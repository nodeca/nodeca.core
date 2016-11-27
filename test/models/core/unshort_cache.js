'use strict';


const assert   = require('assert');
const _        = require('lodash');
const Promise  = require('bluebird');


describe('Unshortener Cache test', function () {

  var cache = TEST.N.models.core.UnshortCache;

  it('Set/Get value', Promise.coroutine(function* () {
    yield cache.set('foo', 'bar');

    let data = yield cache.get('foo');

    assert.strictEqual(data, 'bar');

    data = yield cache.get('unknown key name');

    /* eslint-disable no-undefined */
    assert.strictEqual(data, undefined);
  }));


  it('Update value', Promise.coroutine(function* () {
    yield cache.set('foo', 'bar');
    yield cache.set('foo', 'baz');

    let data = yield cache.get('foo');

    assert.strictEqual(data, 'baz');
  }));


  // Mongodb limit key length with 1024 bytes for btree indices.
  // We use hashed indice for workaround.
  // Need to test that hack works :)
  it('Use long key (> 1024 chars)', Promise.coroutine(function* () {
    let key = _.fill(new Array(2000), 'a').join('');

    yield cache.set(key, 'long');

    let data = yield cache.get(key);

    assert.strictEqual(data, 'long');
  }));

});
