# Github Flavored Markdown Server (GFMS)

### News

* All rendering is done offline by [Marked](https://github.com/chjj/marked), which is great GFM markdown parser
* Uses [Highlight](http://highlightjs.org/) to use syntax highlight of source codes. 
  * You can even direct link to source code files (just Javascript, PHP, Python and SQL, for now).
* Removed WS-RPC dependencies, file monitoring and auto-rendering changed files
* Introduced *Export to _PDF_* feature using [PhantomJS](http://phantomjs.org/)

## Usage

```bash
git clone https://github.com/pawel-wiejacha/gfms.git
cd gfms
npm install
cd your-github-project-dir
gfms-dir/bin/gfms -p 1234
```
Now browse to `http://localhost:1234`, and select the `.md` or `.markdown` file to view.

**To get nice PDF just append `?pdf` suffix to to document URL (for example `http://localhost:1234/Readme.md?pdf`)**

(If you don't know how to install NPM, see here: http://npmjs.org/)

## License
(The MIT License)

Copyright (c) 2012 Juraj Vitko (http://ypocat.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
