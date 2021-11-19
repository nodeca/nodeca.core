// Convert html into markdown
//

'use strict';


/* eslint-disable-next-line no-redeclare */
const $     = require('nodeca.core/lib/parser/cheequery');


class MarkdownWriter {
  constructor() {
    this.tag_handlers = {};

    Object.assign(this.tag_handlers, {
      a:          this.tag_handler_anchor,
      blockquote: this.tag_handler_blockquote,
      br:         this.tag_handler_line_break,
      code:       this.tag_handler_code,
      div:        this.tag_handler_paragraph,
      em:         this.tag_handler_em,
      h1:         this.tag_handler_heading,
      h2:         this.tag_handler_heading,
      h3:         this.tag_handler_heading,
      h4:         this.tag_handler_heading,
      h5:         this.tag_handler_heading,
      h6:         this.tag_handler_heading,
      hr:         this.tag_handler_hr,
      img:        this.tag_handler_img,
      li:         this.tag_handler_list_item,
      ol:         this.tag_handler_paragraph,
      p:          this.tag_handler_paragraph,
      pre:        this.tag_handler_pre,
      s:          this.tag_handler_del,
      strong:     this.tag_handler_strong,
      sub:        this.tag_handler_sub,
      sup:        this.tag_handler_sup,
      td:         this.tag_handler_td,
      tr:         this.tag_handler_tr,
      ul:         this.tag_handler_paragraph
    });
  }

  tag_handler_del(el)          { return this.format_pair('~~', this.contents(el)); }
  tag_handler_em(el)           { return this.format_pair('_', this.contents(el)); }
  tag_handler_hr()             { return this.format_block('---'); }
  tag_handler_line_break()     { return '\\\n'; }
  tag_handler_strong(el)       { return this.format_pair('__', this.contents(el)); }
  tag_handler_sub(el)          { return this.format_pair('~', this.contents(el)); }
  tag_handler_sup(el)          { return this.format_pair('^', this.contents(el)); }
  tag_handler_default(el)      { return this.contents(el); }
  tag_handler_code(el)         { return this.format_code($(el).text()); }
  tag_handler_tr(el)           { return this.contents(el) + '\n'; }
  tag_handler_td(el)           { return '| ' + this.contents(el) + ' '; }

