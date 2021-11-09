// When user selects a text in a single post, show a button to quote it
//

'use strict';


const _            = require('lodash');
const createPopper = require('@popperjs/core').createPopper;


let popper;
let popper_element;
let is_mouse_down = false;


function get_markup_node(selection) {
  let markup;

  // make sure all ranges have a single common .markup parent
  // (guard against user selecting multiple posts)
  for (let i = 0; i < selection.rangeCount; i++) {
    let range_ancestor = selection.getRangeAt(i).commonAncestorContainer;

    let range_markup = range_ancestor.closest ?
                       range_ancestor.closest('.markup') :
                       range_ancestor.parentElement.closest('.markup'); // text node

    if (!range_markup) return null;
    if (markup && markup !== range_markup) return null;
    markup = range_markup;
  }

  return markup;
}


function close_selection_menu() {
  if (!popper) return;

  popper.destroy();
  popper = null;

  popper_element.remove();
  popper_element = null;
}


let open_selection_menu = _.debounce(function open_selection_menu() {
  if (is_mouse_down) return;

  let selection = document.getSelection();

  if (selection.isCollapsed) {
    close_selection_menu();
    return;
  }

  let markup_node = get_markup_node(selection);

  // don't show quote button if user selects none or multiple posts
  if (!markup_node) return;

  // don't show quote unless there's `.markup(data-nd-src=url)` as a parent
  // (so we know there's a code that can open editor)
  if (!markup_node.dataset.ndSrc) return;

  if (!popper_element) {
    let div = document.createElement('div');
    div.innerHTML = N.runtime.render(module.apiPath, { apiPath: module.apiPath });
    popper_element = div.firstChild;
    document.body.appendChild(popper_element);
  }

  popper = popper || createPopper(
    {
      getBoundingClientRect() {
        let last = selection.getRangeAt(selection.rangeCount - 1);
        let rects = last.getClientRects();
        return rects[rects.length - 1];
      }
    },
    popper_element,
    {
      placement: 'bottom-end',
      modifiers: [
        {
          name: 'offset',
          // add some space (8px) between selected text and menu
          options: { offset: [ 0, 8 ] }
        }
      ]
    }
  );

  popper.update();
}, 25);


N.wire.once('navigate.done', function markup_selection_init() {
  // only enable this feature for members
  if (!N.runtime.is_member) return;

  document.addEventListener('selectionchange', open_selection_menu);

  document.addEventListener('mousedown', function mousedown(event) {
    is_mouse_down = true;

    // ignore if user clicks inside menu itself
    if (!popper_element?.contains(event.target)) close_selection_menu();
  });

  document.addEventListener('mouseup', function mouseup(event) {
    is_mouse_down = false;

    // ignore if user clicks inside menu itself
    if (!popper_element?.contains(event.target)) open_selection_menu();
  });


  N.wire.on('navigate.exit', function selection_menu_hide_on_exit() {
    close_selection_menu();
  });


  N.wire.before(module.apiPath + ':quote', { priority: -20 }, function get_selection(data) {
    close_selection_menu();

    data.selection = document.getSelection();

    // do nothing on empty input
    if (data.selection.isCollapsed || !data.selection.rangeCount) throw 'CANCELED';

    data.markup_node = get_markup_node(data.selection);

    // do nothing if user selects none or multiple posts
    if (!data.markup_node) throw 'CANCELED';

    // collect selection as html
    data.contents = document.createElement('div');

    for (let i = 0; i < data.selection.rangeCount; i++) {
      data.contents.appendChild(data.selection.getRangeAt(i).cloneContents());
    }
  });


  N.wire.on(module.apiPath + ':quote', function selection_quote(data) {
    // check if editor is opened
    if (!N.MDEdit?.__layout__) throw 'CANCELED';

    N.MDEdit.insertQuote(data.contents.innerText, data.markup_node.dataset.ndSrc);
  });
});
