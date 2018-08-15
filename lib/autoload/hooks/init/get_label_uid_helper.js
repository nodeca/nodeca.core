// Register `get_label_uid` helper
//
'use strict';


function get_label_uid() {
  this.extras.label_id_cnt = this.extras.label_id_cnt || 0;

  // labels have different prefix on the client in case we need to add blocks
  // to a page that's been rendered on the server
  return `s${this.extras.label_id_cnt++}`;
}


module.exports = function () {
  require('nodeca.core/lib/system/env').helpers.get_label_uid = get_label_uid;
};
