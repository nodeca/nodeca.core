'use strict';


const assert = require('assert');
const createToken = require('../../../lib/app/random_token');
const { validateSession } = require('../../../lib/autoload/hooks/server_chain/session');


describe('Validate session names', () => {

  it('should validate guest session', () => {
    assert.strictEqual(validateSession(createToken()), true);
  });

  it('should validate member session', () => {
    assert.strictEqual(validateSession('m' + createToken()), true);
  });

  it('should not validate garbage', () => {
    assert.strictEqual(validateSession('qwrrty'), false);
    assert.strictEqual(validateSession(123), false);
    assert.strictEqual(validateSession(null), false);
    assert.strictEqual(validateSession(), false);
  });
});
