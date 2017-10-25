'use strict';


const assert     = require('assert');
const SMTPServer = require('smtp-server').SMTPServer;


describe('Mailer', function () {
  let smtp;
  let on_message;


  before(function (done) {
    smtp = new SMTPServer({
      authOptional: true,
      onData(stream, session, callback) {
        let data = '';
        stream.setEncoding('utf8');

        stream.on('data', d => { data += d; });
        stream.on('end', () => {
          on_message(session, data);
          callback();
        });
      }
    });

    smtp.listen(2525, done);
  });


  it('.send()', function (done) {
    let data = {
      to: 'test@example.com',
      subject: 'test subject',
      html: '<h1>Hello world!</h1>'
    };

    on_message = (session, data) => {
      assert.equal(session.envelope.rcptTo.length, 1);
      assert.strictEqual(session.envelope.rcptTo[0].address, 'test@example.com');
      assert.strictEqual(session.envelope.mailFrom.address, TEST.N.config.email.from);
      assert.ok(data.indexOf('<h1>Hello world!</h1>') !== -1);

      done();
    };

    TEST.N.mailer.send(data).catch(done);
  });


  after(done => smtp.close(done));
});
