'use strict';


var _ = require('lodash');


N.wire.once('init:mdedit', function () {

  // Update attachments view
  //
  N.wire.on('mdedit:update.attachments', function updateAttachments() {
    N.MDEdit.__layout__.find('.mdedit-attachments').html(N.runtime.render('mdedit.attachments', {
      attachments: N.MDEdit.attachments()
    }));
  });


  // Attachment click
  //
  N.wire.on('mdedit.attachments:insert', function attachments_insert(data) {
    var url = N.router.linkTo('users.media', { user_hid: N.runtime.user_hid, media_id: data.$this.data('media-id') });
    var cm = N.MDEdit.__cm__;

    cm.replaceRange('![](' + url + ')', cm.getCursor(), cm.getCursor());
    cm.focus();

    data.event.stopPropagation();
  });


  // Remove attachment
  //
  N.wire.on('mdedit.attachments:remove', function attachments_insert(data) {
    var id = data.$this.data('media-id');
    var attachments = N.MDEdit.attachments();

    attachments = _.remove(attachments, val => val.media_id !== id);
    N.MDEdit.attachments(attachments);
    data.event.stopPropagation();
  });


  // Dragdrop file to editor
  //
  N.wire.on('mdedit:dd', function mdedit_dd(data) {
    var $layout = N.MDEdit.__layout__;
    var x0, y0, x1, y1, ex, ey, uploaderData;

    switch (data.event.type) {
      case 'dragenter':
        $layout.addClass('mdedit__m-active');
        break;
      case 'dragleave':
        // 'dragleave' occurs when user move cursor over child HTML element
        // track this situation and don't remove 'active' class
        // http://stackoverflow.com/questions/10867506/
        x0 = $layout.offset().left;
        y0 = $layout.offset().top;
        x1 = x0 + $layout.outerWidth();
        y1 = y0 + $layout.outerHeight();
        ex = data.event.originalEvent.pageX;
        ey = data.event.originalEvent.pageY;

        if (ex > x1 || ex < x0 || ey > y1 || ey < y0) {
          $layout.removeClass('mdedit__m-active');
        }
        break;
      case 'drop':
        $layout.removeClass('mdedit__m-active');

        if (data.files && data.files.length) {

          uploaderData = {
            files: data.files,
            url: N.router.linkTo('users.media.upload'),
            config: 'users.uploader_config',
            uploaded: null
          };

          N.wire.emit('users.uploader:add', uploaderData, function () {
            var attachments = N.MDEdit.attachments();

            uploaderData.uploaded.forEach(function (media) {
              attachments.unshift(_.pick(media, [ 'media_id', 'file_name', 'type' ]));
            });

            N.MDEdit.attachments(attachments);
          });
        }
        break;
      default:
    }
  });
});
