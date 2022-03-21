// Find location name
//
// In:
//  - redis zset `geo:location`      (key: `lon:lat:locale`, value: timestamp)
//  - redis zset `geo:location:fast` (key: `lon:lat:locale`, value: timestamp)
//
// If data in redis gets lost, it'll be regenerated next time user sees a page with location.
//

'use strict';

const _       = require('lodash');
const needle  = require('needle');


module.exports = function (N) {
  let overpass_last_request  = 0;
  let nominatim_last_request = 0;

  let rootUrl = (N.config.bind?.default?.mount || 'http://localhost') + '/';
  let userAgent = `needle/${needle.version} (Nodeca; +${rootUrl})`;


  // Get location name using overpass `is_in` operator (fetches a place
  // defined as an area that cover specified location).
  //
  async function resolve_location_overpass(lat, lon, locale) {
    let req_id = N.models.core.GeoOverpass.hash([ lon, lat ]);

    let cached = await N.models.core.GeoOverpass.findOne({ hash: req_id }).lean(true);
    let body;

    if (cached) {
      if (cached.error || !cached.result) return null;

      body = JSON.parse(cached.result);
    } else {
      let now = Date.now();

      // Limit to 1 request per second, this should keep us below 5GB/day limit
      // https://wiki.openstreetmap.org/wiki/Overpass_API
      //
      // In case it hits their limits too often, you can check free slots here:
      // https://overpass-api.de/api/status
      //
      if (Math.abs(now - overpass_last_request) < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - Math.abs(now - overpass_last_request)));
      }

      overpass_last_request = Date.now();

      let script = `
        [timeout:5][out:json];
        is_in(${lat},${lon})->.a;
        area.a[place~"city|town|village|hamlet"];
        out 1;
      `.replace(/\s+/g, ' ');

      let response, error;

      try {
        response = await needle('get', 'https://overpass-api.de/api/interpreter', { data: script }, {
          headers: { 'user-agent': userAgent, referer: rootUrl },
          open_timeout: 10000,
          response_timeout: 30000,
          read_timeout: 30000,
          parse_response: false
        });

        if (response.statusCode !== 200) {
          let error = new Error(`Wrong HTTP response code: ${response.statusCode}\n` +
            Object.entries(response.headers).map(x => `  ${x[0]}: ${x[1]}`).join('\n'));
          error.statusCode = response.statusCode;
          throw error;
        }

        body = JSON.parse(response.body);
      } catch (err) {
        // keep 400 errors (syntax error in the request), re-throw the rest
        if (err.statusCode !== 400) throw err;

        error = err;
      }

      let set = {
        location:   [ lon, lat ],
        result:     error ? null : response.body.toString(),
        error:      error ? (error.message || error) : null,
        error_code: error ? (error.statusCode || error.code) : null,
        ts:         new Date()
      };

      for (let k of Object.keys(set)) {
        if (typeof set[k] === 'undefined' || set[k] === null) delete set[k];
      }

      await N.models.core.GeoOverpass.updateOne(
        { hash: req_id },
        { $set: set },
        { upsert: true }
      );
    }

    let language = locale.split(/[-_]/)[0];

    // Overpass returns the list of the cities with an area covering
    // specified point. Pick the first one (with the lowest OSM ID).
    //
    if (body?.elements?.[0]?.tags) {
      let name = body.elements[0].tags['name:' + language] ||
                 body.elements[0].tags['name:en'] ||
                 body.elements[0].tags.name;

      if (name) return { name };
    }

    return null;
  }


  // Calculate Great Circle distance between two coordinates,
  // see https://stackoverflow.com/questions/27928
  //
  function distance(lat1, lon1, lat2, lon2) {
    let deg2rad = Math.PI / 180;
    let a = 0.5 - Math.cos((lat2 - lat1) * deg2rad) / 2 +
            Math.cos(lat1 * deg2rad) * Math.cos(lat2 * deg2rad) *
            (1 - Math.cos((lon2 - lon1) * deg2rad)) / 2;

    return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
  }


  // Get location name using overpass `around` operator (fetches all cities
  // within 100km radius and returns the closest one).
  //
  async function resolve_location_overpass_nearest(lat, lon, locale) {
    let req_id = N.models.core.GeoOverpassNearest.hash([ lon, lat ]);

    let cached = await N.models.core.GeoOverpassNearest.findOne({ hash: req_id }).lean(true);
    let body;

    if (cached) {
      if (cached.error || !cached.result) return null;

      body = JSON.parse(cached.result);
    } else {
      let now = Date.now();

      // Limit to 1 request per second, this should keep us below 5GB/day limit
      // https://wiki.openstreetmap.org/wiki/Overpass_API
      //
      // In case it hits their limits too often, you can check free slots here:
      // https://overpass-api.de/api/status
      //
      if (Math.abs(now - overpass_last_request) < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - Math.abs(now - overpass_last_request)));
      }

      overpass_last_request = Date.now();

      let script = `
        [timeout:20][out:json];
        node[place="city"](around:100000,${lat},${lon});
        out;
      `.replace(/\s+/g, ' ');

      let response, error;

      try {
        response = await needle('get', 'https://overpass-api.de/api/interpreter', { data: script }, {
          headers: { 'user-agent': userAgent, referer: rootUrl },
          open_timeout: 10000,
          response_timeout: 30000,
          read_timeout: 30000,
          parse_response: false
        });

        if (response.statusCode !== 200) {
          let error = new Error(`Wrong HTTP response code: ${response.statusCode}\n` +
            Object.entries(response.headers).map(x => `  ${x[0]}: ${x[1]}`).join('\n'));
          error.statusCode = response.statusCode;
          throw error;
        }

        body = JSON.parse(response.body);
      } catch (err) {
        // keep 400 errors (syntax error in the request), re-throw the rest
        if (err.statusCode !== 400) throw err;

        error = err;
      }

      let set = {
        location:   [ lon, lat ],
        result:     error ? null : response.body.toString(),
        error:      error ? (error.message || error) : null,
        error_code: error ? (error.statusCode || error.code) : null,
        ts:         new Date()
      };

      for (let k of Object.keys(set)) {
        if (typeof set[k] === 'undefined' || set[k] === null) delete set[k];
      }

      await N.models.core.GeoOverpassNearest.updateOne(
        { hash: req_id },
        { $set: set },
        { upsert: true }
      );
    }

    if (!body?.elements?.length) return null;

    // manually add distance to each city
    body.elements.forEach(function (node) {
      if (typeof node.lat === 'number' && typeof node.lon === 'number') {
        node.distance = distance(lat, lon, node.lat, node.lon);
      } else {
        node.distance = Infinity;
      }
    });

    let elements = body.elements.sort((a, b) => (a.distance > b.distance ? 1 : -1));

    let language = locale.split(/[-_]/)[0];

    // Overpass returns the list of the cities nearby,
    // we get one with lowest distance.
    //
    if (elements[0]?.tags) {
      let name = elements[0].tags['name:' + language] ||
                 elements[0].tags['name:en'] ||
                 elements[0].tags.name;

      if (name) {
        return { name: '~' + name, distance: elements[0].distance };
      }
    }

    return null;
  }


  // Get location name using nominatim (fetches an address, gets city from it;
  // city is determined using heuristics and sometimes incorrectly for large
  // cities where district is defined at the same admin level as city itself).
  //
  async function resolve_location_nominatim(lat, lon, locale) {
    let req_id = N.models.core.GeoNominatim.hash([ lon, lat ], locale);

    let cached = await N.models.core.GeoNominatim.findOne({ hash: req_id }).lean(true);
    let body;

    if (cached) {
      if (cached.error || !cached.result) return null;

      body = JSON.parse(cached.result);
    } else {
      let now = Date.now();

      // limit to 1 request per second according to
      // https://operations.osmfoundation.org/policies/nominatim/
      if (Math.abs(now - nominatim_last_request) < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - Math.abs(now - nominatim_last_request)));
      }

      nominatim_last_request = Date.now();

      // accept-language field with fallback, e.g. `ru,en;q=0.8`,
      let language = locale.split(/[-_]/)[0];

      if (language !== 'en') language += ',en;q=0.8';

      let response = await needle('get', 'https://nominatim.openstreetmap.org/reverse', {
        format: 'json',
        'accept-language': language,
        lat,
        lon,
        zoom: 15
      }, {
        headers: { 'user-agent': userAgent, referer: rootUrl },
        open_timeout: 10000,
        response_timeout: 30000,
        read_timeout: 30000,
        parse_response: false
      });

      if (response.statusCode !== 200) {
        let error = new Error(`Wrong HTTP response code: ${response.statusCode}\n` +
          Object.entries(response.headers).map(x => `  ${x[0]}: ${x[1]}`).join('\n'));
        error.statusCode = response.statusCode;
        throw error;
      }

      body = JSON.parse(response.body);

      let error = new Error(body.error);
      let set = {
        location:   [ lon, lat ],
        result:     error ? null : response.body.toString(),
        error:      error?.message,
        ts:         new Date(),
        locale
      };

      for (let k of Object.keys(set)) {
        if (typeof set[k] === 'undefined' || set[k] === null) delete set[k];
      }

      await N.models.core.GeoNominatim.updateOne(
        { hash: req_id },
        { $set: set },
        { upsert: true }
      );
    }

    if (body?.address) {
      let name = body.address.city ||
                 body.address.town ||
                 body.address.village ||
                 body.address.hamlet;

      if (name) return { name };
    }

    return null;
  }


  N.wire.on('init:jobs', function register_geo_location_resolve() {
    N.queue.registerTask({
      name: 'geo_location_resolve',

      // static id to ensure that it's singleton
      taskID: () => 'geo_location_resolve',

      async process() {
        const extendDeadline = _.throttle(() => this.setDeadline(120000), 10000);

        let last_request_time = 0;
        let error_count = 0;

        for (;;) {
          extendDeadline();

          let queue_name = 'geo:location:fast';

          // params has the form of `lon:lat:locale`,
          // e.g. `0.12:51.5:en-US` for 51.5°N 0.12°W
          let params = await N.redis.zpopmin(queue_name);

          if (!params.length) {
            queue_name = 'geo:location';
            params = await N.redis.zpopmin(queue_name);
          }

          if (!params.length) {
            // Wait for new data for 2 more seconds after queue empties,
            // then stop the task.
            //
            // Delay is necessary to avoid multiple tasks/processes messing
            // with rate limit counters.
            //
            if (Math.abs(Date.now() - last_request_time) > 2000) {
              break;
            } else {
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
          }

          let [ lon, lat, locale ] = params[0].split(':', 3);

          let hash = N.models.core.Location.hash([ lon, lat ], locale);

          if (await N.models.core.Location.findOne({ hash }).lean(true)) {
            // location is already resolved
            continue;
          }

          let result;
          let provider_name;
          let providers = {
            overpass: resolve_location_overpass,
            nominatim: resolve_location_nominatim,
            overpass_nearest: resolve_location_overpass_nearest
          };

          try {
            /* eslint-disable max-depth */
            for (provider_name of Object.keys(providers)) {
              result = await providers[provider_name](lat, lon, locale);

              if (result) break;
            }

            error_count = 0;
          } catch (err) {
            error_count++;

            // in case of errors, put coordinates back into queue and
            // pause this task for 10 minutes
            N.logger.error(`Geocoding service error (${error_count}), provider=${provider_name}` +
                           `, lon=${lon}, lat=${lat}: ${err.message || err}`);

            // if data in `queue_name` gets lost, it'll be regenerated next time user sees a page with location
            await N.redis.zadd(queue_name, 'NX', Date.now(), params[0]);

            if (error_count > 1) {
              // pause processing if there're 2 errors in a row
              this.setDeadline(12 * 60 * 1000);
              await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000));
            }
            continue;
          }

          let set = {
            location: [ lon, lat ],
            provider: result?.provider,
            name:     result?.name,
            distance: result?.distance,
            ts:       new Date(),
            locale
          };

          for (let k of Object.keys(set)) {
            if (typeof set[k] === 'undefined' || set[k] === null) delete set[k];
          }

          await N.models.core.Location.updateOne(
            { hash: N.models.core.Location.hash([ lon, lat ], locale) },
            { $set: set },
            { upsert: true }
          );

          last_request_time = Date.now();
        }
      }
    });
  });
};
