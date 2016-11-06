'use strict';


const fs          = require('fs');
const path        = require('path');
const Promise     = require('bluebird');

const request     = require('supertest')('');

const fileName    = path.join(__dirname, 'fixtures', 'lorem.jpg');
const fileBase    = path.basename(fileName);
const fileContent = fs.readFileSync(fileName);

const file        = TEST.N.models.core.File;
const router      = TEST.N.router;

describe('File (GridFS) http requests test', function () {
  let info;

  before(Promise.coroutine(function* () {
    info = yield file.put(fileName, { metadata: { origName: fileBase } });
  }));

  it('GET', function (done) {
    request
      .get(router.linkTo('core.gridfs', { bucket: info._id }))
      .expect(fileContent)
      .end(done);
  });

  it('HEAD', function (done) {
    request
      .head(router.linkTo('core.gridfs', { bucket: info._id }))
      .expect(200, {})
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

  after(Promise.coroutine(function* () {
    yield file.remove(info._id);
  }));
});
