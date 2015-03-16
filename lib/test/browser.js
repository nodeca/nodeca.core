// Nightmare extension
//

'use strict';

/*global window, TEST, NodecaLoader, document*/

var Nightmare = require('nightmare');
var assert    = require('assert');
var _         = require('lodash');
var fs        = require('fs');
var path      = require('path');
var rnd       = require('nodeca.core/lib/rnd');

function noop() {}


function Browser(options) {
  Nightmare.call(this, options);

  // Rethrow errors not rethrown by `page.onConsoleMessage`
  this.on('error', assert.ifError);
}

// Extends Nightmare
Browser.prototype = Object.create(Nightmare.prototype);


// Execute code on client side and wait for result. Parameters such
// as in `nightmare.evaluate`. Last `func` parameter should be callback.
//
//   .evaluateAsync(function (param1, done) {
//     setTimeout(function () {
//       if (param1 === 'param1') {
//         done('result 123');
//       } else {
//         done('fail');
//       }
//     }, 1000)
//   }, function (res) {
//     assert.equal(res, 'result 123');
//   }, 'param1')
//
Browser.prototype.evaluateAsync = function (func, callback/**, arg1, arg2...*/) {
  var globVarsSuffix = Math.round(Math.random() * 1000000000);

  var clientFuncWrapperText = _.template('' +
    'function () {' +
    '  arguments[arguments.length - 1] = function (result) {' +
    '    window.__evAsyncResult<%= suffix %> = result;' +
    '    window.__evAsyncDone<%= suffix %> = true;' +
    '  };' +
    '' +
    '  var fn = <%= clientFuncText %>;' +
    '' +
    '  return fn.apply(this, arguments);' +
    '}')({
      clientFuncText: func.toString(),
      suffix: globVarsSuffix
    });

  var waitFuncText = _.template('' +
    'function () {' +
    '  return window.__evAsyncDone<%= suffix %> || false;' +
    '}')({
        suffix: globVarsSuffix
      });

  var evalArgs = [].slice.call(arguments);

  evalArgs[0] = clientFuncWrapperText;
  evalArgs[1] = noop;

  return this
    .evaluate.apply(this, evalArgs)

    // Wait for the client function finish or timeout
    .wait(waitFuncText, true)

    // Get result and call callback
    .evaluate(function (suffix) {
      // Make sure that the client function finished
      assert.ok(window['__evAsyncDone' + suffix], 'evaluateAsync error: time out');

      var res = window['__evAsyncResult' + suffix];

      window['__evAsyncResult' + suffix] = null;
      window['__evAsyncDone' + suffix] = false;

      return res;
    }, callback || noop, globVarsSuffix);
};


// Authenticate user by login. You should reload page after use this or use before `.goto`
//
// - login (String) - if empty - do logout, if exists - login, if not exists - create and login
// - callback(user) (Function) - optional
//
Browser.prototype.auth = function (login, callback) {
  var self = this;

  // If `login` not specified - do logout
  if (!login) {
    this.queue.push([ function () {
      self.phantomJS.clearCookies();
    }, [ ] ]);

    return this;
  }

  function createSession (user, done) {
    var sessionId = rnd();

    TEST.N.redis.setex(
      'sess:' + sessionId,
      1 * 60 * 60,
      JSON.stringify({
        user_id: user._id.toString()
      })
    );

    self.phantomJS.clearCookies();
    self.phantomJS.addCookie('sid', sessionId, 'localhost');

    if (callback) {
      callback(user);
    }

    done();
  }

  function authFn (login, done) {
    TEST.N.models.users.User
        .findOne({ nick: login })
        .lean(true)
        .exec(function (err, user) {

      assert.ifError(err);

      // If user not exist - create new
      if (!user) {
        user = new TEST.N.models.users.User({
          nick: login
        });

        user.save(function (err) {
          assert.ifError(err);

          createSession(user, done);
        });
        return;
      }

      createSession(user, done);
    });
  }

  this.queue.push([ authFn, [ login ] ]);
  return this;
};


Browser.prototype.setupClientEnv = function () {
  var chaiPath = path.join(path.dirname(require.resolve('chai')), 'chai.js');
  var clientUtilsPath = require.resolve('./setup_client_env');

  return this
    .evaluate('function () {' + fs.readFileSync(chaiPath, 'utf8') + '}')
    .evaluate('function () {' + fs.readFileSync(clientUtilsPath, 'utf8') + '}');
};


// Override `Nightmare.goto`. Waits for `NodecaLoader.booted`.
//
// - url (String || Function)
//
Browser.prototype.goto = function (url) {
  var self = this;

  this.queue.push([ function (url, done) {
    self.page.open(_.isFunction(url) ? url() : url, done);
  }, [ url ] ]);

  this.setupClientEnv();

  this.wait(function () {
    return NodecaLoader.booted;
  }, true);

  return this;
};


// Override `Nightmare.refresh`. Similar to `goto`.
//
Browser.prototype.refresh = function () {
  var self = this;

  this.queue.push([ function (done) {
    self.page.evaluate(function() {
      document.location.reload(true);
    }, done);
  }, [ ] ]);

  this.setupClientEnv();

  this.wait(function () {
    return NodecaLoader.booted;
  }, true);

  return this;
};


// Override `Nightmare.setup` to inject console handler and set viewport by default
//
Browser.prototype.setup = function(done) {
  var self = this;

  this.setupInstance(function(instance) {
    instance.createPage(function(page) {

      page.onConsoleMessage(function (msg) {

        // If msg is serialized assertion error - unserialize and rethrow
        if (msg.indexOf('AssertionError:') === 0) {
          assert.ifError(new assert.AssertionError(JSON.parse(msg.substr('AssertionError:'.length))));
        }
      });

      self.page = page;

      page.set('viewportSize', { width: 1600, height: 900 }, done);
    });
  });
};


// Expose `Browser`
module.exports = Browser;
