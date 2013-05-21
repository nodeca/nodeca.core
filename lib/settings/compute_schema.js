/**
 *  computeSchema(env, name, schema, callback) -> Void
 *  - env (Object): Nodeca server `env` used for translations.
 *  - name (String): Setting name for translations.
 *  - schema (Object): Normalized settings schema from N.config.setting_schemas.
 *  - callback (Function):
 *
 *  Returns a copy of a settings schema with computed `values` field using
 *  fetcher function if present (e.g. 'usergroups'), and injected translations
 *  for the values if such translations exists.
 *
 *
 *  #### Example:
 *
 *    values: usergroups
 *
 *  =>
 * 
 *    values:
 *      - name: administrators
 *        value: '518a7f652065d47310000002'
 *        title: 'Администраторы' # Here and next: example Russian translations.
 *
 *      - name: members
 *        value: '518a7f652065d47310000003'
 *        title: 'Участники'
 *
 *      - name: unconfirmed_email
 *        value: '519a227473ec93170d000002'
 *        title: 'Пользователи с неподтверждённым E-mail'
 **/
  
  
'use strict';


var _ = require('lodash');
  
  
module.exports = function computeSchema(env, name, schema, callback) {
  schema = _.clone(schema);

  if (_.isFunction(schema.values)) {
    // Dynamic values set.
    schema.values(env, function (err, values) {
      if (err) {
        callback(err);
        return;
      }

      schema.values = values;
      callback(null, schema);
    });
  } else {
    // Static values set or no values.
    schema.values = _.map(schema.values, function (value) {
      var title, translation = 'admin.core.setting_values.' + name + '.' + value;

      if (env && env.helpers.t.exists(translation)) {
        title = env.helpers.t(translation);
      } else {
        // If there is no translation, assume it isn't needed.
        // That's true for proper names like 'GMail' for SMTP configuration.
        title = value;
      }

      return { name: value, value: value, title: title };
    });
    callback(null, schema);
  }
};
