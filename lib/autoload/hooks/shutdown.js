// Shut down system when receiving 'shutdown' or 'terminate' events
//

'use strict';


module.exports = function (N) {
  N.wire.after([ 'shutdown', 'terminate' ], { priority: 999, ensure: true }, function process_exit(code) {
    if (N.logger && N.logger.shutdown) {
      N.logger.shutdown(function () {
        process.exit(code || 0);
      });
      return;
    }

    process.exit(code || 0);
  });
};
