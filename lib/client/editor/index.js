'use strict';

/**
 *  class Editor
 **/

/**
 *  new Editor()
 **/
function Editor () {
  this.$element = $('<textarea>');
}

/**
 *  Editor#value() -> text
 *  Editor#value(text)
 **/
Editor.prototype.value = function (text) {
  if (arguments.length) {
    this.$element.val(text);
    return this;
  }
  return this.$element.val();
};

/**
 *  Editor#attach(element)
 **/
Editor.prototype.attach = function (element) {
  $(element).append(this.$element);
  return this;
};

/**
 *  Editor#remove()
 **/
Editor.prototype.remove = function () {
  this.$element.remove();
  return this;
};

/**
 *  Editor#isDirty()
 **/
Editor.prototype.isDirty = function () {
  return !!this.$element.val();
};

module.exports = Editor;
