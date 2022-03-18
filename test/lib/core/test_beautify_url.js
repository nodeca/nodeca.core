'use strict';


const assert   = require('assert');
const beautify = require('nodeca.core/lib/parser/beautify_url');


describe('beautify_url', function () {

  // TODO: write tests for each corner case

  it('should truncate domains', function () {
    assert.equal(beautify('https://whatever.example.com/foobarbazquux?query=string', 20), '…example.com/foobarb…');
  });

  it('should show common 2nd level domains', function () {
    assert.equal(beautify('https://whatever.example.co.uk/foobarbazquux?query=string', 20), '…example.co.uk/fooba…');
  });

  it('should show 4-letter 3rd level domains', function () {
    assert.equal(beautify('https://blog.chromium.org/2019/10/no-more-mixed-messages-about-https.html', 40),
      'blog.chromium.org/…/no-more-mixed-messag…');
  });
});
