
'use strict';


const assert = require('assert');
const rnd = require('nodeca.core/lib/app/random_token');


describe('random_token', function () {

  it('should pass own validator', function () {

    assert.strictEqual(rnd().length, 40);
    assert.strictEqual(rnd.validate(rnd()), true);
    assert.strictEqual(rnd.validate(123), false);
    assert.strictEqual(rnd.validate('abcd'), false);
  });

});
