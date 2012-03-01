"use strict";


// stdlib
var Fs = require('fs');


// nodeca
var NLib = require('nlib');


// 3rd-party
var StaticLulz = require('static-lulz');
var FsTools = NLib.Vendor.FsTools;
var Async = NLib.Vendor.Async;
var Redis = require('redis');
var Mongoose = require('mongoose');
var connect = require('connect');


module.exports = NLib.Application.create({
  root: __dirname,
  name: 'nodeca.core',
  bootstrap: function (nodeca, callback) {
    // empty bootstrap... for now..
    callback();
  }
});


var nodeca = global.nodeca;


nodeca.hooks.init.before('initialization', function (next) {
  var cfg = nodeca.config.database;

  if (!cfg) {
    next(new Error('No database configuration'));
    return;
  }

  // TODO: Respect redis index
  nodeca.runtime.redis = Redis.createClient(cfg.redis.port, cfg.redis.host);

  // TODO: Respect user/pass
  nodeca.runtime.mongoose = Mongoose;
  Mongoose.connect(cfg.mongo.host, cfg.mongo.database, cfg.mongo.port);

  next(null);
});


nodeca.hooks.init.after('bundles', function (next) {
  nodeca.runtime.assets_server = new StaticLulz();

  FsTools.walk(nodeca.runtime.assets_path, function (file, stats, next_file) {
    // Fill in Static lulz with files and data
    Async.waterfall([
      Async.apply(Fs.readFile, file),
      function (buffer, callback) {
        var rel_path = file.replace(nodeca.runtime.assets_path, '');
        nodeca.runtime.assets_server.add(rel_path, buffer);
        callback();
      }
    ], next_file);
  }, next);
});


nodeca.hooks.init.after('initialization', function (next) {
  var app = connect();

  app.use("/assets/", nodeca.runtime.assets_server.middleware);

  app.use("/", function (req, res, next) {
    nodeca.server.admin.dashboard.call(req, function (err) {
      res.end(nodeca.runtime.views['core-desktop'].admin.dashboard['en-US']());
    });
  });

  require('http').createServer(app).listen(3000);
  next();
});
