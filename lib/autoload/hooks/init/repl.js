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

  const SOCKET_PATH = path.resolve(N.mainApp.root, N.config.repl);

  N.wire.after('init:server', function repl_init() {
    // run only in master
    if (cluster.isWorker) return;

    // prevent EADDRINUSE if socket wasn't removed previously (e.g. kill -9)
    try {
      if (fs.statSync(SOCKET_PATH).isSocket()) fs.unlinkSync(SOCKET_PATH);
    } catch (__) {}

    let replServer = net.createServer(socket => {
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
    }).listen(SOCKET_PATH);

    N.wire.on('exit.terminate', function repl_close() {
      replServer.close();

      try {
        if (fs.statSync(SOCKET_PATH).isSocket()) fs.unlinkSync(SOCKET_PATH);
      } catch (__) {}
    });
  });
};
