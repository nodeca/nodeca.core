// Find location name
//
// In:
//  - redis set `geo:location` (`lon:lat:locale`)
//  - redis set `geo:location:fast` (`lon:lat:locale`)
//

'use strict';

const _       = require('lodash');
const Promise = require('bluebird');
const got     = require('got');


module.exports = function (N) {
  let overpass_last_request  = 0;
  let nominatim_last_request = 0;

  let rootUrl = _.get(N.config, 'bind.default.mount') || 'http://localhost';
  let userAgent = `Nodeca (+${rootUrl})`;

  const resolve_location_overpass = Promise.coroutine(function* (lat, lon, locale) {
    // TODO: check if this request is in the cache

    let now = Date.now();

    // limit to 1 request per second, this should keep us below 5GB/day limit
    // https://wiki.openstreetmap.org/wiki/Overpass_API
    if (Math.abs(now - overpass_last_request) < 1000) {
      yield Promise.delay(1000 - Math.abs(now - overpass_last_request));
    }

    overpass_last_request = Date.now();

    let script = `
[timeout:5][out:json];
is_in(${lat},${lon})->.a;
area.a[place~"city|town|village|hamlet"];
out 1;
`;

    let response = yield got('http://overpass-api.de/api/interpreter', {
      query:   { data: script },
      headers: { 'user-agent': userAgent },
      timeout: 15000,
      retries: 1,
      json:    true
    });

    let body = response.body;

    // TODO: write this request to cache

    // TODO: retry some errors, log others

    let language = (locale.match(/^\w+/) || [ locale ])[0];

    if (body.elements && body.elements[0] && body.elements[0].tags) {
      let name = body.elements[0].tags['name:' + language] ||
                 body.elements[0].tags['name:en'] ||
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

    // limit to 1 request per second according to
    // http://wiki.openstreetmap.org/wiki/Nominatim_usage_policy
    if (Math.abs(now - nominatim_last_request) < 1000) {
      yield Promise.delay(1000 - Math.abs(now - nominatim_last_request));
    }

    nominatim_last_request = Date.now();

    // accept-language field with fallback, e.g. `ru,en;q=0.8`,
    let language = (locale.match(/^\w+/) || [ locale ])[0];

    if (language !== 'en') language += ',en;q=0.8';

    let response = yield got('http://nominatim.openstreetmap.org/reverse', {
      query: {
        format: 'json',
        'accept-language': language,
        lat,
        lon,
        zoom: 15
      },
      headers: { 'user-agent': userAgent },
      timeout: 15000,
      retries: 1,
      json:    true
    });

    let body = response.body;

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

      process: Promise.coroutine(function* () {
        const extendDeadline = _.throttle(() => this.setDeadline(120000), 10000);

        let last_request_time = 0;

        for (;;) {
          extendDeadline();

          let queue_name = 'geo:location:fast';

          // params has the form of `lon:lat:locale`,
          // e.g. `0.12:51.5:en-US` for 51.5°N 0.12°W
          let params = yield N.redis.lpopAsync(queue_name);

          if (!params) {
            queue_name = 'geo:location';
            params = yield N.redis.lpopAsync(queue_name);
          }

          if (!params) {
            // Wait for new data for 2 more seconds after queue empties,
            // then stop the task.
            //
            // Delay is necessary to avoid multiple tasks/processes messing
            // with rate limit counters.
            //
            if (Math.abs(Date.now() - last_request_time) > 2000) {
              break;
            } else {
              yield Promise.delay(2000);
              continue;
            }
          }

          let [ lon, lat, locale ] = params.split(':', 3);

          let hash = N.models.core.Location.hash([ lon, lat ], locale);

          if (yield N.models.core.Location.findOne({ hash }).lean(true)) {
            // location is already resolved
            continue;
          }

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

          last_request_time = Date.now();
        }
      })
    });
  });
};
