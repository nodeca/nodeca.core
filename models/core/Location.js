'use strict';


const _        = require('lodash');
const Promise  = require('bluebird');
const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let Location = new Schema({
    // hash used for quick exact search, `lon:lat:locale`
    hash:          String,

    location:      [ Number, Number ],
    ts:            { type: Date, 'default': Date.now },

    // resolved location name, null if not resolved
    name:          String,

    // full locale, e.g. 'en-US'
    locale:        String,

    // provider used to resolve this name, 'nominatim' or 'overpass',
    // null if name is not resolved
    provider:      String,

    // distance in km if match is not exact
    distance:      Number
  }, {
    versionKey: false
  });


  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  Location.index({ hash: 'hash' });


  // Generate hash field used for search
  //
  function hash(lonlat, locale) {
    return lonlat.join(':') + ':' + locale;
  }

  Location.statics.hash = hash;


  /*
   * Find location name by coordinates
   *
   * Params:
   *
   * - locations (Array)   - array of [ longitude, latitude ] coordinate pairs
   * - locale    (String)  - locale
   * - fast      (Boolean) - if this location needs resolving, resolve it
   *                         with higher priority
   *
   * Returns [ String ], location name for every coordinate pair requested.
   */
  Location.statics.info = Promise.coroutine(function* getLocationName(locations, locale, fast) {
    let location_hashes = locations.map(lonlat => hash(lonlat, locale));

    let resolved = _.keyBy(
      yield N.models.core.Location.find({
        hash: { $in: location_hashes }
      }).select('name hash').lean(true),
      'hash'
    );

    let result = [];
    let locations_to_resolve = [];

    for (let lonlat of locations) {
      let location = resolved[hash(lonlat, locale)];

      if (!location) {
        locations_to_resolve.push(lonlat[0] + ':' + lonlat[1] + ':' + locale);
      }

      result.push(location && location.name ? location.name : '');
    }

    if (locations_to_resolve.length) {
      yield N.redis.rpushAsync.apply(N.redis,
        [ fast ? 'geo:location:fast' : 'geo:location' ].concat(locations_to_resolve));

      N.queue.geo_location_resolve().run();
    }

    return result;
  });


  N.wire.on('init:models', function emit_init_Location(__, callback) {
    N.wire.emit('init:models.' + collectionName, Location, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_Location(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
