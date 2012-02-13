'use strict';


var ActionController = require('nodeca-lib').ExpressRailer.Controller;

module.exports = function (app, callback) {
  var ErrorsController = function ErrorsController() {
    ActionController.call(this);


    this.error = function index(req, res, next) {
      var error = req.error || new Error('Direct acces to error controller');

      res.local('error', error);

      if (error.code && 404 === error.code) {
          res.render('errors/404', {status: 404, description: 'Not Found'});
          return;
      }

      res.render('errors/500', {status: 500, description: 'Application Error'});
    };
  };


  ActionController.adopts(ErrorsController);


  callback(null, new ErrorsController);
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
