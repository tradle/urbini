(function(window, doc, undefined) {
var __started = new Date(),
    ArrayProto = Array.prototype,
    browser = Lablz.browser;

_.extend($, {
  RESOLVED_PROMISE: $.Deferred().resolve().promise(),
  whenAll: function() {
    var args = ArrayProto.slice.call(arguments),
        len = args.length;

    if (!len)
      return $.RESOLVED_PROMISE;

    return $.Deferred(function(dfd) {
      var results = new Array(len),
          counter = 0,
          state = "resolved",
          resolveOrReject = function() {
            if (this.state() === "rejected"){
              state = "rejected";
            }

            var idx = args.indexOf(this);
            counter++;
            switch (arguments.length) {
              case 0:
              case 1:
                results[idx] = arguments[0] || null;
                break;
              default:
                results[idx] = [].slice.call(arguments);
                break;
            }

            if (counter === len) {
              dfd[state === "rejected"? "reject": "resolve"].apply(dfd, results);
            }
          };

      for (var i = 0, l = args.length; i < l; i++) {
        var item = args[i];
        item.always(resolveOrReject.bind(item));
      }
    }).promise();
  }
});

define('globals', function() {
  /**
   * @param constantTimeout: if specified, this will always be the timeout for this function, otherwise the first param of the returned async function will be the timeout
   */

  function hasLocalStorage() {
    var supported = false;
    try{
      supported = window && ("localStorage" in window) && ("getItem" in localStorage);
    } catch(e) {}

    return supported;
  };

  function getFullName(module) {
    return require.toUrl(module).slice(require.getConfig().baseUrl.length);
  };

  function getBundleForFile(fileName) {
    var fullName = getFullName(fileName);
    for (var bName in G.bundles) {
      var bundle = G.bundles[bName];
      if (_.any(bundle, function(info) { return info.name == fullName; }))
        return bundle;
    }
  }

  function getFileStorageType(fileName) {
    var bundle = getBundleForFile(fileName);
    if (bundle)
      return getBundleStorageType(bundle._name);
    else
      return 'localStorage';
  }

  function getBundleStorageType(bundleName) {
    if (G.dbType == 'none')
      return 'localStorage';

    switch (bundleName) {
    case 'pre':
    case 'post':
    case 'widgetsFramework':
      return 'localStorage';
    default:
      return 'indexedDB';
    }
  };

  function saveBootInfo() {
    var ls = G.localStorage,
        sortable = [],
        count = 0;

    if (!ls)
      return;

    for (var source in ls) {
      sortable.push([source, ls[source].length]);
    }

    sortable.sort(function(a, b) {return a[1] - b[1]})
    for (var i = 0; i < sortable.length; i++) {
      count += sortable[i][1];
      G.log(G.TAG, 'boot', sortable[i][1] + ' ' + sortable[i][0]);
    }

    G.log(G.TAG, 'boot', 'total: ' + count);

    var v = ls.get('VERSION');
    v ? ls.put('OLD_VERSION', v) : ls.clean();
    ls.put('VERSION', JSON.stringify(Lablz.VERSION));
    delete Lablz.VERSION;
    ls.put('Globals', JSON.stringify(Lablz));
  }

  function addModule(text) {
  //  console.log("evaling/injecting", text.slice(text.lastIndexOf('# sourceURL')));
    // Script Injection

    var idx = text.indexOf('//@ sourceURL');
    idx = idx == -1 ? 0 : idx;
    var length = idx ? 100 : text.length - idx;
//    Lablz.log(Lablz.TAG, 'module load', text.slice(idx, idx + length));

    if (G.minify) {
      if (browser.chrome) // || nav.isSafari)
        G.inject(text);
      else if (browser.mozilla)
        return window.eval(text);
//        return window.eval.call({}, text);
      else // Safari
        return window.eval(text);
    }
    else
      return window.eval(text);
  }

  Function.prototype.async = function(constantTimeout) {
    var self = this;
    return function() {
      var args = arguments;
      var timeout = constantTimeout || ArrayProto.shift.apply(args);
      setTimeout(function() {
        self.apply(self, args);
      }, timeout);
    }
  };

  // maybe we don't even need deferreds here, but if sth here ever becomes async with onload callbacks...
  function loadModule (name, url, text) {
    return $.Deferred(function(defer) {
      var ext = url.match(/\.[a-zA-Z]+$/g)[0];
      var appcache = G.files.appcache;

      switch (ext) {
        case '.css':
          text += '\r\n/*//@ sourceURL=' + url + '*/';
          if (appcache[name])
            G.linkCSS(G.serverName + '/' + url);
          else
            G.appendCSS(text);

          G.log(G.TAG, 'cache', 'cache.get: ' + url);
          defer.resolve(name);
          G.log(G.TAG, 'cache', 'end cache.get: ' + url);
          break;
        case '.json':
          G.log(G.TAG, 'cache', 'cache.get: ' + url);
          defer.resolve(JSON.parse(text));
          G.log(G.TAG, 'cache', 'end cache.get: ' + url);
          break;
        case '.html':
        case '.jsp':
        case '.lol':
          G.log(G.TAG, 'cache', 'cache.get: ' + url);
//          onLoad(text);
          defer.resolve(text);
          G.log(G.TAG, 'cache', 'end cache.get: ' + url);
          break;
        default:
          if (browser.msie)
            text += '/*\n'; // see http://bugs.jquery.com/ticket/13274#comment:6
//          temp commment out as profiler says sourceMappingURL slows down app load
//          if (G.minify)
//            text += '\n//@ sourceMappingURL=' + url.match(/\/([^\/]*)\.js$/)[1] + '.min.js.map';

          text += '\n//@ sourceURL=' + url;
          if (browser.msie)
            text += '*/\n';

          addModule(text);
          defer.resolve();
          break;
      }
    }).promise();
  }

  var orgLoad = require.load;
  require.load = function(name) {
    name = require.getRealName(name);
//    if (!isModuleNeeded(name))
//      return G.getResolvedPromise();

    var url = G.getCanonicalPath(require.toUrl(name));
    var args = arguments,
        self = this;

    return $.Deferred(function(defer) {
      if (name === 'globals')
        return defer.resolve(G);
      else if (name == 'underscore')
        return defer.resolve(window._);

      var cached, realPath;
      if (/\.(jsp|css|html|json)\.js$/.test(url))
        url = url.replace(/\.js$/, '');

      var inAppcache = realPath = Bundler.getFromAppcacheBundle(url);
      if (inAppcache || (G.inFirefoxOS && G.minify)) {
        var path = requireConfig.paths[name] || name;
        if (!/\.(jsp|css|html|json)$/.test(url)) {
          orgLoad(name, url.replace(path, realPath));
          return;
        }
      }


      var ext;
      var isText = ext = name.match(/\.[a-zA-Z]+$/g);
      if (ext)
        ext = ext[0].slice(1).toLowerCase();

      var mCache = G.modules;
      var cached = inAppcache || (mCache && mCache[url]);
      var loadedCached = false;
      if (cached) {// || hasLocalStorage) {
        var loadedCached = cached;
        if (loadedCached) {
          try {
            G.log(G.TAG, 'cache', 'Loading from LS', url);
            loadModule(name, url, cached).done(defer.resolve);
            G.log(G.TAG, 'cache', 'End loading from LS', url);
          } catch (err) {
            debugger;
            defer.reject();
            G.log(G.TAG, ['error', 'cache'], 'failed to load', url, 'from local storage', err);
            G.localStorage.del(url);
            loadedCached = false;
          }
        }
      }

      if (loadedCached) {
        delete G.modules[url];
        return;
      }

      /// use 'sendXhr' instead of 'req' so we can store to localStorage
      Bundler.loadBundle(name, {source: getFileStorageType(name)}).done(function() {
        if (G.modules[url])
          loadModule(name, url, G.modules[url]).done(defer.resolve);
        else {
          G.log(G.TAG, ['error', 'cache'], 'failed to load module', name);
          defer.reject();
        }
      });
    }).promise();
  };

  function getDomain() {
    return window.location.host.match(/[a-zA-Z]+\.[a-zA-Z]+$/)[0];
  }

  function testCSS(prop) {
    return prop in doc.documentElement.style;
  };

  function getSpinnerId(name) {
    return 'loading-spinner-holder-' + (name || '').replace(/[\.\ ]/g, '-');
  };

  function getFilePathInStorage(url) {
    url = isFilePathKey(url) ? url : 'file:' + url;
    if (G.minify && !/\.min$/.test(url))
      url += ".min";

    return url;
  };

  function isFilePathKey(str) {
    return /^file:/.test(str);
  };

  function isFilePathMetadataKey(str) {
    return /^file:metadata:/.test(str);
  };

  function getMetadataURL(url) {
    return 'metadata:' + getFilePathInStorage(url);
  };

  function putCached(keyToData, options) {
    options = options || {};
    var storage = options.storage || G.getPreferredStorage(),
        store = options.store || 'modules',
        storeInfo = store === 'modules' ? G.getModulesStoreInfo() : G.getModelsStoreInfo(),
        keyPath = storeInfo.options.keyPath;

    if (storage === 'localStorage') {
      if (!G.prunedLocalStorage)
        G.pruneLocalStorage();

      for (var key in keyToData) {
        var val = keyToData[key];
        if (typeof val == 'object')
          val = JSON.stringify(val);

        G.localStorage.put(key, val);
      }

      return RESOLVED_PROMISE;
    }
    else if (storage === 'indexedDB') {
      if (G.dbType === 'none')
        return REJECTED_PROMISE;

      if (DB_OPEN_DFD.state() == 'pending') {
        debugger;
        var self = this,
            args = arguments;

        return DB_OPEN_DFD.promise().then(function() {
          return putCached.apply(self, args);
        });
      }

//      if (!G.prunedIndexedDB)
//        G.pruneIndexedDB();

      var stuff = [];
      for (var key in keyToData) {
        var stuffInfo = {
          data: keyToData[key]
        };

        stuffInfo[keyPath] = key;
        stuff.push(stuffInfo);
      };

      return G.ResourceManager.addItems(options.store || 'modules', stuff);
    }
    else
      return REJECTED_PROMISE;
  };

  function setMiscGlobals() {
    var path = window.location.pathname,
        appPath = path.slice(path.lastIndexOf('/') + 1),
        devVoc = G.DEV_PACKAGE_PATH.replace('/', '\/'),
        regex = devVoc + appPath + '\/[^\/]*$',
        commonTypes = G.commonTypes,
        defaultVocPath = G.defaultVocPath;

    G.serverNameHttp = G.serverName.replace(/^[a-zA-Z]+:\/\//, 'http://');
    _.extend(G, {
      appUrl: G.serverName + '/' + G.pageRoot,
      sqlUrl: G.serverNameHttp + '/' + G.sqlUri,
      hostName: getDomain().split('.')[0],
      modelsUrl: G.serverName + '/backboneModel',
      storeFilesInFileSystem: G.hasBlobs && G.hasFileSystem && G.browser.chrome,
      useInlineWorkers: G.hasBlobs && G.hasWebWorkers && !G.browser.msie,
      apiUrl: G.serverName + '/api/v1/',
      timeOffset: G.localTime - G.serverTime,
      firefoxManifestPath: G.serverName + '/wf/' + G.currentApp.attachmentsUrl + '/firefoxManifest.webapp',
//      firefoxManifestPath: G.serverName + '/FirefoxApp/NursMe/manifest.webapp',
      chromeManifestPath: G.serverName + '/wf/' + G.currentApp.attachmentsUrl + '/chromeManifest.json',
      domainRegExp: new RegExp('(https?:\/\/)?' + G.serverName.slice(G.serverName.indexOf('://') + 3)),
      appModelRegExp: new RegExp('model:(metadata:)?' + devVoc),
      currentAppRegExp: new RegExp(regex),
      currentAppModelRegExp: new RegExp('model:(metadata:)?' + regex)
    });

    for (var type in commonTypes) {
      commonTypes[type] = defaultVocPath + commonTypes[type];
    }
  };

  function adjustForVendor() {
    (function () {
      function CustomEvent ( event, params ) {
        params = params || { bubbles: false, cancelable: false, detail: undefined };
        var evt = document.createEvent( 'CustomEvent' );
        evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
        return evt;
       };

      CustomEvent.prototype = window.Event.prototype;

      window.CustomEvent = CustomEvent;
    })();

    // requestAnimationFrame polyfill by Erik Miller & Paul Irish et. al., adjusted by David DeSandro https://gist.github.com/desandro/1866474
    window.AudioContext = window.AudioContext || window.webkitAudioContext; // keep in mind, firefox doesn't have AudioContext.createMediaStreamSource
    window.MediaStream = window.webkitMediaStream || window.MediaStream;
    window.MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.webkitMutationObserver || window.mozMutationObserver;
    window.URL = window.URL || window.webkitURL;
    (function( window ) {
      'use strict';

      var lastTime = 0;
      var prefixes = 'webkit moz ms o'.split(' ');
      // get unprefixed rAF and cAF, if present
      var requestAnimationFrame = window.requestAnimationFrame;
      var cancelAnimationFrame = window.cancelAnimationFrame;
      // loop through vendor prefixes and get prefixed rAF and cAF
      var prefix;
      for( var i = 0; i < prefixes.length; i++ ) {
        if ( requestAnimationFrame && cancelAnimationFrame ) {
          break;
        }
        prefix = prefixes[i];
        requestAnimationFrame = requestAnimationFrame || window[ prefix + 'RequestAnimationFrame' ];
        cancelAnimationFrame  = cancelAnimationFrame  || window[ prefix + 'CancelAnimationFrame' ] ||
                                  window[ prefix + 'CancelRequestAnimationFrame' ];
      }

      // fallback to setTimeout and clearTimeout if either request/cancel is not supported
      if ( !requestAnimationFrame || !cancelAnimationFrame ) {
        G.hasRequestAnimationFrame = false;
        requestAnimationFrame = function( callback, element ) {
          var currTime = new Date().getTime();
          var timeToCall = Math.max( 0, 16 - ( currTime - lastTime ) );
          var id = window.setTimeout( function() {
            callback( currTime + timeToCall );
          }, timeToCall );
          lastTime = currTime + timeToCall;
          return id;
        };

        cancelAnimationFrame = function( id ) {
          window.clearTimeout( id );
        };
      }
      else
        G.hasRequestAnimationFrame = true;

      // put in global namespace
      window.raf = window.requestAnimationFrame = requestAnimationFrame;
      window.caf = window.cancelAnimationFrame = cancelAnimationFrame;

    })( window );
  }

  function testIfInsidePackagedApp() {
    // browser and version detection: http://stackoverflow.com/questions/5916900/detect-version-of-browser
    if (!browser.chrome && !browser.firefox)
      return;

    function setParent() {
      if (browser.chrome)
        G.inWebview = true;
      else if (browser.firefox) {
        G.inFirefoxOS = true;
//        window.top.postMessage({message: 'Hello world'}, G.serverName);
      }
    };

    var param = browser.chrome ? '-webview' : '-ffiframe';
    if (hasLocalStorage) {
      if (localStorage.getItem(param) === 'y') {
        setParent();
        return;
      }
    }

    if (params[param] == 'y') {
      setParent();
      G.localStorage.put(param, 'y');
    }

    G.hasFFApps = browser.firefox && 'mozApps' in navigator;
    G.log(G.TAG, 'webview', 'inWebview:', G.inWebview);
    G.log(G.TAG, 'ffIframe', 'inFFIframe:', G.inFirefoxOS);
  //    ALL_IN_APPCACHE = G.inFirefoxOS;
  }

  function determineMinificationMode() {
    // Determine whether we want the server to minify stuff
    // START minify
    var qIdx = hash.indexOf('?'),
        set = false,
        mCookieName = G.serverName + '/cookies/minify',
        minified = G.getCookie(mCookieName);

    if (qIdx != -1) {
      var hParams = hash.slice(qIdx + 1).split('&');
      for (var i = 0; i < hParams.length; i++) {
        var p = hParams[i].split('=');
        if (p[0] == '-min') {
          G.setCookie(mCookieName, p[1], 100000);
          if (p[1] != minified) {
            minified = p[1];
          }

          break;
        }
      }
    }

    G.minify = minified === 'y' ? true : minified === 'n' ? false : G.minifyByDefault;
  }

  function setupLocalStorage() {
    if (!hasLocalStorage)
      return;

    G.localStorage = {
      get: function(url) {
        var item = localStorage.getItem(url);
        return item;
      },
      del: function(key) {
        localStorage.removeItem(key);
      },
      put: function(key, value, force) {
        if (!G.hasLocalStorage)
          return false;

        value = Object.prototype.toString.call(value) === '[object String]' ? value : JSON.stringify(value);
        try {
          localStorage.setItem(key, value);
        } catch(e) {
//          debugger;
          if (['QuotaExceededError', 'QUOTA_EXCEEDED_ERR', 'NS_ERROR_DOM_QUOTA_REACHED'].indexOf(e.name) != -1) {
            // clean to make space
            var appModelRegexp = G.appModelRegExp,
                thisAppModelRegexp = G.currentAppModelRegExp,
                numRemoved = this.clean(function(key) {
                  return appModelRegexp.test(key) && !thisAppModelRegexp.test(key);
                });

            if (!numRemoved) {
              numRemoved = this.clean(function(key) {
                return /^model\:/.test(key);
              });
            }

            if (!numRemoved) {
              numRemoved = this.clean(function(key) {
                return !/\//.test(key); // all except Globals, Version, other state variables
              });
            }

            if (!numRemoved)
              this.clean();

  //          if (!numRemoved) {
  //            var extras = G.bundles.extras;
  //            for (var type in extras) {
  //              if (!/^_/.test(type)) {
  //                _.each(_.map(_.pluck(extras[type], 'name'), _.compose(G.getCanonicalPath, require.toUrl)), function(url) {
  //                  G.localStorage.del(url);
  //                  G.localStorage.del('metadata:' + url);
  //                });
  //              }
  //            }
  //          }

            if (!this.cleaning) { // TODO: unhack this garbage
              this.cleaning = true;
              G.Voc && G.Voc.saveModelsToStorage();
            }

            if (numRemoved)
              this.put(key, value);

            this.cleaning = false;
          } else {
            debugger;
            G.hasLocalStorage = false;
            G.log(G.TAG, "Local storage write failure: ", e);
          }
        }
      },

      clean: function(test) {
        var cleaning = this.cleaning,
            numRemoved = 0;

        this.cleaning = true;
        for (var i = localStorage.length - 1; i > -1; i--) {
          var key = localStorage.key(i);
          if (!test || test(key)) {
            G.localStorage.del(key);
            numRemoved++;
          }
        }

        return numRemoved;
      },

      nukeScripts: function() {
        var start = new Date().getTime();
        var length = localStorage.length;
        G.log(G.TAG, 'nuke', "nuking scripts, localStorage has", length, "keys", start);
        for (var i = length - 1; i > -1; i--) {
          var key = localStorage.key(i);
          if (/\.(?:js|css|jsp|json)$/.test(key)) {
            var start1 = new Date().getTime();
            G.localStorage.del(key);
            G.log(G.TAG, "nuke", key, new Date().getTime() - start1);
          }
        }

        G.log(G.TAG, "nuke", "nuking scripts took", new Date().getTime() - start, "ms");
      },

      nukePlugs: function() {
        var length = localStorage.length;
        var types = [], plugs;
        for (var i = length - 1; i > -1; i--) {
          var key = localStorage.key(i);
          if (/^plugs/.test(key)) {
            types.push(key.slice(9));
            G.localStorage.del(key);
          }
        }

        return types;
      }
    };

    G.localStorage.putAsync = G.localStorage.put.async(100);
    G.localStorage.cleanAsync = G.localStorage.clean.async(100);
  }

  function setupWidgetLibrary() {
    var widgets = G._widgetsLib = [],
        bundle = widgetsBundle,
        templates = ['../templates.jsp'];

    for (var i = 0, len = bundle.length; i < len; i++) {
      widgets.push(bundle[i].name);
    }

    switch (G._widgetLibrary.toLowerCase()) {
//    case 'building blocks':
//      templates.push('../templates.jsp');
//      break;
    case 'topcoat':
      templates.push('../templates_topcoat.jsp');
      break;
    case 'bootstrap':
      templates.push('../templates_bootstrap.jsp');
      break;
    }

    G._widgetTemplates = templates;
  }

  function load() {
    var spinner = {
          name: 'app init',
          timeout: 10000,
          blockClick: true
        },
        priorityModules = [];

//    G.startedTask("loading pre-bundle");
    G.showSpinner(spinner);
    APP_START_PROMISE.done(function() {
      G.hideSpinner(spinner);
      G.log(G.TAG, 'stats', "App start took: " + (new Date().getTime() - __started) + ' millis');
    });

    for (var type in preBundle) {
      var subBundle = preBundle[type];
      for (var i = 0; i < subBundle.length; i++) {
        var module = subBundle[i];
        if (module.hasOwnProperty('priority')) {
          subBundle.splice(i, 1);
          priorityModules.push(module);
        }
      }
    }

    if (priorityModules.length) {
      priorityModules.sort(function(a, b) {
        return b.priority - a.priority;
      });

//      var pModules = [];
      for (var i = 0; i < priorityModules.length; i++) {
        priorityModules[i] = priorityModules[i].name;
//        pModules.push(priorityModules[i].name);
      }

//        require(pModules);
      require(priorityModules).done(loadRegular);
    }
    else
      loadRegular();
  }

  function getCSS(/* bundles */) {
    var css = [];
    for (var i = 0; i < arguments.length; i++) {
      var bundle = arguments[i];
      for (var j = 0, len = bundle.length; j < len; j++) {
        var info = bundle[j];
        if (/\.css$/.test(info.name))
          css.push(info);
      }
    }

    css.sort(function(item) {
      return item.order || 0;
    });

    for (var i = 0, len = css.length; i < len; i++) {
      css[i] = css[i].name;
    }

    return css;
  }

  function loadRegular() {
    G.log(G.TAG, 'bundles', 'loaded app cache bundle');
    G.bundles.appcache._deferred.resolve();
    G.log(G.TAG, 'bundles', 'loading bundles pre, widgetsFramework');
    Bundler.loadBundle(preBundle.concat(widgetsBundle), {source: getBundleStorageType('pre')}).then(function() {
      preBundle._deferred.resolve();
      G.bundles.widgetsFramework._deferred.resolve();
      G.log(G.TAG, 'bundles', 'loaded pre,widgetsFramework bundles');
//      G.finishedTask("loading pre-bundle and widgets-bundle");
//      G.startedTask("loading modules");
      var essential = getCSS(preBundle, widgetsBundle);
      essential.unshift.call(essential, 'events', 'app', 'lib/l10n');
      return require('__domReady__').then(function() {
        return require(essential);
      });
    }).then(function(Events, App) {
      Events.on('visibility:hidden', function() {
        G._pageIsVisible = false;
      });

      Events.on('visibility:visible', function() {
        G._pageIsVisible = true;
      });

      Events.once('dbOpen', DB_OPEN_DFD.resolve);
      Events.once('appStart', APP_START_DFD.resolve);
//      G.log(G.TAG, 'info', "Loaded pre-bundle: " + (new Date().getTime() - __started) + ' millis');
//      G.finishedTask("loading modules");
      App.initialize();
//      G.startedTask('loading post-bundle');
      G.log(G.TAG, 'bundles', 'loading post bundle');
      return Bundler.loadBundle(postBundle, {async: true, source: getBundleStorageType('post')}).done(function() {
//        G.finishedTask('loading post-bundle');
        G.log(G.TAG, 'bundles', 'loaded post bundle');
        postBundle._deferred.resolve();
      });
    });

    G.onAppStart(function() {
//      G.startedTask('loading extras-bundle');
      G.log(G.TAG, 'bundles', 'loading extras bundle');
      Bundler.loadBundle(extrasBundle, {async: true, source: getBundleStorageType('extras')}).done(function() {
        G.log(G.TAG, 'bundles', 'loaded extras bundle');
//        G.startedTask('loading extras-bundle');
        extrasBundle._deferred.resolve();
      });
    });
  }

  var Bundler = {
    pruneUnneededModules: function() {
      var bundles = G.bundles;
      for (var name in bundles) {
        var bundle = bundles[name];
        for (var i = bundle.length - 1; i >= 0; i--) {
          if (!G.isModuleNeeded(bundle[i].name))
            bundle.splice(i, 1);
        }
      }

      this.pruneUnneededBundles = null;
    },

    pruneBundle: function(bundle, options) {
      options = options || {};
      var source = options.source || G.getPreferredStorage();
      var pruneDfd = $.Deferred();
      var prunePromise = pruneDfd.promise();
      var modules = [];
      var appcache = G.files.appcache;
      var bType = Object.prototype.toString.call(bundle);
      var noTS = bType === '[object String]';
      if (noTS) {
        var info = {
          name: bundle
        }

        var timestamp = G.files[name];
        if (timestamp && timestamp.timestamp)
          info.timestamp = timestamp.timestamp;

        bundle = {def: [info]};
      }
      else if (Object.prototype.toString.call(bundle) === '[object Array]') {
        bundle = {def: bundle};
      }

      for (var type in bundle) {
        var bt = bundle[type];
        for (var i = 0; i < bt.length; i++) {
          var info = bt[i];
          var name, timestamp;
          if (typeof info === 'string')
            name = info, timestamp = G.files[name];
          else {
            name = info.name;
            timestamp = info.timestamp;
          }

          if (!name || (appcache[name] && (!name.endsWith('Worker.js') || !G.useInlineWorkers)))
            continue;

          info = {};
          var path = G.getCanonicalPath(require.toUrl(name));
          if (G.modules[path])
            continue;

          info[path] = timestamp; // || G.modules(G.bundles, path)[path];
          modules.push(info);
        }
      }

      if (!hasLocalStorage)
        source = 'indexedDB';

      if (!modules.length)
        return $.Deferred().resolve(modules).promise();

      var minify = G.minify,
          def = G.minifyByDefault;

      var pruned = [];
      var cachedPromises = modules.map(function(dmInfo, i) {
        var url;
        for (var n in dmInfo) {
          url = n;
          break;
        }

        return G.getCached(getMetadataURL(url), source).then(function(metadata) {
          if (!metadata) {
            pruned.push(url);
            return;
          }

          metadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
          var dateSaved = metadata.dateModified;
          var minified = metadata.minified;
          var dateModified = dmInfo[url];
          if (dateModified <= dateSaved) {
            var fetch = false;
            if (G.isMinifiable(url)) {
              if ((!minified && (minify===true || (typeof minify ==='undefined' && def))) ||
                  (minified && (minify===false || (typeof minify ==='undefined' && !def)))) {
                // wrong minification mode on this file
                fetch = true;
              }
            }

            if (!fetch) {
              return G.getCached(getFilePathInStorage(url), source).then(function(text) {
                G.modules[url] = text;
              }).fail(function() {
                pruned.push(url);
              });
            }
          }
          else {
            if (!info)
              G.log('init', 'error', 'no info found for file: ' + url);

//              G.localStorage.del(url);
          }

          pruned.push(url);
        }, function() {
          pruned.push(url);
        });
      });

      $.whenAll.apply($, cachedPromises).always(function() {
        pruneDfd.resolve(pruned);
      });

      return prunePromise;
    },

//    _queuedToLoad: [],
//    queueLoadBundle: function(/* module names */) {
//      var self = this;
//      this._queuedToLoad.push.apply(this._queuedToLoad, arguments);
//      if (this._bundleTimer) {
//        clearTimeout(this._bundleTimer);
//        debugger;
//      }
//
//      this._bundleTimer = setTimeout(function() {
//        self.loadBundle(self._queuedToLoad);
//      }, 50);
//    },

    loadBundle: function(bundle, options) {
      var bundleDfd = $.Deferred(),
          bundlePromise = bundleDfd.promise(),
          options = options || {},
          source = options.source,
          useWorker = G.hasWebWorkers && options.async,
          worker;

      // recycling the worker needs to be the first order of business when this promise if resolved/rejected
      if (useWorker) {
        bundlePromise.always(function() {
          if (worker)
            G.recycleXhrWorker(worker);
        });
      }

      function onResponse(resp) {
        if (useWorker) {
          if (resp.status == 304)
            bundleDfd.resolve();
          else
            resp = resp.data;
        }
        else {
          try {
            resp = JSON.parse(resp);
          } catch (err) {
          }
        }

        if (resp && !resp.error && resp.modules) {
          var newModules = {};
          var modules = resp.modules;
          for (var i = 0; i < modules.length; i++) {
            var m = modules[i];
//            for (var name in m) {
            var name = m.name;
            var ext = name.slice(name.lastIndexOf(".") + 1);
            var minMatch = name.match(/\.min\.(js|css)$/);
            name = minMatch == null ? name : name.slice(0, name.lastIndexOf('.min.' + minMatch[1])) + '.' + minMatch[1];
            G.modules[name] = m.body;
            newModules[getFilePathInStorage(name)] = m.body;
            newModules[getMetadataURL(name)] = {
              dateModified: m.dateModified,
              minified: G.isMinified(name, m.body)
            };
          }

          setTimeout(function() {
            G.putCached(newModules, {
              storage: source
            });
          }, 100);
        }

        bundleDfd.resolve();
      };

      Bundler.pruneBundle(bundle, options).done(function(pruned) {
        if (!pruned.length) {
          G.log('init', 'cache', 'bundle was cached', bundle);
          return bundleDfd.resolve();
        }

        var data = {modules: pruned.join(',')},
            getBundleReq = {
              url: G.serverName + "/backboneFiles",
              type: 'POST',
              data: data,
              dataType: 'JSON'
            };

        if (useWorker) {
          G.getXhrWorker().done(function() {
            worker = arguments[0];
            worker.onmessage = function(event) {
              G.log(G.TAG, 'xhr', 'fetched', getBundleReq.data.modules);
              onResponse(event.data);
            };

            worker.onerror = function(e) {
              debugger;
              bundleDfd.reject();
            };

            worker.postMessage({
              command: 'xhr',
              config: getBundleReq
            });
          });
        }
        else {
          getBundleReq.success = onResponse;
          G.sendXhr(getBundleReq);
        }
      });

      return bundlePromise;
    },

    prepAppCacheBundle: function() {
      var bundles = G.bundles;
      G.files = {appcache: {}};
      for (var when in bundles) {
        var bundle = bundles[when];
        bundle._deferred = $.Deferred();
        bundle._name = when;
        for (var type in bundle) {
          var info = bundle[type];
          G.files[info.name] = info;
          if (when === 'appcache') {
  //        if ((type === 'js' && ALL_IN_APPCACHE && !/^lib/.test(info.name)) || when === 'appcache') {
            G.files.appcache[info.name] = info;
          }
        }
      }
    },
    getFromAppcacheBundle: function(url) {
      var appcacheBundle = G.bundles.appcache;
      url = url.slice(url.indexOf('/') + 1);
//      if (/\.js$/.test(url))
//        url = url.slice(0, url.length - 3);

      var info = G.files.appcache[url];
      return info ? info.fullName || info.name : null;
    }
  };

  var TRACE = {
    ON: true,
    DEFAULT: {on: true},
    types : {
      info: {
        on: false,
        color: '#FFFFFF',
        bg: '#000'
      },
      error: {
        on: true,
        color: '#FF0000',
        bg: '#333'
      },
      checkpoints: {
        on: false,
        color: '#FF88FF',
        bg: '#000'
      },
      xhr: {
        on: false,
        color: '#2288FF',
        bg: '#000'
      },
      bundles: {
        on: true,
        color: '#88FFFF',
        bg: '#000'
      },
//      tasks: {
//        on: true,
//        color: '#88FFFF',
//        bg: '#000'
//      },
      taskQueue: {
        on: false,
        color: '#88FFFF',
        bg: '#000'
      },
      visibility: {
        on: false,
        color: '#FFFFFF',
        bg: '#000'
      },
      app: {
        on: true,
        color: '#88FFFF',
        bg: '#000'
      },
      db: {
        on: false,
        color: '#FFFFFF',
        bg: '#000'
      },
      render: {
        on: true,
        color: '#AA00FF',
        bg: '#DDD'
      },
      events: {
        on: false,
        color: '#baFF00',
        bg: '#555'
      },
      history: {
        on: true,
        color: '#baFF66',
        bg: '#555'
      },
      cache: {
        on: false,
        color: '#CCCCCC',
        bg: '#555'
      }
    }
  };

  var requireConfig = {
    paths: {
      '@widgets': 'widgetsLibAdapter',
      physics: 'physicsBridge',
      hammer: 'lib/hammer',
      mobiscroll: 'lib/mobiscroll',
//      mobiscroll: 'lib/mobiscroll-datetime-min',
//      mobiscrollDate: 'lib/mobiscroll-datetime',
//      mobiscrollDuration: 'lib/mobiscroll-duration',
      simplewebrtc: 'lib/simplewebrtc',
      jqmConfig: 'jqm-config',
      jqueryMobile: 'lib/jquery.mobile-1.3.2',
//      _underscore: 'lib/underscore',
//      underscore: 'underscoreMixins',
      backbone: 'lib/backbone',
      indexedDBShim: 'lib/IndexedDBShim',
      jqueryIndexedDB: 'lib/jquery-indexeddb',
      queryIndexedDB: 'lib/queryIndexedDB',
      uuid: 'lib/uuid',
      codemirror: 'lib/codemirror',
      codemirrorCss: '../styles/codemirror.css',
      codemirrorJSMode: 'lib/codemirrorJSMode',
      codemirrorXMLMode: 'lib/codemirrorXMLMode',
      codemirrorHTMLMode: 'lib/codemirrorHTMLMode',
      codemirrorCSSMode: 'lib/codemirrorCSSMode',
      stockCharts: 'lib/stockCharts',
      colorbrewer: 'lib/colorbrewer',
      d3: 'lib/d3',
      dcCss: 'lib/dc/dc.css',
      dc: 'lib/dc/dc',
      crossfilter: 'lib/crossfilter/crossfilter',
      leaflet: 'lib/leaflet',
      leafletMarkerCluster: 'lib/leaflet.markercluster',
//      jqueryImagesLoaded: 'lib/jquery.imagesloaded',
      jqueryMasonry: 'lib/jquery.masonry'
//      jqueryAnyStretch: 'lib/jquery.anystretch'
    },
    shim: {
      backbone: {
        deps: ['underscore'],
        exports: 'Backbone'
      },
      '../styles/bb_styles.css': ['../styles/styles.css', '../styles/common-template-m.css'],
      '../styles/topcoat_styles.css': ['../styles/styles.css', '../styles/common-template-m.css'],
      '../styles/jqm_styles.css': ['../styles/styles.css', '../styles/common-template-m.css'],
      leafletMarkerCluster: ['leaflet'],
      dc: ['d3'],
//      mobiscroll: ['../styles/mobiscroll.datetime.min.css'],
      mobiscroll: ['../styles/mobiscroll-scroller.css'],
      codemirrorJSMode: ['codemirror', 'codemirrorCss'],
      codemirrorCSSMode: ['codemirror', 'codemirrorCss'],
      codemirrorHTMLMode: ['codemirror', 'codemirrorCss', 'codemirrorXMLMode']
    }
  };

  /////////////////// START SETUP ///////////////////////////////

  var G = window.Lablz,
      APP_START_DFD = $.Deferred(),
      APP_START_PROMISE = APP_START_DFD.promise(),
      DB_OPEN_DFD = $.Deferred(),
      RESOLVED_PROMISE = $.Deferred().resolve().promise(),
      REJECTED_PROMISE = $.Deferred().reject().promise(),

      // DOM stuff
//      ALL_IN_APPCACHE,
      hash = window.location.hash ? window.location.hash.slice(1) : window.location.href.slice(window.location.href.indexOf(Lablz.pageRoot) + Lablz.pageRoot.length + 1),
      query = hash.split('?')[1],
      params = _.toQueryParams(query),
      head = doc.head,
      body = doc.body,
//      $head = $('head'),
//      head = $head[0],
//      $body = $('body'),
//      body = $body[0],

      // XHR
      PROG_IDS = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],

      // localStorage
      hasLocalStorage = hasLocalStorage(), // yes, overwrite the function reference, we don't need it anymore

      // bundles
      bundles = G.bundles, // is part of initial globals
      widgetsBundle = bundles.widgetsFramework,
      preBundle = bundles.pre,
      postBundle = bundles.post,
      extrasBundle = bundles.extras;

  window.addEventListener("offline", function(e) {
    // we just lost our connection and entered offline mode, disable eternal link
    G.setOnline(false);
  }, false);

  window.addEventListener("online", function(e) {
    // just came back online, enable links
    G.setOnline(true);
  }, false);

  _.extend(G, {
    _widgetLibrary: G.currentApp.widgetLibrary || 'Building Blocks',
    _pageIsVisible: true,
    browser: browser,
    isVisible: function() {
      return G._pageIsVisible;
    },
    isJQM: function() {
      return G.getWidgetLibrary().toLowerCase() == 'jquery mobile';
    },
    isBB: function() {
      return G.getWidgetLibrary().toLowerCase() == 'building blocks';
    },
    isTopcoat: function() {
      return G.getWidgetLibrary().toLowerCase() == 'topcoat';
    },
    isBootstrap: function() {
      return G.getWidgetLibrary().toLowerCase() == 'bootstrap';
    },
    getWidgetLibrary: function() {
      return G._widgetLibrary;
    },
    lazyImgSrcAttr: 'data-lazysrc',
    _blankImgSrc: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
    getBlankImgSrc: function() {
      return this._blankImgSrc;
    },
    emptyFn: function() {},
    falseFn: function() { return false; },
    trueFn: function() { return true; },
    onAppStart: function(fn) {
      return APP_START_PROMISE.then(fn);
    },
    getResolvedPromise: function() {
      return RESOLVED_PROMISE;
    },
    getRejectedPromise: function() {
      return REJECTED_PROMISE;
    },
//    serverName: (function() { // defined in boot.js
//      var s = $('base')[0].href;
//      return s.match("/$") ? s.slice(0, s.length - 1) : s;
//    })(),
    putCached: function(urlToData, options) {
      var args = arguments;
      return G.onAppStart(function() {
//        return G.whenNotRendering(function() {
          putCached.apply(null, args);
//        });
      });
    },

    getCached: function(url, source, storeName) {
      if (source === 'localStorage') {
        return $.Deferred(function(defer) {
          var result = G.localStorage.get(url);
          if (result)
            defer.resolve(result);
          else
            defer.reject();
        }).promise();
      }
      else if (source === 'indexedDB') {
        var RM = G.ResourceManager;
        if (!RM)
          return REJECTED_PROMISE;

        return RM.getItem(storeName || 'modules', url).then(function(data) {
          return data.data;
        });
      }
    },

    pruneLocalStorage: function() {
      G.prunedLocalStorage = true;
      var except = [],
          remove = [],
          bundle,
          url,
          i,
          key;

      for (var bName in bundles) {
        bundle = bundles[bName];
        if (bName == 'pre' || bName == 'post' || bName == 'widgetsFramework' || bName == 'appcache') { // TODO: this preference should be set in one spot, not all over the place
          i = bundle.length;
          while (i--) {
            url = G.getCanonicalPath(require.toUrl(bundle[i].name));
            except.push(getFilePathInStorage(url));
            except.push(getMetadataURL(url));
          }
        }
      }

      for (var key in localStorage) {
        if ((isFilePathKey(key) || isFilePathMetadataKey(key)) && except.indexOf(key) == -1) {
          remove.push(key); // just in case removing while looping affects the loop order
        }
      }

      i = remove.length;
      while (i--) {
        key = remove[i];
        G.log("localStorage", "removing item: " + key);
        localStorage.removeItem(key);
      }
    },

    pruneIndexedDB: function(except) {
      G.prunedIndexedDB = true;
      var idb = G.IDB.getIDB(),
          except = [],
          remove = [],
          key,
          bundle,
          url,
          i;

      for (var bName in bundles) {
        bundle = bundles[bName];
        if (bName != 'pre' && bName != 'post') {
          i = bundle.length;
          while (i--) {
            url = G.getCanonicalPath(require.toUrl(bundle[i].name));
            except.push(getFilePathInStorage(url));
            except.push(getMetadataURL(url));
          }
        }
      }

      idb.getAllKeys('modules').then(function(keys) {
        i = keys ? keys.length : 0;
        while (i--) {
          key = keys[i];
          if ((isFilePathKey(key) || isFilePathMetadataKey(key)) && except.indexOf(key) == -1) {
            remove.push(key); // just in case removing while looping affects the loop order
          }
        }

        if (remove.length)
          idb['delete']('modules', remove);
      });
    },

    dbType: (function() {
//      var using = (browser.chrome && !G.inWebview) || !window.indexedDB;
      var using = !window.indexedDB && !window.mozIndexedDB && !window.webkitIndexedDB && !window.msIndexedDB,
          type;
      if (using) {
        if (window.openDatabase) {
//          G.log(G.TAG, 'db', 'using indexeddb shim');
          type = 'shim';
        }
        else {
//          G.log(G.TAG, 'db', 'local db is not supported');
          type = 'none';
        }
      }
      else {
//        var pre = G.bundles.pre.js,
//            shimIdx = pre.indexOf('lib/IndexedDBShim');
//
//        if (shimIdx >= 0)
//          pre.splice(shimIdx, 1);
//
//        G.log(G.TAG, 'db', "don't need indexeddb shim");
        type = 'idb';
      }

//      if (browser.chrome) // testing how things work without indexeddb
//        type = 'shim';

      var dfd = $.Deferred(),
          promise = dfd.promise();

      G.getDBReadyPromise = function() {
        return promise;
      };

      if (type == 'shim')
        window.addEventListener('IndexedDBShimInit', dfd.resolve);
      else
        dfd.resolve();

      return type;
    })(),

    _preferredStorageMedium: 'indexedDB',
    getPreferredStorage: function() {
      debugger;
      var type = this._preferredStorageMedium;
      if (type == 'indexedDB') {
        if (this.dbType == 'none' || DB_OPEN_DFD.state() != 'resolved') {
          type = 'localStorage';
        }
      }

      return type;
    },

    media_events: ["loadstart", "progress", "suspend", "abort", "error", "emptied", "stalled",
                    "loadedmetadata", "loadeddata", "canplay", "canplaythrough", "playing", "waiting",
                    "seeking", "seeked", "ended", "durationchange", "timeupdate", "play", "pause", "ratechange", "volumechange"],

    nukeAll: function(reload) {
      G.Events.trigger('clearTaskQueues');
      hasLocalStorage && localStorage.clear();
      if (G.ResourceManager) {
        return G.ResourceManager.deleteDatabase().done(function() {
          if (reload)
            window.location.reload();
        });
      }
      else
        return G.getResolvedPromise();
    },
    canWebcam: (function() {
      var m = (navigator.getMedia = (navigator.getUserMedia ||
          navigator.webkitGetUserMedia ||
          navigator.mozGetUserMedia ||
          navigator.msGetUserMedia));

//      m && m.bind(navigator);
      return !!m;
    })(),
    clickBlocker: function(e) {
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    showSpinner: function(options) {
      if (document.$)
        document.$('.spinner_bg').$remove();

      options = options || {};
      if (typeof options === 'string')
        options = {name: options};

      var id = getSpinnerId(options.name);
      var cl = 'vcenteredR ' + (options.nonBlockingOverlay ? '' : ' spinner_bg');
      var color;
      if (G.tabs) {
        var t0 = G.tabs[0];
        if (t0)
          color = t0.color;
      }

      var style = ' style="' + (color ? 'color:' + color + ';' : '') + '"';
      var innerHTML = '<div ' + style + ' class="spinner"></div>';
      var spinner = doc.createElement('div');
      spinner.id = id;
      spinner.className = cl;

      spinner.innerHTML = innerHTML;
//      var spinner = '<div id="' + id + '" class="' + cl + '">' + innerHTML + '</div>';
      body.appendChild(spinner);
      if (options.timeout) {
        setTimeout(function() {
          G.hideSpinner(options);
        }, options.timeout);
      }

      if (options.blockClick)
        document.addEventListener('click', this.clickBlocker, true);
    },
    hideSpinner: function(spinner) {
      var id = getSpinnerId(spinner.name);
      while (spinner = doc.getElementById(id)) {
        spinner.parentNode.removeChild(spinner);
      }

      document.removeEventListener('click', this.clickBlocker, true);
    },

    getVersion: function(old) {
      if (!old && G.VERSION)
        return G.VERSION;

      var v = G.localStorage.get((old ? 'OLD_' : '') + 'VERSION');
      try {
        v = JSON.parse(v);
      } catch (err) {
      }

      return v;
//          || {
//        All: 0,
//        Models: 0,
//        JS: 0,
//        CSS: 0
//      };
    },

    setVersion: function(key, version) {
      var oldV = G.VERSION;
      var newV;
      if (typeof key == 'object')
        newV = key;
      else {
        newV = _.clone(G.VERSION) || {};
        newV[key] = version;
      }

      G.localStorage.put("OLD_VERSION", JSON.stringify(oldV));
      G.localStorage.put("VERSION", JSON.stringify(newV));
    },

    checkVersion: function(data) {
      if (G._nuking)
        return;

      var init = data === true,
          newV = data ? data.VERSION : G.getVersion(),
          oldV = G.getVersion(!data) || newV; // get old

      if (!newV)
        return;

      if (newV.All > oldV.All) {
        if (G._nuking)
          return;

        this._nuking = true;
//        APP_START_PROMISE.done(function() {
          G.nukeAll().done(function() {
            G.setVersion(newV);
            window.location.reload(); // otherwise pending reqs to database may fail and cause trouble, expecting object stores we just deleted
          }).fail(function() {
            debugger;
          }).always(function() {
            G._nuking = false;
          });
//        });

        return;
      }

      for (var key in newV) {
        if (oldV[key] && newV[key] > oldV[key]) {
          G.Events.trigger('VERSION:' + key, newV[key], init);
          // DB and Models version update is async, it needs to complete before we can safely up the version number in storage
          if (key != 'DB' && key != 'Models')
            G.setVersion(key, newV[key]);
        }
      }
    },

    localTime: new Date().getTime(),
    online: !!navigator.onLine,
    setOnline: function(online) {
      G.online = online;
    }, // will fill out in app.js
    onModulesLoaded: function(modules) {
      var bundlePromises = [],
          missing = [],
          allBundles = G.bundles,
          baseUrlLength = require.getConfig().baseUrl.length,
          modules = typeof modules === 'string' ? [modules] : modules;

      for (var i = 0, len = modules.length; i < len; i++) {
        var module = modules[i],
            found = false,
            bundle = getBundleForFile(module);

        if (bundle) {
          if (bundle._name != 'pre')
            bundlePromises.push(bundle._deferred.promise());
        }
        else
          missing.push(getFullName(module));
      }

      if (missing.length) {
        // should only happen when dynamically deciding which modules to load (like based on browser, or based on app settings)
        bundlePromises.push(Bundler.loadBundle(missing));
      }

      return $.when.apply($, bundlePromises);
    },
    isMinifiable: function(url) {
      return /\.(js|css)$/.test(url);
    },
    isMinified: function(url, text) {
      if (!G.isMinifiable(url))
        return false;

//      if (/\.min\.(js|css)$/.test(url))
//        return true;
//      else
        return text.lastIndexOf('/*min*/') === text.length - 7;
    },

    storedModelTypes: [],
    minifyByDefault: true,
//    webWorkers: {},
    customPlugs: {},
    defaults: {
      radius: 2000 // km
    },
//    modelsMetadataMap: {},
//    oldModelsMetadataMap: {}, // map of models which we don't know latest lastModified date for
    LISTMODES: {
      // TODO: get this out of here
      LIST: 'LIST',
      CHOOSER: 'CHOOSER',
      DEFAULT: 'LIST'
    },
    classMap: G.classMap || {},
    defaultVocPath: 'http://www.hudsonfog.com/voc/',
    contextual: function(shortName) {
      if (!G.vocContext)
        return shortName;
      
      return G.vocContext[shortName];
    },
    commonTypes: {
      App: 'model/social/App',
      Urbien: 'commerce/trading/Tradler',
      Friend: 'model/company/Friend',
      FriendApp: 'model/social/FriendApp',
      Theme: 'model/social/Theme',
      WebClass: 'system/designer/WebClass',
      WebProperty: 'system/designer/WebProperty',
      CloneOfProperty: 'system/designer/CloneOfProperty',
      Handler: 'system/designer/Handler',
      Jst: 'system/designer/Jst',
      JS: 'system/designer/JS',
      Css: 'system/designer/Css',
      Grab: 'model/social/Grab',
      AppInstall: 'model/social/AppInstall',
      Transaction: 'aspects/commerce/Transaction',
      PushEndpoint: 'model/social/PushEndpoint',
      PushChannel: 'model/social/PushChannel',
      Image: 'model/portal/Image'
    },
//    commonTypes: {
//      model: {
//        social: ['App', 'FriendApp', 'Theme', 'Grab', 'AppInstall'],
//        company: ['Friend'],
//      },
//      system: {
//        designer: ['WebProperty', 'CloneOfProperty', 'Handler', 'Jst', 'JS', 'Css', 'WebClass']
//      },
//      commerce: {
//        urbien: ['Urbien']
//      }
//    },
    currentServerTime: function() {
      return new Date().getTime() - G.timeOffset;
    },
    hasLocalStorage: hasLocalStorage,
    hasFileSystem: !!(window.requestFileSystem || window.webkitRequestFileSystem),
    hasBlobs: typeof window.Blob !== 'undefined',
    hasWebWorkers: typeof window.Worker !== 'undefined',
    TAG: 'globals',
//    checkpoints: [],
//    tasks: {},
//    recordCheckpoint: function(name, dontPrint) {
//      G.checkpoints.push({name: name, time: new Date()});
//      if (!dontPrint)
//        G.printCheckpoint(G.checkpoints.length - 1);
//    },
//    startedTask: function(name) {
//      G.tasks[name] = {start: new Date()};
//    },
//    finishedTask: function(name, dontPrint) {
//      var task = G.tasks[name];
//      if (!task) {
//        G.log(G.TAG, 'tasks', name, 'finished but starting point was not recorded');
//        return;
//      }
//
//      task.end = new Date();
//      if (!dontPrint)
//        G.printTask(name);
//    },
//    printCheckpoint: function(i) {
//      var c = G.checkpoints[i];
//      var time = c.time.getTime();
//      var passed = i ? time - G.checkpoints[i - 1].time.getTime() : 0;
//      G.log(G.TAG, 'checkpoints', c.name, c.time.getTime(), 'time since last checkpoint: ' + passed);
//    },
//    printCheckpoints: function() {
//      for (var i = 0; i < G.checkpoints.length; i++) {
//        G.printCheckpoint(G.checkpoints[i]);
//      }
//    },
//    printTask: function(name) {
//      var t = G.tasks[name];
//      var time = t.end - t.start;
//      G.log(G.TAG, 'tasks', name + ' took ' + time + 'ms');
//    },
//    printTasks: function() {
//      for (var name in G.tasks) {
//        G.printTask(name);
//      }
//    },
    sqlUri: 'sql',
    modules: {},
    id: 0,
    nextId: function(prefix) {
      return prefix ? prefix + G.id++ : G.id++;
    },
    createXhr: function () {
      //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
      var xhr, i, progId;
      if (typeof XMLHttpRequest !== "undefined") {
        return new XMLHttpRequest();
      } else {
        for (i = 0; i < 3; i++) {
          progId = PROG_IDS[i];
          try {
            xhr = new ActiveXObject(progId);
          } catch (e) {}

          if (xhr) {
            PROG_IDS = [progId];  // so faster next time
            break;
          }
        }
      }

      if (!xhr) {
        throw new Error("createXhr(): XMLHttpRequest not available");
      }

      return xhr;
    },

    sendXhr: function (options) {
      var url = options.url;
      var method = (options.type || 'GET').toUpperCase();
      var xhr = G.createXhr();
//      if (options.raw && browser.chrome)
//        xhr.responseType = 'blob';
      var params = options.data;
      if (url == null || url.slice(url.length - 'null'.length) == 'null')
        debugger;
      xhr.open(method, url, true);
      if (options.responseType)
        xhr.responseType = options.responseType;

      xhr.onreadystatechange = function (evt) {
        var status, err;
        //Do not explicitly handle errors, those should be
        //visible via console output in the browser.
        if (xhr.readyState === 4) {
          status = xhr.status;
          if (status > 399 && status < 600) {
            //An http 4xx or 5xx error. Signal an error.
            err = new Error(url + ' HTTP status: ' + status);
            err.xhr = xhr;
            options.error && options.error(err);
          } else {
            options.success && options.success(options.responseType ? xhr.response : xhr.responseText);
          }
        }
      };

      if (method === 'POST') {
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        var tmp = [];
        for (var name in params) {
          tmp.push(encodeURIComponent(name) + '=' + encodeURIComponent(params[name]));
        }

        if (tmp.length)
          params = tmp.join('&');
      }

      xhr.send(params);
    },

    debug: function() {
      console.debug.apply(console, arguments);
    },

//    _space: function(n) {
//      var space = '';
//      while (n--) {
//        space += ' ';
//      }
//
//      return space;
//    },

    _logArray: new Array(0),
    log: function(tag, type) {
      if (!G.DEBUG || !TRACE.ON || !console || !console.log || !type)
        return;

      var types = typeof type == 'string' ? [type] : type;
      for (var i = 0; i < types.length; i++) {
        var type = types[i],
            typeTrace = TRACE.types[type] || TRACE.DEFAULT;

        if (!typeTrace.on)
          continue;

        var b = G.browser;
        var css = b && ((b.mozilla && parseInt(b.version.slice(0,2))) > 4 || b.chrome && parseInt(b.version.slice(0,2)) >= 24);
        var msg = ArrayProto.slice.call(arguments, 2);
        var msgStr = '';
        for (var i = 0; i < msg.length; i++) {
          msgStr += (typeof msg[i] === 'string' ? msg[i] : JSON.stringify(msg[i]));
          if (i < msg.length - 1) msgStr += ' ';
        }

        var txt = type + ' : ' + tag + ' : ' + msgStr + ' : ';
        var d = new Date(G.currentServerTime());
        G._logArray.length = Math.max(100 - txt.length, 0);
        console.log((css ? '%c ' : '') + txt + G._logArray.join(' ') + d.toUTCString().slice(17, 25) + ':' + d.getUTCMilliseconds(), css ? 'background: ' + (typeTrace.bg || '#FFF') + '; color: ' + (typeTrace.color || '#000') : '');
      }

      G._logArray.length = 0;
    },

    linkCSS: function(url) {
      var link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = url;
//      link.setAttribute("rel", "stylesheet")
//      link.setAttribute("type", "text/css")
//      link.setAttribute("href", url);
      head.appendChild(link);
    },

    appendCSS: function(text) {
      var style = doc.createElement('style');
      style.type = 'text/css';
      style.textContent = text; // iphone 2g gave innerhtml and appendchild the no_modification_allowed_err
      head.appendChild(style);
    },

    getCanonicalPath: function(path, separator) {
      separator = separator || '/';
      var parts = path.split(separator);
      var stack = [];
      _.each(parts, function(part, idx) {
        if (part == '..')
          stack.pop();
        else
          stack.push(part);
      });

      return stack.join(separator);
    },

    splitListRequest: true,

//    mainWorkerName: 'main',
    maxXhrWorkers: 4,
    numXhrWorkers: 0,
    workers: [],
    runningWorkers: [],
    workerDeferreds: [],
//    isWorkerAvailable: function(worker) {
//      return !worker.__lablzTaken;
//    },
//
//    captureWorker: function(worker) {
//      worker.__lablzTaken = true;
//      return worker;
//    },
//
//    /**
//     * get a promise of a web worker
//     */
//    getXhrWorker: function(taskType) {
//      taskType = taskType || G.mainWorkerName;
//      return $.Deferred(function(dfd) {
//        if (!G.workers[taskType]) {
//          var xw = G.files.xhrWorker;
//          G.workers[taskType] = new Worker(G.serverName + '/js/' + (xw.fullName || xw.name) + '.js');
//        }
//
//        var w = G.workers[taskType];
//        w._taskType = taskType;
//        if (G.isWorkerAvailable(w)) {
//          dfd.resolve(G.captureWorker(w));
//        }
//        else {
//          G.workerQueues[taskType] = G.workerQueues[taskType] || [];
//          G.workerQueues[taskType].push(dfd);
//        }
//      }).promise();
//    },

    loadWorker: function(relUrl) {
      var worker;
      if (G.useInlineWorkers) {
        var blob = new Blob([G.modules[relUrl]], { type: "text/javascript" });
        var url = window.URL.createObjectURL(blob);
        worker = new Worker(url);
//        window.URL.revokeObjectURL(url);
      }
      else {
        var url = relUrl.slice(relUrl.lastIndexOf('/') + 1);
        var xw = G.files.appcache[url] || G.files[url];
        worker = new Worker(G.serverName + '/js/' + (xw.fullName || xw.name));
      }

      return worker;
    },

    getXhrWorker: function() {
      return $.Deferred(function(dfd) {
        var worker;
        if (G.workers.length)
          worker = G.workers.shift();
        else {
          if (G.numXhrWorkers == G.maxXhrWorkers) {
            G.workerDeferreds.push(dfd);
            return;
          }
          else {
            G.numXhrWorkers++;
            worker = G.loadWorker('js/xhrWorker.js');
          }
        }

        dfd.resolve(worker);
      }).promise().done(function(worker) {
        G.runningWorkers.push(worker);
      });
    },

    /**
     * when you're done with a worker, let it go with this method so that others can use it
     */
    recycleXhrWorker: function(worker) {
      var idx = G.runningWorkers.indexOf(worker);
      if (idx == -1)
        debugger; // should never happen
      else
        G.runningWorkers.splice(idx, 1);

      worker.onerror = null;
      worker.onmessage = null;
      if (G.workerDeferreds.length)
        G.workerDeferreds.pop().resolve(worker);
      else
        G.workers.push(worker);
//      worker.__lablzTaken = false;
//      var q = G.workerQueues[worker._taskType];
//      if (q && q.length)
//        q.shift().resolve(G.captureWorker(worker));
    },

    setCookie: function(name, value, exdays) {
      var exdate = new Date();
      exdate.setDate(exdate.getDate() + exdays);
      var c_value = escape(value) + ((exdays==null) ? "" : ";domain=." + getDomain() + ";path=/;expires="+exdate.toUTCString());
      doc.cookie = name + "=" + c_value;
    },

    getCookie: function(name) {
      var i, x, y, cookies = doc.cookie.split(";");
      for (i = 0;i < cookies.length; i++) {
        var cookie = cookies[i];
        x = cookie.substr(0, cookie.indexOf("="));
        y = cookie.substr(cookie.indexOf("=") + 1);
        x = x.replace(/^\s+|\s+$/g,"");
        if (x == name) {
          return unescape(y);
        }
      }
    },

    inject: function(text) {// , context) {
      var script = doc.createElement("script");
      script.type = "text/javascript";
      script.charset = "utf-8";
      script.async = true;

      // Make sure that the execution of code works by injecting a script
      // tag with appendChild/createTextNode
      // (IE doesn't support this, fails, and uses .text instead)
      try {
        script.appendChild(doc.createTextNode(text));
      } catch (err) {
        script.text = text;
      }

      head.appendChild(script);
      head.removeChild(script);
    },
    support: {
      pushState: !!(G.preferPushState && window.history && history.pushState)// && !browser.chrome
    },

    // http://stackoverflow.com/questions/5342917/custom-events-in-ie-without-using-libraries
    _htmlEvents: [
      // list of real events
      // <body> and <frameset> events
      'onload', 'onunload',
      //Form Events
      'onblur', 'onchange', 'onfocus', 'onreset', 'onselect', 'onsubmit', //Image Events
      'onabort', //Keyboard Events
      'onkeydown', 'onkeypress', 'onkeyup', //Mouse Events
      'onclick', 'ondblclick', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup'
    ],

    triggerEvent: function triggerEvent(el, eventName){
        var event;
        if(document.createEvent){
            event = document.createEvent('HTMLEvents');
            event.initEvent(eventName,true,true);
        }else if(document.createEventObject){// IE < 9
            event = document.createEventObject();
            event.eventType = eventName;
        }
        event.eventName = eventName;
        if(el.dispatchEvent){
            el.dispatchEvent(event);
        }else if(el.fireEvent && G._htmlEvents['on'+eventName]){// IE < 9
            el.fireEvent('on'+event.eventType,event);// can trigger only real event (e.g. 'click')
        }else if(el[eventName]){
            el[eventName]();
        }else if(el['on'+eventName]){
            el['on'+eventName]();
        }
    },

    addEventListener: function addEvent(el,type,handler){
      if(el.addEventListener){
        el.addEventListener(type,handler,false);
      }else if(el.attachEvent && G._htmlEvents['on'+type]){// IE < 9
        el.attachEvent('on'+type,handler);
      }else{
        debugger;
        var name = 'on' + type;
        if (el[name])
          el[name].handlers.push(handler);
        else {
          el[name] = function() {
            var self = this,
                args = arguments;

            el[name].handlers.forEach(function(h) {
              h.apply(self, arguments);
            });
          };
        }
      }
    },

    removeEventListener: function removeEvent(el,type,handler){
      if(el.removEventListener){
        el.removeEventListener(type,handler,false);
      }else if(el.detachEvent && G._htmlEvents['on'+type]){// IE < 9
        el.detachEvent('on'+type,handler);
      }else{
        var name = 'on' + type;
        var handler = el[name];
        if (!handler)
          return;

        debugger;
        var idx = handler.handlers.indexOf(handler);
        if (~idx)
          handler.handlers.splice(idx, 1);

        if (!handler.handlers.length)
          el[name] = null;
      }
    },

    language: params['-lang'] || (navigator.language || 'en-US').split('-')[0],
    tourGuideEnabled: false,
    Errors: {
      Login: {
        code: 401,
        name: 'User is not logged in',
        message: 'Please log in'
      }
    },
    _clickDisabled: false,
    enableClick: function() {
      if (this._clickDisabled) {
        this.log('Globals', 'events', 'ENABLED CLICK');
        this._clickDisabled = false;
      }
    },
    disableClick: function() {
      if (!this._clickDisabled) {
        this.log('Globals', 'events', 'DISABLED CLICK');
        this._clickDisabled = true;
      }
    },
    canClick: function() {
      return !this._clickDisabled;
    },
    lazifyImages: false,
//    tween: false,
    isModuleNeeded: function(name) {
      if (~G.skipModules.indexOf(name))
        return false;

      switch (name) {
//      case 'lib/physicsjs-custom.js':
//        return false;
//      case 'lib/jquery.masonry.js':
//        return false;
      case '../templates_topcoat.jsp':
        return G.isTopcoat();
      case '../templates_bb.jsp':
        return G.isBB();
      case '../templates_bootstrap.jsp':
        return G.isBootstrap();
      case 'lib/IndexedDBShim.js':
        return G.dbType == 'shim';
      case 'lib/whammy.js':
        return browser.chrome;
      case 'chrome.js':
        return G.inWebview;
      case 'firefox.js':
        return G.hasFFApps;
//      case 'lib/tween.js':
//        return G.tween;
      default:
        return true;
      }
    },

    viewport: {
      width: null,
      height: null,
      maxWidth: 960,
      isAtMaxWidth: function() { return G.viewport.width >= G.viewport.maxWidth }
    },
    DEFAULT_TRADLE_NAME: 'New tradle'
  });

  if (G.globalCss) {
    G.appendCSS(G.globalCss);
    delete G.globalCss;
  }

  determineMinificationMode();
  G.skipModules = G.skipModules || [];
  G.DEBUG = !G.minify;

  setupWidgetLibrary();
  setupLocalStorage();
  saveBootInfo();
  setMiscGlobals();
  adjustForVendor();
  testIfInsidePackagedApp();
  Bundler.pruneUnneededModules();
  Bundler.prepAppCacheBundle();
  require.config(requireConfig);
  load();

  return G;
});

})(window, document, undefined);
