'use strict';


const assert   = require('assert');
const _        = require('lodash');


describe('Unshortener Cache test', function () {

  var cache = TEST.N.models.core.UnshortCache;

  it('Set/Get value', async function () {
    await cache.set('foo', 'bar');

    let data = await cache.get('foo');

    assert.strictEqual(data, 'bar');

    data = await cache.get('unknown key name');

    /* eslint-disable no-undefined */
    assert.strictEqual(data, undefined);
  });


  it('Update value', async function () {
    await cache.set('foo', 'bar');
    await cache.set('foo', 'baz');

    let data = await cache.get('foo');

    assert.strictEqual(data, 'baz');
  });


  // Mongodb limit key length with 1024 bytes for btree indices.
  // We use hashed indice for workaround.
  // Need to test that hack works :)
  it('Use long key (> 1024 chars)', async function () {
    let key = _.fill(new Array(2000), 'a').join('');

    await cache.set(key, 'long');

    let data = await cache.get(key);

    assert.strictEqual(data, 'long');
  });

});
