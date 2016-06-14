// Init navit
//
'use strict';


/*global window, TEST*/
const _     = require('lodash');
const co    = require('bluebird-co').co;
const navit = require('navit');
const url   = require('url');


module.exports = function (N) {

  function navitPlugins(navit) {

    // Authenticate user by login. You should reload page after use this or use before `.open`
    //
    // - login (String) - if empty - do logout, if exists - login, if not exists - create and login
    // - callback(user) (Function) - optional
    //
    navit.registerMethod('do.auth', function do_auth(login, fn) {
      let userLogin = _.isFunction(login) ? login() : login;
      let domain = url.parse(TEST.N.config.bind.default.mount).hostname;

      // If `login` not specified - do logout
      if (!login) {
        this.cookie({
          name: 'sid',
          value: '',
          domain,
          expires: Date.now() - 1000
        });

        return this;
      }

      let cookieObj = {
        name: 'sid',
        value: '', // changed by a function below
        domain,
        httponly: true,
        secure: false,
        expires: (new Date()).getTime() + (1000 * 60 * 60 * 24 * 365) // expires in 1 year
      };

      let user;

      this.fn(callback => co(function* auth() {
        let user = yield TEST.N.models.users.User
                                 .findOne({ nick: login })
                                 .lean(false); // some tests use user.save()

        // Create user entry if it doesn't exist
        //
        if (!user) {
          user = new TEST.N.models.users.User({ nick: login });

          yield user.save();
        }

        // Create user token
        //
        let token = yield TEST.N.models.users.TokenLogin
                                  .findOne({ user: user._id })
                                  .lean(true);

        if (!token) {
          token = new TEST.N.models.users.TokenLogin({ user: user._id });

          yield token.save();
        }

        cookieObj.value = token.session_id;

        // Invoke callback for `do.auth(login, callback)`
        //
        if (fn) fn(user);

      }).asCallback(callback));


      // Set cookie
      //
      this.cookie(function () {
        return cookieObj;
      });

      return this;
    });


    // Wait for nodeca scripts load and check status
    //
    navit.batch.create('waitNodecaBooted', function () {
      this
        .wait(function () {
          try {
            return window.NodecaLoader.booted;
          } catch (__) {}
          return false;
        })
        .test.status(200);
    });

    navit.afterOpen = function () {
      this.batch('waitNodecaBooted');
    };
  }


  N.wire.on('init:tests', function init_navit() {
    global.TEST.browser = navit({ engine: 'slimerjs' }).use(navitPlugins);

    N.wire.before([ 'exit.shutdown', 'exit.terminate' ], function navit_shutdown(__, callback) {
      TEST.browser.close(() => callback());
    });
  });
};
