// Generate sitemap index
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {});

  N.wire.after('server:common.robots', function add_sitemap_link(env) {
    env.body += 'Sitemap: ' + N.router.linkTo('common.sitemap') + '\n';
  });

  N.wire.on(apiPath, function* print_sitemap_index(env) {
    let sitemap_data = yield N.redis.getAsync('sitemap');
    let content;

    if (sitemap_data) {
      let sitemap = JSON.parse(sitemap_data);

      content = sitemap.files.sort().map(file =>
          '<sitemap>\n' +
          `  <loc>${N.router.linkTo('core.gridfs_tmp', { bucket: file })}</loc>\n` +
          `  <lastmod>${new Date(sitemap.date).toISOString()}</lastmod>\n` +
          '</sitemap>\n').join('');
    } else {
      content = '';
    }

    env.headers['Content-Type'] = 'text/xml';

    /* eslint-disable max-len */
    env.body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/09/siteindex.xsd">
${content}
</sitemapindex>
`;

  });

};
