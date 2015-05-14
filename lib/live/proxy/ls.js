// localStorage live proxy. Track all tabs, make one of tabs master
//
'use strict';


/* global window */
var _ = require('lodash');


var TIMEOUT = 2000;
var UPDATE_INTERVAL = TIMEOUT / 2;


// Constructor
//
// - namespace (String) - optional, prefix for `localStorage`, default 'live_'
// - connector (Object) - connection handler
//
function LSProxy(namespace, transport) {
  var self = this;

  this.onmessage = null;

  this.__transport__ = transport;
  this.__namespace__ = namespace;

  this.__ls__ = window.localStorage;

  this.__tab_id_prefix__ = namespace + 'tab_';
  this.__tab_channels_prefix__ = namespace + 'subscribed_';

  this.__tab_id__ = Math.floor(Math.random() * 1e10) + 1;

  // Id of master tab
  this.__master_id__ = null;

  // Current tab channels
  this.__tab_channels__ = [];

  // Used only on master to compare differences between channels list
  this.__mastered_channels__ = [];

  // Handle messages from server
  this.__transport__.onmessage = function (channel, message) {
    var data = JSON.stringify({
      channel: channel,
      message: message,

      // Add random to be shure that `localStorage` sent event even new massage is same than previous
      random: Math.floor(Math.random() * 1e10)
    });

    self.__ls__.setItem(self.__namespace__ + 'data', data);
    self.__on_data_changed__(data);
  };

  // Handle `localStorage` update
  window.addEventListener('storage', function (e) {
    // In IE 9 without delay `e.newValue` will be broken
    // http://stackoverflow.com/questions/9292576/localstorage-getitem-returns-old-data-in-ie-9
    setTimeout(function () {
      self.__on_changed__(e);
    }, 1);
  });

  // Handle page close
  window.addEventListener('beforeunload', this.__destroy__.bind(this));

  // Update current tab info and check master alive
  this.__check_master__();
  setInterval(this.__check_master__.bind(this), UPDATE_INTERVAL);
}


// Check is `localStorage` available and writable
//
LSProxy.ok = function () {
  if (!window.localStorage) {
    return false;
  }

  try {
    // On Safari in private browsing mode, calling localStorage.setItem throws an
    // exception. Do not continue in this case.
    window.localStorage.setItem('live_local_storage_is_writable_test', '');
    window.localStorage.removeItem('live_local_storage_is_writable_test');
  } catch (__) {
    return false;
  }

  return true;
};


// Subscribe channel
//
LSProxy.prototype.on = function (channel) {
  this.__tab_channels__.push(channel);
  this.__tab_channels__ = this.__tab_channels__.sort();
  this.__update_channels_list__();
};


// Unsubscribe channel
//
LSProxy.prototype.off = function (channel) {
  this.__tab_channels__ = _.without(this.__tab_channels__, channel);
  this.__update_channels_list__();
};


// Emit message
//
LSProxy.prototype.emit = function (channel, data) {
  this.__transport__.emit(channel, data);
};


// Update master id, if current tab is master - init connect and subscribe channels
//
LSProxy.prototype.__on_master_changed__ = function (newMasretID) {
  // If master tab closed
  if (!newMasretID) {
    // Select random master (tab with smallest ID becomes master)
    if (this.__get_alive_tab_ids__().sort()[0] === this.__tab_id__) {
      this.__ls__.setItem(this.__namespace__ + 'master', this.__tab_id__);
      this.__on_master_changed__(this.__tab_id__);
    }
    return;
  }

  this.__master_id__ = +newMasretID;

  // If master changed to current tab - init master
  if (this.__tab_id__ === this.__master_id__) {
    this.__transport__.connect();

    // Subscribe to all channels
    this.__mastered_channels__ = this.__get_all_tabs_channels__();
    this.__transport__.subscribe(this.__mastered_channels__);
  }
};


