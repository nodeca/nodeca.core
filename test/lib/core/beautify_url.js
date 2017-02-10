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
});
