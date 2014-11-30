/*global describe, it*/


'use strict';


var fs      = require('fs');
var path    = require('path');
var assert  = require('assert');

var fileName    = path.join(__dirname, 'fixtures', 'lorem.jpg');
var fileBase    = path.basename(fileName);
var fileContent = fs.readFileSync(fileName);

var file = global.TEST_N.models.core.File;


describe('File model test', function () {

  it('put(file) + remove()', function (done) {
    file.put(fileName, { metadata: { origName: fileBase } }, function (err, info) {
      if (err) { done(err); return; }

      file.getInfo(info._id, function(err, i) {
        if (err) { done(err); return; }

        assert.equal(i.contentType, 'image/jpeg');
        assert.equal(i.metadata.origName, 'lorem.jpg');
        assert.equal(i.filename, info._id.toHexString());

        file.remove(info._id, done);
      });
    });
  });

  it('put(stream)', function (done) {
    var stream = fs.createReadStream(fileName);
    file.put(stream, { metadata: { origName: fileBase } }, function (err, info) {
      if (err) { done(err); return; }

      file.getInfo(info._id, function(err, i) {
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

      file.getInfo(info._id, function(err, i) {
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
