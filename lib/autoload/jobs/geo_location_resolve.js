// Find location name
//
// In:
//  - redis set `geo:location` (`lon:lat:locale`)
//  - redis set `geo:location:fast` (`lon:lat:locale`)
//

'use strict';

const _       = require('lodash');
const Promise = require('bluebird');
const request = require('request');


module.exports = function (N) {
  let overpass_last_request  = 0;
  let nominatim_last_request = 0;


  const resolve_location_overpass = Promise.coroutine(function* (lat, lon, locale) {
    // TODO: check if this request is in the cache

    let now = Date.now();

    // 10000 requests per day, 24*60*60*1000/10000 msec between requests
    if (Math.abs(now - overpass_last_request) < 8640) {
      yield Promise.delay(8640 - Math.abs(now - overpass_last_request));
    }

    overpass_last_request = Date.now();

    let script = `
[timeout:5][out:json];
is_in(${lat},${lon})->.a;
area.a[place~"city|town|village|hamlet"];
out 1;
`;

    let body = yield new Promise((resolve, reject) => {
      // TODO: set user-agent, referer
      request.get({
        url:     'http://overpass-api.de/api/interpreter',
        qs:      { data: script },
        headers: { 'User-Agent': 'https://github.com/nodeca/nodeca' },
        json:    true
      }, (error, response, body) => {
        if (error) reject(error);
        else resolve(body);
      });
    });

    // TODO: write this request to cache

    // TODO: retry some errors, log others

    let language = (locale.match(/^\w+/) || [ locale ])[0];

    if (body.elements && body.elements[0] && body.elements[0].tags) {
      let name = body.elements[0].tags['name:' + language] ||
                 body.elements[0].tags.name;

      if (name) {
        return { name, provider: 'overpass' };
      }
    }

    return null;
  });


  const resolve_location_nominatim = Promise.coroutine(function* (lat, lon, locale) {
    // TODO: check if this request is in the cache

    let now = Date.now();

    if (Math.abs(now - nominatim_last_request) < 1000) {
      yield Promise.delay(1000 - Math.abs(now - nominatim_last_request));
    }

    nominatim_last_request = Date.now();

    let body = yield new Promise((resolve, reject) => {
      // TODO: set user-agent, referer, email
      request.get({
        url: 'http://nominatim.openstreetmap.org/reverse',
        qs: {
          format: 'json',
          'accept-language': locale,
          lat,
          lon,
          zoom: 15
        },
        headers: { 'User-Agent': 'https://github.com/nodeca/nodeca' },
        json: true
      }, (error, response, body) => {
        if (error) reject(error);
        else resolve(body);
      });
    });

    // TODO: write this request to cache

    // TODO: retry some errors, log others

    if (body.address) {
      let name = body.address.city ||
                 body.address.town ||
                 body.address.village ||
                 body.address.hamlet;

      if (name) {
        return { name, provider: 'nominatim' };
      }
    }

    return null;
  });


  N.wire.on('init:jobs', function register_geo_location_resolve() {
    N.queue.registerTask({
      name: 'geo_location_resolve',

      // static id to ensure that it's singleton
      taskID: () => 'geo_location_resolve',

      // TODO: which pool should it belong to?
      pool: 'hard',

      process: Promise.coroutine(function* () {
        const extendDeadline = _.throttle(() => this.setDeadline(120000), 10000);

        for (;;) {
          extendDeadline();

          let queue_name = 'geo:location:fast';
          let params = yield N.redis.spopAsync(queue_name);

          if (!params) {
            queue_name = 'geo:location';
            params = yield N.redis.spopAsync(queue_name);
          }

          if (!params) {
            yield Promise.delay(2000);
            continue;
          }

          let [ lon, lat, locale ] = params.split(':', 3);

          // TODO: check if location is already resolved

          let result = yield resolve_location_overpass(lat, lon, locale);

          if (!result) result = yield resolve_location_nominatim(lat, lon, locale);

          yield N.models.core.Location.update(
            { hash: N.models.core.Location.hash([ lon, lat ], locale) },
            { $set: {
              location: [ lon, lat ],
              provider: result ? result.provider : null,
              name:     result ? result.name : null,
              ts:       new Date(),
              locale
            } },
            { upsert: true }
          );
        }
      })
    });

    // run task on start-up
    N.queue.once('ready', function () {
      N.queue.geo_location_resolve().run();
    });
  });
};
