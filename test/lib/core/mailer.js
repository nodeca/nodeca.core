'use strict';


const assert     = require('assert');
const simplesmtp = require('simplesmtp');


describe('Mailer', function () {
  let smtp;


  before(function (done) {
    smtp = simplesmtp.createServer({ disableDNSValidation: true });

    smtp.on('startData', connection => { connection.body = ''; });
    smtp.on('data', (connection, chunk) => { connection.body += chunk; });

    smtp.listen(2525, done);
  });


  it('.send()', function (done) {
    let data = {
      to: 'test@example.com',
      subject: 'test subject',
      html: '<h1>Hello world!</h1>'
    };

    smtp.once('dataReady', (connection, cb) => {
      assert.deepStrictEqual(connection.to, [ 'test@example.com' ]);
      assert.strictEqual(connection.from, TEST.N.config.email.from);
      assert.ok(connection.body.indexOf('<h1>Hello world!</h1>') !== -1);

      done();
      cb();
    });

    TEST.N.mailer.send(data).catch(done);
  });


  after(done => smtp.end(done));
});
