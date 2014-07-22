// Parser class
//
// data
//  - input   (String) HTML or SRC HTML
//  - output  (String) AST
//    - .html() - render HTML
//    - .text() - render plain text
//  - options (Object) parsing params
//

'use strict';

var Wire     = require('./../system/wire');
var html2ast = require('./html2ast');
var src2ast  = require('./src2ast');

function Parser() {
  this.bus = new Wire();

  this.bus.on('html2ast', html2ast);
  this.bus.on('src2ast', src2ast);
}


Parser.prototype.src2ast = function (data, callback) {
  this.bus.emit('src2ast', data, callback);
};


Parser.prototype.html2ast = function (data, callback) {
  this.bus.emit('html2ast', data, callback);
};


module.exports = Parser;


/*

function PrepareHTML(cleanupRules, smiles, medialinks) {
  this.cleanupRules = this._prepareRules(cleanupRules);
  this.smiles = this._prepareSmiles(smiles);
  this.medialinks = medialinks;
}

// TODO: ADD PLAIN TEXT RESULT!!!


// Parse HTML to DOM tree
//
// - srcHTML (String) - HTML text
// - callback - function (err)
//
PrepareHTML.prototype.parse = function (srcHTML, callback) {
  var self = this;

  // Convert links in text to tag

  srcHTML = srcHTML.replace(/([^"'>]|p>)(https?:\/\/[^\s"'<]+)/gim, '$1<a href="$2"></a>');

  var handler = new htmlParser.DomHandler(function (err, dom) {
    if (err) {
      callback.call(self, err);
      return;
    }

    self.dom = dom;
    callback.call(self);
  });

  var parser = new htmlParser.Parser(handler);
  parser.write(srcHTML);
  parser.done();
};


PrepareHTML.prototype.apply = function (callback) {
  this.dom = this._cleanup();

  this._render(null, callback);
};


PrepareHTML.prototype._prepareSmiles = function (smilesConfig) {
  var smiles = _.cloneDeep(smilesConfig);

  _.forEach(smiles, function (val, name) {
    if (!_.isArray(val)) {
      val = [ val ];
    }

    for (var i = 0; i < val.length; i++) {
      val[i] = val[i].replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    }

    smiles[name] = new RegExp('(' + val.join('|') + ')', 'g');
  });

  return smiles;
};


PrepareHTML.prototype._prepareRules = function (cleanupRules) {
  var rules = _.cloneDeep(cleanupRules);
  var regExpParse = /^\/(.*?)\/(g?i?m?y?)$/;

  var groups = {};
  var all = Object.keys(rules);

  // Extract groups
  _.forEach(rules, function (rule, tag) {
    if (rule.group) {
      groups[rule.group] = groups[rule.group] || [];
      groups[rule.group].push(tag);
    }
  });

  _.forEach(rules, function (rule) {

    // Prepare attributes
    var attributes = {};

    if (_.isPlainObject(rule.attributes)) {
      var attrs = [];
      _.forEach(rule.attributes, function (val, attr) {
        var attrObj = {};
        attrObj[attr] = val;
        attrs.push(attrObj);
      });
      rule.attributes = attrs;
    }

    if (_.isString(rule.attributes)) {
      rule.attributes = [ rule.attributes ];
    }

    _.forEach(rule.attributes || [], function (val) {
      var attr;
      if (_.isObject(val)) {
        attr = Object.keys(val)[0];
        val = val[attr];
      } else {
        attr = val;
        val = '.*';
      }

      // If val is regexp
      if (val.length > 0 && val[0] === '/') {
        attributes[attr] = new RegExp(
          val.replace(regExpParse, '$1'),
          val.replace(regExpParse, '$2')
        );
        return;
      }

      // If val is enum
      if (_.isArray(val)) {
        val = val.join('|');
      }

      attributes[attr] = new RegExp('^' + val + '$');
    });

    rule.attributes = attributes;

    // Prepare children
    var children = [];

    rule.children = rule.children || [];
    rule.children = _.isArray(rule.children) ? rule.children : [ rule.children ];

    _.forEach(rule.children, function (val) {
      var add = true;
      if (val.length > 0 && val[0] === '!') {
        add = false;
        val = val.substr(1);
      }

      if (val === '*') {

        if (add) {
          children = _.union(children, all);
        } else {
          children = _.difference(children, all);
        }
        return;
      }

      if (val.length > 6 && val.substr(0, 6) === 'group-') {

        if (add) {
          children = _.union(children, groups[val.substr(6)] || []);
        } else {
          children = _.difference(children, groups[val.substr(6)] || []);
        }
        return;
      }

      if (all.indexOf(val) !== -1 || val === 'text') {

        if (add) {
          children = _.union(children, [ val ]);
        } else {
          children = _.difference(children, [ val ]);
        }
        return;
      }
    });

    rule.children = children;
  });

  return rules;
};


PrepareHTML.prototype._cleanupAttrs = function (tagName, attrs) {
  var result = {};
  var tagRules = this.cleanupRules[tagName];

  _.forEach(attrs || {}, function (val, attr) {
    if (tagRules.attributes[attr] && tagRules.attributes[attr].test(val)) {
      result[attr] = val;
    }
  });

  return result;
};


PrepareHTML.prototype._cleanupTags = function (parent, tags) {
  var rules = this.cleanupRules;
  var length = tags.length;

  for (var i = 0; i < length; i++) {

    var node = tags[i];
    var tagName = node.name || node.type;

    // If tag can't be on this level - remove it without removing children
    if (!rules[parent] || rules[parent].children.indexOf(node.name || node.type) === -1) {
      tags.splice(i, 1); // remove item

      node.children = node.children || [];
      if (tagName === 'text' && parent === 'root' && node.data.replace(/\r|\n/g, '').length > 0) {
        node.children.unshift({ type: 'tag', name: 'p', attribs: {}, children: [ node ] });
      }

      // Insert children to current position
      tags = tags
        .slice(0, i)
        .concat(node.children)
        .concat(tags.slice(i));

      length = tags.length;
      i -= 1;

      continue;
    }

    node.attribs = this._cleanupAttrs(tagName, node.attribs);
  }

  return tags;
};


PrepareHTML.prototype._cleanup = function (parent, tags) {
  if (!parent) {
    parent = 'root';
  }

  if (!tags) {
    tags = this.dom;
  }

  tags = this._cleanupTags(parent, tags);

  for (var i = 0; i < tags.length; i++) {
    tags[i].children = this._cleanup(tags[i].name || tags[i].type, tags[i].children || []);
  }

  return tags;
};


PrepareHTML.prototype._renderAttrsString = function (attrs) {
  var attrString = _.map(attrs || {}, function (val, attr) {
    return attr + '="' + val + '"';
  }).join(' ');

  if (attrString.length > 0) {
    attrString = ' ' + attrString;
  }

  return attrString;
};


PrepareHTML.prototype._renderSmiles = function (text) {
  _.forEach(this.smiles, function (regExp, name) {
    text = text.replace(
      regExp,
      '<span data-nd-type="smile" data-nd-id="' + name + '" data-nd-src="$&" class="smiles smile_' + name + '"></span>'
    );
  });

  return text;
};


PrepareHTML.prototype._renderLink = function (tag, callback) {
  var href = tag.attribs.href || '';

  if ((tag.children || []).length > 0) {
    var html = '<a class="outer-link" href="' + href +  '">';
    this._render(tag.children || [], function (data) {
      html += data.html + '</a>';
      callback({ html: html, text: href + ' ' + data.text });
    });
    return;
  }

  var plainLink = '<a class="outer-link" href="' + href + '" data-nd-automatic-title="true">' + href.substr(0, 30);
  if (href.length > 30) {
    plainLink += '...';
  }
  plainLink += '</a>';

  // Find medialink provider
  var provider = _.find(this.medialinks, function (provider) {
    for (var i = 0; i < provider.match.length; i++) {
      if (provider.match[i].test(href)) {
        return true;
      }
    }
    return false;
  });

  if (!provider) {
    callback({ html: plainLink, text: href });
    return;
  }

  provider.parse(href, function (err, data) {
    // Skip url on error - url will be parsed as plain link
    if (err) {
      callback({ html: plainLink, text: href });
      return;
    }

    callback({ html: data, text: href });
  });
};


PrepareHTML.prototype._render = function (tags, callback) {
  var html = '';
  var plainText = '';

  if (!tags) {
    tags = this.dom;
  }

  var self = this;

  async.eachSeries(tags, function(tag, next) {

    if (tag.name === 'a') {
      self._renderLink(tag, function (data) {
        plainText += data.text;
        html += data.html;
        next();
      });
      return;
    }

    if (tag.type === 'text') {
      plainText += ' ' + tag.data;
      html += self._renderSmiles(tag.data);
      next();
      return;
    }

    if (tag.name === 'cut') {
      var cutText = [];
      for (var j = 0; j < (tag.children || []).length; j++) {
        cutText.push(tag.children[j].data);
      }

      html += '<!--CUT ' + cutText.join(' ') + '--!>';
      next();
      return;
    }

    if (tag.name === 'spoiler') {
      var title = (tag.attribs || {}).title || '';
      html += '<div data-nd-type="spoiler" data-nd-title="' + title + '">' +
        '<div class="title">' + title + '</div>' +
        '<div class="spoiler-content">';

      self._render(tag.children || [], function (data) {
        plainText += data.text;
        html += data.html + '</div></div>';
        next();
        return;
      });
    }

    html += '<' + tag.name + self._renderAttrsString(tag.attribs) + '>';
    self._render(tag.children || [], function (data) {
      plainText += data.text;
      html += data.html + '</' + tag.name + '>';
      next();
      return;
    });
  }, function () {
    callback.call(self, { html: html, text: plainText });
  });
};


module.exports = PrepareHTML;
*/
