// Register `number_short` helper
//
'use strict';

const number_short = require('nodeca.core/lib/app/number_short');


module.exports = function () {
  require('nodeca.core/lib/system/env').helpers.number_short = number_short;
};
