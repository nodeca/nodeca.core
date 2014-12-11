// Parser class.
//

'use strict';

var Wire     = require('./../system/wire');
var html2ast = require('./html2ast');
var src2ast  = require('./src2ast');
var md2src   = require('./md2src');
var src2md   = require('./src2md');

function Parser(N) {
  this.bus = new Wire();

  this.bus.on('html2ast', html2ast);
  this.bus.on('src2ast', src2ast(N));
  this.bus.on('md2src', md2src);
  this.bus.on('src2md', src2md);
}


// Parse SRC HTML (input format) to AST
//
// data
//  - input   (String) SRC HTML
//  - output  (Object) AST
//    - .html() - render HTML
//    - .text() - render plain text
//  - options (Object) parsing params
//
Parser.prototype.src2ast = function (data, callback) {
  this.bus.emit('src2ast', data, callback);
};


// Parse HTML (display format) to AST
//
// data
//  - input   (String) HTML
//  - output  (Object) AST
//    - .html() - render HTML
//    - .text() - render plain text
//  - options (Object) parsing params
//
Parser.prototype.html2ast = function (data, callback) {
  this.bus.emit('html2ast', data, callback);
};


// Parse markdown to SRC HTML (input format)
//
// data
//  - input   (String) markdown
//  - output  (String) SRC HTML
//  - options (Object) parsing params
//
Parser.prototype.md2src = function (data, callback) {
  this.bus.emit('md2src', data, callback);
};


// Parse SRC HTML to markdown
//
// data
//  - input   (String) SRC HTML
//  - output  (String) markdown
//  - options (Object) parsing params
//
Parser.prototype.src2md = function (data, callback) {
  this.bus.emit('src2md', data, callback);
};


module.exports = Parser;
