"use strict";

/*global nodeca, _*/


// prepare nodeca.runtime.recaptcha
nodeca.filters.after('', { weight: 50 }, function init_recaptcha(params, next) {
  //FIXME fetch current locale.
  var locale = nodeca.config.recaptcha.locale;
  // FIXME If current locale not supported, then add
  // custom localization
  var custom_theme_widget = null;

  // FIXME move recaptcha data from config to settings
  this.runtime.recaptcha = {
    public_key: nodeca.config.recaptcha.public_key,
    theme: nodeca.config.recaptcha.theme,
    lang: nodeca.config.recaptcha.locale,
    custom_theme_widget: custom_theme_widget
  };
  next();
});