// Update subscribes if channels list changed (run only on master)
//
LSProxy.prototype.__on_channels_list_changed__ = function () {
  if (this.__tab_id__ !== this.__master_id__) {
    return;
  }

  var allChannels = this.__get_all_tabs_channels__();
  var channelsToAdd = _.difference(allChannels, this.__mastered_channels__);
  var channelsToRemove = _.difference(this.__mastered_channels__, allChannels);

  // Add new subscriptions
  this.__transport__.subscribe(channelsToAdd);

  // Remove no more needed subscriptions
  this.__transport__.unsubscribe(channelsToRemove);

  this.__mastered_channels__ = allChannels;
};


// Receive resended message from master and send it to tab subscribers
//
LSProxy.prototype.__on_data_changed__ = function (serializedData) {
  var data = JSON.parse(serializedData);

  if (this.onmessage && this.__tab_channels__.indexOf(data.channel) !== -1) {
    this.onmessage(data.channel, data.message);
  }
};


// localStorage change handler. Updates master ID, receive subscribe requests
//
LSProxy.prototype.__on_changed__ = function (e) {
  var self = this;

  // Master changed
  if (e.key === this.__namespace__ + 'master') {
    this.__on_master_changed__(e.newValue);
  }

  // Channels list changed
  if (_.startsWith(e.key, this.__tab_channels_prefix__)) {
    this.__on_channels_list_changed__();
  }

  // Receive message from master
  if (e.key === this.__namespace__ + 'data') {
    this.__on_data_changed__(e.newValue);
  }
};


// Page unload handler. Remove tab data from store
//
LSProxy.prototype.__destroy__ = function () {
  this.__ls__.removeItem(this.__tab_id_prefix__ + this.__tab_id__);
  this.__ls__.removeItem(this.__tab_channels_prefix__ + this.__tab_id__);

  if (this.__master_id__ === this.__tab_id__) {
    this.__ls__.removeItem(this.__namespace__ + 'master');
  }
};


// Get channels for all tabs
//
LSProxy.prototype.__get_all_tabs_channels__ = function () {
  var channels = [];

  for (var i = 0, key; i < this.__ls__.length; i++) {
    key = this.__ls__.key(i);

    // Filter localStorage records by prefix
    if (!_.startsWith(key, this.__tab_channels_prefix__)) {
      continue;
    }

    channels = _.union(JSON.parse(this.__ls__.getItem(key)), channels);
  }

  return channels;
};


// Get alive tabs IDs and remove timeouted tabs
//
LSProxy.prototype.__get_alive_tab_ids__ = function () {
  var maxTime = Date.now() - TIMEOUT;
  var id;
  var tabIDs = [];

  for (var i = 0, key; i < this.__ls__.length; i++) {
    key = this.__ls__.key(i);

    // Filter localStorage records by prefix
    if (!_.startsWith(key, this.__tab_id_prefix__)) {
      continue;
    }

    id = +key.substr(this.__tab_id_prefix__.length);

    // Check tab is alive and remove if not
    if (this.__ls__.getItem(key) < maxTime) {
      this.__ls__.removeItem(key);
      this.__ls__.removeItem(this.__tab_channels_prefix__ + id);
      continue;
    }

    tabIDs.push(id);
  }

  return tabIDs;
};


// Update tab channels list
//
LSProxy.prototype.__update_channels_list__ = function () {
  var channels = JSON.stringify(this.__tab_channels__);

  // Update channels list if changed
  if (this.__ls__.getItem(this.__tab_channels_prefix__ + this.__tab_id__) !== channels) {
    this.__ls__.setItem(this.__tab_channels_prefix__ + this.__tab_id__, channels);
    this.__on_channels_list_changed__();
  }
};


// Update tab livetime and become master if not exists
//
LSProxy.prototype.__check_master__ = function () {
  // Update current tab time
  this.__ls__.setItem(this.__tab_id_prefix__ + this.__tab_id__, Date.now());

  // Update local value of master ID
  this.__master_id__ = +this.__ls__.getItem(this.__namespace__ + 'master');

  // If master tab not found - become master
  if (this.__get_alive_tab_ids__().indexOf(this.__master_id__) === -1) {
    this.__ls__.setItem(this.__namespace__ + 'master', this.__tab_id__);
    this.__on_master_changed__(this.__tab_id__);
  }
};


module.exports = LSProxy;
