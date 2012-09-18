"use strict";

/*global nodeca, _*/


// prepare nodeca.runtime.recaptcha
// FIXME move recaptcha data from config to settings
nodeca.filters.after('', { weight: 50 }, function init_recaptcha(params, next) {
  //FIXME fetch current locale.
  var lang = nodeca.config.recaptcha.form.lang;

  // FIXME If current locale not supported, then add
  // custom localization

  // set div name for cusom theme
  var custom_theme_widget = null;
  if (nodeca.config.recaptcha.form.theme === 'custom') {
    custom_theme_widget = nodeca.config.recaptcha.form.custom_theme;
  }

  this.runtime.recaptcha = {
    public_key: nodeca.config.recaptcha.public_key,
    theme: nodeca.config.recaptcha.form.theme,
    lang: lang,
    custom_theme_widget: custom_theme_widget
  };
  next();
});
