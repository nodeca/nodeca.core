// Init navit
//
'use strict';


/*global window, TEST*/
const _       = require('lodash');
const url     = require('url');


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
      if (!userLogin) {
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

      this.fn(async function auth() {
        let user = await TEST.N.models.users.User
                                 .findOne({ nick: userLogin })
                                 .lean(false); // some tests use user.save()

        // Create user entry if it doesn't exist
        //
        if (!user) {
          user = new TEST.N.models.users.User({ nick: userLogin });

          await user.save();
        }

        // Create user session auth record
        //
        let authSession = await TEST.N.models.users.AuthSession
                                  .findOne({ user: user._id })
                                  .lean(true);

        if (!authSession) {
          authSession = new TEST.N.models.users.AuthSession({ user: user._id });

          await authSession.save();
        }

        cookieObj.value = authSession.session_id;

        // Invoke callback for `do.auth(login, callback)`
        //
        if (fn) fn(user);

      });

      // Delete cookie first, because override may fail if previous garbage
      // exists with different security settings.
      //
      this.cookie(function () {
        return Object.assign({}, cookieObj, { expires: 0 });
      });

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
    // Should not require this package on production installs
    const navit   = require('navit');

    global.TEST.browser = navit({
      engine: 'electron',
      timeout: 20000 // Increase waiting timeout, 5000ms not enougth for tests.
    })
    .use(navitPlugins);

    N.wire.before([ 'exit.shutdown', 'exit.terminate' ], function navit_shutdown(__, callback) {
      TEST.browser.exit(() => callback());
    });
  });
};
