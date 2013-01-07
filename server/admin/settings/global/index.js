'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  return function (params, next) {
    this.response.data.categories = N.settings.getStore('global').getCategories();
    next();
  };
};
