'use strict';


const assert   = require('assert');
const fs       = require('fs');
const Mongoose = require('mongoose');
const path     = require('path');

const fileName    = path.join(__dirname, 'fixtures', 'lorem.jpg');
const fileBase    = path.basename(fileName);
const fileContent = fs.readFileSync(fileName);

const file = TEST.N.models.core.FileTmp;


describe('FileTmp model test', function () {

  it('createReadStream()', async function () {
    let info = await file.put(fileName, { metadata: { origName: fileBase } });

    let chunks = [];

    await new Promise(resolve => {
      file.createReadStream(info._id)
        .on('data', data => { chunks.push(data); })
        .on('end', () => resolve());
    });

    assert.deepEqual(Buffer.concat(chunks), fileContent);

    await file.remove(info._id);
  });


  it('put(file) + remove()', async function () {
    let info = await file.put(fileName, { metadata: { origName: fileBase } });

    let i = await file.getInfo(info._id);

    assert.equal(i.contentType, 'image/jpeg');
    assert.equal(i.metadata.origName, 'lorem.jpg');
    assert.equal(i.filename, info._id.toHexString());

    await file.remove(info._id);
  });


  it('put(file) + remove(all)', async function () {
    let origId = new Mongoose.Types.ObjectId();

    // Put file
    let f1Info = await file.put(fileName, { _id: origId, metadata: { origName: fileBase } });

    // Put file's preview
    let f2Info = await file.put(fileName, { filename: origId + '_sm', metadata: { origName: fileBase } });

    // Check file exists
    let i = await file.getInfo(f1Info._id);

    assert.equal(i.contentType, 'image/jpeg');

    // Check preview exists
    i = await file.getInfo(f2Info._id);

    assert.equal(i.contentType, 'image/jpeg');

    // Remove file + preview
    await file.remove(f1Info._id, true);

    // Check file not exists
    i = await file.getInfo(f1Info._id);

    assert.equal(i, null);

    // Check preview not exists
    i = await file.getInfo(f2Info._id);

    assert.equal(i, null);
  });


  it('remove for not existing file', async function () {
    await file.remove('012345678901234567890123'); // by _id
    await file.remove('not_existing_file.txt');
  });


  it('remove(all) for not existing file', async function () {
    await file.remove('012345678901234567890123', true); // by _id
    await file.remove('not_existing_file.txt', true);
  });


  it('put(stream)', async function () {
    let stream = fs.createReadStream(fileName);

    let info = await file.put(stream, { metadata: { origName: fileBase } });

    let i = await file.getInfo(info._id);

    assert.equal(i.contentType, 'image/jpeg');
    assert.equal(i.metadata.origName, 'lorem.jpg');
    assert.equal(i.filename, info._id.toHexString());

    await file.remove(info._id);
  });


  it('put(buffer)', async function () {
    let info = await file.put(fileContent, { metadata: { origName: fileBase } });

    let i = await file.getInfo(info._id);

    assert.equal(i.contentType, 'image/jpeg');
    assert.equal(i.metadata.origName, 'lorem.jpg');
    assert.equal(i.filename, info._id.toHexString());

    await file.remove(info._id);
  });
});
