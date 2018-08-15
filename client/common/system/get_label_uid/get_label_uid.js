// Register `get_label_uid` helper
//
'use strict';


let label_id_cnt = 0;


function get_label_uid() {
  // labels have different prefix on the client in case we need to add blocks
  // to a page that's been rendered on the server
  return `c${label_id_cnt++}`;
}


N.wire.once('init:assets', function get_label_uid_helper_register() {
  N.runtime.render.helpers.get_label_uid = get_label_uid;
});
