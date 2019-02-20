'use strict';


const assert  = require('assert');
const Promise = require('bluebird');


describe('Parser', function () {

  describe('.md2html()', function () {
    it('should highlight code', function () {
      let data = {
        text: '```js\nvar a = 1;\n```',
        options: true, // enable all plugins
        attachments: []
      };

      return TEST.N.parser.md2html(data).then(res => {
        assert.strictEqual(
          res.html,
          '<pre class="hljs language-js"><code><span class="hljs-keyword">var</span> ' +
          'a = <span class="hljs-number">1</span>;\n</code></pre>\n'
        );
      });
    });


    it('should render footnotes', function () {
      let data = {
        text: 't1[^1] t2[^1] t3^[i1]\n\n[^1]: i2\n\nt4 [^2]\n\n[^2]: i3[^textref]\n\n[^textref]: i4',
        options: true, // enable all plugins
        attachments: []
      };

      return TEST.N.parser.md2html(data).then(res => {
        assert.strictEqual(
          res.html,
          '<p>t1<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a>' +
          '</sup> t2<sup class="footnote-ref"><a href="#fn1" id="fnref1:1">[1]' +
          '</a></sup> t3<sup class="footnote-ref"><a href="#fn2" id="fnref2">[2]' +
          '</a></sup></p>\n<p>t4 <sup class="footnote-ref"><a href="#fn3" ' +
          'id="fnref3">[3]</a></sup></p>\n<hr class="footnotes-sep">\n<section ' +
          'class="footnotes">\n<ol class="footnotes-list">\n<li id="fn1" ' +
          'class="footnote-item"><p>i2 <a href="#fnref1" class="footnote-backref">' +
          '↩</a> <a href="#fnref1:1" class="footnote-backref">↩</a>' +
          '</p>\n</li>\n<li id="fn2" class="footnote-item"><p>i1 <a href="#fnref2" ' +
          'class="footnote-backref">↩</a></p>\n</li>\n<li id="fn3" ' +
          'class="footnote-item"><p>i3<sup class="footnote-ref"><a href="#fn4" ' +
          'id="fnref4">[4]</a></sup> <a href="#fnref3" class="footnote-backref">' +
          '↩</a></p>\n</li>\n<li id="fn4" class="footnote-item"><p>i4 <a ' +
          'href="#fnref4" class="footnote-backref">↩</a></p>\n</li>\n</ol>\n</section>'
        );
      });
    });


    it('should calculate text length', function () {
      let assets = [
        [ '### Test\n\nText test 123\n\n- a\n- b\n- c', 18 ],
        [ 'http://www.google.com', 21 ],
        [ '> test', 0 ],
        [ '```spoiler\n~~test~~\n```', 4 ]
      ];

      return Promise.all(assets.map(asset =>
        TEST.N.parser.md2html({ text: asset[0], options: true, attachments: [] }).then(res => {
          assert.strictEqual(res.text_length, asset[1], `Broken asset: "${asset[0]}"`);
        })
      ));
    });
  });


  describe('.md2preview()', function () {
    it('should transform md to preview', function () {
      let assets = [
        [ '| title |\n| --- |\n| text |', '<span class="icon icon-table"></span>' ],
        [ '[test](#)', '<a href="#" class="link link-ext" title target="_blank" rel="nofollow noopener">test</a>' ],
        [ 'http://www.google.com', '<a href="http://www.google.com" class="link link-ext link-auto" ' +
                                   'title target="_blank" rel="nofollow noopener">www.google.com</a>' ],
        [ '![](#)', '<span class="icon icon-picture"></span>' ],
        [ '- a\n- b', '<span class="icon icon-list-bullet"></span>' ],
        [ '1. a\n2. b', '<span class="icon icon-list-numbered"></span>' ],
        [ '```\ncode\n```', '<span class="icon icon-code"></span>' ],
        [ '`test`', 'test' ],
        [ '_test_', 'test' ],
        [ '__test__', 'test' ],
        [ '~~test~~', 'test' ],
        [ '### test', 'test' ],
        [ '^test^', '^test' ],
        [ '~test~', 'test' ],
        [ '> test', '' ],
        [ '---', '' ],
        [ 'test[^1]\n\n[^1]: foo', 'test' ],
        [ '```spoiler\ntest\n```', 'test' ],
        [ 'foo\n\nbar', 'foo\nbar' ]
      ];

      return Promise.all(assets.map(asset =>
        TEST.N.parser.md2preview({ text: asset[0] }).then(res => {
          assert.strictEqual(res.preview.trim(), asset[1], `Broken asset: "${asset[0]}"`);
        })
      ));
    });


    it('should transform link to text', function () {
      let data = {
        text: '[test](#)',
        link2text: true
      };

      return TEST.N.parser.md2preview(data).then(res => {
        assert.strictEqual(res.preview.trim(), '<span class="preview-link">test</span>');
      });
    });


    it('should limit text length', function () {
      let data = {
        text: '- a\n- b\n\nfoobarbaz\n\ntest test',
        limit: 10
      };

      return TEST.N.parser.md2preview(data).then(res => {
        assert.strictEqual(res.preview, '<span class="icon icon-list-bullet"></span>\nfoobarbaz…');
      });
    });
  });
});
