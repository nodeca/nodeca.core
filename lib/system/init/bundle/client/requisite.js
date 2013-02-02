// utility to process `require('./file')` and build bundled files of client tree
//


'use strict';


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var ejs           = require('ejs');
var findRequires  = require('find-requires');


////////////////////////////////////////////////////////////////////////////////


var TEMPLATE = fs.readFileSync(__dirname + '/template/requisite.js.ejs', 'utf8');


////////////////////////////////////////////////////////////////////////////////


function Requisite() {
  this.requires = {};
  this.idx      = 1;
}


Requisite.prototype.process = function (source, pathname) {
  var base = path.dirname(pathname.toString());

  findRequires(source, { raw: true }).forEach(function (info) {
    var requiredPath = info.value;

    if (!requiredPath) {
      throw new Error("Can't resolve required path " + JSON.stringify(info.raw) +
                      " in " + pathname + ":" + info.line);
    }

    try {
      if ('.' === requiredPath[0]) {
        // resolve relative pathname (prepend basepath)
        requiredPath = path.resolve(base, requiredPath);
      }

      requiredPath = require.resolve(requiredPath);
    } catch (err) {
      throw new Error("Can't resolve required path " + JSON.stringify(info.raw) +
                      " in " + pathname + ":" + info.line);
    }

    if (undefined === this.requires[requiredPath]) {
      // prevent from "cyclic" loops
      this.requires[requiredPath] = {
        idx:      this.idx++,
        apiPath:  pathname.apiPath,
        source:   null
      };

      this.requires[requiredPath].source =
        this.process(fs.readFileSync(requiredPath, 'utf8'), requiredPath);
    }

    source = source.replace(info.value, this.requires[requiredPath].idx);
  }, this);

  return source;
};


Requisite.prototype.bundle = function () {
  return ejs.render(TEMPLATE, this);
};


////////////////////////////////////////////////////////////////////////////////


module.exports = Requisite;
