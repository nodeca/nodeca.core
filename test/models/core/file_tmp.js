'use strict';


const assert   = require('assert');
const Promise  = require('bluebird');
const fs       = require('fs');
const path     = require('path');

const fileName    = path.join(__dirname, 'fixtures', 'lorem.jpg');
const fileBase    = path.basename(fileName);
const fileContent = fs.readFileSync(fileName);

const file = TEST.N.models.core.FileTmp;


describe('FileTmp model test', function () {

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
