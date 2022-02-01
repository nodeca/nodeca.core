'use strict';


const assert   = require('assert');


describe('Embedza Cache test', function () {

  var cache = TEST.N.models.core.EmbedzaCache;

  it('Set/Get value', async function () {
    await cache.set('foo', 'bar');

    let data = await cache.get('foo');

    assert.strictEqual(data, 'bar');

    data = await cache.get('unknown key name');

    assert.strictEqual(data, null);
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
    let key = new Array(2000).fill('a').join('');

    await cache.set(key, 'long');

    let data = await cache.get(key);

    assert.strictEqual(data, 'long');
  });


  it('Set/Get temporary value', async function () {
    await cache.set('image#foo', 'bar');

    let data = await cache.get('image#foo');

    assert.strictEqual(data, 'bar');

    data = await cache.get('image#unknown');

    /* eslint-disable no-undefined */
    assert.strictEqual(data, null);
  });


  it('Update temporary value', async function () {
    await cache.set('image#foo', 'bar');
    await cache.set('image#foo', 'baz');

    let data = await cache.get('image#foo');

    assert.strictEqual(data, 'baz');
  });

});
