// Infinite list that can be scrolled up or down
// with more data being fetched as necessary
//

/* eslint-env browser */
/* global $ */

'use strict';


const _      = require('lodash');
const Steady = require('steady');


// Delays after successful and failed xhr request respectively.
//
// For example, suppose user continuously scrolls. If server is up, each
// subsequent request will be sent each 100 ms. If server goes down, the
// interval between request initiations goes up to 2000 ms.
//
const DELAY_AFTER_SUCCESS = 100;
const DELAY_AFTER_ERROR   = 2000;

// Size of the area on the border of the list (in pixels) where
// prefetch starts when user scrolls into it.
//
const ACTIVE_AREA_SIZE = 500;


function ScrollableList(options) {
  this.N = options.N;

  this.options = {
    // Container selector
    //
    list_selector: options.list_selector,

    // Selector of each item directly inside the container
    //
    item_selector: options.item_selector,

    // Selectors used to show/hide loading placeholders
    //
    placeholder_top_selector:    options.placeholder_top_selector,
    placeholder_bottom_selector: options.placeholder_bottom_selector,

    // Function used to get element identifier used for fetching,
    // it can be mongo _id, search skip or last post id depending on content.
    //
    // Syntax: get_content_id(item) -> String
    //
    get_content_id: options.get_content_id,

    // Function used to load more content when user scrolls
    //
    // Syntax: load(start, direction) -> { $html, locals, reached_end }
    //
    // Arguments:
    //  - start - content id of current element (as returned by get_content_id)
    //  - direction - "top" or "bottom"
    //
    // Returns:
    //  - $html - jquery-wrapped rendered html
    //  - locals - server response (used in navigate.content_update)
    //  - offset - index of the first element in html (optional)
    //  - reached_end - flag whether further loading in that direction is possible
    //
    load: options.load || (() => null),

    // Function used to specify item cutting behaviour on large pages
    //
    // Syntax: need_gc(item_count) -> cut_item_count
    //
    // Argument: number of items currently on the page
    // Returns: number of items allowed to cut
    //
    need_gc: options.need_gc || null,

    // Optional event handler that is called on every scroll (debounced),
    //
    // Syntax: on_list_scroll(element, index, offset) -> void
    //
    // If user scrolls inside the list:
    //  - element - top fully visible element as specified by item_selector,
    //              or null if user sees above the list
    //  - index   - 0-based index of said element
    //  - offset  - number of pixels from the element to top of the page
    //              (i.e. navbar), or 0 if user sees above the list
    //
    on_list_scroll: options.on_list_scroll || (() => {}),

    // Vertical position in a viewport at which item is considered to be
    // current for pagination purposes (usually navbar size plus some padding).
    //
    navbar_height: options.navbar_height || 0
  };

  // Approximate number of items not yet fetched at the at the top,
  // used to calculate current item index.
  //
  this.index_offset = options.index_offset || 0;

  // Flags defining whether further loading in respective direction is possible
  //
  this.reached_top    = options.reached_top;
  this.reached_bottom = options.reached_bottom;

  this.top_loading_start    = 0;
  this.bottom_loading_start = 0;

  this.steady_top    = null;
  this.steady_bottom = null;
  this.destroyed     = false;
  this.list = $(options.list_selector)[0];
  this.init();
}


ScrollableList.prototype.init = function () {
  if (this.list) this.add_tracker($(this.list));

  this.scroll_handler = _.debounce(() => {
    let posts = $(this.list).find(this.options.item_selector),
        index;

    // Get offset of the first post in the viewport,
    // "-1" means user sees navigation above all entries
    //
    index = _.sortedIndexBy(posts.toArray(), null, post => {
      if (!post) return this.options.navbar_height;
      return post.getBoundingClientRect().bottom;
    });

    // user sees above the list
    if (index === 0 && posts.length > 0) {
      if (posts[0].getBoundingClientRect().top > this.options.navbar_height) {
        index--;
      }
    }

    // user sees below the list, just change to last element
    if (index >= posts.length) index--;

    let offset = index >= 0 ?
                 this.options.navbar_height - posts[index].getBoundingClientRect().top :
                 $(window).scrollTop();

    this.options.on_list_scroll.call(
      this,
      index >= 0 ? posts[index] : null,
      index + this.index_offset,
      offset
    );
  }, DELAY_AFTER_SUCCESS, { maxWait: DELAY_AFTER_SUCCESS });

  this.scroll_handler();
  $(window).on('scroll', this.scroll_handler);

  // those should be correct already, but check them just in case
  this.reset_loading_placeholders();
};


