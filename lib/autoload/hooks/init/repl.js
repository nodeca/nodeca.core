// Create REPL socket
//

'use strict';


const cluster = require('cluster');
const fs      = require('fs');
const net     = require('net');
const path    = require('path');
const repl    = require('repl');


module.exports = function (N) {
  if (!N.config.repl) return;

  let socket_path, listen_port, listen_host;

  if (typeof N.config.repl === 'string') {
    // unix socket
    socket_path = path.resolve(N.mainApp.root, N.config.repl);
    listen_port = socket_path;
  } else {
    // tcp socket
    listen_port = N.config.repl;
    listen_host = 'localhost';
  }


  let pools = [];

  N.wire.before('init:services', function repl_init() {
    // run only in master
    if (cluster.isWorker) return;

    // prevent EADDRINUSE if socket wasn't removed previously (e.g. kill -9)
    try {
      if (fs.statSync(socket_path).isSocket()) fs.unlinkSync(socket_path);
    } catch (__) {}

    let replServer = net.createServer(socket => {
      // Common telnet greeting:
      // IAC WILL ECHO IAC WILL SUPPRESS-GO-AHEAD IAC WONT LINEMODE
      //
      // Telnet will acknowledge it causing "nodeca> ����" to appear on the screen
      //
      socket.write(Buffer.from([ 255, 251, 1, 255, 251, 3, 255, 252, 34 ]));

      let r = repl.start({
        prompt:          'nodeca> ',
        input:           socket,
        output:          socket,
        terminal:        true,
        ignoreUndefined: true
      }).on('exit', () => {
        socket.end();
      });

      r.context.N = N;

      r.context.help = [
        'help        - display this text',
        'reload()    - reload all workers',
        'shutdown()  - close server gracefully',
        'terminate() - close server quickly',
        'workers     - show worker details'
      ];

      [ 'shutdown', 'reload', 'terminate' ].forEach(command => {
        r.context[command] = () => N.wire.emit(command);
      });

      Object.defineProperty(r.context, 'workers', {
        get() {
          return pools.reduce((acc, pool) =>
            acc.concat(pool.list().map(worker => ({
              pid:     worker.pid,
              uptime:  Math.round((Date.now() - worker.started) / 1000), // in seconds
              state:   worker.current,
              'class': worker.class
            })))
          , []);
        }
      });
    }).listen(listen_port, listen_host);

    N.wire.before([ 'exit.shutdown', 'exit.terminate' ], function repl_close() {
      replServer.close();

      try {
        if (fs.statSync(socket_path).isSocket()) fs.unlinkSync(socket_path);
      } catch (__) {}
    });
  });


  // Get list of worker pools (we can do that after services are
  // initialized because worker pools don't change over time)
  //
  N.wire.after('init:services', function* repl_get_pools() {
    yield N.wire.emit('init:services.list', pools = []);
  });
};
