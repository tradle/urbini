define('firefox', ['globals', 'events', 'utils', 'cache', 'collections/ResourceList'], function(G, Events, U, C, ResourceList) {
  var gManifestName = "/manifest.webapp",
      TAG = 'Firefox',
      connectedDfd = $.Deferred(),
      connectedPromise = connectedDfd.promise();

  if (G.appWindow)
    connectedDfd.resolve();

  function log() {
    var args = [].slice.call(arguments);
    G.log.apply([TAG, 'app comm'].concat(args));
    U.rpc.apply(null, ['log'].concat(args));
  }
  
  connectedPromise.done(function() {
    log("2. CONNECTED TO APP!");
  });
  
  function onMessageFromApp(e) {
    log('got message from app', e.data);
    G.appWindow = G.appWindow || e.source;
    G.appOrigin = G.appOrigin || e.origin;
    connectedDfd.resolve();
    
    if (e.origin !== G.appOrigin) {
      log("got a message from some other app:", e.origin);
      return;
    }
    
    var data = e.data,
        type = data.type,
        args = data.args || [];
    
    delete data.type;
    args.unshift('messageFromApp:' + type);
    Events.trigger.apply(Events, args);
  };

  function onpush(message) {
    debugger;
    log('got push message');
    var endpoints = C.getResourceList(U.getModel(G.commonTypes.PushEndpoint)),
        endpoint = message.endpoint;
    
    if (!endpoints || !endpoints.length) {
      debugger;
      return;
    }
    
    var match = endpoints.where({
      endpoint: endpoint
    }, true);
    
    if (!match) {
      debugger;
      return;
    }
    
    if (/^https?\:/.test(match.channelName))
      window.location.href = match.channelName;
    else
      Events.trigger('navigate', match.channelName);
    
//    firefox.notifications.create('Client Waiting', "There's a client waiting to be assisted in the lobby", 'icon_128.png', {
//      onclick: function() {
//        console.log('push message notification clicked');
//        Events.trigger('navigate', G.tabs[0].hash);
//      },
//      onclose: function() {
//        console.log('push message notification closed');
//      }
//    });
  };
  
  /**
   * @param eventName the event to listen to and upon receiving which to call the "callback" 
   * @param callback the function to call when the event is received
   * @param persistent if true, will allow callback to be called repeatedly 
  **/
  function createCallbackEvent(eventName, callback, context, persistent) {
    if (arguments.length == 1) {
      callback = eventName;
      eventName = null;
    }
    
    eventName = eventName || 'callbackEvent' + G.nextId();
    context = context || callback;
    
    Events[persistent ? 'on' : 'once']('messageFromApp:' + eventName, function() {
      callback.apply(context, arguments);
    });
    
    return eventName;
  };
  
  function setPaths(obj) {
    for (var pkgName in obj) {
      var pkg = obj[pkgName];
      pkg._path = (obj._path ? obj._path + '.' : '') + pkgName;
      switch (typeof pkg) {
        case 'function':
          obj[pkgName] = pkg.bind(pkg);
          break;
        case 'object':
          setPaths(pkg);
          break;
      }
    }
  };
  
  function sendMessageToApp(msg) {
    connectedPromise.done(function() {
      var appWin = G.appWindow;
      if (appWin && G.appOrigin)
        appWin.postMessage(msg, G.appOrigin);
      else
        console.debug("can't send message to app, don't know app's window and/or origin");
    });
  };

  function setup() {
//    console.log("creating notification");
//    firefox.mozNotification.createNotification("Hello Mark", "This is for your eyes only", "icon_128.png", {
//      onclose: function() {
//        console.log("closed notification");
//      },
//      onclick: function() {
//        console.log("clicked notification");
//      }
//    });

    Events.on('messageFromApp:push', onpush);
    var installedApps = G.currentUser.installedApps,
        currentApp = G.currentApp,
        channelId = G.pushChannelId,
        appInstall = G.currentAppInstall,
        channels = G.currentApp.pushChannels,
        endpointList = new ResourceList(G.currentUser.pushEndpoints, {
          model: U.getModel(G.commonTypes.PushEndpoint),
          query: $.param({
            appInstall: appInstall,
            browser: G.browser.name.capitalizeFirst()
          })
        });
    
    if (!channels || !channels.length) {
      log('all app channels already registered');
      return;
    }
    
    for (var i = 0; i < channels.length; i++) {
      var channel = channels[i].channel;
      if (endpointList.where({channelName: channel}).length) {
        log('PUSH ENDPOINT ALREADY EXISTS FOR CHANNEL:', channel);
        return;
      }
      else {
        firefox.push.register(function(endpoint) {
          log("REGISTERED NEW PUSH ENDPOINT");
          Events.trigger('newPushEndpoint', endpoint, channel);
        }, function() {
          log("FAILED TO REGISTER PUSH CHANNEL");
        });
      }
    }

    firefox.setMessageHandler('push', onpush);
    firefox.setMessageHandler('push-register', function(e) {
      debugger;
      if (!G.currentUser.guest)
        firefox._setup();
    });
  };
  
  var firefox = {
    _setup: function() {
      connectedPromise.done(setup);
    },
    mozNotification: {
      /**
       * example: create('This is the title', 'These are the details', '/icon_128.png', {
       *   onclose: function() {
       *     console.log("notification closed");
       *   },
       *   onclick: function() {
       *     console.log("notification clicked");
       *   }
       * })
       */
      createNotification: function(title, desc, iconURL, callbacks) {
        var args = arguments;
        if (callbacks) {
          for (var cbName in callbacks) {
            callbacks[cbName] = createCallbackEvent(callbacks[cbName]);
          }
        }
          
        [].unshift.call(args, this._path);
        U.rpc.apply(null, args);
      }
    },
    push: {
      register: function(success, error) {
        U.rpc(this._path, createCallbackEvent(success || function() {}), createCallbackEvent(error || function() {}));
      },
      unregister: function(endpoint) {
        U.rpc(this._path, endpoint, createCallbackEvent(success || function() {}), createCallbackEvent(error || function() {}));
      },
      registrations: function() {
        U.rpc(this._path, createCallbackEvent(success || function() {}), createCallbackEvent(error || function() {}));        
      }
    },
    setMessageHandler: function(messageType, callback) {
      U.rpc(this._path, messageType, createCallbackEvent(callback));      
    },
    install: function() {
      var req = navigator.mozApps.install(G.serverName + '/FirefoxApp/NursMe/manifest.webapp', null);
//      var req = navigator.mozApps.install(G.currentApp.firefoxManifest, null);
      req.onerror = function(e) {
        debugger;
        console.log("Error installing app : " + req.error.name);
      };
      
      req.onsuccess = function(e) {
        debugger;
        var app = req.result;
        console.log("Success installing app : " + app.manifest.name + " " + app.installState);
      };
    }
  };
  
  
  setPaths(firefox);
  window.addEventListener('message', onMessageFromApp);
  Events.on('messageToApp', sendMessageToApp);
  
  return firefox;
});
