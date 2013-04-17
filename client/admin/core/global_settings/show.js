'use strict';


var _  = require('lodash');
var ko = require('knockout');


function GroupModel(config) {
  var tName = 'admin.setting.group.' + config.name
    , tHelp = 'admin.setting.group.' + config.name + '_help';

  this.name          = config.name;
  this.localizedName = N.runtime.t(tName);
  this.localizedHelp = N.runtime.t.exists(tHelp) ? N.runtime.t(tHelp) : '';

  this.href = N.runtime.router.linkTo(module.apiPath, { group: config.name });
}


function SettingModel(config) {
  var self  = this
    , tName = 'admin.setting.' + config.name
    , tHelp = 'admin.setting.' + config.name + '_help';

  this.name          = config.name;
  this.localizedName = N.runtime.t(tName);
  this.localizedHelp = N.runtime.t.exists(tHelp) ? N.runtime.t(tHelp) : '';

  this.id   = 'setting_' + this.name;
  this.type = config.type;

  this.defaultValue = ko.observable(config['default']);
  this.savedValue   = ko.observable(config.value);
  this.userValue    = ko.observable(config.value);

  this.modified = ko.computed(function () {
    return self.userValue() !== self.savedValue();
  });
}


function SettingsEditorModel(settings, groups) {
  var self = this;

  this.settings = _.map(settings, function (s) { return new SettingModel(s); });
  this.groups   = _.map(groups,   function (s) { return new GroupModel(s);   });

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
      data[setting.name] = {
        value: setting.userValue()
      , force: false
      };

      setting.savedValue(setting.userValue());
    }
  });

  N.io.rpc('admin.core.global_settings.update', { store: 'global', settings: data }, function (err) {
    var report = err ? 'error' : 'info';

    N.wire.emit('notify', { type: report, message: t('notify.' + report) });
  });
};

SettingsEditorModel.prototype.cancel = function cancel() {
  _.forEach(this.settings, function (setting) {
    setting.userValue(setting.savedValue());
  });
};


N.wire.on('navigate.done', function (data) {
  N.io.rpc('admin.core.global_settings.fetch', { store: 'global', group: data.params.group }, function (err, response) {
    if (err) {
      return;
    }

    var editor = new SettingsEditorModel(response.data.settings, response.data.groups);

    ko.applyBindings(editor, $('#content').get(0));
    $('#content [data-bind]:first').show();
  });
});
