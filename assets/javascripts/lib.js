//= require vendor/jquery/jquery
//= require vendor/powertip/jquery.powertip

//= require_self

//= require vendor/bootstrap/bootstrap
//= require babelfish-runtime
//= require pointer
//= require vendor/history/history.adapter.jquery
//= require vendor/history/history
//= require vendor/jade/runtime

//= require_tree ./lib

//= require ./n
//= require client


'use strict';

/*global define, window*/


define('jquery', null, null, function (exports, module) {
  module.exports = window.jQuery;
});
