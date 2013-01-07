'use strict';


/*global underscore*/


var _ = underscore;


////////////////////////////////////////////////////////////////////////////////


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    // thread id
    id: {
      type: 'string',
      required: true
    }
  });

  return function (params, next) {
    var data = this.response.data;
    var category_name = params.id;

    data.category_name = category_name;

    N.settings.getStore('global')
      .fetchSettingsByCategory(category_name, function (err, settings) {
        _.each(settings, function (obj, key) {
          _.defaults(obj, N.settings.getStore('global').getSchema(key));
        });

        data.category = settings;

        next(err);
      });
  };
};
