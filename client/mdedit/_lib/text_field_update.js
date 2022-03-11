// Utilities to change textarea content while keeping undo history.
//
// Ported from https://github.com/fregante/text-field-edit/blob/main/index.ts
//
// MIT License
// Copyright (c) Federico Brigante <me@fregante.com> (https://fregante.com)

'use strict';

// https://github.com/fregante/text-field-edit/issues/16
function safeTextInsert(text) {
  if (text === '') {
    return document.execCommand('delete');
  }

  return document.execCommand('insertText', false, text);
}

function insertTextFirefox(field, text) {
  // Found on https://www.everythingfrontend.com/posts/insert-text-into-textarea-at-cursor-position.html 🎈
  field.setRangeText(
    text,
    field.selectionStart || 0,
    field.selectionEnd || 0,
    'end' // Without this, the cursor is either at the beginning or `text` remains selected
  );

  field.dispatchEvent(
    new InputEvent('input', {
      data: text,
      inputType: 'insertText'
    })
  );
}

/** Inserts `text` at the cursor’s position, replacing any selection, with **undo** support
    and by firing the `input` event. */
function insert(field, text) {
  const document = field.ownerDocument;
  const initialFocus = document.activeElement;
  if (initialFocus !== field) {
    field.focus();
  }

  if (!safeTextInsert(text)) {
    insertTextFirefox(field, text);
  }

  if (initialFocus === document.body) {
    field.blur();
  } else if (initialFocus instanceof HTMLElement && initialFocus !== field) {
    initialFocus.focus();
  }

  field.dispatchEvent(new Event('change'));
}

/** Replaces the entire content, equivalent to `field.value = text` but with **undo** support
    and by firing the `input` event. */
function set(field, text) {
  field.select();
  insert(field, text);
}

/** Get the selected text in a field or an empty string if nothing is selected. */
// eslint-disable-next-line no-redeclare
function getSelection(field) {
  return field.value.slice(field.selectionStart, field.selectionEnd);
}

/** Adds the `wrappingText` before and after field’s selection (or cursor). If `endWrappingText`
    is provided, it will be used instead of `wrappingText` at on the right. */
function wrapSelection(field, wrap, wrapEnd) {
  const { selectionStart, selectionEnd } = field;
  const selection = getSelection(field);
  insert(field, wrap + selection + (wrapEnd ?? wrap));

  // Restore the selection around the previously-selected text
  field.selectionStart = selectionStart + wrap.length;
  field.selectionEnd = selectionEnd + wrap.length;
}

/** Finds and replaces strings and regex in the field’s value, like `field.value = field.value.replace()` but better */
function replace(field, searchValue, replacer) {
  /** Remembers how much each match offset should be adjusted */
  let drift = 0;

  field.value.replace(searchValue, (...args) => {
    // Select current match to replace it later
    const matchStart = drift + Number(args[args.length - 2]);
    const matchLength = args[0].length;
    field.selectionStart = matchStart;
    field.selectionEnd = matchStart + matchLength;

    const replacement = typeof replacer === 'string' ? replacer : replacer(...args);
    insert(field, replacement);

    // Select replacement. Without this, the cursor would be after the replacement
    field.selectionStart = matchStart;
    drift += replacement.length - matchLength;
    return replacement;
  });
}

module.exports.insert        = insert;
module.exports.set           = set;
module.exports.replace       = replace;
module.exports.getSelection  = getSelection;
module.exports.wrapSelection = wrapSelection;
