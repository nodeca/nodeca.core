// Register `number_short` helper
//
'use strict';

const number_short = require('nodeca.core/lib/app/number_short');


N.wire.once('init:assets', function numeral_helper_register() {
  N.runtime.render.helpers.number_short = number_short;
});
