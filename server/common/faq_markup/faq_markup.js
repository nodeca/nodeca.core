// Display markdown cheatsheet user can display by pressing "?" in mdedit
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {});

  N.wire.on(apiPath, function mdedit_help(env) {
    env.res.head.title = env.t('title');
    env.res.text = env.t('text');
  });


  // Fill breadcrumbs
  //
  N.wire.after(apiPath, function fill_breadcrumbs(env) {
    env.data.breadcrumbs = [];

    env.data.breadcrumbs.push({
      text: env.t('breadcrumbs_category')
    });

    env.data.breadcrumbs.push({
      text: env.t('breadcrumbs_title')
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
