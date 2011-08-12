var ActionController = require('nodeca-lib').ExpressRailer.Controller;

module.exports = function (app, callback) {
  var WelcomeController = function WelcomeController() {
    ActionController.call(this);


    this.index = function index(req, res, next) {
      res.render('welcome/index');
    };
  };


  ActionController.adopts(WelcomeController);


  callback(null, new WelcomeController);
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
