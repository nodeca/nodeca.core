/*global describe, it, before, after*/


'use strict';


var fs      = require('fs');
var path    = require('path');
var assert  = require('assert');

var request   = require('supertest')('http://localhost:3000');
var sbuffers  = require('stream-buffers');

var fileName    = path.join(__dirname, 'fixtures', 'lorem.jpg');
var fileBase    = path.basename(fileName);
var fileContent = fs.readFileSync(fileName);

var file    = global.TEST_N.models.core.File;
var router  = global.TEST_N.router;

describe('File (GridFS) http requests test', function () {
  var info;

  before(function (done) {
    file.put(fileName, { metadata: { origName: fileBase } }, function (err, fileInfo) {
      info = fileInfo;
      done(err);
    });
  });

  it('GET', function (done) {
    var sb = new sbuffers.WritableStreamBuffer();

    request
      .get(router.linkTo('core.gridfs', { bucket: info._id }))
      .on('end', function () {
        assert.equal(sb.getContents().toString('hex'), fileContent.toString('hex'));
        done();
      })
      .pipe(sb);
  });

  it('HEAD', function (done) {
    request
      .head(router.linkTo('core.gridfs', { bucket: info._id }))
      .expect(200)
      .expect(function (res) {
        if (res.text) { return 'Body should be empty'; }
      })
      .expect('Content-Type', 'image/jpeg')
      .end(done);
  });

  it('GET with ETag', function (done) {
    request
      .get(router.linkTo('core.gridfs', { bucket: info._id }))
      .set('If-None-Match', info.md5)
      .expect(304)
      .expect(function (res) {
        if (res.text) { return 'Body should be empty'; }
      })
      .end(done);
  });

  it('GET with If-Modified-Since', function (done) {
    request
      .get(router.linkTo('core.gridfs', { bucket: info._id }))
      .set('If-Modified-Since', (new Date(Date.now() + 1000 * 60)).toString())
      .expect(304)
      .expect(function (res) {
        if (res.text) { return 'Body should be empty'; }
      })
      .end(done);
  });

  after(function (done) {
    file.remove(info._id, done);
  });
});
