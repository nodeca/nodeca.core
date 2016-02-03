'use strict';


const _  = require('lodash');
const ko = require('knockout');


// Module variables, initialized at navigate.done
let categoryKeys     = null;
let categoryNames    = null;
let categorySettings = null;
let settingModels    = null;
let isDirty          = null;


function submit() {
  let payload = {};

  settingModels.forEach(setting => {
    if (setting.value.isDirty()) {
      if (setting.type === 'number') {
        payload[setting.name] = Number(setting.value());
      } else {
        payload[setting.name] = setting.value();
      }
    }
  });

  N.io.rpc('admin.core.global_settings.update', { settings: payload }).then(() => {
    settingModels.forEach(function (setting) { setting.value.markClean(); });

    return N.wire.emit('notify', { type: 'info', message: t('saved') });
  }).catch(err => N.wire.emit('error', err));
}


function SettingModel(name, schema, value) {
  let tName = '@admin.core.setting_names.' + name,
      tHelp = '@admin.core.setting_names.' + name + '_help';

  this.id            = 'setting_' + name;
  this.name          = name;
  this.type          = schema.type;
  this.priority      = schema.priority;
  this.localizedName = t(tName);
  this.localizedHelp = t.exists(tHelp) ? t(tHelp) : '';

  this.valueOptions = _.map(schema.values, option => ({
    name: option.name,
    value: option.value,
    title: t.exists('@' + option.title) ? t('@' + option.title) : option.name
  }));

  if (schema.type === 'combobox') {
    this.value = ko.observableArray(value).extend({ dirty: false });
  } else {
    this.value = ko.observable(value).extend({ dirty: false });
  }
}


N.wire.on('navigate.done:' + module.apiPath, function global_settings_edit_init() {
  let inputSchemas = N.runtime.page_data.setting_schemas,
      inputValues  = N.runtime.page_data.setting_values;

  // Initialize module variables.
  categoryKeys     = [];
  categoryNames    = {};
  categorySettings = {};
  settingModels    = [];

  // Collect category keys and prepare setting models.
  _.forEach(inputSchemas, function (schema, name) {
    let key   = schema.category_key,
        model = new SettingModel(name, schema, inputValues[name]);

    if (categoryKeys.indexOf(key) < 0) {
      categoryKeys.push(key);
      categoryNames[key] = t('@admin.core.category_names.' + key);
    }

    if (!categorySettings[key]) {
      categorySettings[key] = [];
    }

    categorySettings[key].push(model);
    settingModels.push(model);
  });

  // Sort categories using category setting priorities.
  categoryKeys = categoryKeys.sort(key => {
    let priority = 0;

    _.forEach(categorySettings[key], setting => { priority += setting.priority; });

    return -priority;
  });

  // Sort settings within categories.
  _.forEach(categorySettings, (settings, key) => {
    categorySettings[key] = settings.sort((a, b) => {
      if (a.priority === b.priority) {
        return a.name.localeCompare(b.name);
      }
      return a.priority - b.priority;
    });
  });

  isDirty = ko.computed(() => _.some(settingModels, setting => setting.value.isDirty()));

  ko.applyBindings({
    categoryKeys,
    categoryNames,
    categorySettings,
    isDirty,
    submit
  }, $('#content').get(0));

  $('#content form[data-bind]:first').show();
});


N.wire.on('navigate.exit:' + module.apiPath, function global_settings_edit_free() {
  // Reset module variables to allow the garbage collector do it's job.
  categoryKeys     = null;
  categoryNames    = null;
  categorySettings = null;
  settingModels    = null;
  isDirty          = null;

  // Clear Knockout buidings.
  ko.cleanNode($('#content').get(0));
});
