'use strict';

var $ = require('./cheequery');


///////////////////////////////////////////////////////////////////////////////
// Tags handlers
//

function header($node, nodeContent) {
  var result = '';

  var level = parseInt($node.prop('tagName').substr(1), 10);

  for (var i = 0; i < level; i++) {
    result += '#';
  }

  result += ' ' + nodeContent + '\n\n';

  return result;
}

function spoiler($node, nodeContent) {
  return '``` spoiler ' + ($node.attr('title') || '') + '\n' + nodeContent + '```\n\n';
}

function hr() {
  return '* * *\n\n';
}

function cut($node, nodeContent) {
  return '{% cut ' + nodeContent + ' %}\n\n';
}

function br() {
  return '\n';
}

function link($node, nodeContent) {
  return '[' + nodeContent + '](' + ($node.attr('href') || '') + ')';
}

function image($node) {
  var result = '![' + ($node.attr('alt') || '') + '](' + $node.attr('src');

  if ($node.attr('title')) {
    result += ' "' + $node.attr('title') + '"';
  }

  return result + ')';
}

function paragraph($node, nodeContent) {
  var result = nodeContent;

  if (result === '') {
    return '';
  }

  return result + '\n\n';
}

function underline($node, nodeContent) {
  return '-' + nodeContent + '-';
}

function strike($node, nodeContent) {
  return '--' + nodeContent + '--';
}

function bold($node, nodeContent) {
  return '__' + nodeContent + '__';
}

function italic($node, nodeContent) {
  return '_' + nodeContent + '_';
}

function list($node, nodeContent, $parent) {
  var result = nodeContent;

  if (
      $parent.prop('tagName') === 'LI' &&
      $node.index() === 0 && // index doesn't include text nodes
      $($parent.contents()[0]).prop('tagName') === undefined
     ) {
    result = '\n' + result;
  }

  return result + '\n';
}

function listItem($node, nodeContent, $parent) {
  // порезать ентеры на конце

  var result = nodeContent;

  // remove all \n after the last line
  result = result.replace(/\n+$/g, '');

  if ($parent.prop('tagName') === 'UL') {
    // Shift all lines 2 spaces
    result = result.replace(/^(.*$)/gm, '  $1');
    // Add '-' before line start
    result = '-' + result.substr(1);

  } else {
    // Shift all lines 3 spaces
    result = result.replace(/^(.*$)/gm, '   $1');
    // Add '1.', '2.', ... before line start
    result = ($node.index() + 1) + '.' + result.substr(2);
  }

  return result + '\n';
}

function blockquote($node, nodeContent) {
  return nodeContent
    .replace(/\n+$/g, '') // remove all \n after the last line
    .replace(/^(.*)$/gm, '> $1')
    .replace(/^> $/gm, '>') // remove extra space
    + '\n\n';
}

function text($node, nodeContent) {
  // TODO: Remove after src2ast fix

  // Temporary fix to strip garbage
  if (nodeContent === '\n') {
    return '';
  }

  return nodeContent;
}


///////////////////////////////////////////////////////////////////////////////
// Src2md class
//
function Src2md() {
  this.tagsHandlers = {
    h1: header,
    h2: header,
    h3: header,
    h4: header,
    h5: header,
    h6: header,

    spoiler: spoiler,
    hr: hr,
    br: br,
    cut: cut,
    a: link,
    img: image,
    p: paragraph,
    u: underline,

    strike: strike,
    s: strike,

    strong: bold,
    b: bold,

    em: italic,
    italic: italic,

    ul: list,
    ol: list,

    li: listItem,
    blockquote: blockquote,
    text: text
  };
}


// Parse SRC HTML to markdown
//
Src2md.prototype.parse = function (src) {
  return this.node2md($.parse(src));
};


// Walk through all nodes and compile it to markdown
//
Src2md.prototype.node2md = function($node) {
  var $child, tagName, i, l;

  var output = '';
  var children = $node.contents();

  for (i = 0, l = children.length; i < l; i++) {
    $child = $(children[i]);

    // Text node has tagName 'undefined'
    tagName = ($child.prop('tagName') || 'text').toLowerCase();

    if (this.tagsHandlers.hasOwnProperty(tagName) && this.tagsHandlers[tagName] !== null) {
      output += this.tagsHandlers[tagName]($child, (tagName === 'text' ? $child.text() : this.node2md($child)), $node);
    }
  }

  return output;
};


module.exports = function (data, callback) {
  var src2md = new Src2md();

  src2md.options = data.options;
  data.output = src2md.parse(data.input);

  callback();
};
