//= require modernizr.custom
//= require yepnope/yepnope
//= require_self


/*jshint browser:true,node:false*/
/*global yepnope*/


(function () {
  'use strict';


  var toString  = Object.prototype.toString,
      hasOwn    = Object.prototype.hasOwnProperty;


  // check if `obj` is a function
  function isFunction(obj) {
    return '[object Function]' === toString.call(obj);
  }


  // check if `obj` is array
  function isArray(obj) {
    return '[object Array]' === toString.call(obj);
  }


  // check if `obj` is a plain object: not a null, underfined, function, array
  // or instance of something else.
  function isPlainObject(obj) {
    // Must be an Object.
    // Because of IE, we also have to check the presence of the constructor property.
    if (!obj || '[object Object]' !== toString.call(obj)) {
      return false;
    }

    try {
      // Not own constructor property must be Object
      if (obj.constructor &&
        !hasOwn.call(obj, "constructor") &&
        !hasOwn.call(obj.constructor.prototype, "isPrototypeOf")) {
        return false;
      }
    } catch ( e ) {
      // IE8,9 Will throw exceptions on certain host objects #9897
      return false;
    }

    // Own properties are enumerated firstly, so to speed up,
    // if last one is own, then all properties are own.

    /*jshint noempty:false*/
    for (var key in obj) {}

    return key === undefined || hasOwn.call(obj, key);
  }


  // returns array of `prop` values from `obj`
  //
  //    collect([{foo: 1}, {foo: 2}], 'foo');
  //    // -> [1, 2]
  //
  function collect(obj, prop) {
    var out = [], i;

    for (i in obj) {
      if (obj.hasOwnProperty(i) && obj[i][prop]) {
        out.push(obj[i][prop]);
      }
    }

    return out;
  }


  // Simple `each` iterator
  function each(obj, iter) {
    for (var k in obj) {
      if (obj.hasOwnProperty(k)) {
        iter(obj[k], k);
      }
    }
  }


  // cached non-operable function
  function noop() {}


  function load_assets(assets, callback) {
    callback = callback || noop;

    if (0 === assets.length) {
      callback();
      return;
    }

    yepnope({load: collect(assets, 'link'), complete: callback});
  }


  function inject_tree(tree, branch) {
    // make sure tree is a plain object or a function
    tree = (isPlainObject(tree) || isFunction(tree)) && tree || {};

    each(branch || {}, function (val, key) {
      if (isPlainObject(val)) {
        tree[key] = inject_tree(tree[key], val);
        return;
      }

      if (isFunction(val)) {
        tree[key] = inject_tree(val, inject_tree(tree[key], val));
        return;
      }

      // plain value - do not try to merge - just override
      tree[key] = val;
    });

    // Return the modified object
    return tree;
  }


  window.load_assets = load_assets;
  window.inject_tree = inject_tree;
}());
