
'use strict';


const assert = require('assert');
const format = require('nodeca.core/lib/app/number_short');


describe('number_short', function () {

  it('should format numbers', function () {
    assert.strictEqual(format(1),         '1');
    assert.strictEqual(format(12),        '12');
    assert.strictEqual(format(123),       '123');
    assert.strictEqual(format(1234),      '1.2k');
    assert.strictEqual(format(12345),     '12k');
    assert.strictEqual(format(123456),    '123k');
    assert.strictEqual(format(1234567),   '1.2m');
    assert.strictEqual(format(12345678),  '12m');
    assert.strictEqual(format(123456789), '123m');
  });

});
