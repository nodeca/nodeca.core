'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  return function (env, next) {
    env.response.data.categories = N.settings.getStore('global').getCategories();
    next();
  };
};
