'use strict';


const fs       = require('fs');
const path     = require('path');
const assert   = require('assert');
const co       = require('co');
const Mongoose = require('mongoose');

const fileName    = path.join(__dirname, 'fixtures', 'lorem.jpg');
const fileBase    = path.basename(fileName);
const fileContent = fs.readFileSync(fileName);

const file = TEST.N.models.core.File;


describe('File model test', function () {


  describe('callbacks', function () {

    it('put(file) + remove()', function (done) {
      file.put(fileName, { metadata: { origName: fileBase } }, (err, info) => {
        if (err) { done(err); return; }

        file.getInfo(info._id, (err, i) => {
          if (err) { done(err); return; }

          assert.equal(i.contentType, 'image/jpeg');
          assert.equal(i.metadata.origName, 'lorem.jpg');
          assert.equal(i.filename, info._id.toHexString());

          file.remove(info._id, done);
        });
      });
    });

    it('put(file) + remove(all)', function (done) {
      let origId = new Mongoose.Types.ObjectId();

      /*eslint-disable max-nested-callbacks*/

      // Put file
      file.put(fileName, { _id: origId, metadata: { origName: fileBase } }, (err, f1Info) => {
        if (err) {
          done(err);
          return;
        }

        // Put file's preview
        file.put(fileName, { filename: origId + '_sm', metadata: { origName: fileBase } }, (err, f2Info) => {
          if (err) {
            done(err);
            return;
          }

          // Check file exists
          file.getInfo(f1Info._id, (err, i) => {
            if (err) {
              done(err);
              return;
            }

            assert.equal(i.contentType, 'image/jpeg');

            // Check preview exists
            file.getInfo(f2Info._id, (err, i) => {
              if (err) {
                done(err);
                return;
              }

              assert.equal(i.contentType, 'image/jpeg');

              // Remove file + preview
              file.remove(f1Info._id, true, (err) => {
                if (err) {
                  done(err);
                  return;
                }

                // Check file not exists
                file.getInfo(f1Info._id, (err, i) => {
                  if (err) {
                    done(err);
                    return;
                  }

                  assert.equal(i, null);

                  // Check preview not exists
                  file.getInfo(f2Info._id, (err, i) => {
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
      let stream = fs.createReadStream(fileName);
      file.put(stream, { metadata: { origName: fileBase } }, (err, info) => {
        if (err) { done(err); return; }

        file.getInfo(info._id, (err, i) => {
          if (err) { done(err); return; }

          assert.equal(i.contentType, 'image/jpeg');
          assert.equal(i.metadata.origName, 'lorem.jpg');
          assert.equal(i.filename, info._id.toHexString());

          file.remove(info._id, done);
        });
      });
    });

    it('put(buffer)', function (done) {
      file.put(fileContent, { metadata: { origName: fileBase } }, (err, info) => {
        if (err) { done(err); return; }

        file.getInfo(info._id, (err, i) => {
          if (err) { done(err); return; }

          assert.equal(i.contentType, 'image/jpeg');
          assert.equal(i.metadata.origName, 'lorem.jpg');
          assert.equal(i.filename, info._id.toHexString());

          file.remove(info._id, done);
        });
      });
    });

    it('getStream()', function (done) {
      file.put(fileName, { metadata: { origName: fileBase } }, (err, info) => {
        if (err) { done(err); return; }

        let chunks = [];

        file.getStream(info._id)
          .on('data', data => { chunks.push(data); })
          .on('end', () => {
            assert.deepEqual(Buffer.concat(chunks), fileContent);
            file.remove(info._id, done);
          });
      });
    });

  });


  describe('promises', function () {

    it('put(file) + remove()', co.wrap(function* () {
      let info = yield file.put(fileName, { metadata: { origName: fileBase } });

      let i = yield file.getInfo(info._id);

      assert.equal(i.contentType, 'image/jpeg');
      assert.equal(i.metadata.origName, 'lorem.jpg');
      assert.equal(i.filename, info._id.toHexString());

      yield file.remove(info._id);
    }));

    it('put(file) + remove(all)', co.wrap(function* () {
      let origId = new Mongoose.Types.ObjectId();

      // Put file
      let f1Info = yield file.put(fileName, { _id: origId, metadata: { origName: fileBase } });

      // Put file's preview
      let f2Info = yield file.put(fileName, { filename: origId + '_sm', metadata: { origName: fileBase } });

      // Check file exists
      let i = yield file.getInfo(f1Info._id);

      assert.equal(i.contentType, 'image/jpeg');

      // Check preview exists
      i = yield file.getInfo(f2Info._id);

      assert.equal(i.contentType, 'image/jpeg');

      // Remove file + preview
      yield file.remove(f1Info._id, true);

      // Check file not exists
      i = yield file.getInfo(f1Info._id);

      assert.equal(i, null);

      // Check preview not exists
      i = yield file.getInfo(f2Info._id);

      assert.equal(i, null);
    }));

    it('put(stream)', co.wrap(function* () {
      let stream = fs.createReadStream(fileName);

      let info = yield file.put(stream, { metadata: { origName: fileBase } });

      let i = yield file.getInfo(info._id);

      assert.equal(i.contentType, 'image/jpeg');
      assert.equal(i.metadata.origName, 'lorem.jpg');
      assert.equal(i.filename, info._id.toHexString());

      yield file.remove(info._id);
    }));

    it('put(buffer)', co.wrap(function* () {
      let info = yield file.put(fileContent, { metadata: { origName: fileBase } });

      let i = yield file.getInfo(info._id);

      assert.equal(i.contentType, 'image/jpeg');
      assert.equal(i.metadata.origName, 'lorem.jpg');
      assert.equal(i.filename, info._id.toHexString());

      yield file.remove(info._id);
    }));

  });

});
