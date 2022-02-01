'use strict';


const assert   = require('assert');
const fs       = require('fs');
const Mongoose = require('mongoose');
const path     = require('path');

const fileName    = path.join(__dirname, 'fixtures', 'lorem.jpg');
const fileBase    = path.basename(fileName);
const fileContent = fs.readFileSync(fileName);

const file = TEST.N.models.core.File;


describe('File model test', function () {

  it('createReadStream()', async function () {
    let id = await file.put(fileName, { metadata: { origName: fileBase } });

    let chunks = [];

    await new Promise(resolve => {
      file.createReadStream(id)
        .on('data', data => { chunks.push(data); })
        .on('end', () => resolve());
    });

    assert.deepEqual(Buffer.concat(chunks), fileContent);

    await file.remove(id);
  });


  it('put(file) + remove()', async function () {
    let id = await file.put(fileName, { metadata: { origName: fileBase } });

    let i = await file.getInfo(id);

    assert.equal(i.contentType, 'image/jpeg');
    assert.equal(i.metadata.origName, 'lorem.jpg');
    assert.equal(i.filename, id.toHexString());

    await file.remove(id);
  });


  it('put(file) + remove(all)', async function () {
    let origId = new Mongoose.Types.ObjectId();

    // Put file
    let f1Id = await file.put(fileName, { _id: origId, metadata: { origName: fileBase } });

    // Put file's preview
    let f2Id = await file.put(fileName, { filename: origId + '_sm', metadata: { origName: fileBase } });

    // Check file exists
    let i = await file.getInfo(f1Id);

    assert.equal(i.contentType, 'image/jpeg');

    // Check preview exists
    i = await file.getInfo(f2Id);

    assert.equal(i.contentType, 'image/jpeg');

    // Remove file + preview
    await file.remove(f1Id, true);

    // Check file not exists
    i = await file.getInfo(f1Id);

    assert.equal(i, null);

    // Check preview not exists
    i = await file.getInfo(f2Id);

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

    let id = await file.put(stream, { metadata: { origName: fileBase } });

    let i = await file.getInfo(id);

    assert.equal(i.contentType, 'image/jpeg');
    assert.equal(i.metadata.origName, 'lorem.jpg');
    assert.equal(i.filename, id.toHexString());

    await file.remove(id);
  });


  it('put(buffer)', async function () {
    let id = await file.put(fileContent, { metadata: { origName: fileBase } });

    let i = await file.getInfo(id);

    assert.equal(i.contentType, 'image/jpeg');
    assert.equal(i.metadata.origName, 'lorem.jpg');
    assert.equal(i.filename, id.toHexString());

    await file.remove(id);
  });
});
