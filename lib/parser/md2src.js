'use strict';

var remarked = require('remarked');


function escape(html) {
  return String(html)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


///////////////////////////////////////////////////////////////////////////////
// remarked.Lexer customization
//
function CustomLexer (options) {
  remarked.Lexer.call(this, options);
  this.rules.spoiler = /^ *`{3,} *spoiler *(.*?) *\n([\s\S]+?)\s`{3,} *(?:\n+|$)/;
  this.rules.cut = /^ *\{% *cut *(.*?) *%\}(?:\n+|$)/;
}


CustomLexer.prototype = Object.create(remarked.Lexer.prototype);


// Parse markdown (src) to tokens.
//
// This function is copy of original 'token' with modifications.
// Original function located here:
// node_modules/remarked/lib/lexer-block.js
//
// All modifications marked by '// Modification:'
//
CustomLexer.prototype.token = function (src, top, bq) {
  /*eslint-disable*/

  src = src.replace(/^ +$/gm, '');

  var b, bull, cap, i, item, l, loose, next, space;

  while (src) {
    // newline
    if (cap = this.rules.newline.exec(src)) {
      src = src.substring(cap[0].length);
      if (cap[0].length > 1) {
        this.tokens.push({
          type: 'space'
        });
      }
    }

    /*eslint-enable*/

    // Modification: added spoiler
    if ((cap = this.rules.spoiler.exec(src)) !== null) {
      src = src.substring(cap[0].length);

      this.tokens.push({
        type: 'spoiler_start',
        title: cap[1]
      });

      // Pass `top` to keep the current "toplevel" state.
      // This is exactly how markdown.pl works.
      this.token(cap[2], top, true);
      this.tokens.push({
        type: 'spoiler_end'
      });
      continue;
    }

    // Modification: added cut
    if ((cap = this.rules.cut.exec(src)) !== null) {
      src = src.substring(cap[0].length);

      this.tokens.push({
        type: 'cut',
        text: cap[1]
      });

      continue;
    }

    /*eslint-disable*/

    // code
    if (cap = this.rules.code.exec(src)) {
      src = src.substring(cap[0].length);
      cap = cap[0].replace(/^ {4}/gm, '');
      this.tokens.push({
        type: 'code',
        text: !this._options.pedantic
          ? cap.replace(/\n+$/, '')
          : cap
      });
      continue;
    }

    // fences (gfm)
    if (cap = this.rules.fences.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'code',
        lang: cap[2],
        text: cap[3]
      });
      continue;
    }

    // heading
    if (cap = this.rules.heading.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'heading',
        depth: cap[1].length,
        text: cap[2]
      });
      continue;
    }

    // table no leading pipe (gfm)
    if (top && (cap = this.rules.nptable.exec(src))) {
      src = src.substring(cap[0].length);

      item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/\n$/, '').split('\n')
      };
      for (i = 0; i < item.align.length; i += 1) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right';
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center';
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left';
        } else {
          item.align[i] = null;
        }
      }
      for (i = 0; i < item.cells.length; i += 1) {
        item.cells[i] = item.cells[i].split(/ *\| */);
      }

      this.tokens.push(item);
      continue;
    }

    // lheading
    if (cap = this.rules.lheading.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'heading',
        depth: cap[2] === '=' ? 1 : 2,
        text: cap[1]
      });
      continue;
    }

    // hr
    if (cap = this.rules.hr.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'hr'
      });
      continue;
    }

    // blockquote
    if (cap = this.rules.blockquote.exec(src)) {
      src = src.substring(cap[0].length);

      this.tokens.push({
        type: 'blockquote_start'
      });

      cap = cap[0].replace(/^ *> ?/gm, '');

      // Pass `top` to keep the current "toplevel" state.
      // This is exactly how markdown.pl works.
      this.token(cap, top, true);
      this.tokens.push({
        type: 'blockquote_end'
      });
      continue;
    }

    // list
    if (cap = this.rules.list.exec(src)) {
      src = src.substring(cap[0].length);
      bull = cap[2];
      this.tokens.push({
        type: 'list_start',
        ordered: bull.length > 1
      });

      // Get each top-level item.
      cap = cap[0].match(this.rules.item);
      next = false;
      l = cap.length;
      i = 0;
      for (; i < l; i += 1) {
        item = cap[i];

        // Remove the list item's bullet
        // so it is seen as the next token.
        space = item.length;
        item = item.replace(/^ *([*+-]|\d+\.) +/, '');

        // Outdent whatever the list item contains. Hacky.
        if (~item.indexOf('\n ')) {
          space -= item.length;
          item = !this._options.pedantic
            ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
            : item.replace(/^ {1,4}/gm, '');
        }

        // Determine whether the next list item belongs here.
        // Backpedal if it does not belong in this list.
        if (this._options.smartLists && i !== l - 1) {

          // Modification:
          // Original code: b = block.bullet.exec(cap[i + 1])[0];
          // 'block' is unreachable here,
          // but 'remarked.Lexer.rules' is link to 'block'
          b = remarked.Lexer.rules.bullet.exec(cap[i + 1])[0];

          if (bull !== b && !(bull.length > 1 && b.length > 1)) {
            src = cap.slice(i + 1).join('\n') + src;
            i = l - 1;
          }
        }

        var looseRe = function (item, opts) {
          var re = /\n\n(?!\s*$)/;
          // Use discount behavior.
          if (opts.discountItems) {
            re = /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/;
          }
          return re.test(item);
        };

        // Determine whether item is loose or not.
        loose = next || looseRe(item, this._options);

        if (i !== l - 1) {
          next = item.charAt(item.length - 1) === '\n';
          if (!loose) {
            loose = next;
          }
        }

        this.tokens.push({
          type: loose ? 'loose_item_start' : 'list_item_start'
        });

        // Recurse.
        this.token(item, false, bq);
        this.tokens.push({
          type: 'list_item_end'
        });
      }

      this.tokens.push({
        type: 'list_end'
      });
      continue;
    }

    // html
    if (cap = this.rules.html.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: this._options.sanitize
          ? 'paragraph'
          : 'html',
        pre: cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style',
        text: cap[0]
      });
      continue;
    }

    // def
    if (!bq && top && (cap = this.rules.def.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.links[cap[1].toLowerCase()] = {
        href: cap[2],
        title: cap[3]
      };
      continue;
    }

    // table (gfm)
    if (top && (cap = this.rules.table.exec(src))) {
      src = src.substring(cap[0].length);
      item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/(?: *\| *)?\n$/, '').split('\n')
      };
      for (i = 0; i < item.align.length; i += 1) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right';
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center';
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left';
        } else {
          item.align[i] = null;
        }
      }
      for (i = 0; i < item.cells.length; i += 1) {
        item.cells[i] = item.cells[i]
          .replace(/^ *\| *| *\| *$/g, '')
          .split(/ *\| */);
      }
      this.tokens.push(item);
      continue;
    }

    // top-level paragraph
    if (top && (cap = this.rules.paragraph.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'paragraph',
        text: cap[1].charAt(cap[1].length - 1) === '\n'
          ? cap[1].slice(0, -1)
          : cap[1]
      });
      continue;
    }

    // text
    if (cap = this.rules.text.exec(src)) {

      // Top-level should never reach here.
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'text',
        text: cap[0]
      });
      continue;
    }
    if (src) {
      throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
    }
  }
  return this.tokens;

  /*eslint-enable*/
};


