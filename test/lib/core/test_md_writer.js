
'use strict';


const assert = require('assert');
const writer = require('nodeca.core/lib/parser/md_writer');
const $      = require('nodeca.core/lib/parser/cheequery');


describe('MarkdownWriter', function () {
  function expect(html, md) {
    let dom = $(`<div>${html}</div>`);

    assert.strictEqual(new writer.MarkdownWriter().convert(dom[0]), md);
  }

  it('emphasis-like', function () {
    //expect('<i>abc</i>', '_abc_\n');
    expect('<em>abc</em>', '_abc_\n');

    //expect('<b>abc</b>', '__abc__\n');
    expect('<strong>abc</strong>', '__abc__\n');

    expect('<s>abc</s>', '~~abc~~\n');
    //expect('<del>abc</del>', '~~abc~~\n');

    expect('<sup>abc</sup>', '^abc^\n');
    expect('<sub>abc</sub>', '~abc~\n');
    //expect('<ins>abc</ins>', '++abc++\n');
    //expect('<mark>abc</mark>', '==abc==\n');
    expect('<code>abc</code>', '`abc`\n');

    expect('foo<em></em>bar<strong></strong>baz<s></s>quux', 'foobarbazquux\n');
    expect('foo<code></code>bar', 'foobar\n');
  });

  it('emphasis-like should be safe to concat', function () {
    //expect('<em>abc</em><em>def</em>', '_abc_ _def_\n');
    expect('<span>a <em>foo</em></span><span><s>bar</s> b</span>', 'a _foo_~~bar~~ b\n');
    //expect('<span>a <em>foo</em></span><span><em>bar</em> b</span>', 'a _foo_ _bar_ b\n');
    //expect('<span>a <em>foo</em></span><span><strong>bar</strong> b</span>', 'a _foo_ __bar__ b\n');
  });

  it('emphasis-like markers should be escaped', function () {
    expect('_<em>abc</em>', '\\__abc_\n');
    expect('**foo_bar_baz**', '\\*\\*foo\\_bar\\_baz\\*\\*\n');

    expect('~~abc~~', '\\~\\~abc\\~\\~\n'); // strikethrough
    expect('^abc^', '\\^abc\\^\n'); // sup
    expect('~abc~', '\\~abc\\~\n'); // sub
    expect('`abc`', '\\`abc\\`\n'); // code

    expect('++abc++', '\\+\\+abc\\+\\+\n'); // ins
    expect('==abc==', '\\=\\=abc\\=\\=\n'); // mark
    expect('a + b', 'a + b\n'); // no escape
    expect('a = b', 'a = b\n'); // no escape

    expect('```foo', '\\`\\`\\`foo\n'); // fence
    expect('~~~foo', '\\~\\~\\~foo\n'); // fence
  });

  it('emphasis-like should be able to be nested', function () {
    expect('a<s>b<em>c<strong>d</strong>e</em>f</s>g', 'a~~b_c__d__e_f~~g\n');
  });

  it('emphasis-like should concat as inline tags', function () {
    expect('<sub>a</sub><sup>b</sup><sub>c</sub>', '~a~^b^~c~\n');
  });

  it('code span should contain raw text', function () {
    expect('<code>**foo** _bar_ \\</code>', '`**foo** _bar_ \\`\n');
    expect('<code><strong>foo</strong> <em>bar</em></code>', '`foo bar`\n');
    expect('<code>foo\n\nbar</code>', '`foo bar`\n'); // collapse multiple newlines
    expect('<code>&amp;amp;</code>', '`&amp;`\n');
    expect('<code>foo`bar</code>', '``foo`bar``\n'); // no way to represent ` itself?
    expect('<code>f`o``o```b</code>', '````f`o``o```b````\n'); // no way to represent ` itself?
    expect('<code>```</code>', '` ``` `\n');
    expect('<code>`foo</code>', '`` `foo ``\n');
    expect('<code>foo`</code>', '`` foo` ``\n');
  });

  it('comment', function () {
    expect('foo<!--comment-->bar', 'foobar\n');
  });

  it('hr', function () {
    expect('<hr>', '---\n');
    expect('<hr><hr><hr>', '---\n\n---\n\n---\n');
  });

  it('pre', function () {
    expect('foo<pre>bar</pre>baz', 'foo\n\n```\nbar\n```\n\nbaz\n');
    expect('<pre>1</pre><pre>2</pre>', '```\n1\n```\n\n```\n2\n```\n');
    expect('<pre>`\n``\n```\n````\n`````</pre>', '``````\n`\n``\n```\n````\n`````\n``````\n');
    expect('<pre>*foo* __bar__</pre>', '```\n*foo* __bar__\n```\n');
    expect('<pre><em>foo</em> <strong>bar</strong></pre>', '```\nfoo bar\n```\n');

    // info string
    expect('<pre class="hljs language-js language-wtf">var x = 123;</pre>', '```js\nvar x = 123;\n```\n');
    expect('<pre class="hljs language-fo`o``bar">x</pre>', '```foobar\nx\n```\n');

    // real example
    expect('<pre class="hljs language-js"><code><span class="hljs-keyword">var</span> ' +
           'x = <span class="hljs-number">123</span>;</code></pre>', '```js\nvar x = 123;\n```\n');

    expect('<pre>123</pre>', '```\n123\n```\n');
    expect('<pre>123\n</pre>', '```\n123\n```\n');
    expect('<pre>123\n\n</pre>', '```\n123\n\n```\n');
  });

  it('quote', function () {
    expect('<blockquote><hr><hr></blockquote>', '> ---\n>\n> ---\n');
    expect('<blockquote><blockquote><blockquote>a</blockquote>b</blockquote>c</blockquote>',
      '>>> a\n>>\n>> b\n>\n> c\n');
    expect('<blockquote cite="http://example.com">test</blockquote>', 'http://example.com\n> test\n');
  });

  it('inline tags should concat', function () {
    expect('<span>foo</span><span>bar</span>', 'foobar\n');
  });

  it('block tags should turn into paragraphs', function () {
    expect('<p>foo</p><p>bar</p>', 'foo\n\nbar\n');
    expect('<div>foo</div><div>bar</div>', 'foo\n\nbar\n');

    // don't allow empty paragraphs
    expect('<p></p><p></p><p>foo</p>\n\n\n<p>bar</p>', 'foo\n\nbar\n');
  });

  it('br', function () {
    expect('foo<br>bar<br><br><br>baz', 'foo\\\nbar\\\n\\\n\\\nbaz\n');
  });

  it('heading', function () {
    expect('<h0>abc</h0>', 'abc\n');
    expect('<h7>abc</h7>', 'abc\n');
    expect('<hX>abc</hX>', 'abc\n');

    expect('<h1>abc</h1>', '# abc\n');
    expect('<h2>abc</h2>', '## abc\n');
    expect('<h3>abc</h3>', '### abc\n');
    expect('<h4>abc</h4>', '#### abc\n');
    expect('<h5>abc</h5>', '##### abc\n');
    expect('<h6>abc</h6>', '###### abc\n');

    expect('<h2>abc ##</h2>', '## abc \\#\\#\n');

    expect('<h1>a</h1><h2>b</h2><h3>c</h3>', '# a\n\n## b\n\n### c\n');
  });

  it('lists', function () {
    expect('<ul><li>123</li><li>456</li></ul>', ' - 123\n\n - 456\n');
    expect('<ul><li><ul><li>123</li><li>456</li></ul></li><li>789</li></ul>', ' -  - 123\n\n    - 456\n\n - 789\n');
  });

  it('link destination', function () {
    expect('<a>link</a>', '[link]()\n');
    expect('<a href=""></a>', '[]()\n');
    expect('<a href="">link</a>', '[link]()\n');
    expect('<a href="test">link</a>', '[link](test)\n');
    expect('<a href="\r\n">link</a>', '[link](%0D%0A)\n');
    expect('<a href="<test>">link</a>', '[link](<\\<test\\>>)\n');
    expect('<a href="foo bar">link</a>', '[link](<foo bar>)\n');
    expect('<a href="\x7f">link</a>', '[link](<\x7f>)\n');
    expect('<a href="\t">link</a>', '[link](<\t>)\n');
    expect('<a href="a(foo)b">link</a>', '[link](<a(foo)b>)\n');
    expect('<a href="\\">link</a>', '[link](\\\\)\n');
    expect('<a href="\\<test\\>">link</a>', '[link](<\\\\\\<test\\\\\\>>)\n');
    expect('<a href="*foo*">link</a>', '[link](*foo*)\n');
    expect('<a href="`foo`">link</a>', '[link](`foo`)\n');
  });

  it('image destination', function () {
    expect('<img>', '![]()\n');
    expect('<img src="">', '![]()\n');
    expect('<img src="test">', '![](test)\n');
    expect('<img src="\r\n">', '![](%0D%0A)\n');
    expect('<img src="<test>">', '![](<\\<test\\>>)\n');
    expect('<img src="foo bar">', '![](<foo bar>)\n');
    expect('<img src="\x7f">', '![](<\x7f>)\n');
    expect('<img src="\t">', '![](<\t>)\n');
    expect('<img src="a(foo)b">', '![](<a(foo)b>)\n');
    expect('<img src="\\">', '![](\\\\)\n');
    expect('<img src="\\<test\\>">', '![](<\\\\\\<test\\\\\\>>)\n');
    expect('<img src="*foo*">', '![](*foo*)\n');
    expect('<img src="`foo`">', '![](`foo`)\n');
  });

  it('link title', function () {
    expect('<a href="url" title="foo bar">link</a>', '[link](url "foo bar")\n');
    expect('<a href="url" title="foo&quot;bar">link</a>', '[link](url "foo\\"bar")\n');
    expect('<a href="url" title="foo\n\n\nbar">link</a>', '[link](url "foo\nbar")\n');
    expect('<a href="url" title="*foo*">link</a>', '[link](url "*foo*")\n');
    expect('<a href="url" title="`foo`">link</a>', '[link](url "`foo`")\n');
  });

  it('image title', function () {
    expect('<img src="url" title="foo bar">', '![](url "foo bar")\n');
    expect('<img src="url" title="foo&quot;bar">', '![](url "foo\\"bar")\n');
    expect('<img src="url" title="foo\n\n\nbar">', '![](url "foo\nbar")\n');
    expect('<img src="url" title="*foo*">', '![](url "*foo*")\n');
    expect('<img src="url" title="`foo`">', '![](url "`foo`")\n');
  });

  it('link text', function () {
    expect('<a href="url">[]()</a>', '[\\[\\]()](url)\n');
    expect('<a href="url"><em>foo</em></a>', '[_foo_](url)\n');
    expect('<a href="url">_foo_</a>', '[\\_foo\\_](url)\n');
    expect('<a href="url"><img src="img"></a>', '[![](img)](url)\n');
  });

  it('image alt', function () {
    expect('<img src="url" alt="test" title="foo bar">', '![test](url "foo bar")\n');
    expect('<img src="url" alt="*test*">', '![\\*test\\*](url)\n');
    expect('<img src="url" alt="`test`">', '![\\`test\\`](url)\n');
    expect('<img src="url" alt="\\">', '![\\\\](url)\n');
  });

  it('link and image escaping', function () {
    expect('[reference]', '\\[reference\\]\n');
    expect('[foo](bar)', '\\[foo\\](bar)\n');
    expect('![foo](bar)', '!\\[foo\\](bar)\n');
  });

  it('forbid nested links', function () {
    expect('<a href="a">foo<a href="b">bar<a href="c">baz</a>x</a>x</a>', 'foobar[baz](c)xx\n');
  });

  it('autolinks', function () {
    // can be recognized by linkify
    expect('<a href="http://localhost">http://localhost</a>', 'http://localhost\n');
    expect('<a href="http://example.org">http://example.org</a>', 'http://example.org\n');
    expect('<a href="HTTP://EXAMPLE.ORG/">HTTP://EXAMPLE.ORG/</a>', 'HTTP://EXAMPLE.ORG/\n');
    expect('<a href="https://example.org?q=1">https://example.org?q=1</a>', 'https://example.org?q=1\n');

    // can't be recognized by linkify, but valid autolinks
    expect('<a href="hxxps://example.org">hxxps://example.org</a>', '<hxxps://example.org>\n');
    expect('<a href="https://example.org??">https://example.org??</a>', '<https://example.org??>\n');
    expect('<a href="https://example.org/\t >>">https://example.org\t >></a>',
           '[https\\://example.org >>](<https://example.org/\t \\>\\>>)\n');
    expect('<a href="https://-example.org">https://-example.org</a>', '<https://-example.org>\n');
    expect('<a href="https://example-.org">https://example-.org</a>', '<https://example-.org>\n');

    // not valid autolinks
    expect('<a href="foobar">foobar</a>', '[foobar](foobar)\n');
    expect('<a href="a@b://c">a@b://c</a>', '[a@b://c](a@b://c)\n');
  });

  it('should convert non-valid previous autolinks to plain links', function () {
    // https://rcopen.com/forum/f49/topic570584/24
    // eslint-disable-next-line max-len
    expect('<a href="httpS://%D0%B1%D0%BB%D0%B0-%D0%B1%D0%BB%D0%B0-%D0%B1%D0%BB%D0%B0" class="link link-ext link-auto" data-nd-link-type="linkify" data-nd-link-orig="httpS://%D0%B1%D0%BB%D0%B0-%D0%B1%D0%BB%D0%B0-%D0%B1%D0%BB%D0%B0" target="_blank" rel="nofollow noopener">httpS://%D0%B1%D0%BB%D0%B0-%D0%B1%D0%BB%D0%B0-%D0%B1%D0%BB%D0%B0</a>', '<httpS://%D0%B1%D0%BB%D0%B0-%D0%B1%D0%BB%D0%B0-%D0%B1%D0%BB%D0%B0>\n');
  });

  it('mixes of inline and block tags', function () {
    expect('abc<hr>def', 'abc\n\n---\n\ndef\n');
    expect('<hr><h1>abc</h1><em>foo</em><s>bar</s><hr>', '---\n\n# abc\n\n_foo_~~bar~~\n\n---\n');
  });

  it('should collapse spaces', function () {
    expect('foo\n   ba   r\n    baz\n     quu      x', 'foo ba r baz quu x\n');
    expect('foo\n\tbar\n\t\tba\t\tz\n', 'foo bar ba z\n');
  });

  it('should convert tables (incomplete)', function () {
    expect('<td>foo</td><td>bar</td><td>baz</td>', '| foo | bar | baz\n');
    expect('<tr><td>foo</td></tr><tr><td>bar</td></tr><tr><td>baz</td></tr>', '| foo\n| bar\n| baz\n');
  });

  it('should escape backslashes', function () {
    expect('\\foo\\\\\\bar\\', '\\\\foo\\\\\\\\\\\\bar\\\\\n');
  });

  it('should escape entities', function () {
    expect('&amp;amp;', '\\&amp;\n');
    expect('&amp;AMP;', '\\&AMP;\n');
    expect('&amp;#x42;', '\\&#x42;\n');
    expect('&amp;#XABCDEF;', '\\&#XABCDEF;\n');
    expect('&amp;#1234567;', '\\&#1234567;\n');
    expect('a &amp; b', 'a & b\n');
    expect('&amp;&amp;&amp;', '&&&\n');
    expect('&amp;CounterClockwiseContourIntegral;', '\\&CounterClockwiseContourIntegral;\n'); // longest entity
    expect('&amp;copy', '&copy\n'); // html entity, but not md entity
  });

  it('should escape autolinks and html tags', function () {
    expect('&lt;div&gt;', '\\<div>\n');
    expect('&lt;/div&gt;', '\\</div>\n');
    expect('&lt;!-- --&gt;', '\\<!-- -->\n');
    expect('&lt;?php &gt;', '\\<?php >\n');
    expect('&lt;444@example.com&gt;', '\\<444@example.com>\n');
    expect('<span>&lt;</span>444@example.com&gt;', '\\<444@example.com>\n');
    expect('222 &lt; 444', '222 < 444\n'); // no need to escape
  });

  it('should escape emojis and plain urls', function () {
    expect('http://example.org', 'http\\://example.org\n');
    expect(':)', '\\:)\n');
    expect(':test:', '\\:test\\:\n');
    expect('test:<span>)</span>', 'test\\:)\n');
    expect('test: foo', 'test: foo\n');
  });

  it('should escape block tags', function () {
    // hr
    expect('* * *', '\\* \\* \\*\n');
    expect('_ _ _', '\\_ \\_ \\_\n');
    expect('- - -', '\\- - -\n');
    expect('a - - - b', 'a - - - b\n');

    // heading
    expect('===', '\\=\\=\\=\n');
    expect('---', '\\---\n');
    expect('-- --', '\\-- --\n');
    expect('- - -', '\\- - -\n');
    expect('# foo<p>### bar</p>', '\\# foo\n\n\\### bar\n');

    // fence
    expect('```js', '\\`\\`\\`js\n');
    expect('~~~js', '\\~\\~\\~js\n');

    // lists
    expect('<p>- 123</p>', '\\- 123\n');
    expect('<p>+ 123</p>', '\\+ 123\n');
    expect('<p>* 123</p>', '\\* 123\n');
    expect('<p>123. 123</p>', '123\\. 123\n');

    // blockquote
    expect('> foo', '\\> foo\n');
    expect('>>>foo', '\\>>>foo\n');

    // code block
    expect('    foo', 'foo\n');
    expect('\tfoo', 'foo\n');
  });
});


