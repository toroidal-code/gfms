
var laeh = require('laeh2').leanStacks(true);
var _e = laeh._e;
var _x = laeh._x;

var express = require('express');
var stylus = require('stylus');
var nib = require('nib');
var app = express();
var http = require('http');
var server = http.createServer(app);
var marked = require('marked');
var highlight = require('highlight.js');
var _ = require('underscore');
var fs = require('fs');
var ews = require('ws');
var ws = require('ws-rpc').extend(ews);
var wss = new ws.Server({ server: server });
var utilz = require('utilz');
var optimist = require('optimist');

var watched = {};

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

var pub = __dirname + '/public';
var views = __dirname + '/views';
app.set('views', views);
app.set('view engine', 'jade');
app.set('view options', { layout: false });


if(process.env.NODE_ENV === 'development') {
    // only use Stylus in development, because when gfms is installed
    // globally with sudo, and then run by an user, it cannot create
    // the generate .css files (and I'm too tired to look for a solution now).
    app.use(stylus.middleware({
        src: views,
        dest: pub,
        compile: function(str, path) {
            return stylus(str)
                .set('filename', path)
                .set('compress', true)
                .use(nib())
                .import('nib');
        }
    }));
}

app.use(wss.middleware(express));
app.use(express.static(pub));


function basename(fn) {
    var m = fn.match(/.*?([^\/]+)\/?$/);
    return m ? m[1] : fn;
}

function is_markdown(v) {
    return v.match(/.*?(?:\.md|\.markdown)$/) ? true : false;
}

function is_image(v) {
    return v.match(/.*?(?:\.png|\.jpg|\.gif|\.svg)$/) ? true : false;
}

function is_sourcecode(v) {
    var matched = v.match(/.*?(?:(\.js|\.php|\.php5|\.py|\.sql))$/, 'i');

    if (matched) {
        return matched[1].substring(1).toLowerCase();
    }

    return false;
}

app.get('*', function(req, res, next) {
    
    if(req.path.indexOf('/styles/') === 0) {
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
        
        var files = _.chain(fs.readdirSync(dir)).filter(function(v) {
            var stat = fs.statSync(dir + '/' + v);
            return stat.isDirectory() || (stat.isFile() && (is_markdown(v) || is_image(v)));
        }).map(function(v) {
            return {
                url: base + '/' + v,
                name: v
            };
        }).value();
        
        res.render('directory', {
            files: files,
            dir: dir,
            styles: [],
            title: basename(dir)
        });
    } else if(query.raw === "true") {
        var content = fs.readFileSync(dir);
        res.writeHead('200');
        res.end(content,'binary');
    } else if(is_markdown(dir)) {
        
        if(!watched[dir]) {
            fs.watchFile(dir, { interval: 500 }, function(curr, prev) {
                if(curr.mtime.getTime() !== prev.mtime.getTime()) {

                    console.log('file ' + dir + ' has changed');
                    
                    renderFile(dir, _x(console.log, false, function(err, rendered) {
                        wss.message('update', { update: dir, content: err || rendered });
                    }));
                }
            });
            watched[dir] = true;
        }
        
        renderFile(dir, _x(next, true, function(err, rendered) {
            res.render('file', {
                file: rendered,
                title: basename(dir),
                styles: [],
                fullname: dir
            });
        }));
        
    }
    else if(is_image(dir)) {

        if(!watched[dir]) {
            fs.watchFile(dir, { interval: 500 }, function(curr, prev) {
                if(curr.mtime.getTime() !== prev.mtime.getTime()) {

                    console.log('file ' + dir + ' has changed');

                    renderImageFile(base, argv.a, _x(console.log, false, function(err, rendered) {
                        wss.message('update', { update: dir, content: err || rendered });
                    }));
                }
            });
            watched[dir] = true;
        }

        renderImageFile(base, argv.a || argv.b, _x(next, true, function(err, rendered) {
            res.render('file', {
                file: rendered,
                title: basename(dir),
                styles: [],
                fullname: dir
            });
        }));

    }
    else if(lang = is_sourcecode(dir)) {
        if(!watched[dir]) {
            fs.watchFile(dir, { interval: 500 }, function(curr, prev) {
                if(curr.mtime.getTime() !== prev.mtime.getTime()) {

                    console.log('file ' + dir + ' has changed');
                    
                    renderSourceCode(dir, argv.a, lang, _x(console.log, false, function(err, rendered) {
                        wss.message('update', { update: dir, content: err || rendered });
                    }));
                }
            });
            watched[dir] = true;
        }
        
        renderSourceCode(dir, argv.a || argv.b, lang, _x(next, true, function(err, rendered) {
            res.render('file', {
                file: rendered,
                title: basename(dir),
                styles: [],
                fullname: dir
            });
        }));        
    }
    else
        return next();
});

function renderFile(file, cb) { // cb(err, res)
    var contents = fs.readFileSync(file, 'utf8');
    var func = renderWithMarked;
    func(contents, _x(cb, true, cb));
}

function renderImageFile(file, api, cb) { // cb(err, res)
    var html = '<div class="image js-image"><span class="border-wrap"><img src="' + file + '?raw=true"></span></div>';
    cb(null, html);
}

function renderSourceCode(file, api, lang, cb) { // cb(err, res)
    var contents = "```" + lang + "\n" + fs.readFileSync(file, 'utf8') + "\n```";
    var func = api ? renderWithGithub : renderWithMarked;
    func(contents, _x(cb, true, cb));
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
            return highlight.highlightAuto(code).value;
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
        console.log('GFMS ' + pkgJson.version + ' serving ' + process.cwd() + ' at http://' + argv.h + ':' + argv.p + '/ - press CTRL+C to exit.');
})();
