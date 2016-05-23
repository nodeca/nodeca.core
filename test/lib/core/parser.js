'use strict';


const assert = require('assert');


describe('Parser', function () {

  it('should highlight code', function () {
    let data = {
      text: '```js\nvar a = 1;\n```',
      options: true, // enable all plugins
      attachments: []
    };

    return TEST.N.parse(data).then(res => {
      assert.strictEqual(
        res.html,
        '<pre class="hljs language-js"><code><span class="hljs-keyword">var</span> ' +
        'a = <span class="hljs-number">1</span>;\n</code></pre>\n'
      );
    });
  });
});