  tag_handler_heading(el) {
    return this.format_block('#'.repeat(el.tagName[1]) + ' ' + this.contents(el).replace(/#/g, '\\#'));
  }

  tag_handler_blockquote(el) {
    let contents = this.contents(el);
    return this.format_quote(
      contents.startsWith('\n\n') ? contents.slice(2) : this.escape_block(contents),
      $(el).attr('cite')
    );
  }

  tag_handler_list_item(el) {
    let contents = this.contents(el);
    contents = contents.startsWith('\n\n') ? contents.slice(2) : this.escape_block(contents);
    return this.format_block(contents.replace(/^(?!$)/mg, '   ').replace(/^   /, ' - '));
  }

  tag_handler_paragraph(el) {
    let contents = this.contents(el);
    return contents.startsWith('\n\n') ? contents : this.format_block(this.escape_block(contents));
  }

  tag_handler_anchor(el) {
    let $el = $(el);
    if ($el.find('a').length) return this.tag_handler_default(el);

    let dest = $el.attr('href') || '';
    let title = $el.attr('title') || '';

    if ($el.children().length === 0 && $el.text() === dest && dest && !title) {
      if (/^https?:\/\/(?!-)([a-z0-9-]|[a-z0-9]\.[a-z0-9])+(?=[\/?]|$)(?:[a-z0-9]|[\/\-&=?](?:[a-z0-9]|$))*$/i
        .test(dest)) return this.format_linkify(dest);
      if (/^[a-z][a-z0-9+.\-]{1,31}:/.test(dest)) return this.format_autolink(dest);
      return this.format_link(dest, dest);
    }

    return this.format_link(this.contents(el), dest, title);
  }

  tag_handler_img(el) {
    let $el = $(el);
    let text = $el.attr('alt') || '';
    let dest = $el.attr('src') || '';
    let title = $el.attr('title') || '';

    return this.format_image(text, dest, title);
  }

  tag_handler_pre(el) {
    let language = ($(el).attr('class') || '').split(/\s+/)
                     .map(x => x.match(/^language-(.*)$/)).filter(Boolean).map(x => x[1])[0];

    return this.format_fence($(el).text(), language);
  }

  format_pair(markers, text) {
    if (!text) return ''; // empty tags can't be represented in markdown
    return `${markers}${text}${markers}`;
  }

  format_linkify(dest) {
    return dest;
  }

  format_autolink(dest) {
    // eslint-disable-next-line no-control-regex
    return '<' + dest.replace(/[<>\x00-\x20\x7f]/g, encodeURI) + '>';
  }

  format_link(text, dest, title = '') {
    dest = dest.replace(/[\r\n]/g, encodeURI);

    if (!dest && !title) {
      // nothing to do, return []()
      // eslint-disable-next-line no-control-regex
    } else if (!dest || /[<>\s()\x00-\x1f\x7f]/.test(dest)) {
      dest = '<' + dest.replace(/([\\<>])/g, '\\$1') + '>';
    } else {
      dest = dest.replace(/\\/g, '\\\\');
    }

    title = title.replace(/[\r\n]+/g, '\n').replace(/"/g, '\\"');

    return `[${text}](${dest}${title ? ` "${title}"` : ''})`;
  }

  format_image(text, dest, title) {
    return '!' + this.format_link(this.escape_inline(text), dest, title);
  }

  format_quote(text, cite) {
    return this.format_block((cite ? `${cite}\n` : '') + text.replace(/^(>*) ?/mg, '>$1 ')).replace(/^(>+) $/mg, '$1');
  }

  format_code(text) {
    // collapse newlines
    text = text.replace(/(\r\n|\r|\n)+/g, ' ');

    // calculate minimum backtick length for `code`, so it would encapsulate
    // original content (longest backtick sequence plus 1)
    let backtick_sequences = new Set(((text).match(/`+/g) ?? [ '' ]).map(s => s.length)); //`
    let backtick_seq_len = 1;

    while (backtick_sequences.has(backtick_seq_len)) backtick_seq_len++;

    if (/^`|`$/.test(text)) text = ` ${text} `;

    let markers = '`'.repeat(backtick_seq_len);

    return this.format_pair(markers, text);
  }

  // make "```type params" block (code or quote)
  //
  format_fence(text, infostring = '') {
    // calculate minimum backtick length for ````quote, so it would encapsulate
    // original content (longest backtick sequence plus 1, but at least 3)
    let backtick_seq_len = Math.max.apply(
      null,
      ('`` ' + text)
        .match(/`+/g) //`
        .map(s => s.length)
    ) + 1;

    let markers = '`'.repeat(backtick_seq_len);

    // can represent "`" infostring with ~~~ markers, but we don't support it yet
    infostring = String(infostring).replace(/[\r\n`]/g, ''); //`

    return this.format_block(`
${markers}${infostring}
${text.replace(/\n$/, '')}
${markers}
`.replace(/^\n|\n$/g, ''));
  }

  format_block(md) {
    return md.startsWith('\n\n') ? md : ('\n\n' + md);
  }

  // Concatenate many markdown texts into a single document
  //
  // This method is required because we can't safely concatenate two markdown parts
  // (e.g. `*abc**def*` isn't the same as `*abc*` + `*def*`).
  //
  // Texts starting with '\n\n' are considered block tags, the rest are inline.
  //
  concat(texts) {
    let blocks = [];
    let inlines = [];

    for (let text of texts) {
      if (!text.startsWith('\n\n')) {
        inlines.push(text);
        continue;
      }

      if (inlines.length) {
        blocks.push(this.format_block(this.escape_block(this.concat_inline(inlines))));
        inlines = [];
      }
      blocks.push(text);
    }

    if (inlines.length) {
      // all inline tags, join into single inline tag
      if (!blocks.length) return this.concat_inline(inlines);
      blocks.push(this.format_block(this.escape_block(this.concat_inline(inlines))));
    }

    return blocks.filter(block => block.match(/\S/)).join('');
  }

  concat_inline(texts) {
    // This is not implemented (needs object tokens instead of strings):
    // `_em_` + `_em_` == `_em_ _em_`
    // `foo` + `http://` == `foo http://`
    // `http://google.com` + `foo` == `http://google.com foo`
    return texts.join('');
  }

  contents(el) {
    if (!el) return '';

    let texts = [];

    el.childNodes.forEach(child => {
      texts.push(this._write_node(child));
    });

    return this.concat(texts);
  }

  // Convert any node with ELEMENT_NODE type to markdown
  //
  _write_element_node(el) {
    let tag = el.tagName.toLowerCase();

    if (Object.prototype.hasOwnProperty.call(this.tag_handlers, tag)) {
      return this.tag_handlers[tag].call(this, el);
    }

    return this.tag_handler_default(el);
  }

  // Convert any node to markdown
  //
  _write_node(node) {
    if (!node) return '';

    switch (node.nodeType) {
      case 1 /* Node.ELEMENT_NODE */:
        return this._write_element_node(node);

      case 3 /* Node.TEXT_NODE */:
        return this.escape_inline(node.data.replace(/\s+/g, ' '));

      default:
        return '';
    }
  }

  // Convert any DOM Node or Cheerio Node to markdown
  //
  // Input:
  //  - node: Node   - either DOM Node or Cheerio Node
  //
  convert(node) {
    let result = this._write_node(node);

    if (!result.startsWith('\n\n')) result = this.escape_block(result);

    return result.replace(/^\n+|\n+$/g, '') + '\n';
  }

  escape_inline(text = '') {
    // *  - emphasis
    // _  - emphasis
    // ~  - strikethrough, sub, fence
    // ^  - sup
    // ++ - ins
    // -- - heading
    // == - mark, heading
    // `  - code, fence
    // [] - links
    // \  - escape
    return String(text)
             .replace(/([*_~^`\\\[\]])/g, '\\$1') //`
             .replace(/(:(?!\s))/ig, '\\$1') // emoji
             .replace(/(<(?!\s))/ig, '\\$1') // autolinks
             .replace(/(?:\r\n|\r|\n)/g, '\\\n') // newlines
             .replace(/(\+{2,}|\={2,})/g, m => Array.from(m).map(x => `\\${x}`).join(''))
             .replace(/(&([a-z0-9]+|#[0-9]+|#x[0-9a-f]+);)/ig, '\\$1'); // entities
  }

  escape_block(text = '') {
    return String(text)
             .replace(/^\s+|\s+$/mg, '') // remove leading and trailing spaces
             .replace(/^(#+\s)/mg, '\\$1') // atx headings
             .replace(/^((?!\s)([*\s]+|[-\s]+|[_\s+]))$/mg, '\\$1') // hr
             .replace(/^([-+*]\s)/mg, '\\$1') // lists
             .replace(/^(\d+)(\.)/mg, '$1\\$2') // ordered lists
             .replace(/^(>)/mg, '\\$1'); // blockquote
  }
}


class NodecaMarkdownWriter extends MarkdownWriter {
  constructor() {
    super();

    Object.assign(this.tag_handlers, {
      span: this.tag_handler_span
    });
  }

  _write_element_node(el) {
    let $el = $(el);

    if ($el.data('nd-link-orig'))  return this.nd_link_handler(el);
    if ($el.data('nd-image-orig')) return this.nd_image_handler(el);

    return super._write_element_node(el);
  }

  nd_link_handler(el) {
    let $el = $(el);
    let orig = $el.data('nd-link-orig');
    let type = $el.data('nd-link-type');
    let result;

    if (type === 'linkify') {
      result = this.format_linkify(orig) ??
               this.format_link(orig, orig);
    } else if (type === 'autolink') {
      result = this.format_autolink(orig) ??
               this.format_link(orig, orig);
    } else {
      result = this.format_link(this.contents(el), orig, $el.attr('title') || '');
    }

    let tag = el.tagName.toLowerCase();

    if (tag === 'div' || tag === 'blockquote') result = this.format_block(this.escape_block(result));

    return result;
  }

  nd_image_handler(el) {
    let $el = $(el);
    let $img = el.tagName.toLowerCase() === 'img' ? $el : $el.children('img');
    let orig = $el.data('nd-image-orig');
    let size = $el.data('nd-image-size') || 'sm';
    let alt = $img.attr('alt') || '';
    let title = $img.attr('title') || '';
    let desc = [ alt, size === 'sm' ? '' : size ].filter(Boolean).join('|');

    return this.format_image(desc, orig, title);
  }

  // `<em data-nd-pair-src="*">abc</em>` -> `*abc*`
  tag_handler_em(el) {
    let markers = $(el).data('nd-pair-src');
    if (markers) return this.format_pair(markers, this.contents(el));
    return super.tag_handler_em(el);
  }

  // `<strong data-nd-pair-src="**">abc</strong>` -> `**abc**`
  tag_handler_strong(el) {
    let markers = $(el).data('nd-pair-src');
    if (markers) return this.format_pair(markers, this.contents(el));
    return super.tag_handler_strong(el);
  }

  // `<hr data-nd-hr-src="*****">` -> `*****`
  tag_handler_hr(el) {
    let src = $(el).data('nd-hr-src');
    if (src) return this.format_block(src);
    return super.tag_handler_hr(el);
  }

  // `<span class="emoji emoji-xxx" data-nd-emoji-src=":xxx:"></span>` -> `:xxx:`
  tag_handler_span(el) {
    let src = $(el).data('nd-emoji-src');
    if (src) return src;
    return this.tag_handler_default(el);
  }

  tag_handler_blockquote(el) {
    if (!$(el).hasClass('quote')) return super.tag_handler_blockquote(el);

    let contents = this.contents($(el).children('.quote__content')[0]);
    return this.format_quote(
      contents.startsWith('\n\n') ? contents.slice(2) : this.escape_block(contents),
      $(el).attr('cite')
    );
  }

  format_quote(text, cite) {
    return this.format_fence(text, 'quote' + (cite ? ` ${cite}` : ''));
  }
}


module.exports = {
  MarkdownWriter,
  NodecaMarkdownWriter
};
