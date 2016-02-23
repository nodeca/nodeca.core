// Generate sitemap
//
'use strict';

const _        = require('lodash');
const eos      = require('end-of-stream');
const multi    = require('multistream');
const pump     = require('pump');
const pumpify  = require('pumpify');
const through2 = require('through2');
const zlib     = require('zlib');

// limit urls per sitemap file, sitemap specification sets 50k limit
const MAX_URLS = 40000;

const FILE_HEADER =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="
    http://www.sitemaps.org/schemas/sitemap/0.9
    http://www.sitemaps.org/schemas/sitemap/09/siteindex.xsd">
`;

const FILE_FOOTER = '</urlset>\n';


function get_changefreq(time) {
  let now = Date.now();

  if (time + 600e3 >= now) {
    return 'always';
  } else if (time + 3600e3 >= now) {
    return 'hourly';
  } else if (time + 86400e3 >= now) {
    return 'daily';
  } else if (time + 604800e3 >= now) {
    return 'weekly';
  } else if (time + 2629743761 >= now) {
    return 'monthly';
  }

  return 'yearly';
}


module.exports = function (N, apiPath) {
  /* eslint-disable new-cap */
  function SiteMapFile() {
    return through2({ writableObjectMode: true }, function (chunk, encoding, callback) {
      if (!this.date) this.date = Date.now();

      if (!chunk.loc) {
        callback(new Error('sitemap_generate: no location specified for url entry'));
        return;
      }

      if (!this.header_written) {
        this.push(FILE_HEADER);
        this.header_written = true;
      }

      let data = '<url>\n';

      data += `  <loc>${_.escape(chunk.loc)}</loc>\n`;

      if (chunk.lastmod) {
        data += `  <lastmod>${_.escape(chunk.lastmod.toISOString())}</lastmod>\n`;
        data += `  <changefreq>${_.escape(chunk.changefreq || get_changefreq(+chunk.lastmod))}</changefreq>\n`;
      }

      if (chunk.priority) {
        data += `  <priority>${_.escape(chunk.priority)}</priority>\n`;
      }

      data += '</url>\n';

      this.push(data);
      callback();
    }, function (callback) {
      this.push(FILE_FOOTER);
      callback();
    });
  }


  function create_new_file(file_no, sitemap, callback) {
    let filename = `sitemap-${sitemap._id}-${_.padStart(file_no, 3, '0')}.xml.gz`;

    sitemap.files = sitemap.files.concat([ filename ]);

    N.logger.info('Writing sitemap file: ' + filename);

    sitemap.save(err => {
      if (err) {
        callback(err);
        return;
      }

      callback(null, pumpify.obj(
        SiteMapFile(),
        zlib.createGzip(),
        N.models.core.File.createWriteStream({
          filename,
          contentType: 'application/x-gzip'
        })
      ));
    });
  }


  function SiteMapStream() {
    return through2({ writableObjectMode: true }, function write(chunk, encoding, callback) {
      if (!this.sitemap) {
        // initialization
        this.url_count = 0;
        this.file_no   = 0;
        this.sitemap   = new N.models.core.SiteMap();

        create_new_file(++this.file_no, this.sitemap, (err, stream) => {
          if (err) {
            callback(err);
            return;
          }

          this.stream = stream;

          this.url_count++;
          this.stream.write(chunk, encoding, callback);
        });
        return;
      }

      if (this.url_count >= MAX_URLS) {
        this.stream.end();

        eos(this.stream, err => {
          if (err) {
            callback(err);
            return;
          }

          this.url_count = 0;
          create_new_file(++this.file_no, this.sitemap, (err, stream) => {
            if (err) {
              callback(err);
              return;
            }

            this.stream = stream;

            this.url_count++;
            this.stream.write(chunk, callback);
          });
        });
        return;
      }

      this.url_count++;
      this.stream.write(chunk, callback);
    }, function finish(callback) {
      this.stream.end();

      eos(this.stream, err => {
        if (err) {
          callback(err);
          return;
        }

        this.sitemap.active = true;
        this.sitemap.save(callback);
      });
    });
  }


  N.wire.on(apiPath, function* sitemap_generate() {
    let data = {};

    // get all sitemaps to remove later when task succeeds
    let old_sitemaps = yield N.models.core.SiteMap.find();

    // request streams to read urls from
    yield N.wire.emit('internal:common.sitemap.collect', data);

    let out_stream = SiteMapStream();

    let s = multi.obj(data.streams);

    yield new Promise((resolve, reject) => {
      pump(s, out_stream, err => {
        if (err) reject(err);
        else resolve();
      });

      out_stream.resume();
    });

    // cleanup: remove old sitemaps
    yield old_sitemaps.map(sm => sm.remove());
  });
};
