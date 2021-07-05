// Compile translations with `md:` prefix from markdown to html
//
'use strict';


const md = require('markdown-it')({ html: true, linkify: true, typographer: true })
           .use(require('markdown-it-sup'));


function convert_md_plugin(context) {
  return Promise.resolve().then(() => {
    if (!context.asset.source) return;

    let data = JSON.parse(context.asset.source);

    for (let locale of Object.values(data.locales)) {
      for (let key of Object.keys(locale)) {
        if (typeof locale[key] === 'string' && /^md:/.test(locale[key])) {
          locale[key] = md.render(locale[key].slice(3));
        }
      }
    }

    context.asset.source = JSON.stringify(data);
  });
}


module.exports = function (N) {

  N.wire.after('init:bundle.create_components', function convert_md(sandbox) {
    for (let pkg of Object.values(sandbox.component_server)) {
      for (let asset of Object.values(pkg.i18n)) {
        asset.plugins.unshift(convert_md_plugin);
      }
    }

    for (let pkg of Object.values(sandbox.component_client)) {
      for (let asset of Object.values(pkg.i18n)) {
        asset.plugins.unshift(convert_md_plugin);
      }
    }
  });
};
