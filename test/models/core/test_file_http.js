'use strict';


const fs          = require('fs');
const path        = require('path');
const request     = require('supertest')('');

const fileName    = path.join(__dirname, 'fixtures', 'lorem.jpg');
const fileBase    = path.basename(fileName);
const fileContent = fs.readFileSync(fileName);

const file        = TEST.N.models.core.File;
const router      = TEST.N.router;

describe('File (GridFS) http requests test', function () {
  let info;

  before(async function () {
    let id = await file.put(fileName, { metadata: { origName: fileBase } });

    info = await file.getInfo(id);
  });

  it('GET', function () {
    return request
      .get(router.linkTo('core.gridfs', { bucket: info._id }))
      .expect(fileContent);
  });

  it('HEAD', function () {
    return request
      .head(router.linkTo('core.gridfs', { bucket: info._id }))
      .expect(200, {})
      .expect('Content-Type', 'image/jpeg');
  });

  it('GET with ETag', function () {
    return request
      .get(router.linkTo('core.gridfs', { bucket: info._id }))
      .set('If-None-Match', info._id)
      .expect(304, {});
  });

  it('GET with If-Modified-Since', function () {
    return request
      .get(router.linkTo('core.gridfs', { bucket: info._id }))
      .set('If-Modified-Since', info.uploadDate.toUTCString())
      .expect(304, {});
  });

  after(async function () {
    await file.remove(info._id);
  });
});
