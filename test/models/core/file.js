'use strict';


var fs       = require('fs');
var path     = require('path');
var assert   = require('assert');
var Mongoose = require('mongoose');

var fileName    = path.join(__dirname, 'fixtures', 'lorem.jpg');
var fileBase    = path.basename(fileName);
var fileContent = fs.readFileSync(fileName);

var file = TEST.N.models.core.File;


describe('File model test', function () {

  it('put(file) + remove()', function (done) {
    file.put(fileName, { metadata: { origName: fileBase } }, function (err, info) {
      if (err) { done(err); return; }

      file.getInfo(info._id, function (err, i) {
        if (err) { done(err); return; }

        assert.equal(i.contentType, 'image/jpeg');
        assert.equal(i.metadata.origName, 'lorem.jpg');
        assert.equal(i.filename, info._id.toHexString());

        file.remove(info._id, done);
      });
    });
  });

  it('put(file) + remove(all)', function (done) {
    var origId = new Mongoose.Types.ObjectId();

    /*eslint-disable max-nested-callbacks*/

    // Put file
    file.put(fileName, { _id: origId, metadata: { origName: fileBase } }, function (err, f1Info) {
      if (err) {
        done(err);
        return;
      }

      // Put file's preview
      file.put(fileName, { filename: origId + '_sm', metadata: { origName: fileBase } }, function (err, f2Info) {
        if (err) {
          done(err);
          return;
        }

        // Check file exists
        file.getInfo(f1Info._id, function (err, i) {
          if (err) {
            done(err);
            return;
          }

          assert.equal(i.contentType, 'image/jpeg');

          // Check preview exists
          file.getInfo(f2Info._id, function (err, i) {
            if (err) {
              done(err);
              return;
            }

            assert.equal(i.contentType, 'image/jpeg');

            // Remove file + preview
            file.remove(f1Info._id, true, function (err) {
              if (err) {
                done(err);
                return;
              }

              // Check file not exists
              file.getInfo(f1Info._id, function (err, i) {
                if (err) {
                  done(err);
                  return;
                }

                assert.equal(i, null);

                // Check preview not exists
                file.getInfo(f2Info._id, function (err, i) {
                  if (err) {
                    done(err);
                    return;
                  }

                  assert.equal(i, null);

                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  it('put(stream)', function (done) {
    var stream = fs.createReadStream(fileName);
    file.put(stream, { metadata: { origName: fileBase } }, function (err, info) {
      if (err) { done(err); return; }

      file.getInfo(info._id, function (err, i) {
        if (err) { done(err); return; }

        assert.equal(i.contentType, 'image/jpeg');
        assert.equal(i.metadata.origName, 'lorem.jpg');
        assert.equal(i.filename, info._id.toHexString());

        file.remove(info._id, done);
      });
    });
  });

  it('put(buffer)', function (done) {
    file.put(fileContent, { metadata: { origName: fileBase } }, function (err, info) {
      if (err) { done(err); return; }

      file.getInfo(info._id, function (err, i) {
        if (err) { done(err); return; }

        assert.equal(i.contentType, 'image/jpeg');
        assert.equal(i.metadata.origName, 'lorem.jpg');
        assert.equal(i.filename, info._id.toHexString());

        file.remove(info._id, done);
      });
    });
  });

  it('getStream()', function (done) {
    file.put(fileName, { metadata: { origName: fileBase } }, function (err, info) {
      if (err) { done(err); return; }

      var chunks = [];

      file.getStream(info._id)
        .on('data', function (data) { chunks.push(data); })
        .on('end', function () {
          assert.deepEqual(Buffer.concat(chunks), fileContent);
          file.remove(info._id, done);
        });
    });
  });

});
