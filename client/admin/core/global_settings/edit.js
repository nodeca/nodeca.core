'use strict';


var _  = require('lodash');
var ko = require('knockout');


// Module variables, initialized at navigate.done
var categoryKeys     = null;
var categoryNames    = null;
var categorySettings = null;
var settingModels    = null;
var isDirty          = null;


function submit() {
  var payload = {};

  _.forEach(settingModels, function (setting) {
    if (setting.value.isDirty()) {
      if ('number' === setting.type) {
        payload[setting.name] = Number(setting.value());
      } else {
        payload[setting.name] = setting.value();
      }
      setting.value.markClean();
    }
  });

  N.io.rpc('admin.core.global_settings.update', { settings: payload }, function (err) {
    if (err) {
      return false;
    }

    N.wire.emit('notify', { type: 'info', message: t('saved') });
  });
}


function SettingModel(name, schema, value) {
  var tName = '@admin.core.setting_names.' + name
    , tHelp = '@admin.core.setting_names.' + name + '_help';

  this.id            = 'setting_' + name;
  this.name          = name;
  this.type          = schema.type;
  this.priority      = schema.priority;
  this.localizedName = t(tName);
  this.localizedHelp = t.exists(tHelp) ? t(tHelp) : '';

  this.valueOptions = _.map(schema.values, function (option) {
    return {
      name:  option.name
    , value: option.value
    , title: t.exists('@' + option.title) ? t('@' + option.title) : option.name
    };
  });

  if ('combobox' === schema.type) {
    this.value = ko.observableArray(value).extend({ dirty: false });
  } else {
    this.value = ko.observable(value).extend({ dirty: false });
  }
}


N.wire.on('navigate.done:' + module.apiPath, function () {
  var inputSchemas = N.runtime.page_data.setting_schemas
    , inputValues  = N.runtime.page_data.setting_values;

  // Initialize module variables.
  categoryKeys     = [];
  categoryNames    = {};
  categorySettings = {};
  settingModels    = [];

  // Collect category keys and prepare setting models.
  _.forEach(inputSchemas, function (schema, name) {
    var key   = schema.category_key
      , model = new SettingModel(name, schema, inputValues[name]);

    if (!_.contains(categoryKeys, key)) {
      categoryKeys.push(key);
      categoryNames[key] = t('@admin.core.category_names.' + key);
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

    return -priority;
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

  isDirty = ko.computed(function () {
    return _.some(settingModels, function (setting) {
      return setting.value.isDirty();
    });
  });

  ko.applyBindings({
    categoryKeys:     categoryKeys
  , categoryNames:    categoryNames
  , categorySettings: categorySettings
  , isDirty:          isDirty
  , submit:           submit
  }, $('#content').get(0));

  $('#content form[data-bind]:first').show();
});


N.wire.on('navigate.exit:' + module.apiPath, function () {
  // Reset module variables to allow the garbage collector do it's job.
  categoryKeys     = null;
  categoryNames    = null;
  categorySettings = null;
  settingModels    = null;
  isDirty          = null;

  // Clear Knockout buidings.
  ko.cleanNode($('#content').get(0));
});
