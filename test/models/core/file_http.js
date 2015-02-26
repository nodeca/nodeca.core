'use strict';


var fs      = require('fs');
var path    = require('path');

var request   = require('supertest')('http://localhost:3000');

var fileName    = path.join(__dirname, 'fixtures', 'lorem.jpg');
var fileBase    = path.basename(fileName);
var fileContent = fs.readFileSync(fileName);

var file    = TEST.N.models.core.File;
var router  = TEST.N.router;

describe('File (GridFS) http requests test', function () {
  var info;

  before(function (done) {
    file.put(fileName, { metadata: { origName: fileBase } }, function (err, fileInfo) {
      info = fileInfo;
      done(err);
    });
  });

  it('GET', function (done) {
    request
      .get(router.linkTo('core.gridfs', { bucket: info._id }))
      .expect(fileContent)
      .end(done);
  });

  it('HEAD', function (done) {
    request
      .head(router.linkTo('core.gridfs', { bucket: info._id }))
      .expect(200, new Buffer(0))
      .expect('Content-Type', 'image/jpeg')
      .end(done);
  });

  it('GET with ETag', function (done) {
    request
      .get(router.linkTo('core.gridfs', { bucket: info._id }))
      .set('If-None-Match', info.md5)
      .expect(304, {})
      .end(done);
  });

  it('GET with If-Modified-Since', function (done) {
    request
      .get(router.linkTo('core.gridfs', { bucket: info._id }))
      .set('If-Modified-Since', info.uploadDate.toString())
      .expect(304, {})
      .end(done);
  });

  after(function (done) {
    file.remove(info._id, done);
  });
});
