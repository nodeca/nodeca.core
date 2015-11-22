'use strict';


var assert   = require('assert');
var _        = require('lodash');


describe('Embedza Cache test', function () {

  var cache = TEST.N.models.core.EmbedzaCache;

  it('Set/Get value', function (done) {
    cache.set('foo', 'bar', function (err) {
      if (err) {
        done(err);
        return;
      }

      cache.get('foo', function (err, data) {
        if (err) {
          done(err);
          return;
        }

        assert.strictEqual(data, 'bar');
        done();
      });
    });
  });


  it('Update value', function (done) {
    cache.set('foo', 'bar', function (err) {
      if (err) {
        done(err);
        return;
      }

      cache.set('foo', 'baz', function (err) {
        if (err) {
          done(err);
          return;
        }

        cache.get('foo', function (err, data) {
          if (err) {
            done(err);
            return;
          }

          assert.strictEqual(data, 'baz');
          done();
        });
      });
    });
  });


  // Mongodb limit key length with 1024 bytes for btree indices.
  // We use hashed indice for workaround.
  // Need to test that hack works :)
  it('Use long key (> 1024 chars)', function (done) {
    var key = _.fill(new Array(2000), 'a').join('');

    cache.set(key, 'long', function (err) {
      if (err) {
        done(err);
        return;
      }

      cache.get(key, function (err, data) {
        if (err) {
          done(err);
          return;
        }

        assert.strictEqual(data, 'long');
        done();
      });
    });
  });


  it('Set/Get temporary value', function (done) {
    cache.set('image#foo', 'bar', function (err) {
      if (err) {
        done(err);
        return;
      }

      cache.get('image#foo', function (err, data) {
        if (err) {
          done(err);
          return;
        }

        assert.strictEqual(data, 'bar');
        done();
      });
    });
  });


  it('Update temporary value', function (done) {
    cache.set('image#foo', 'bar', function (err) {
      if (err) {
        done(err);
        return;
      }

      cache.set('image#foo', 'baz', function (err) {
        if (err) {
          done(err);
          return;
        }

        cache.get('image#foo', function (err, data) {
          if (err) {
            done(err);
            return;
          }

          assert.strictEqual(data, 'baz');
          done();
        });
      });
    });
  });

});
