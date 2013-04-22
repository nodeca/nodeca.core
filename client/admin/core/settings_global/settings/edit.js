'use strict';


var _  = require('lodash');
var ko = require('knockout');


function SettingModel(name, schema, value) {
  var tName = 'admin.setting.' + name
    , tHelp = 'admin.setting.' + name + '_help';

  this.id            = 'setting_' + name;
  this.name          = name;
  this.type          = schema.type;
  this.priority      = schema.priority;
  this.localizedName = N.runtime.t(tName);
  this.localizedHelp = N.runtime.t.exists(tHelp) ? N.runtime.t(tHelp) : '';

  if (_.isUndefined(value)) {
    value = schema['default'] || '';
  }

  // Stringify the value for all types handled by 'value' Knockout binding,
  // to ensure correct isModified behaviour when user changes the input field.
  // Note: booleans are handled by 'checked' binding.
  if ('boolean' !== schema.type) {
    value = String(value);
  }

  this.savedValue = ko.observable(value);
  this.userValue  = ko.observable(value);

  this.isModified = ko.computed(function () {
    return this.userValue() !== this.savedValue();
  }, this);
}


N.wire.on('navigate.done:' + module.apiPath, function () {
  var inputSchemas     = N.runtime.page_data.setting_schemas
    , inputValues      = N.runtime.page_data.setting_values
    , categoryKeys     = []
    , categoryNames    = {}
    , categorySettings = {}
    , settingModels    = []
    , isModified
    , saveChanges;

  // Collect category keys and prepare setting models.
  _.forEach(inputSchemas, function (schema, name) {
    var key   = schema.category_key
      , model = new SettingModel(name, schema, inputValues[name]);

    if (!_.contains(categoryKeys, key)) {
      categoryKeys.push(key);
      categoryNames[key] = N.runtime.t('admin.setting.category.' + key);
    }

    if (!categorySettings.hasOwnProperty(key)) {
      categorySettings[key] = [];
    }

    categorySettings[key].push(model);
    settingModels.push(model);
  });

  // Sort categories using category setting priorities.
  categoryKeys.sort(function (key) {
    var priority = 0;

    _.forEach(categorySettings[key], function (setting) {
      priority += setting.priority;
    });

    return priority;
  });

  // Sort settings within categories.
  _.forEach(categorySettings, function (settings) {
    settings.sort(function (a, b) {
      if (a.priority === b.priority) {
        return a.name.localeCompare(b.name);
      } else {
        return a.priority - b.priority;
      }
    });
  });

  isModified = ko.computed(function () {
    return _.any(settingModels, function (setting) {
      return setting.isModified();
    });
  });

  saveChanges = function () {
    var payload = {};

    _.forEach(settingModels, function (setting) {
      if (setting.isModified()) {
        payload[setting.name] = setting.userValue();
        setting.savedValue(setting.userValue());
      }
    });

    N.io.rpc('admin.core.settings_global.settings.update', { settings: payload }, function (err) {
      var report = err ? 'error' : 'info';

      N.wire.emit('notify', { type: report, message: t('notify.' + report) });
    });
  };

  ko.applyBindings({
    categoryKeys:     categoryKeys
  , categoryNames:    categoryNames
  , categorySettings: categorySettings
  , isModified:       isModified
  , saveChanges:      saveChanges
  }, $('#content').get(0));

  $('#content form[data-bind]:first').show();
});


N.wire.on('navigate.exit:' + module.apiPath, function () {
  ko.cleanNode($('#content').get(0));
});
