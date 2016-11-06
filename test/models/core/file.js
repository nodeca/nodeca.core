'use strict';


const assert   = require('assert');
const Promise  = require('bluebird');
const fs       = require('fs');
const Mongoose = require('mongoose');
const path     = require('path');

const fileName    = path.join(__dirname, 'fixtures', 'lorem.jpg');
const fileBase    = path.basename(fileName);
const fileContent = fs.readFileSync(fileName);

const file = TEST.N.models.core.File;


describe('File model test', function () {

  it('createReadStream()', Promise.coroutine(function* () {
    let info = yield file.put(fileName, { metadata: { origName: fileBase } });

    let chunks = [];

    yield new Promise(resolve => {
      file.createReadStream(info._id)
        .on('data', data => { chunks.push(data); })
        .on('end', () => resolve());
    });

    assert.deepEqual(Buffer.concat(chunks), fileContent);

    yield file.remove(info._id);
  }));


  it('put(file) + remove()', Promise.coroutine(function* () {
    let info = yield file.put(fileName, { metadata: { origName: fileBase } });

    let i = yield file.getInfo(info._id);

    assert.equal(i.contentType, 'image/jpeg');
    assert.equal(i.metadata.origName, 'lorem.jpg');
    assert.equal(i.filename, info._id.toHexString());

    yield file.remove(info._id);
  }));


  it('put(file) + remove(all)', Promise.coroutine(function* () {
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


  it('put(stream)', Promise.coroutine(function* () {
    let stream = fs.createReadStream(fileName);

    let info = yield file.put(stream, { metadata: { origName: fileBase } });

    let i = yield file.getInfo(info._id);

    assert.equal(i.contentType, 'image/jpeg');
    assert.equal(i.metadata.origName, 'lorem.jpg');
    assert.equal(i.filename, info._id.toHexString());

    yield file.remove(info._id);
  }));


  it('put(buffer)', Promise.coroutine(function* () {
    let info = yield file.put(fileContent, { metadata: { origName: fileBase } });

    let i = yield file.getInfo(info._id);

    assert.equal(i.contentType, 'image/jpeg');
    assert.equal(i.metadata.origName, 'lorem.jpg');
    assert.equal(i.filename, info._id.toHexString());

    yield file.remove(info._id);
  }));
});