ScrollableList.prototype.load_top = function () {
  if (this.destroyed) return;
  if (this.reached_top) return;

  let now = Date.now();

  // `top_loading_start` is the last request start time, which is reset to 0 on success
  //
  // Thus, successful requests can restart immediately, but failed ones
  // will have to wait `DELAY_AFTER_ERROR` ms.
  //
  if (Math.abs(this.top_loading_start - now) < DELAY_AFTER_ERROR) return;

  let list = $(this.list);
  let first_element = list.find(this.options.item_selector + ':first')[0];

  // fetch is not supported for an empty list
  if (!first_element) return;

  let content_id = this.options.get_content_id(first_element);

  this.top_loading_start = now;

  Promise.resolve(this.options.load.call(this, content_id, 'top')).then(res => {
    if (this.destroyed) return;

    if (!res || res.reached_end) {
      this.reached_top = true;
      this.reset_loading_placeholders();
    }

    if (!res) {
      this.top_loading_start = 0;
      return;
    }

    // update index of the first element
    if (typeof res.offset !== 'undefined') {
      this.index_offset = res.offset;
    }

    let old_offset_top = first_element.getBoundingClientRect().top;

    // Cut duplicate post, used to display date intervals properly,
    // here's an example showing how it works:
    //
    //   DOM                + fetched           = result
    //                    | ...            |  | ...            |
    //                    +----------------+  +----------------+
    //                    | before         |  | before         |
    //                    | post#37        |  | post#37        |
    //                    | after          |  | after          |
    // +---------------+  +----------------+  +----------------+
    // | before  (cut) |  | before         |  | before         |
    // | post#38       |  | post#38  (cut) |  | post#38        |
    // | after         |  | after    (cut) |  | after          |
    // +---------------+  +----------------+  +----------------+
    // | before        |                      | before         |
    // | post#39       |                      | post#39        |
    // | after         |                      | after          |
    // +---------------+                      +----------------+
    // | ...           |                      | ...            |
    //
    // Reason for this: we don't have the data to display post intervals
    //                  for the first post in the DOM.
    //
    let overlapping_element = res.$html.filter(this.options.item_selector + ':last')[0];

    if (overlapping_element && this.options.get_content_id(overlapping_element) === content_id) {
      let idx = res.$html.index(overlapping_element);
      res.$html = res.$html.slice(0, idx);
      $(first_element).prevAll().remove();
    }

    // deduplication by id
    res.$html.find(this.options.item_selector).each((index, item) => {
      list.remove('#' + item.id);
    });

    return this.N.wire.emit('navigate.content_update', {
      $: res.$html,
      locals: res.locals,
      $before: $(this.options.list_selector + ' > :first')
    }).then(() => {
      if (this.destroyed) return;

      // update scroll so it would point at the same spot as before
      $(window).scrollTop($(window).scrollTop() + first_element.getBoundingClientRect().top - old_offset_top);

      // Limit total amount of posts in DOM
      //
      if (this.options.need_gc) {
        let posts     = $(this.list).find(this.options.item_selector);
        let cut_count = this.options.need_gc(posts.length);

        if (cut_count > 0) {
          // make sure to never remove posts visible on screen,
          // or within active area (so prefetch won't get triggered)
          let last_visible = _.sortedIndexBy(posts.toArray(), null, post => {
            if (!post) return ACTIVE_AREA_SIZE + window.innerHeight;
            return post.getBoundingClientRect().top;
          });

          let cut_start = Math.max(last_visible, posts.length - cut_count - 1);

          if (cut_start < posts.length - 1) {
            $(posts[cut_start]).nextAll().remove();

            this.reached_bottom = false;
            this.reset_loading_placeholders();
          }
        }
      }

      // update scroll so it would point at the same spot as before
      $(window).scrollTop($(window).scrollTop() + first_element.getBoundingClientRect().top - old_offset_top);

      // reset lock
      this.top_loading_start = 0;
    }).catch(err => this.error(err));
  });
};