///////////////////////////////////////////////////////////////////////////////
// remarked.Parser customization
//
function CustomParser (options) {
  remarked.Parser.call(this, options);
}


CustomParser.prototype = Object.create(remarked.Parser.prototype);


CustomParser.prototype.tok = function () {
  var body, header;

  switch (this.token.type) {

    case 'spoiler_start':
      header = this.token.title || '';
      body = '';
      while (this.next().type !== 'spoiler_end') {
        body += this.tok();
      }
      return this.renderer.spoiler(header, body);

    case 'cut':
      return this.renderer.cut(this.token.text || '');
    default:
      return remarked.Parser.prototype.tok.call(this);
  }
};


///////////////////////////////////////////////////////////////////////////////
// remarked.Renderer customization
//
function CustomRenderer (options) {
  remarked.Parser.call(this, options);
}


CustomRenderer.prototype = Object.create(remarked.Renderer.prototype);


CustomRenderer.prototype.spoiler = function (header, body) {
  return '<spoiler title="' + escape(header) + '">' + body + '</spoiler>\n';
};


CustomRenderer.prototype.cut = function (text) {
  return '<cut>' + escape(text) + '</cut>\n';
};


module.exports = function (data, callback) {
  remarked.setOptions({
    gfm: false,
    tables: false,
    breaks: false,
    pedantic: false,
    sanitize: true,
    smartLists: true,
    smartypants: false,
    renderer: new CustomRenderer()
  });

  var lexer = new CustomLexer(remarked.defaults);
  var parser = new CustomParser(remarked.defaults);
  var tokens = lexer.lex(data.input);

  data.output = parser.parse(tokens);

  callback();
};
