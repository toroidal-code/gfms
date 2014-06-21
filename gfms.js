
var laeh = require('laeh2').leanStacks(true);
var _e = laeh._e;
var _x = laeh._x;

var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var marked = require('marked');
var highlight = require('highlight.js');
var _ = require('underscore');
var fs = require('fs');
var utilz = require('utilz');
var optimist = require('optimist');
var tmp = require('temporary');

var phantom_sync = require('phantom-sync')
var phantom = phantom_sync.phantom
var sync = phantom_sync.sync

var pkgJson = require('./package.json');

function cb(err, msg) {
    console.log(err ? (err.stack || err) : msg || 'done');
}

var argv = optimist
    .usage('\nGithub Flavored Markdown Server.\nRun in your project\'s root directory.\nUsage: $0')
    .demand('p')
    .alias('p', 'port')
    .describe('p', 'Port number to listen at.')
    .alias('h', 'host')
    .describe('h', 'Host address to bind to.')
    .default('h', 'localhost')
    .describe('proxy', 'if behind a proxy, proxy url.')
    .argv;

var rootUrl = 'http://' + argv.h + ':' + argv.p + '/'

var pub = __dirname + '/public';
var views = __dirname + '/views';
app.set('views', views);
app.set('view engine', 'jade');
app.set('view options', { layout: false });

app.use(express.static(pub));


function basename(fn) {
    var m = fn.match(/.*?([^\/]+)\/?$/);
    return m ? m[1] : fn;
}

function is_markdown(v) {
    return v.match(/.*?(?:\.md|\.markdown)$/) ? true : false;
}

function is_image(v) {
    return v.match(/.*?(?:\.png|\.jpg|\.gif|\.svg\|jpeg)$/) ? true : false;
}

function is_sourcecode(v) {
    var matched = v.match(/.*?(?:(\.js|\.php|\.php5|\.py|\.sql))$/, 'i');

    if (matched) {
        return matched[1].substring(1).toLowerCase();
    }

    return false;
}

app.get('*', function(req, res, next) {

    if ('pdf' in req.query) {
        var urlToRender = rootUrl + req.path + '?printerFriendly'

        var tmpFileBase = new tmp.File()
        var tmpFilePdfPath = tmpFileBase + '.pdf'

        sync(function() {
            var ph = phantom.create()
            var page = ph.createPage()
            page.set("paperSize", { format: "A4", orientation: 'portrait', margin: '0.6cm' });
            page.viewPortSize = { width: 1366, height: 768 };
            page.open(urlToRender)

            page.render(tmpFilePdfPath)

            var pdfFileContents = fs.readFileSync(tmpFilePdfPath)
            tmpFileBase.unlink()
            fs.unlink(tmpFilePdfPath)

            ph.exit();
            res.send(200, pdfFileContents);
        })

        res.set('Content-Type', 'application/pdf');
        return 
    }


    var styles = ('printerFriendly' in req.query) ? ['/print.css'] : []
    
    if (req.path.indexOf('/styles/') === 0) {
        var style = styles[req.path];
        if(!style) {
            res.send(404);
        }
        else {
            res.set('Content-Type', 'text/css');
            // res.set('ETag', utilz.randomString());
            return res.send(200, style);
        }
    }

    var base = req.path.replace('..', 'DENIED').replace(/\/$/, '');
    var query = req.query || {};
    var dir = decodeURI(process.cwd() + base);
    var lang = "";
    
    var stat;
    try {
        stat = fs.statSync(dir);
    }
    catch(e) {
        return next();
    }
    
    if(stat.isDirectory()) {
        renderDir(base, dir, styles, res)
    } else if(is_markdown(dir)) {
        renderFile(dir, _x(next, true, function(err, rendered) {
            res.render('file', {
                file: rendered,
                title: basename(dir),
                styles: styles,
                fullname: dir
            });
        }));
    }
    else if (query.raw === "true") { // displaying raw content: images, etc.
        var content = fs.readFileSync(dir);
        res.writeHead('200');
        res.end(content,'binary');
    }
    else if(is_image(dir)) {
        renderImageFile(base, _x(next, true, function(err, rendered) {
            res.render('file', {
                file: rendered,
                title: basename(dir),
                styles: styles,
                fullname: dir
            });
        }));

    }
    else if(lang = is_sourcecode(dir)) {
        renderSourceCode(dir, lang, _x(next, true, function(err, rendered) {
            res.render('file', {
                file: rendered,
                title: basename(dir),
                styles: styles,
                fullname: dir
            });
        }));        
    }

    else
        return next();
});

function renderDir(base, dir, styles, res) {
    // stat
    var files = _.chain(fs.readdirSync(dir)).map(function(v) { 
        return { name: v, stat: fs.statSync(dir + '/' + v) }
    })

    // show only docs
    files = files.filter(function(fileDesc) {
        return fileDesc.stat.isDirectory() || (fileDesc.stat.isFile() && (is_markdown(fileDesc.name) || is_image(fileDesc.name)));
    })

    // sort
    files = files.sortBy(function(entry) { return !entry.stat.isDirectory() })

    // prepare file list for jade template
    files = files.map(function(fileDesc) {
        return {
            url: base + '/' + fileDesc.name,
            name: fileDesc.name,
            type: fileDesc.stat.isDirectory() ? 'directory' : (is_image(fileDesc.name) ? 'media' : 'text')
        };
    })

    files = files.value();
    // add parent directory
    if (base.length > '/'.length) {
        files.unshift({
            url: base.slice(0, base.lastIndexOf('/')) || '/',
            name: '..',
            type: 'directory'
        })
    }
   
    res.render('directory', {
        files: files,
        dir: dir,
        baseDir: base ? base : '/',
        styles: styles,
        title: basename(dir)
    });
}

function renderFile(file, cb) { // cb(err, res)
    var contents = fs.readFileSync(file, 'utf8');
    renderWithMarked(contents, _x(cb, true, cb));
}

function renderImageFile(file, cb) { // cb(err, res)
    var html = '<div class="image js-image"><span class="border-wrap"><img src="' + file + '?raw=true"></span></div>';
    cb(null, html);
}

function renderSourceCode(file, lang, cb) { // cb(err, res)
    var contents = "```" + lang + "\n" + fs.readFileSync(file, 'utf8') + "\n```";
    renderWithMarked(contents, _x(cb, true, cb));
}

function renderWithMarked(contents, cb) { // cb(err, res)
    marked.setOptions({
      gfm: true,
      tables: true,
      smartLists: true,
      breaks: true,
      highlight: function (code, lang) {
        if (lang) {
            return highlight.highlight(lang, code, true).value;
        } else {
            code
        }
      }
    });

    var html = marked(contents);

    cb(null, html);
}

process.on('SIGINT', function() {
    console.log('\nGFMS exit.');
    return process.exit();
});


_x(cb, false, function() {
        server.listen(argv.p, argv.h);
        console.log('GFMS ' + pkgJson.version + ' serving ' + process.cwd() + ' at ' + rootUrl + ' - press CTRL+C to exit.');
})();
