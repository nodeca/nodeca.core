// Generate sitemap index
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {});

  N.wire.after('server:common.robots', function add_sitemap_link(env) {
    env.body += 'Sitemap: ' + N.router.linkTo('common.sitemap') + '\n';
  });

  N.wire.on(apiPath, function* print_sitemap_index(env) {
    let sitemap = yield N.models.core.SiteMap.findOne({ active: true });

    env.body = env.body || '';
    env.headers['Content-Type'] = 'text/xml';

    env.body +=
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<sitemapindex\n' +
      '  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
      '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n' +
      '  xsi:schemaLocation="\n' +
      '    http://www.sitemaps.org/schemas/sitemap/0.9' +
      '    http://www.sitemaps.org/schemas/sitemap/09/siteindex.xsd">\n';

    if (sitemap) {
      env.body += sitemap.files.map(file =>
        '<sitemap>\n' +
        `  <loc>${N.router.linkTo('core.gridfs', { bucket: file })}</loc>\n` +
        '  <lastmod>${sitemap._id.getTimestamp().toISOString()}</lastmod>\n' +
        '</sitemap>\n').join('');
    }

    env.body += '</sitemapindex>\n';
  });

};
