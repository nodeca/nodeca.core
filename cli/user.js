"use strict";


// 3rd-party
var _     = require('underscore');
var async = require('async');

////////////////////////////////////////////////////////////////////////////////


module.exports.parserParameters = {
  addHelp:      true,
  help:         'Create user and assign with some groups',
  description:  'Create user '
};


module.exports.commandLineArguments = [
  {
    args:    [ 'action' ],
    options: {
      help:   'cli command add/update',
      choices: ['add', 'update']
    }
  },
  {
    args:    [ '--group' ],
    options: {
      dest:         'mark_to_add',
      help:         'add user to group',
      action:       'append',
      defaultValue: [],
      type: 'string'
    }
  },
  {
    args:    [ '--no-group' ],
    options: {
      dest:         'mark_to_remove',
      help:         'remove user from group',
      action:       'append',
      defaultValue: [],
      type: 'string'
    }
  },
  {
    args:    [ '-u', '--user' ],
    options: {
      help:         'target user',
      type: 'string',
      required: true
    }
  },
  {
    args:    [ '--pass' ],
    options: {
      help:         'user passsword. required only for add command',
      type: 'string'

    }
  },
  {
    args:    [ '--email' ],
    options: {
      help:         'user email. required only for add command',
      type: 'string'
    }
  }
];


module.exports.run = function (N, args, callback) {
  async.series(
    _.map([
      require('../lib/system/init/models'),
      require('../lib/system/init/stores'),
      require('../lib/system/init/check_migrations')
    ], function (fn) { return async.apply(fn, N); })

    , function (err) {
      var user      = null;
      var to_add    = {};
      var to_remove = [];

      // FIXME check to_remove and to_add intersection
      async.series([
        // fetch usergroups
        function (callback) {
          var UserGroup = N.models.users.UserGroup;

          UserGroup.find().select('_id short_name').exec(function (err, docs) {
            if (err) {
              callback(err);
              return;
            }

            docs.forEach(function (group) {
              if (args.mark_to_remove.indexOf(group.short_name) !== -1) {
                to_remove.push(group._id.toString());
              }
              if (args.mark_to_add.indexOf(group.short_name) !== -1) {
                to_add[group._id.toString()] = group;
              }
            });

            // FIXME check all groups were found from both lists?
            callback();
          });
        },

        // find or create user
        function (callback) {
          // FIXME test existing login and email
          var User = N.models.users.User;
          var auth = new N.models.users.AuthLink();

          if ('add' === args.action) {
            // FIXME user revalidator for pass and email test
            if (!args.pass || !args.email) {
              callback('Invalid password or email');
              return;
            }

            user = new User({
              nick: args.user,
              joined_ts: new Date
            });

            user.save(function (err) {
              if (err) {
                callback(err);
                return;
              }

              var provider = auth.providers.create({
                'type': 'plain',
                'email': args.email
              });

              provider.setPass(args.pass);

              auth.user_id = user._id;
              auth.providers.push(provider);

              auth.save(callback);
            });
          } else {
            User.findOne({nick: args.user}).exec(function (err, doc) {
              if (err) {
                callback(err);
                return;
              }
              if (!user) {
                callback('User not found, check name or use `add`');
              }
              user = doc;
              callback();
            });
          }
        },

        // update groups
        function (callback) {
          if (!_.isEmpty(to_remove) && !_.isEmpty(user.usergroups)) {
            user.usergroups = user.usergroups.filter(function (group) {
              return to_remove.indexOf(group.toString()) === -1;
            });
          }
          if (!_.isEmpty(to_add)) {
            // remove from to_add list already assigned groups
            user.usergroups.forEach(function (group) {
              var group_id = group.toString();
              if (to_add[group_id]) {
                to_add = _.without(to_add, group_id);
              }
            });
            if (!_.isEmpty(to_add)) {
              _.values(to_add).forEach(function (group) {
                user.usergroups.push(group);
              });
            }
          }
          user.save(callback);
        }
      ], function (err) {
        if (err) {
          console.log(err + "\n");
          process.exit(0);
        }

        console.log('OK\n');
        process.exit(0);
      });
    }
  );
};
