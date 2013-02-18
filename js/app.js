//'use strict';
define('app', [
  'globals',
  'backbone',
  'cache!jqueryMobile',
  'templates', 
  'utils', 
  'events',
  'error',
  'vocManager',
  'resourceManager',
  'router'
], function(G, Backbone, jqm, Templates, U, Events, Errors, Voc, RM, Router) {
  Backbone.View.prototype.close = function() {
    this.$el.detach();
    this.unbind();
    if (this.onClose){
      this.onClose();
    }
  };  
  
  /* Backbone.validateAll.js - v0.1.0 - 2012-08-29
  * http://www.gregfranko.com/Backbone.validateAll.js/
  * Copyright (c) 2012 Greg Franko; Licensed MIT */
  Backbone.Model.prototype._validate = function(attrs, options) {
    options = options || {};
    if (options.silent || options.skipValidation || !this.validate) {
      return true;
    }
    
    if (options.validateAll !== false) {
      attrs = _.extend({}, this.attributes, attrs);
    }
    
    var error = this.validate(attrs, options);
    if (!error) {
      if (options.validated)
        options.validated(this, options);
      
      return true;
    }
    if (options && options.error) {
      options.error(this, error, options);
    } else {
      this.trigger('error', this, error, options);
    }
    
    return false;
  };

  var App = {
    TAG: 'App',
    initialize: function() {
      var error = function(e) {
        G.log('init', 'error', "failed to init app, not starting");
        throw new Error('failed to load app');
      };
      
      Templates.loadTemplates();
      _.each(G.modelsMetadata, function(m) {m.type = U.getLongUri1(m.type)});
      _.each(G.linkedModelsMetadata, function(m) {m.type = U.getLongUri1(m.type)});
      App.setupWorkers();
      App.setupNetworkEvents();
      Voc.checkUser();
      Voc.loadStoredModels();
      if (!Voc.changedModels.length) {// && !Voc.newModels.length) {
        RM.restartDB().always(App.startApp);
        return;
      }

      this.prepModels();
    },
    
    prepModels: function() {
      var self = this;
      var error = function(xhr, err, options) {
//        debugger;
        if (!G.online) {
          Errors.offline();
        }
        else if (xhr) {
          if (xhr.status === 0) {
            if (G.online)
              self.prepModels(); // keep trying
            else {
  //            window.location.hash = '';
  //            window.location.reload();
              Errors.offline();
            }
          }
        }
        else if (err) {
          throw new Error('failed to load app: ' + JSON.stringify(err));            
        }
        else {
          throw new Error('failed to load app');
        }
      };
      
      Voc.fetchModels(null, {sync: true}).done(function() {
        if (RM.db)
          self.startApp();
        else
          RM.restartDB().always(App.startApp);
      }).fail(error);
    },
    
    startApp: function() {
      if (App.started)
        return;
      
      App.setupModuleCache();
      App.setupLoginLogout();
      
      G.app = App;
      App.started = true;
      if (window.location.hash == '#_=_') {
//        debugger;
        G.log(App.TAG, "info", "hash stripped");
        window.location.hash = '';
      }
      
      G.Router = new Router();
      Backbone.history.start();
      setTimeout(RM.sync, 1000);
    },
    
    setupLoginLogout: function() {
      Events.on('req-login', function(options) {
        options = _.extend({online: 'Login through a Social Net', offline: 'You are currently offline, please get online and try again'}, options);
        if (!G.online) {
          Errors.offline();
          return;
        }
        
        var here = window.location.href;
        _.each(G.socialNets, function(net) {
          var state = U.getQueryString({socialNet: net.socialNet, returnUri: here, actionType: 'Login'}, {sort: true}); // sorted alphabetically
          var params = net.oAuthVersion == 1 ?
              {
            episode: 1, 
            socialNet: net.socialNet,
            actionType: 'Login'
              }
          : 
          {
            scope: net.settings,
            display: 'page', 
            state: state, 
            redirect_uri: G.serverName + '/social/socialsignup', 
            response_type: 'code', 
            client_id: net.appId || net.appKey
          };
          
          net.icon = net.icon || G.serverName + '/icons/' + net.socialNet.toLowerCase() + '-mid.png';
          net.url = net.authEndpoint + '?' + U.getQueryString(params, {sort: true}); // sorted alphabetically
        });
        
        var popupTemplate = _.template(Templates.get('loginPopupTemplate'));
        var $popup = $('.ui-page-active #login_popup');
        var html = popupTemplate({nets: G.socialNets, msg: options.online});
        if ($popup.length == 0) {
          $(document.body).append(html);
          $popup = $('#login_popup');
        }
          
        $popup.trigger('create');
        $popup.popup().popup("open");
        return false; // prevents login button highlighting
      });
      
      var defaults = {returnUri: ''}; //encodeURIComponent(G.serverName + '/' + G.pageRoot)};
      Events.on('logout', function(options) {
        options = _.extend({}, defaults, options);
        var url = G.serverName + '/j_security_check?j_signout=true';
        $.get(url, function() {
            // may be current page is not public so go to home page (?)
          window.location.hash = options.returnUri;
          window.location.reload();
        });        
      });
    },
    
//    setupModuleCache: function() {
//      G.require = function(modules, callback, context) {
//        modules = $.isArray(modules) ? modules : [modules];
//        for (var i = 0; i < modules.length; i++) {
//          var m = modules[i];
//          if (!G.modCache[m]) {
//            G.modCache[m] = $.Deferred(function(defer) {
//              require([m], function(mod) {
//                defer.resolve(mod);
//              });
//            }).promise();
//          }
//          
//          modules[i] = G.modCache[m];
//        }
//        
//        return $.when.apply(null, modules).then(function() {
//          callback.apply(context, arguments);
//        }).promise();
//      }
//    }
    setupModuleCache: function() {
      G.require = function(modules, callback, context) {
        modules = $.isArray(modules) ? modules : [modules];
        var mods = [], newModNames = [];
        for (var i = 0; i < modules.length; i++) {
          var m = modules[i];
          if (!G.modCache[m]) {
            G.modCache[m] = $.Deferred();
            newModNames.push(m);
          }
          
          mods.push(G.modCache[m]);
        }
        
        if (newModNames.length) {
          G.loadBundle(newModNames, function() {
            require(newModNames, function() {
              for (var i = 0; i < newModNames.length; i++) {
                G.modCache[newModNames[i]].resolve(arguments[i]);
              }          
            });
          });
        }
        
        return $.when.apply(null, mods).then(function() {
          callback.apply(context, arguments);
        }).promise();
      }
    },
    
    setupWorkers: function() {
      var hasWebWorkers = G.hasWebWorkers;
      Backbone.ajax = G.ajax = function(options) {
        var opts = _.clone(options);
        opts.method = opts.method || opts.type;
        opts.type = opts.dataType === 'json' ? 'JSON' : opts.type;
        var useWorker = hasWebWorkers && !opts.sync;
        return new $.Deferred(function(defer) {
          if (opts.success) defer.done(opts.success);
          if (opts.error) defer.fail(opts.error);
          if (useWorker) {
            G.log(App.TAG, 'xhr', 'webworker', opts.url);
            var xhrWorker = G.getXhrWorker();          
            xhrWorker.onmessage = function(event) {
              var xhr = event.data;
              if (xhr.status === 304) {
//                debugger;
                defer.reject(xhr, "unmodified", "unmodified");
              }
              else
                defer.resolve(xhr.data, xhr.status, xhr);
            };
            
            xhrWorker.onerror = function(err) {
//              debugger;
              defer.reject({}, "error", err);
            };
            
            defer.always(function() {
              G.recycleWebWorker(xhrWorker);
            });

            xhrWorker.postMessage(_.pick(opts, ['type', 'url', 'data', 'method', 'headers']));
          }
          else {
            G.log(App.TAG, 'xhr', '$.ajax', opts.url);
            $.ajax(_.pick(opts, ['timeout', 'method', 'url', 'headers', 'data'])).then(function(data, status, jqXHR) {
//              debugger;
              if (status != 'success') {
                defer.reject(jqXHR, status, opts);
                return;
              }
              
              if (jqXHR.status === 200) {
                defer.resolve(data, status, jqXHR);
                return;
              }
              
              if (data && data.error) {
                defer.reject(jqXHR, data.error, opts);
                return;
              }
              
              defer.reject(jqXHR, {code: jqXHR.code}, opts);                  
            }, 
            function(jqXHR, status, err) {
              debugger;
              var text = jqXHR.responseText;
              var error;
              try {
                error = JSON.parse(text).error;
              } catch (err) {
                error = {code: jqXHR.status, details: err};
              }
              
              defer.reject(jqXHR, error, opts);
            });
          }
        }).promise();
      }
    },
    
    setupNetworkEvents: function() {
      G.connectionListeners = [];
      var fn = G.setOnline;
      G.setOnline = function(online) {
        fn.apply(this, arguments);
        Events.trigger('online', online);
      };      
    }
  };
  
  return App;
});