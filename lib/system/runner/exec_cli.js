// Final stage of runner's bootstrap. Searches for all CLI command scripts
// (`cli/*.js` files) in all applications and then executes requested command:
//
//    ./nodeca.js server
//
// will excutes `cli/server.js` command (if any).
//
'use strict';


const path = require('path');

const _       = require('lodash');
const fstools = require('fs-tools');

const ArgumentParser = require('argparse').ArgumentParser;


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N, callback) {
  // main parser instance
  let argparser = new ArgumentParser({
    addHelp:  true,
    epilog:   'See \'%(prog)s <command> --help\' for ' +
              'more information on specific command.'
  });

  // sub-parser for commands
  let cmdArgparsers = argparser.addSubparsers({
    title:    'Known commands',
    metavar:  '<command>',
    dest:     'command'
  });

  // collect cli scripts

  let commands = {};

  try {
    N.apps.forEach(app => {
      let cliRoot = path.join(app.root, 'cli');

      fstools.walkSync(cliRoot, /\.js$/, function (file) {
        let cli, cmd, subArgparser;

        // skip:
        // - filename starts with underscore, e.g.: /foo/bar/_baz.js
        // - dirname of file starts with underscore, e.g. /foo/_bar/baz.js
        if (file.match(/(^|\/|\\)_/)) {
          return;
        }

        cli          = require(file);
        cmd          = cli.commandName || path.basename(file, '.js');
        subArgparser = cmdArgparsers.addParser(cmd, cli.parserParameters);
        cli.commandLineArguments = cli.commandLineArguments || [];

        // append command arguments
        cli.commandLineArguments.forEach(
          item => subArgparser.addArgument(item.args, item.options)
        );

        // store command
        commands[cmd] = cli;

      });
    });
  } catch (err) {
    callback(err);
    return;
  }

  if (_.values(commands).length === 0) {
    callback("Can't find available CLI commands. Please, check config files.");
    return;
  }

  // by default (no params) - run server
  if (N.args.length === 0 && commands.server) {
    N.args.unshift('server');
  }

  var args = argparser.parseArgs(N.args);

  commands[args.command].run(N, args, callback);
};
