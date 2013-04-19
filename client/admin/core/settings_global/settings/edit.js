'use strict';


var _  = require('lodash');
var ko = require('knockout');


function SettingModel(config) {
  var self  = this
    , tName = 'admin.setting.' + config.name
    , tHelp = 'admin.setting.' + config.name + '_help';

  this.name          = config.name;
  this.localizedName = N.runtime.t(tName);
  this.localizedHelp = N.runtime.t.exists(tHelp) ? N.runtime.t(tHelp) : '';

  this.id   = 'setting_' + this.name;
  this.type = config.type;

  this.savedValue   = ko.observable(String(config.value));
  this.userValue    = ko.observable(String(config.value));

  this.modified = ko.computed(function () {
    return self.userValue() !== self.savedValue();
  });
}


function SettingsEditorModel(settings) {
  var self = this;

  this.settings = _.map(settings, function (s) { return new SettingModel(s); });

  this.modified = ko.computed(function () {
    return _.any(self.settings, function (setting) {
      return setting.modified();
    });
  });
}

SettingsEditorModel.prototype.save = function save() {
  var data = {};

  _.forEach(this.settings, function (setting) {
    if (setting.modified()) {
      data[setting.name] = { value: setting.userValue() };
      setting.savedValue(setting.userValue());
    }
  });

  N.io.rpc('admin.core.settings_global.settings.update', { settings: data }, function (err) {
    var report = err ? 'error' : 'info';

    N.wire.emit('notify', { type: report, message: t('notify.' + report) });
  });
};


N.wire.on('navigate.done:' + module.apiPath, function () {
  var editor = new SettingsEditorModel(N.runtime.page_data.settings);

  ko.applyBindings(editor, $('#content').get(0));
  $('#content form[data-bind]:first').show();
});