describe('NodecaMarkdownWriter', function () {
  function expect(html, md) {
    let dom = $(`<div>${html}</div>`);

    assert.strictEqual(new writer.NodecaMarkdownWriter().convert(dom[0]), md);
  }

  it('links', function () {
    expect('<a href="https://www.google.com/" class="link link-int link-auto" data-nd-link-type="linkify" ' +
      'data-nd-link-orig="https://www.google.com/">www.google.com</a>', 'https://www.google.com/\n');
    expect('<a href="https://www.google.com/" class="link link-int link-auto" data-nd-link-type="autolink" ' +
      'data-nd-link-orig="https://www.google.com/">www.google.com</a>', '<https://www.google.com/>\n');
    expect('<a class="ez-inline" target="_blank" href="https://www.youtube.com/watch?v=xx" rel="nofollow" ' +
      'data-nd-link-orig="https://www.youtube.com/watch?v=xx" ' +
      'data-nd-link-type="autolink">description</a><span>test</span>',
      '<https://www.youtube.com/watch?v=xx>test\n');
    expect('<div class="ez-player ez-block" data-nd-link-orig="https://www.youtube.com/watch?v=xx" ' +
      'data-nd-link-type="autolink"></div><span>test</span>', '<https://www.youtube.com/watch?v=xx>\n\ntest\n');
    expect('<blockquote class="quote" cite="/forum/f1/topic2/3" ' +
      'data-nd-link-orig="https://dev.rcopen.com/forum/f1/topic2/3" ' +
      'data-nd-link-type="linkify"></blockquote><span>test</span>',
      'https://dev.rcopen.com/forum/f1/topic2/3\n\ntest\n');
  });

  it('images', function () {
    expect('<img class="image" data-nd-image-orig="dest" src="aaa" alt="foo" title="bar">', '![foo](dest "bar")\n');
    expect('<a class="attach attach-img thumb thumb__m-responsive attach__m-sm" ' +
      'href="/member1/media/111111111111111111111111" target="_blank" data-nd-media-id="111111111111111111111111" ' +
      'data-nd-image-orig="/member1/media/111111111111111111111111" data-nd-image-size="sm">' +
      '<img class="thumb__image" src="/files/111111111111111111111111_sm" alt="alt" title="title"></a>',
      '![alt](/member1/media/111111111111111111111111 "title")\n');
    expect('<span class="attach attach-img attach__m-orig" data-nd-media-id="111111111111111111111111" ' +
      'data-nd-image-orig="/member1/media/111111111111111111111111" data-nd-image-size="orig">' +
      '<img src="/files/111111111111111111111111" alt="alt" title="title"></a></span>',
      '![alt|orig](/member1/media/111111111111111111111111 "title")\n');
  });

  it('hr', function () {
    expect('<hr data-nd-hr-src="-----">', '-----\n');
    expect('<hr data-nd-hr-src="********">', '********\n');
    expect('abc<hr data-nd-hr-src="********">def', 'abc\n\n********\n\ndef\n');
  });

  it('pairs', function () {
    expect('<strong data-nd-pair-src="**">abc</strong>', '**abc**\n');
    expect('<strong data-nd-pair-src="__">abc</strong>', '__abc__\n');
    expect('<em data-nd-pair-src="*">abc</em>', '*abc*\n');
    expect('<em data-nd-pair-src="_">abc</em>', '_abc_\n');
  });

  it('emoji', function () {
    expect('<span class="emoji emoji-smiley" data-nd-emoji-src=":smiley:">😃</span>', ':smiley:\n');
    expect('abc<span class="emoji emoji-smiley" data-nd-emoji-src=":smiley:">😃</span>def', 'abc:smiley:def\n');
  });

  it('basic quote', function () {
    expect('<blockquote><hr><hr></blockquote>', '```quote\n---\n\n---\n```\n');
    expect('<blockquote><blockquote><blockquote>a</blockquote>b</blockquote>c</blockquote>',
      '`````quote\n````quote\n```quote\na\n```\n\nb\n````\n\nc\n`````\n');
    expect('<blockquote cite="http://example.com">test</blockquote>', '```quote http://example.com\ntest\n```\n');
  });

  it('wrapped quote', function () {
    expect('<blockquote class="quote quote__m-local" cite="/forum/f6/topic245/5">' +
      '<footer class="quote__title">foo</footer>' +
      '<div class="quote__content"><p>test</p></div></blockquote>',
      '```quote /forum/f6/topic245/5\ntest\n```\n');
  });
});
