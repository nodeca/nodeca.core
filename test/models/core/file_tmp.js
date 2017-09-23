'use strict';


const assert   = require('assert');
const fs       = require('fs');
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


  it('remove for not existing file', async function () {
    await file.remove('012345678901234567890123'); // by _id
    await file.remove('not_existing_file.txt');
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
