(function () {
/**
 * almond 0.2.6 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("almond", function(){});

define('mobifyjs/utils',[], function() {

// ##
// # Utility methods
// ##

var Utils = {};

Utils.extend = function(target){
    [].slice.call(arguments, 1).forEach(function(source) {
        for (var key in source)
            if (source[key] !== undefined)
                target[key] = source[key];
    });
    return target;
};

Utils.keys = function(obj) {
    var result = [];
    for (var key in obj) {
        if (obj.hasOwnProperty(key))
            result.push(key);
    }
    return result;
};

Utils.values = function(obj) {
    var result = [];
    for (var key in obj) {
      if (obj.hasOwnProperty(key))
          result.push(obj[key]);
    }
    return result;
};

Utils.clone = function(obj) {
    var target = {};
    for (var i in obj) {
        if (obj.hasOwnProperty(i)) {
          target[i] = obj[i];
        }
    }
    return target;
};

// Some url helpers
/**
 * Takes a url, relative or absolute, and absolutizes it relative to the current 
 * document's location/base, with the assistance of an a element.
 */
var _absolutifyAnchor = document.createElement("a");
Utils.absolutify = function(url) {
    _absolutifyAnchor.href = url;
    return _absolutifyAnchor.href;
};

/**
 * Takes an absolute url, returns true if it is an http/s url, false otherwise 
 * (e.g. mailto:, gopher://, data:, etc.)
 */
var _httpUrlRE = /^https?/;
Utils.httpUrl = function(url) {
    return _httpUrlRE.test(url);
};

/**
 * outerHTML polyfill - https://gist.github.com/889005
 */
Utils.outerHTML = function(el){
    if (el.outerHTML) {
        return el.outerHTML;
    }
    else {
        var div = document.createElement('div');
        div.appendChild(el.cloneNode(true));
        var contents = div.innerHTML;
        div = null;
        return contents;
    }
};

/**
 * Return a string for the doctype of the current document.
 */
Utils.getDoctype = function(doc) {
    doc = doc || document;
    var doctypeEl = doc.doctype || [].filter.call(doc.childNodes, function(el) {
            return el.nodeType == Node.DOCUMENT_TYPE_NODE
        })[0];

    if (!doctypeEl) return '';

    return '<!DOCTYPE HTML'
        + (doctypeEl.publicId ? ' PUBLIC "' + doctypeEl.publicId + '"' : '')
        + (doctypeEl.systemId ? ' "' + doctypeEl.systemId + '"' : '')
        + '>';
};

Utils.removeBySelector = function(selector, doc) {
    doc = doc || document;

    var els = doc.querySelectorAll(selector);
    return Utils.removeElements(els, doc);
};

Utils.removeElements = function(elements, doc) {
    doc = doc || document;

    for (var i=0,ii=elements.length; i<ii; i++) {
        var el = elements[i];
        el.parentNode.removeChild(el);
    }
    return elements;
};

// localStorage detection as seen in such great libraries as Modernizr
// https://github.com/Modernizr/Modernizr/blob/master/feature-detects/storage/localstorage.js
// Exposing on Jazzcat for use in qunit tests
var cachedLocalStorageSupport;
Utils.supportsLocalStorage = function() {
    if (cachedLocalStorageSupport !== undefined) {
        return cachedLocalStorageSupport;
    }
    var mod = 'modernizr';
    try {
        localStorage.setItem(mod, mod);
        localStorage.removeItem(mod);
        cachedLocalStorageSupport = true;
    } catch(e) {
        cachedLocalStorageSupport = false
    }
    return cachedLocalStorageSupport;
};

// matchMedia polyfill generator
// (allows you to specify which document to run polyfill on)
Utils.matchMedia = function(doc) {
    

    var bool,
        docElem = doc.documentElement,
        refNode = docElem.firstElementChild || docElem.firstChild,
        // fakeBody required for <FF4 when executed in <head>
        fakeBody = doc.createElement("body"),
        div = doc.createElement("div");

    div.id = "mq-test-1";
    div.style.cssText = "position:absolute;top:-100em";
    fakeBody.style.background = "none";
    fakeBody.appendChild(div);

    return function(q){
        div.innerHTML = "&shy;<style media=\"" + q + "\"> #mq-test-1 { width: 42px; }</style>";

        docElem.insertBefore(fakeBody, refNode);
        bool = div.offsetWidth === 42;
        docElem.removeChild(fakeBody);

        return {
           matches: bool,
           media: q
        };
    };
};

// readyState: loading --> interactive --> complete
//                      |               |
//                      |               |
//                      v               v
// Event:        DOMContentLoaded    onload
//
// iOS 4.3 and some Android 2.X.X have a non-typical "loaded" readyState,
// which is an acceptable readyState to start capturing on, because
// the data is fully loaded from the server at that state.
// For some IE (IE10 on Lumia 920 for example), interactive is not 
// indicative of the DOM being ready, therefore "complete" is the only acceptable
// readyState for IE10
// Credit to https://github.com/jquery/jquery/commit/0f553ed0ca0c50c5f66377e9f2c6314f822e8f25
// for the IE10 fix
Utils.domIsReady = function(doc) {
    var doc = doc || document;
    return doc.attachEvent ? doc.readyState === "complete" : doc.readyState !== "loading";
}

Utils.getPhysicalScreenSize = function(devicePixelRatio) {

    function multiplyByPixelRatio(sizes) {
        var dpr = devicePixelRatio || window.devicePixelRatio || 1;

        sizes.width = Math.round(sizes.width * dpr);
        sizes.height = Math.round(sizes.height * dpr);

        return sizes;
    }

    var iOS = navigator.userAgent.match(/ip(hone|od|ad)/i);
    var androidVersion = (navigator.userAgent.match(/android (\d)/i) || {})[1];

    var sizes = {
        width: window.outerWidth
      , height: window.outerHeight
    };

    // Old Android and BB10 use physical pixels in outerWidth/Height, which is what we need
    // New Android (4.0 and above) use CSS pixels, requiring devicePixelRatio multiplication
    // iOS lies about outerWidth/Height when zooming, but does expose CSS pixels in screen.width/height

    if (!iOS) {
        if (androidVersion > 3) return multiplyByPixelRatio(sizes);
        return sizes;
    }

    var isLandscape = window.orientation % 180;
    if (isLandscape) {
        sizes.height = screen.width;
        sizes.width = screen.height;
    } else {
        sizes.width = screen.width;
        sizes.height = screen.height;
    }

    return multiplyByPixelRatio(sizes);
}

return Utils;

});
define('mobifyjs/capture',["mobifyjs/utils"], function(Utils) {

// ##
// # Static Variables/Functions
// ##

// v6 tag backwards compatibility change
if (window.Mobify && 
    !window.Mobify.capturing &&
    document.getElementsByTagName("plaintext").length) 
{
            window.Mobify.capturing = true;
}

var openingScriptRe = /(<script[\s\S]*?>)/gi;

// Inline styles and scripts are disabled using a unknown type.
var tagDisablers = {
    style: ' media="mobify-media"',
    script: ' type="text/mobify-script"'
};

var tagEnablingRe = new RegExp(Utils.values(tagDisablers).join('|'), 'g');

// Map of all attributes we should disable (to prevent resources from downloading)
var disablingMap = {
    img:    ['src'],
    source: ['src'],
    iframe: ['src'],
    script: ['src', 'type'],
    link:   ['href'],
    style:  ['media'],
};

var affectedTagRe = new RegExp('<(' + Utils.keys(disablingMap).join('|') + ')([\\s\\S]*?)>', 'gi');
var attributeDisablingRes = {};
var attributesToEnable = {};

// Populate `attributesToEnable` and `attributeDisablingRes`.
for (var tagName in disablingMap) {
    if (!disablingMap.hasOwnProperty(tagName)) continue;
    var targetAttributes = disablingMap[tagName];

    targetAttributes.forEach(function(value) {
        attributesToEnable[value] = true;
    });

    // <space><attr>='...'|"..."
    attributeDisablingRes[tagName] = new RegExp(
        '\\s+((?:'
        + targetAttributes.join('|')
        + ")\\s*=\\s*(?:('|\")[\\s\\S]+?\\2))", 'gi');
}

/**
 * Returns the name of a node (in lowercase)
 */
function nodeName(node) {
    return node.nodeName.toLowerCase();
}

/**
 * Escape quotes
 */
function escapeQuote(s) {
    return s.replace('"', '&quot;');
}


/**
 * Helper method for looping through and grabbing strings of elements
 * in the captured DOM after plaintext insertion
 */
function extractHTMLStringFromElement(container) {
    if (!container) return '';

    return [].map.call(container.childNodes, function(el) {
        var tagName = nodeName(el);
        if (tagName == '#comment') return '<!--' + el.textContent + '-->';
        if (tagName == 'plaintext') return el.textContent;
        // Don't allow mobify related scripts to be added to the new document
        if (tagName == 'script' && ((/mobify/.test(el.src) || /mobify/i.test(el.textContent)))) {
            return '';
        }
        return el.outerHTML || el.nodeValue || Utils.outerHTML(el);
    }).join('');
}

/**
 * Takes a method name and applies that methon on a source object and overrides
 * it to call the method on a destination object with the same arguments 
 * (in addition to calling the method on the source object)
 */
var callMethodOnDestObjFromSourceObj = function(srcObj, destObj, method) {
    var oldMethod = srcObj[method];
    if (!oldMethod) {
        return;
    }
    srcObj[method] = function() {
        oldMethod.apply(srcObj, arguments);
        destObj[method].apply(destObj, arguments);
    };
}

/**
 * Creates an iframe and makes it as seamless as possible through CSS
 * TODO: Test out Seamless attribute when available in latest browsers
 */
var createSeamlessIframe = function(doc){
    var doc = doc || document;
    var iframe = doc.createElement("iframe");
    // set attribute to make the iframe appear seamless to the user
    iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;box-sizing:border-box;padding:0px;margin:0px;background-color:transparent;border:0px none transparent;'
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('seamless', '');
    return iframe;
}

// Track what has been written to captured and destination docs for each chunk
var plaintextBuffer = '';
var writtenToDestDoc = '';

var pollPlaintext = function(capture, chunkCallback, finishedCallback, options){
    var finished = Utils.domIsReady(capture.sourceDoc);
    var pollInterval = options.pollInterval || 300; // milliseconds
    var prefix = options.prefix + 'href'

    // if document is ready, set finished to true for users of the API
    // to be able to act appropriately
    if (finished) {
        capture.finished = true;
    }

    var html = capture.plaintext.textContent;
    var toWrite = html.substring(plaintextBuffer.length);

    // Only write up to the end of a tag
    // it is OK if this catches a &gt; or &lt; because we just care about
    // escaping attributes that fetch resources for this chunk
    toWrite = toWrite.substring(0, toWrite.lastIndexOf('>') + 1);

    // If there is nothing to write, return and check again.
    if (toWrite === '' && !finished) {
        setTimeout(function(){
            pollPlaintext(capture, chunkCallback, finishedCallback, options);
        }, pollInterval);
        return;
    }

    // Write our progress to plaintext buffer
    plaintextBuffer += toWrite;

    // Escape resources for chunk and remove target=self
    toWrite = Capture.removeTargetSelf(Capture.disable(toWrite, capture.prefix));

    // Write escaped chunk to captured document
    capture.capturedDoc.write(toWrite);

    // Move certain elements that should be in the parent document,
    // such as meta viewport tags and title tags.
    // We also want to move stylesheets into the head, because
    // resources loaded via document.write do not initiate the
    // loading bar (consistent across all browsers), and moving them into
    // top level document forces it to without causing an additional request.
    var href = options.prefix + 'href';
    var elsToMove = capture.capturedDoc.querySelectorAll('meta, title, link[' + href + '][rel="stylesheet"]');
    if (elsToMove.length > 0) {
        for (var i = 0, len=elsToMove.length; i < len; i++) {
            var el = elsToMove[i];
            // do not copy dom notes over twice
            if (el.hasAttribute('capture-moved')) {
                continue;
            }
            var elClone = capture.sourceDoc.importNode(el, true);
            if (elClone.nodeName === 'LINK') {
                // http://stackoverflow.com/questions/12825248/enable-disable-stylesheet-using-javascript-in-chrome
                var src = elClone.getAttribute(href);
                elClone.setAttribute('href', src);
                capture.sourceDoc.head.appendChild(elClone);
                elClone.disabled = true;
            } else {
                capture.sourceDoc.head.appendChild(elClone);
            }
            el.setAttribute('capture-moved', '');
        }
    }

    // In Android 2.3, widths of iframes can override of the width
    // of the html element of the top-level document (which can inadvertently. We detect for that
    // and change the width of the iframe
    // TODO: with max-widths set, this may not be necessary. -sj
    if (document.documentElement.offsetWidth !== window.outerWidth) {
        var iframes = Array.prototype.slice.call(capture.capturedDoc.querySelectorAll('iframe'));
        iframes.forEach(function(iframe){
            iframe.width = '100%';
        });
    }

    // Execute chunk callback to allow users to make modifications to capturedDoc
    chunkCallback(capture);

    if (capture.capturedDoc.documentElement) {
        // Grab outerHTML of capturedDoc and write the diff to destDoc
        capturedHtml = Utils.outerHTML(capture.capturedDoc.documentElement);
        // we could be grabbing from a captured document that has a head and no body.
        var toWriteDest = capturedHtml.substring(writtenToDestDoc.length);

        // outerHTML will always give us an balanced tree, which isn't what
        // we want to write into the destination document. The solution for
        // this is to simply never write out closing tags if they
        // are at the end of the `toWriteDest` string. If those end tags
        // were truly from the document, rather then generated by outerHTML,
        // then they will come in on the next chunk.
        toWriteDest = Capture.removeClosingTagsAtEndOfString(toWriteDest);

        writtenToDestDoc += toWriteDest;

        // Unescape chunk
        toWriteDest = Capture.enable(toWriteDest, capture.prefix);
        if (capture.docWriteIntoDest) {
            capture.destDoc.write(toWriteDest);
        }
    }

    // if document is ready, stop polling and ensure all documents involved are closed
    if (finished) {
        finishedCallback && finishedCallback(capture);
        capture.capturedDoc.close();
        capture.destDoc.close();
        capture.sourceDoc.close();
        Utils.removeElements([capture.captureIframe, capture.plaintext]);
        capture.captureIframe = null;
        capture.plaintext = null;
        capture.capturedDoc = null;
        plaintextBuffer = '';
        writtenToDestDoc = '';
    }
    else {
        setTimeout(function(){
            pollPlaintext(capture, chunkCallback, finishedCallback, options);
        }, pollInterval);
    }
};

// cached div used repeatedly to create new elements
var cachedDiv = document.createElement('div');

// ##
// # Constructor
// ##
var Capture = function(sourceDoc, prefix) {
    this.sourceDoc = sourceDoc;
    this.prefix = prefix || "x-";
    if (window.Mobify) window.Mobify.prefix = this.prefix;
};

/**
 * Initiate a buffered capture. `init` is an alias to `initCapture` for
 * backwards compatibility.
 */
Capture.init = Capture.initCapture = function(callback, doc, prefix) {
    var doc = doc || document;

    var createCapture = function(callback, doc, prefix) {
        var capture = new Capture(doc, prefix);
        var capturedStringFragments = capture.createDocumentFragmentsStrings();
        Utils.extend(capture, capturedStringFragments);
        var capturedDOMFragments = capture.createDocumentFragments();
        Utils.extend(capture, capturedDOMFragments);
        callback(capture);
    }

    if (Utils.domIsReady(doc)) {
        createCapture(callback, doc, prefix);
    }
    // We may be in "loading" state by the time we get here, meaning we are
    // not ready to capture. Next step after "loading" is "interactive",
    // which is a valid state to start capturing on (except IE), and thus when ready
    // state changes once, we know we are good to start capturing.
    // Cannot rely on using DOMContentLoaded because this event prematurely fires
    // for some IE10s.
    else {
        var created = false;
        doc.addEventListener("readystatechange", function() {
            if (!created) {
                created = true;
                createCapture(callback, doc, prefix);
            }
        }, false);
    }
};

/**
 * Streaming capturing is a batsh*t loco insane way of being able to modify
 * streaming chunks of markup before the browser can request resources.
 * There are two key things to note when reading this code:
 *  1. Since we use the plaintext tag to capture the markup and prevent resources
 *     from loading, we cannot simply document.write back into the main document,
 *     since whatever we `document.write` into the document will also get swallowed up
 *     by the plaintext tag. We also can't `document.open/document.write` into the main
 *     document either because document.open will blow away the current document, which
 *     would leave the plaintext object for dead. We have attempted to relocate the
 *     plaintext element into a different document to free up the main document, but
 *     this was not successful.
 *  2. We must stream into a "captured" DOM so that we can continue to chunk
 *     data while still being able to use DOM operations on each chunk.
 *     TODO: It might be nice to bypass the captured dom if someone wants to
 *           modify the markup in a streaming way with regular expressions.
 *
 * How it works
 * ============
 * As data from the server gets loaded up on the client, that data is being
 * swallowed up by the plaintext tag which was inserted into the document
 * in the bootloader mobify.js tag. With `initStreamingCapture`, we poll
 * the plaintext tag for new data. We take the delta, we rewrite all resources
 * in that delta using a regular expression to prevent it from loading resources
 * when rendered in the captured document. `chunkCallback` is then executed with
 * the captured document in order to users to make modifications to the DOM. We
 * then take the delta of this capturedDocument and render it into the
 * destination document (which by default is a "seamless" iframe).
 */
Capture.initStreamingCapture = function(chunkCallback, finishedCallback, options) {
    options = options || {};
    var prefix = options.prefix = options.prefix || 'x-';
    var sourceDoc = options.sourceDoc || document;

    // initiates capture object that will be passed to the callbacks
    var capture = new Capture(sourceDoc, prefix);

    // Grab the plaintext element from the source document
    var plaintext = capture.plaintext = sourceDoc.getElementsByTagName('plaintext')[0];
    var iframe;
    // if no destination document specified, create iframe and use its document
    if (options.destDoc) {
        capture.destDoc = options.destDoc;
    }
    else {
        iframe = capture.iframe = createSeamlessIframe(sourceDoc);
        sourceDoc.body.insertBefore(iframe, plaintext);
        capture.destDoc = iframe.contentDocument;
    }
    // currently, the only way to reconstruct the destination DOM without
    // breaking script execution order is through document.write.
    // TODO: Figure out way without document.write, and then make
    //       `docWriteIntoDest` configurable through options
    var docWriteIntoDest = capture.docWriteIntoDest = true;
    if (docWriteIntoDest) {
        // Open the destination document
        capture.destDoc.open("text/html", "replace");
    }

    var explicitlySetWidth = function() {
        var width = Utils.getPhysicalScreenSize().width/(window.devicePixelRatio || 1);
        width = (width >= 320) ? width : 320;
        width = width.toString() + "px";
        sourceDoc.documentElement.style.maxWidth = width;
        capture.destDoc.documentElement !== null && (capture.destDoc.documentElement.style.maxWidth = width);
    }
    // We must explicitly set the width of the window on the html of the source
    // document, so that when we create the `startCapturedHtml` string,
    // eventually the html of the destination document will also be set to
    // that width. This is necessary because in some browsers, (iOS6/7, Android 2.3)
    // there is a rendering bug where if the `pre` and `iframe` tags that are larger
    // then the width of their container, it will force the destination iframe
    // to grow larger because the width of the `pre/iframe`.
    var match = /ip(hone|od|ad)|android\s2\./i.exec(navigator.userAgent);
    var ios = (match && match[1] !== undefined);
    if (match) {
        explicitlySetWidth();
        var orientationEvent = ios ? "orientationchange" : "resize";
        window.addEventListener(orientationEvent, function() {
            setTimeout(function(){
                explicitlySetWidth();
            }, 0);
        }, false);
    }

    // Create a "captured" DOM. This is the playground DOM that the user will
    // have that will stream into the destDoc per chunk.
    // Using an iframe instead of `implementation.createHTMLDocument` because
    // you cannot document.write into a document created that way in Firefox
    capture.captureIframe = sourceDoc.createElement("iframe");
    capture.captureIframe.id = 'captured-iframe';
    capture.captureIframe.style.cssText = 'display:none;'
    sourceDoc.body.insertBefore(capture.captureIframe, plaintext);
    capture.capturedDoc = capture.captureIframe.contentDocument;
    capture.capturedDoc.open("text/html", "replace");
    // Start the captured doc with the original pieces of the source doc
    var startCapturedHtml = Utils.getDoctype(sourceDoc) +
                 Capture.openTag(sourceDoc.documentElement) +
                 Capture.openTag(sourceDoc.head) +
                 // Even if there is another base tag in the site that sets
                 // target, the first one declared will be used
                 // TODO: Write tests to verify this for all of our browsers.
                 '<base target="_parent" />' +
                 // Grab and insert all existing HTML above plaintext tag
                 extractHTMLStringFromElement(sourceDoc.head);

    // insert mobify.js (and main) into captured doc
    var mobifyLibrary = Capture.getMobifyLibrary(sourceDoc);
    startCapturedHtml += Utils.outerHTML(mobifyLibrary);

    // If there is a main exec, insert it as well
    var main = Capture.getMain();
    if (main) {
        startCapturedHtml += Utils.outerHTML(main);
    }

    var startDestHtml = Utils.getDoctype(sourceDoc);

    if (iframe) {
         // All browsers except iOS do not expand the height of the iframe
         // container to the height of the content within. To compensate for that,
         // we must set the height manually whenever it changes by polling the
         // destination document.
         if (!ios) {
             var cachedHeight;
             var webkit = /webkit/i.test(navigator.userAgent);
             var setIframeHeight = function(){
                 var heightElement = webkit ? capture.destDoc.documentElement : capture.destDoc.body;
                 if (capture.destDoc.documentElement === null || capture.destDoc.body === null) {
                     return;
                 }
                 // Sometimes, documentElement can have a scroll height of 0.
                 // If so, set the height of it to 100% and attempt to get it again.
                 var height = heightElement.scrollHeight;
                 if (height === 0) {
                    height = capture.destDoc.height;
                 }

                 // if the height has changed, set it.
                 if (height !== 0 && cachedHeight !== height) {
                     iframe.style.height = height + 'px';
                     cachedHeight = height;
                 }
             }
             setIframeHeight();
             var iid = setInterval(setIframeHeight, 1000);
         }

        // In Webkit/Blink, resources requested in a non-src iframe do not have
        // a referer attached. This is an issue for scripts like Typekit.
        // We get around this by manipulating the browsers
        // history to trick it into thinking it is an src iframe, which causes
        // the referer to be sent.
        // AKA an insane hack for an insane hack.
        try {
            iframe.contentWindow.history.replaceState({}, iframe.contentDocument.title, window.location.href);
        } catch (e) {
            // Accessing the iframes history api in Firefox throws an error. But this
            // isn't a concern since Firefox is sending the referer header correctly
            // https://bugzilla.mozilla.org/show_bug.cgi?id=591801
        }

        // If someone uses window.location to navigate, we must ensure that the
        // history in the parent window matches
        window.history.replaceState({}, iframe.contentDocument.title, window.location.href);

        // Override various history APIs in iframe and ensure that they run in
        // the parent document as well
        var iframeHistory = iframe.contentWindow.history;
        var parentHistory = window.parent.history;
        var historyMethods = ['replaceState', 'pushState', 'go', 'forward', 'back'];
        historyMethods.forEach(function(element) {
            callMethodOnDestObjFromSourceObj(iframeHistory, parentHistory, element);
        });
    }

    startCapturedHtml = Capture.disable(startCapturedHtml, prefix);

    // Start the captured doc and dest doc off write! (pun intended)
    capture.capturedDoc.write(startCapturedHtml);
    capture.destDoc.write(startDestHtml);

    pollPlaintext(capture, chunkCallback, finishedCallback, options);

};

/**
 * Removes closing tags from the end of an HTML string.
 */
Capture.removeClosingTagsAtEndOfString = function(html) {
    var match = html.match(/((<\/[^>]+>)+)$/);
    if (!match) return html;
    return html.substring(0, html.length - match[0].length);
}

Capture.removeTargetSelf = function(html) {
    return html.replace(/target=("_self"|\'_self\')/gi, '');
}

/**
 * Grab attributes from a string representation of an elements and clone them into dest element
 */
Capture.cloneAttributes = function(sourceString, dest) {
    var match = sourceString.match(/^<(\w+)([\s\S]*)$/i);
    cachedDiv.innerHTML = '<div' + match[2];
    [].forEach.call(cachedDiv.firstChild.attributes, function(attr) {
        try {
            dest.setAttribute(attr.nodeName, attr.nodeValue);
        } catch (e) {
            console.error("Error copying attributes while capturing: ", e);
        }
    });

    return dest;
};

/**
 * Returns a string with all external attributes disabled.
 * Includes special handling for resources referenced in scripts and inside
 * comments.
 * Not declared on the prototype so it can be used as a static method.
 */
Capture.disable = function(htmlStr, prefix) {
    var self = this;
    // Disables all attributes in disablingMap by prepending prefix
    var disableAttributes = (function(){
        return function(whole, tagName, tail) {
            lowercaseTagName = tagName.toLowerCase();
            return result = '<' + lowercaseTagName + (tagDisablers[lowercaseTagName] || '')
                + tail.replace(attributeDisablingRes[lowercaseTagName], ' ' + prefix + '$1') + '>';
        }
    })();

    var splitRe = /(<!--[\s\S]*?-->)|(?=<\/script)/i;
    var tokens = htmlStr.split(splitRe);
    var ret = tokens.map(function(fragment) {
                var parsed

                // Fragment may be empty or just a comment, no need to escape those.
                if (!fragment) return '';
                if (/^<!--/.test(fragment)) return fragment;

                // Disable before and the <script> itself.
                // parsed = [before, <script>, script contents]
                parsed = fragment.split(openingScriptRe);
                parsed[0] = parsed[0].replace(affectedTagRe, disableAttributes);
                if (parsed[1]) parsed[1] = parsed[1].replace(affectedTagRe, disableAttributes);
                return parsed;
            });

    return [].concat.apply([], ret).join('');
};

/**
 * Returns a string with all disabled external attributes enabled.
 * Not declared on the prototype so it can be used as a static method.
 */
Capture.enable = function(htmlStr, prefix) {
    var attributeEnablingRe = new RegExp('\\s' + prefix + '(' + Utils.keys(attributesToEnable).join('|') + ')', 'gi');
    return htmlStr.replace(attributeEnablingRe, ' $1').replace(tagEnablingRe, '');
};

/**
 * Return a string for the opening tag of DOMElement `element`.
 */
Capture.openTag = function(element) {
    if (!element) return '';
    if (element.length) element = element[0];

    var stringBuffer = [];

    [].forEach.call(element.attributes, function(attr) {
        stringBuffer.push(' ', attr.name, '="', escapeQuote(attr.value), '"');
    })

    return '<' + nodeName(element) + stringBuffer.join('') + '>';
};

/**
 * Returns an object containing the state of the original page. Caches the object
 * in `extractedHTML` for later use.
 */
 Capture.prototype.createDocumentFragmentsStrings = function() {
    var doc = this.sourceDoc;
    var headEl = doc.getElementsByTagName('head')[0] || doc.createElement('head');
    var bodyEl = doc.getElementsByTagName('body')[0] || doc.createElement('body');
    var htmlEl = doc.getElementsByTagName('html')[0];

    captured = {
        doctype: Utils.getDoctype(doc),
        htmlOpenTag: Capture.openTag(htmlEl),
        headOpenTag: Capture.openTag(headEl),
        bodyOpenTag: Capture.openTag(bodyEl),
        headContent: extractHTMLStringFromElement(headEl),
        bodyContent: extractHTMLStringFromElement(bodyEl)
    };

    /**
     * RR: I assume that Mobify escaping tag is placed in <head>. If so, the <plaintext>
     * it emits would capture the </head><body> boundary, as well as closing </body></html>
     * Therefore, bodyContent will have these tags, and they do not need to be added to .all()
     */
    captured.all = function(inject) {
        return this.doctype + this.htmlOpenTag + this.headOpenTag + (inject || '') + this.headContent + this.bodyContent;
    }

    // During capturing, we will usually end up hiding our </head>/<body ... > boundary
    // within <plaintext> capturing element. To construct source DOM, we need to rejoin
    // head and body content, iterate through it to find head/body boundary and expose
    // opening <body ... > tag as a string.

    // Consume comments without grouping to avoid catching
    // <body> inside a comment, common with IE conditional comments.
    var bodySnatcher = /<!--(?:[\s\S]*?)-->|(<\/head\s*>|<body[\s\S]*$)/gi;

    //Fallback for absence of </head> and <body>
    var rawHTML = captured.bodyContent = captured.headContent + captured.bodyContent;
    captured.headContent = '';

    // Search rawHTML for the head/body split.
    for (var match; match = bodySnatcher.exec(rawHTML); match) {
        // <!-- comment --> . Skip it.
        if (!match[1]) continue;

        if (match[1][1] == '/') {
            // Hit </head. Gather <head> innerHTML. Also, take trailing content,
            // just in case <body ... > is missing or malformed
            captured.headContent = rawHTML.slice(0, match.index);
            captured.bodyContent = rawHTML.slice(match.index + match[1].length);
        } else {
            // Hit <body. Gather <body> innerHTML.

            // If we were missing a </head> before, now we can pick up everything before <body
            captured.headContent = captured.head || rawHTML.slice(0, match.index);
            captured.bodyContent = match[0];

            // Find the end of <body ... >
            var parseBodyTag = /^((?:[^>'"]*|'[^']*?'|"[^"]*?")*>)([\s\S]*)$/.exec(captured.bodyContent);

            // Will skip this if <body was malformed (e.g. no closing > )
            if (parseBodyTag) {
                // Normal termination. Both </head> and <body> were recognized and split out
                captured.bodyOpenTag = parseBodyTag[1];
                captured.bodyContent = parseBodyTag[2];
            }
            break;
        }
    }
    return captured;
};

/**
 * Gather escaped content from the DOM, unescaped it, and then use
 * `document.write` to revert to the original page.
 */
Capture.prototype.restore = function() {
    var self = this;
    var doc = self.sourceDoc;

    var restore = function() {
        doc.removeEventListener('readystatechange', restore, false);

        setTimeout(function() {
            doc.open();
            doc.write(self.all());
            doc.close();
        }, 15);
    };

    if (Utils.domIsReady(doc)) {
        restore();
    } else {
        doc.addEventListener('readystatechange', restore, false);
    }
};

/**
 * Set the content of an element with html from a string
 */
Capture.prototype.setElementContentFromString = function(el, htmlString) {
    for (cachedDiv.innerHTML = htmlString; cachedDiv.firstChild; el.appendChild(cachedDiv.firstChild));
};

/**
 * Grab fragment strings and construct DOM fragments
 * returns htmlEl, headEl, bodyEl, doc
 */
Capture.prototype.createDocumentFragments = function() {
    var docFrags = {};
    var doc = docFrags.capturedDoc = document.implementation.createHTMLDocument("")
    var htmlEl = docFrags.htmlEl = doc.documentElement;
    var headEl = docFrags.headEl = htmlEl.firstChild;
    var bodyEl = docFrags.bodyEl = htmlEl.lastChild;

    // Reconstruct html, body, and head with the same attributes as the original document
    Capture.cloneAttributes(this.htmlOpenTag, htmlEl);
    Capture.cloneAttributes(this.headOpenTag, headEl);
    Capture.cloneAttributes(this.bodyOpenTag, bodyEl);

    // Set innerHTML of new source DOM body
    bodyEl.innerHTML = Capture.disable(this.bodyContent, this.prefix);
    var disabledHeadContent = Capture.disable(this.headContent, this.prefix);

    // On FF4, and potentially other browsers, you cannot modify <head>
    // using innerHTML. In that case, do a manual copy of each element
    try {
        headEl.innerHTML = disabledHeadContent;
    } catch (e) {
        var title = headEl.getElementsByTagName('title')[0];
        title && headEl.removeChild(title);
        this.setElementContentFromString(headEl, disabledHeadContent);
    }

    // Append head and body to the html element
    htmlEl.appendChild(headEl);
    htmlEl.appendChild(bodyEl);

    return docFrags;
};

/**
 * Returns an escaped HTML representation of the captured DOM
 */
Capture.prototype.escapedHTMLString = function() {
    var doc = this.capturedDoc;
    var html = Capture.enable(Utils.outerHTML(doc.documentElement), this.prefix);
    var htmlWithDoctype = this.doctype + html;
    return htmlWithDoctype;
};

/**
 * Rewrite the document with a new html string
 */
Capture.prototype.render = function(htmlString) {
    var escapedHTMLString;
    if (!htmlString) {
        escapedHTMLString = this.escapedHTMLString();
    } else {
        escapedHTMLString = Capture.enable(htmlString);
    }

    var doc = this.sourceDoc;

    // Set capturing state to false so that the user main code knows how to execute
    if (window.Mobify) window.Mobify.capturing = false;

    // Asynchronously render the new document
    setTimeout(function(){
        doc.open("text/html", "replace");
        doc.write(escapedHTMLString);
        doc.close();
    });
};

/**
 * Get the captured document
 */
Capture.prototype.getCapturedDoc = function(options) {
    return this.capturedDoc;
};

Capture.getMobifyLibrary = function(doc) {
    var doc = doc || document;
    var mobifyjsScript = doc.getElementById("mobify-js");

    // v6 tag backwards compatibility change
    if (!mobifyjsScript) {
        mobifyjsScript = doc.getElementsByTagName("script")[0];
        mobifyjsScript.id = "mobify-js";
        mobifyjsScript.setAttribute("class", "mobify");
    }

    return mobifyjsScript;
};

/**
 * Grabs the main function/src/script if it exists
 */
Capture.getMain = function(doc) {
    var doc = doc || document;
    var mainScript = undefined;
    if (window.Mobify && window.Mobify.mainExecutable) {
        // Checks for main executable string on Mobify object and creates a script
        // out of it
        mainScript = document.createElement('script');
        mainScript.innerHTML = "var main = " + window.Mobify.mainExecutable.toString() + "; main();";
        mainScript.id = 'main-executable';
        mainScript.setAttribute("class", "mobify");
    } else {
        // Older tags used to insert the main executable by themselves. 
        mainScript = doc.getElementById("main-executable");
    }
    return mainScript;
}

/**
 * Insert Mobify scripts back into the captured doc
 * in order for the library to work post-document.write
 */
Capture.insertMobifyScripts = function(sourceDoc, destDoc) {
    // After document.open(), all objects will be removed.
    // To provide our library functionality afterwards, we
    // must re-inject the script.
    var mobifyjsScript = Capture.getMobifyLibrary(sourceDoc);

    var head = destDoc.head;
    // If main script exists, re-inject it.
    var mainScript = Capture.getMain(sourceDoc);
    if (mainScript) {
        // Since you can't move nodes from one document to another,
        // we must clone it first using importNode:
        // https://developer.mozilla.org/en-US/docs/DOM/document.importNode
        var mainClone = destDoc.importNode(mainScript, false);
        if (!mainScript.src) {
            mainClone.innerHTML = mainScript.innerHTML;
        }
        head.insertBefore(mainClone, head.firstChild)
    }
    // reinject mobify.js file
    var mobifyjsClone = destDoc.importNode(mobifyjsScript, false);
    head.insertBefore(mobifyjsClone, head.firstChild);
};

/**
 * Render the captured document
 */
Capture.prototype.renderCapturedDoc = function(options) {
    // Insert the mobify scripts back into the captured doc
    Capture.insertMobifyScripts(this.sourceDoc, this.capturedDoc);

    // Inject timing point (because of blowing away objects on document.write)
    // if it exists
    if (window.Mobify && window.Mobify.points) {
        var body = this.bodyEl;
        var date = this.capturedDoc.createElement("div");
        date.id = "mobify-point";
        date.setAttribute("style", "display: none;")
        date.innerHTML = window.Mobify.points[0];
        body.insertBefore(date, body.firstChild);
    }

    this.render();
};

return Capture;

});

var Mobify = window.Mobify = window.Mobify || {};
Mobify.$ = Mobify.$ || window.Zepto || window.jQuery;

// Requires Mobify object for method attachment
(function(Mobify){

// Private Methods
var elementInViewport = function(el) {
    var rect = el.getBoundingClientRect();
    return (
        rect.top  >= 0
    &&  rect.left >= 0
    &&  rect.top <= (window.innerHeight || document.documentElement.clientHeight)
    )   
};  

//Public Methods
var Lazyload = {}
  , renderImages = Lazyload.renderImages = function() {
        images = document.getElementsByTagName("img");
        for (var i=0; i<images.length; i++) {
            if (elementInViewport(images[i]) && images[i].hasAttribute("data-src")) {
                images[i].setAttribute("src", images[i].getAttribute("data-src"));
            }
        }
    }

  , rewriteSrc = Lazyload.rewriteSrc = function(document) {
        images = document.getElementsByTagName("img");
        for (var i=0; i<images.length; i++) {
            var src = images[i].getAttribute("x-src");
            images[i].removeAttribute("x-src");
            images[i].setAttribute("data-src", src);
        }
    }
  , attachLazyloadEvents = Lazyload.attachLazyloadEvents = function($document, captured) {
        renderImages(); 
        Mobify.$(window).on("scroll", renderImages );
  }

Mobify.Lazyload = Lazyload;

})(Mobify);

define("mobifyjs/lazyloadImages", function(){});

require(["mobifyjs/utils", "mobifyjs/capture", "mobifyjs/lazyloadImages"], function(Utils, Capture) {
    var Mobify = window.Mobify = window.Mobify || {};

    // DECLARE LIBRARIES ATTACHED TO MOBIFY OBJECT HERE
    Mobify.Utils = Utils;
    Mobify.Capture = Capture;
}, undefined, true);

define("../mobify-custom.js", function(){});
}());
