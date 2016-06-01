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
          '&#x21A9;</a> <a href="#fnref1:1" class="footnote-backref">&#x21A9;</a>' +
          '</p>\n</li>\n<li id="fn2" class="footnote-item"><p>i1 <a href="#fnref2" ' +
          'class="footnote-backref">&#x21A9;</a></p>\n</li>\n<li id="fn3" ' +
          'class="footnote-item"><p>i3<sup class="footnote-ref"><a href="#fn4" ' +
          'id="fnref4">[4]</a></sup> <a href="#fnref3" class="footnote-backref">' +
          '&#x21A9;</a></p>\n</li>\n<li id="fn4" class="footnote-item"><p>i4 <a ' +
          'href="#fnref4" class="footnote-backref">&#x21A9;</a></p>\n</li>\n</ol>\n</section>'
        );
      });
    });


    it('should calculate text length', function () {
      let data = {
        text: '### Test\n\nText test 123\n\n- a\n- b\n- c',
        options: true, // enable all plugins
        attachments: []
      };

      return TEST.N.parser.md2html(data).then(res => {
        assert.strictEqual(res.text_length, 18);
      });
    });
  });


  describe('.html2preview()', function () {
    it('should transform tag to preview', function () {
      let assets = [
        [ '<table><tr><td>test</td></tr></table>', '<span class="icon icon-table"></span>' ],
        [ '<a href="#">test</a>', '<a href="#">test</a>' ],
        [ '<img src="test.png" />', '<span class="icon icon-picture"></span>' ],
        [ '<ul><li>test</li></ul>', '<span class="icon icon-list-bullet"></span>' ],
        [ '<ol><li>test</li></ol>', '<span class="icon icon-list-numbered"></span>' ],
        [ '<span class="attach"></span>', '<span class="icon icon-attach"></span>' ],
        [ '<pre class="hljs">test</pre>', '<span class="icon icon-code"></span>' ],
        [ '<code>test</code>', 'test' ],
        [ '<b>test</b>', 'test' ],
        [ '<i>test</i>', 'test' ],
        [ '<em>test</em>', 'test' ],
        [ '<strong>test</strong>', 'test' ],
        [ '<s>test</s>', 'test' ],
        [ '<h1>test</h1>', 'test' ],
        [ '<sup>test</sup>', '^test' ],
        [ '<sub>test</sub>', 'test' ],
        [ '<blockquote>test</blockquote>', '' ],
        [ '<hr>', '' ],
        [
          'test <sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a>' +
          '</sup><hr class="footnotes-sep"><section class="footnotes"><ol ' +
          'class="footnotes-list"><li id="fn1" class="footnote-item"><p>test ' +
          '<a href="#fnref1" class="footnote-backref">↩</a></p></li></ol></section>',
          'test'
        ],
        [
          '<div class="spoiler"><div class="spoiler__title"><span ' +
          'class="spoiler__icon-collapse icon icon-collapse-alt icon-space-after">' +
          '</span><span class="spoiler__icon-expand icon icon-expand-alt icon-space-after">' +
          '</span>test title</div><div class="spoiler__inner"><div ' +
          'class="spoiler__content">test text</div></div></div>',
          'test text'
        ],
        [
          '<a class="ez-inline" href="https://www.youtube.com/" data-nd-orig="https://www.youtube.com/">test</a>',
          '<a class="ez-inline" href="https://www.youtube.com/" data-nd-orig="https://www.youtube.com/">test</a>'
        ],
        [
          '<div class="ez-block" data-nd-orig="https://www.youtube.com"></div>',
          '<a href="https://www.youtube.com" target="_blank" rel="nofollow">www.youtube.com</a>'
        ]
      ];

      return Promise.all(assets.map(asset =>
        TEST.N.parser.html2preview({ html: asset[0] }).then(res => {
          assert.strictEqual(res.preview, asset[1]);
        })
      ));
    });


    it('should transform link to text', function () {
      let data = {
        html: '<a href="#">test</a>',
        link2text: true
      };

      return TEST.N.parser.html2preview(data).then(res => {
        assert.strictEqual(res.preview, '<span class="preview__link">test</span>');
      });
    });


    it('should limit text length', function () {
      let data = {
        html: '<h1>Test</h1>\n<p>Text test 123</p><ul><li>a</li><li>b</li><li>c</li></ul><p>foo bar baz</p>',
        limit: 10
      };

      return TEST.N.parser.html2preview(data).then(res => {
        assert.strictEqual(res.preview, 'Test\nText test 123&#x2026;');
      });
    });
  });
});
