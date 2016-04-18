'use strict';

var assert = require('assert');

describe('Parser', function () {

  it('should highlight code', function (done) {
    var data = {
      text: '```js\nvar a = 1;\n```',
      options: true, // enable all plugins
      attachments: []
    };

    TEST.N.parse(data, function (err, res) {
      assert.ifError(err);
      assert.strictEqual(
        res.html,
        '<pre class="hljs language-js"><code><span class="hljs-keyword">var</span> ' +
        'a = <span class="hljs-number">1</span>;\n</code></pre>\n'
      );
      done();
    });
  });
});
