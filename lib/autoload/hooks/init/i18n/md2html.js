// Compile translations with `md:` prefix from markdown to html
//
'use strict';


const _  = require('lodash');
const md = require('markdown-it')({ html: true, linkify: true, typographer: true })
           .use(require('markdown-it-sup'));


function convert_md_plugin(context, callback) {
  if (!context.asset.source) {
    callback();
    return;
  }

  let data = JSON.parse(context.asset.source);

  data.locales = _.mapValues(data.locales, locale =>
    _.mapValues(locale, phrase => {
      if (_.isString(phrase) && /^md:/.test(phrase)) {
        return md.render(phrase.slice(3));
      }
      return phrase;
    })
  );

  context.asset.source = JSON.stringify(data);
  callback();
}


module.exports = function (N) {

  N.wire.after('init:bundle.create_components', function convert_md(sandbox) {
    _.forEach(sandbox.component_server, pkg => {
      _.forEach(pkg.i18n, asset => {
        asset.plugins.unshift(convert_md_plugin);
      });
    });
    _.forEach(sandbox.component_client, pkg => {
      _.forEach(pkg.i18n, asset => {
        asset.plugins.unshift(convert_md_plugin);
      });
    });
  });
};