ScrollableList.prototype.load_bottom = function () {
  if (this.destroyed) return;
  if (this.reached_bottom) return;

  let now = Date.now();

  // `bottom_loading_start` is the last request start time, which is reset to 0 on success
  //
  // Thus, successful requests can restart immediately, but failed ones
  // will have to wait `DELAY_AFTER_ERROR` ms.
  //
  if (Math.abs(this.bottom_loading_start - now) < DELAY_AFTER_ERROR) return;

  let list = $(this.list);
  let last_element = list.find(this.options.item_selector + ':last')[0];

  // fetch is not supported for an empty list
  if (!last_element) return;

  let content_id = this.options.get_content_id(last_element);

  this.bottom_loading_start = now;

  Promise.resolve(this.options.load.call(this, content_id, 'bottom')).then(res => {
    if (this.destroyed) return;

    if (!res || res.reached_end) {
      this.reached_bottom = true;
      this.reset_loading_placeholders();
    }

    if (!res) {
      this.bottom_loading_start = 0;
      return;
    }

    // update index of the first element
    if (typeof res.offset !== 'undefined') {
      this.index_offset = res.offset - list.find(this.options.item_selector).length;
    }

    let old_offset_top = last_element.getBoundingClientRect().top;

    // Cut duplicate post, used to display date intervals properly,
    // here's an example showing how it works:
    //
    //   DOM                + fetched           = result
    // | ...           |                      | ...            |
    // +---------------+                      +----------------+
    // | before        |                      | before         |
    // | post#37       |                      | post#37        |
    // | after         |                      | after          |
    // +---------------+  +----------------+  +----------------+
    // | before        |  | before   (cut) |  | before         |
    // | post#38       |  | post#38  (cut) |  | post#38        |
    // | after   (cut) |  | after          |  | after          |
    // +---------------+  +----------------+  +----------------+
    //                    | before         |  | before         |
    //                    | post#39        |  | post#39        |
    //                    | after          |  | after          |
    //                    +----------------+  +----------------+
    //                    | ...            |  | ...            |
    //
    // Reason for this: we don't have the data to display post intervals
    //                  for the first post in the DOM.
    //
    let overlapping_element = res.$html.filter(this.options.item_selector + ':first')[0];

    if (overlapping_element && this.options.get_content_id(overlapping_element) === content_id) {
      let idx = res.$html.index(overlapping_element);
      res.$html = res.$html.slice(idx + 1);
      $(last_element).nextAll().remove();
    }

    // deduplication by id
    res.$html.find(this.options.item_selector).each((index, item) => {
      list.remove('#' + item.id);
    });

    return this.N.wire.emit('navigate.content_update', {
      $: res.$html,
      locals: res.locals,
      $after: $(this.options.list_selector + ' > :last')
    }).then(() => {
      if (this.destroyed) return;

      // Limit total amount of posts in DOM
      //
      if (this.options.need_gc) {
        let posts     = $(this.list).find(this.options.item_selector);
        let cut_count = this.options.need_gc(posts.length);

        if (cut_count > 0) {
          // make sure to never remove posts visible on screen,
          // or within active area (so prefetch won't get triggered)
          let first_visible = _.sortedIndexBy(posts.toArray(), null, post => {
            if (!post) return -ACTIVE_AREA_SIZE;
            return post.getBoundingClientRect().bottom;
          });

          let cut_start = Math.min(first_visible, cut_count);

          if (cut_start > 0) {
            $(posts[cut_start]).prevAll().remove();

            this.index_offset += cut_start;

            this.reached_top = false;
            this.reset_loading_placeholders();
          }
        }
      }

      // update scroll so it would point at the same spot as before
      $(window).scrollTop($(window).scrollTop() + last_element.getBoundingClientRect().top - old_offset_top);

      // reset lock
      this.bottom_loading_start = 0;
    }).catch(err => this.error(err));
  });
};


ScrollableList.prototype.reset_loading_placeholders = function () {
  if (this.options.placeholder_top_selector) {
    let placeholder = $(this.options.placeholder_top_selector);

    // if first item is loaded, hide top placeholder,
    // adjust scroll if necessary
    if (this.reached_top) {
      if (!placeholder.hasClass('d-none')) {
        $(window).scrollTop($(window).scrollTop() - placeholder.outerHeight(true));
      }

      placeholder.addClass('d-none');
    } else {
      if (placeholder.hasClass('d-none')) {
        $(window).scrollTop($(window).scrollTop() + placeholder.outerHeight(true));
      }

      placeholder.removeClass('d-none');
    }
  }

  if (this.options.placeholder_bottom_selector) {
    let placeholder = $(this.options.placeholder_bottom_selector);

    // if last item is loaded, hide bottom placeholder
    if (this.reached_bottom) {
      placeholder.addClass('d-none');
    } else {
      placeholder.removeClass('d-none');
    }
  }
};


ScrollableList.prototype.add_tracker = function () {
  this.steady_top = new Steady({
    throttle: DELAY_AFTER_SUCCESS,
    handler: (values, done) =>
      Promise.resolve(this.load_top()).then(done, done)
  });

  this.steady_bottom = new Steady({
    throttle: DELAY_AFTER_SUCCESS,
    handler: (values, done) =>
      Promise.resolve(this.load_bottom()).then(done, done)
  });

  this.steady_top.addTracker('list-top', () =>
    this.list.getBoundingClientRect().top
  );

  this.steady_bottom.addTracker('list-bottom', () =>
    this.list.getBoundingClientRect().bottom - window.innerHeight
  );

  this.steady_top.addCondition('min-list-top', -ACTIVE_AREA_SIZE);
  this.steady_bottom.addCondition('max-list-bottom', ACTIVE_AREA_SIZE);
};


ScrollableList.prototype.destroy = function () {
  if (this.steady_top)    this.steady_top.stop();
  if (this.steady_bottom) this.steady_bottom.stop();
  this.steady_top = null;
  this.steady_bottom = null;

  this.scroll_handler.cancel();
  $(window).off('scroll', this.scroll_handler);
  this.scroll_handler = null;

  this.destroyed = true;
};


ScrollableList.prototype.error = function (err) {
  this.N.wire.emit('error', err);
};


module.exports = ScrollableList;
