var nodeca = require('nodeca');


module.exports = function (app, callback) {
  var ActionController = nodeca.require('express-railer').ActionController;


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
