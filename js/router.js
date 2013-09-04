//'use strict';
define('router', [
  'globals',
  'utils', 
  'events', 
  'error',
  'models/Resource', 
  'collections/ResourceList',
  'cache',
  'vocManager',
  'views/HomePage',
  'templates',
  'jqueryMobile',
  'appAuth',
  'redirecter'
//  , 
//  'views/ListPage', 
//  'views/ViewPage'
//  'views/EditPage' 
], function(G, U, Events, Errors, Resource, ResourceList, C, Voc, HomePage, Templates, $m, AppAuth, Redirecter /*, ListPage, ViewPage*/) {
//  var ListPage, ViewPage, MenuPage, EditPage; //, LoginView;
  var Modules = {};
  
  function log() {
    var args = [].slice.call(arguments);
    args.unshift("router");
    G.log.apply(G, args);
  };
  
  var Router = Backbone.Router.extend({
    TAG: 'Router',
    routes:{
      ""                                                       : "home",
      "home/*path"                                             : "home",
//      "install/*path"                                          : "install",
      "social/*path"                                           : "social",
      "static/*path"                                           : "static",
//      "tour/*path"                                             : "tour",
      ":type"                                                  : "list", 
      "list/*path"                                             : "list", 
      "view/*path"                                             : "view",
      "templates/*path"                                        : "templates",
//      "views/*path"                                            : "views",
      "edit/*path"                                             : "edit", 
      "make/*path"                                             : "make", 
      "chooser/*path"                                          : "choose", 
      "chat/*path"                                             : "chat", 
      "chatPrivate/*path"                                      : "chat", 
      "chatLobby/*path"                                        : "chat", 
      "login/*path"                                            : "login", 
      ":type/:backlink"                                        : "list"
    },

//    CollectionViews: {},
//    MkResourceViews: {},
//    PrivateChatViews: {},
//    ChatViews: {},
//    LobbyChatViews: {},
//    MenuViews: {},
//    Views: {},
//    EditViews: {},
//    Models: {},
//    Collections: {},
    Paginator: {},
    backClicked: false,
    forceFetch: false,
    errMsg: null,
    homePage: null,
    info: null,
//    viewsStack: [],
    urlsStack: [],
//    LoginView: null,
    _failToGoBack: function() {      
      U.alert({
        msg: "Oops! The browsing history ends here."
      });
    },
    initialize: function () {
//      G._routes = _.clone(this.routes);
//      _.bindAll(this, '_backOrHome');
      window.router = this;
      this.firstPage = true;
      this.updateHashInfo();
      this.homePage = new HomePage({el: $('div#homePage')});
      var self = this;
      Events.on('home', function() {
        self.goHome();
      });

      Events.on('navigate', function(fragment, options) {
        self.navigate.apply(self, [fragment, _.defaults(options || {}, {trigger: true, replace: false})]);
      });

      Events.on('pageChange', function(prev, current) {
        self.backClicked = self.firstPage = false;
        self.checkTour();
        if (G.DEBUG)
          window.view = current;
      });
      
      Events.on('back', _.debounce(function(ifNoHistory) {
//        var now = +new Date();
//        if (self.lastBackClick && now - self.lastBackClick < 100)
//          debugger;
//          
//        self.lastBackClick = now;
        self.previousFragment = null;
        self.backClicked = true;
        var href = window.location.href, i = 10;
        while (i-- > 0) {
          window.history.back();
          if (window.location.href != href)
            break;
        }
        
        if (window.location.href == href) {
          // there's nowhere to go back to
          if (ifNoHistory)
            ifNoHistory();
            
          return;
        }
        
//        // if this._hashChanged is true, it means the hash changed but the page hasn't yet, so it's safe to use window.history.back(;
//        var haveHistory = self.urlsStack.length || (self._hashChanged && self.currentUrl != null);        
//        if (haveHistory) {
//          window.history.back();
//          return;
//        }
//          
//        // seems we don't have any history to go back to, but as the user has clicked the UI back button, 
//        // they probably don't want to exit the app, so let's go somewhere sane
//        var hash = U.getHash();
//        if (!hash) {
//          self._failToGoBack();
//          return;
//        }
//        
//        var hashParts = hash.match(/^(chat|edit|templates|view|chooser|make)\/(.*)/);
//        if (!hashParts || !hashParts.length) {
//          // we're probably at a list view
//          self._failToGoBack();
//          return;
//        }
//          
//        var method = hashParts[1];
//        switch (method) {
//          case 'chat':
//          case 'edit':
//          case 'templates':
//            self.navigate('view/' + hashParts[2], {trigger: true});
//            return;
//          case 'make':
//          case 'view':
//            self._failToGoBack();
//            return;
//          case 'chooser':
//            Events.trigger('home');
//            return;
//        }
//        
////        self.lastBackClick = now;
//        self.previousHash = null;
//        self.backClicked = true;
//        window.history.back();
      }, 100, true));
      
      Events.on('forward', function() {
        window.history.forward();
      });


      // a hack to prevent browser address bar from dropping down
      // see: https://forum.jquery.com/topic/stopping-the-url-bar-from-dropping-down-i-discovered-a-workaround
      $('[data-role="page"]').on('pagecreate',function(event) {
        $('a[href]', this).each(function() {
            var self = $(this);
            if (!self.is( "[rel='external']" ) ) {
                self.attr('link', self.attr('href'));
                self.removeAttr('href');
            }
        });
      });
      
//      var popped = ('state' in window.history);
//      var initialURL = window.location.href;
//      $(window).bind('popstate', function(e) {
//        // Ignore inital popstate that some browsers fire on page load
//        var initialPop = !popped && location.href == initialURL;
//        popped = true
//        if (initialPop) 
//          return;
//        
//        debugger;
//        console.log('pop: ' + e.originalEvent.state);
//      });
      
      
//      $(window).hashchange(function() {
//        self._hashChanged = true;        
//      });
//      
//      Events.on('pageChange', function() {
//        self._hashChanged = false;
////        console.debug('currentUrl:', self.currentUrl);
////        console.debug('previousHash:', self.previousHash);
//      });
      
//      _.each(['list', 'view', 'make', 'templates', 'home'], function(method) {
//        var fn = self[method];
//        self[method] = function() {
//          self.previousHash = self.currentHash;
//        }
//      });
      
//      window.onpopstate = function(e) {
//        if (self.firstPage)
//          return;
//        else {
//          Events.stopEvent(e);
//          Events.trigger('back');
//        }
//      }
//      $('a').click(function(e) {
//        if (this.href.startsWith(G.appUrl)) {
//          e.preventDefault();
//          self.navigate(this.href.slice(G.appUrl + 1));
//          return false;
//        }        
//      });
    },
    
    defaultOptions: {
//      extraParams: {},
      trigger: true,
      replace: false
    },
    
    fragmentToOptions: {},
    
    navigate: function(fragment, options) {
//      if (this.previousHash === fragment) {
////      prevents some (not all) duplicate history entries, BUT creates unwanted forward history (for example make/edit views)
//        Events.trigger('back');
//        return;
//      }
      if (_.has(arguments[0], 'toFragment')) {
        // hash info object
        var hashInfo = arguments[0];
        fragment = hashInfo.toFragment();
        options = hashInfo.options;
      }
      
      
      options = options || {};
      var adjustedOptions = _.extend({}, this.defaultOptions, _.pick(options, 'forceFetch', 'errMsg', 'info', 'replace', 'postChangePageRedirect')),
          hashInfo = G.currentHashInfo;
      
      if (G.inFirefoxOS)
        U.rpc('setUrl', window.location.href);
      
      if (fragment.startsWith('http://')) {
        var appPath = G.serverName + '/' + G.pageRoot;
        if (fragment.startsWith(appPath))
          fragment = fragment.slice(appPath.length);
        else {
          window.location.href = fragment;
          return;
        }
      }
      
      G.log(this.TAG, 'events', 'navigate', fragment);
      
      this.fragmentToOptions[fragment] = adjustedOptions;
      _.extend(this, {
        previousView: this.currentView, 
        previousHash: U.getHash() 
      });
      
      if (options.transition)
        this.nextTransition = options.transition;
      
      try {
        Backbone.Router.prototype.navigate.call(this, fragment, options);
      } finally {
        if (options.trigger == false)
          this.updateHashInfo();
      }
      
//      _.extend(this, this.defaultOptions);
//      return ret;
    },
    
//    route: function() {
//      return Backbone.Router.prototype.route.apply(this, arguments);
//    },
//    
//    navigateDone: function() {
//      this.navigating = false;
//      this.backClicked = false;
//    },
//    wasBackClicked: function() {
//      return !this.navigating && !this.firstPage;
//    },
    route: function() {
      var currentView = this.currentView;
      this.previousHash = U.getHash(); 
      try {
        return Backbone.Router.prototype.route.apply(this, arguments);
      } finally {
        this.previousView = currentView;
      }
    },

    /**
     * Backbone 1.0 decodes parameters, which confuses our routes, as we have fragments such as
     * #view/http%3A%2F%2Fmark.obval.com%2Furbien%2Fsql%2Furbien.com%2Fvoc%2Fdev%2FGym%2FRun%3Fid%3D32044?$minify=n
     * which when decoded would have two question marks
     */
    _extractParameters: function(route, fragment) {
      return route.exec(fragment).slice(1);
    },

    home: function() {
      if (!this.routePrereqsFulfilled('home', arguments))
        return;
      
      var prev = this.currentView,
          reverse;
      
      this.checkBackClick();
      if (this.backClicked) {
        this.currentView = C.getCachedView(); // this.viewsStack.pop();
        if (!this.currentView) {
          this.homePage.render();
          this.currentView = this.homePage;
          var idx = window.location.href.indexOf('#');
          this.currentUrl = (idx == -1) ? window.location.href : window.location.href.substring(0, idx);
        }
        else {
          this.currentUrl = this.urlsStack.pop();
//          if (!this.viewsStack.length)
//            this.currentView = $.mobile.firstPage;
        }
        
        $('div.ui-page-active #headerUl .ui-btn-active').removeClass('ui-btn-active');
        $m.changePage(this.currentView.$el, {changeHash:false, transition: 'slide', reverse: true});
      }
      else {
        this.currentUrl = window.location.href;
        this.homePage.render();
        this.currentView = this.homePage;
        // no need to call change page when home page is displayed for the very first time
//        if (this.urlsStack.length)
        if (!this.firstPage)
          $m.changePage(this.currentView.$el, {changeHash:false, transition: 'slide', reverse: true});
      }

//      if (this.backClicked) {
//        Events.trigger('pageChange', prev, this.currentView);
//      }
      
      // HACK, this div is hidden for some reason when going to #home/...
      var mainDiv = $('.mainDiv'); 
      if (mainDiv.is(':hidden'))
        mainDiv.show();

      Events.trigger('activeView', this.homePage);
      Events.trigger('pageChange', prev, this.currentView);
      this.checkErr();
    },
    
//    install: function() {
//      
//    },
    
    social: function() {
      if (!this.routePrereqsFulfilled('social', arguments))
        return;
      
      var view = C.getCachedView();
      if (!view)
        view = new Modules.SocialNetworkPage();
      
      this.changePage(view);
    },
    
    'static': function() {
      if (!this.routePrereqsFulfilled('static', arguments))
        return;
      
      var view = C.getCachedView();
      if (!view)
        view = new Modules.StaticPage();
      
      this.changePage(view);
    },

    choose: function(path) { //, checked, props) {
      if (this.routePrereqsFulfilled('choose', arguments))
        this.list(path, G.LISTMODES.CHOOSER); //, {checked: checked !== 'n', props: props ? props.slice(',') : []});
    },

    /**
     * return true if page change will be asynchronous, false or undefined otherwise
     */
    list: function(oParams, mode) {
      if (!this.routePrereqsFulfilled('list', arguments))
        return;

      var self = this,
          ListPage = Modules.ListPage,
          hashInfo = G.currentHashInfo,
          cachedView = C.getCachedView(),
          typeUri = hashInfo.type,
          params = hashInfo.params,
          query = hashInfo.query;
          
      if (query) {        
        if (_.has(params, '$page')) {
          this.page = parseInt(params.$page);
          query = $.param(params);
        }
//        var q = query.split("&");
//        for (var i = q.length - 1; i >= 0; i--) {
//          if (q[i] == "$page") {
//            this.page = parseInt(q[i].split("=")[1]); // page is special because we need it for lookup in db
//            q.splice(i, 1);
//            query = q.length ? q.join("&") : '';
//            break;
//          }
//        }
      }
      
      var page = this.page = this.page || 1;
      var options = this.getChangePageOptions();
      var forceFetch = options.forceFetch;
      
//      if (!this.isModelLoaded(typeUri, 'list', arguments))
//        return;
      
      var model = U.getModel(typeUri),
          className = model.displayName;
      
      if (params['-aroundMe'] == 'y') {
        // auto load location-based results
        U.getCurrentLocation(model).done(function(position) {
          _.extend(params, U.toModelLatLon(position, model), {'-item': 'me', '$orderBy': 'distance'});            
        }).always(function() {
          delete params['-aroundMe'];
          self.navigate(U.makeMobileUrl(hashInfo.action, typeUri, params), {trigger: true, replace: true});
        });
        
        return;
      }
      
//      var t = className;  
//      var key = query ? t + '?' + query : t;
//      var key = query || typeUri;
//      if (query)
//        key = U.getQueryString(U.getQueryParams(key, model), true);

      var params = U.getHashParams();
//      var list =  (mode &&  mode == G.LISTMODES.CHOOSER &&  (params['$more'] || params['$less'])) ? null : C.getResourceList(model, query);
      var list =  (mode &&  mode == G.LISTMODES.CHOOSER &&  (params['$more'] || params['$less'])) ? null : C.getResourceList(model, query);
      if (list && !list._lastFetchedOn)
        list = null;
      
      var meta = model.properties;      
//      var viewsCache = this.CollectionViews[typeUri] = this.CollectionViews[typeUri] || {};
      if (list) {
        if (!cachedView)
          cachedView = new ListPage({model: list});
        
        this.currentModel = list;
        cachedView.setMode(mode || G.LISTMODES.LIST);
        this.changePage(cachedView, _.extend({page: page}));
        Events.trigger('navigateToList:' + list.listId, list);
        list.fetch({page: page, forceFetch: forceFetch});
        this.monitorCollection(list);
//        setTimeout(function() {c.fetch({page: page, forceFetch: forceFetch})}, 100);
        return this;
      }
      
      list = this.currentModel = new ResourceList(null, {model: model, _query: query, _rType: className, rUri: oParams });    
      var listView = new ListPage({model: list});
      listView.setMode(mode || G.LISTMODES.LIST);
      
      list.fetch({
//        update: true,
        sync: true,
        forceFetch: forceFetch,
        rUri: oParams,
        success: _.once(function() {
          self.changePage(listView);
//          self.loadExtras(oParams);
        }),
//        error: Errors.getDefaultErrorHandler()
        error: _.once(function(collection, resp, opts) {
          var code = resp.code;
          if (code === 204)
            self.changePage(listView);
          else {
            if (code == 400)
              Events.trigger('badList', list);
            
            Errors.getBackboneErrorHandler().apply(this, arguments);
          }
        })
      });
      
      this.monitorCollection(list);
      return this;
    },
    
    templates: function(tName) {
      if (!this.routePrereqsFulfilled('templates', arguments))
        return;

      var hashInfo = G.currentHashInfo,
          cached = C.getCachedView();
      
      if (cached) {
        this.changePage(cached);
        return;
      }
        
      var previousView = this.currentView;
      if (!previousView) {
        tName = U.decode(tName.split('?')[0]); // url is of a form make%2f...?modelName=..., we just want the unencoded "make/..."        
        this.navigate(tName, {trigger: true, postChangePageRedirect: U.getHash()});
        return;
      }
      
      var descendants = previousView.getDescendants();
      var templateToTypes = {};
      _.each(descendants, function(d) {
        var templates = d._templates || [];
        var type = d.vocModel.type;
        if (templates.length) {
          _.each(templates, function(t) {
            var typeTemplates = templateToTypes[t] = templateToTypes[t] || [];
            U.pushUniq(typeTemplates, type);
          });
        }
      });
      
      var appTemplates = G.appTemplates;
      var templates = [];
      if (appTemplates) {
        _.each(appTemplates.models, function(t) {
          var tName = t.get('templateName');
          var type = t.get('modelDavClassUri');
          var types = templateToTypes[tName] || [];
          var tIdx = types.indexOf(type);
          if (tIdx != -1) {
            types.splice(tIdx, 1);
            if (!types.length)
              delete templateToTypes[tName];
            
            templates.push(t);
          }
        });
      }
      
      var type = hashInfo.sub.type;
      var currentAppUri = G.currentApp._uri;
      var jstType = G.commonTypes.Jst;
      var jstModel = U.getModel(jstType);
      var jstUriBase = G.sqlUrl + '/' + jstType.slice(7) + '?';
      _.each(templateToTypes, function(types, tName) {
        templates.push(new jstModel({
          _uri:  jstUriBase + $.param({templateName: tName}),
          templateName: tName,
          forResource: currentAppUri,
          modelDavClassUri: type
        }, {
          detached: true
        }));
      });
      
      var tList = new ResourceList(templates, {params: {forResource: currentAppUri}});
      if (!G.appTemplates)
        G.appTemplates = tList;
      
      var lPage = new Modules.ListPage({model: tList});
      this.changePage(lPage);
    },

//    views: function(tName) {
//      if (!this.ListPage)
//        return this.loadViews('ListPage', this.views, arguments);
//
//      var cached = this.CollectionViews[tName];
//      if (cached) {
//        this.changePage(cached);
//        return;
//      }
//        
//      var previousView = this.currentView;
//      if (!previousView) {
//        var qIdx = tName.indexOf("?");
//        if (qIdx >= 0) // these parameters are meant for the "views" route, not for the previous view 
//          tName = tName.slice(0, qIdx);
//        
//        this.navigate(U.decode(tName), {trigger: true, postChangePageRedirect: U.getHash()});
//        return;
//      }
//
//      debugger;
//      var descendants = previousView.getDescendants();
//      var viewToTypes = {};
//      _.each(descendants, function(d) {
//        var views = d._views || [];
//        var type = d.vocModel.type;
//        if (views.length) {
//          _.each(views, function(v) {
//            var typeViews = viewToTypes[v] = viewToTypes[v] || [];
//            U.pushUniq(typeViews, type);
//          });
//        }
//      });
//      
//      var appViews = G.appViews;
//      var views = [];
//      if (appViews) {
//        _.each(appViews.models, function(v) {
//          var vName = v.get('viewName');
//          var type = v.get('modelDavClassUri');
//          var types = viewToTypes[tName] || [];
//          var tIdx = types.indexOf(type);
//          if (tIdx != -1) {
//            types.splice(tIdx, 1);
//            if (!types.length)
//              delete viewToTypes[tName];
//            
//            views.push(v);
//          }
//        });
//      }
//      
//      var currentAppUri = G.currentApp._uri;
//      var modelUri = decodeURIComponent(tName);
//      var idx = modelUri.indexOf('?');
//      var sqlUri = '/' + G.sqlUri + '/';
//      var idx0 = modelUri.indexOf(sqlUri);
//      modelUri = idx0 == -1 ||  idx0 > idx ? modelUri.slice(0, idx) : 'http://' + modelUri.slice(idx0 + sqlUri.length, idx);
//      if (modelUri === 'view/profile')
//        modelUri = G.currentUser._uri;
//      if (modelUri.indexOf('http://') == -1)
//        modelUri = U.getModel(modelUri).type;
//      var jsType = G.commonTypes.JS;
//      var jsModel = U.getModel(jsType);
//      var jsUriBase = G.sqlUrl + '/' + jsType.slice(7) + '?';
//      _.each(viewToTypes, function(types, tName) {
//        views.push(new jsModel({
//          _uri:  jsUriBase + $.param({viewName: tName}),
//          viewName: tName,
//          forResource: currentAppUri,
//          modelDavClassUri: modelUri
//        }, {
//          detached: true
//        }));
//      });
//      
//      var vList = new ResourceList(views, {params: {forResource: currentAppUri}});
//      if (!G.appViews)
//        G.appViews = vList;
//      
//      var lPage = this.CollectionViews[tName] = new this.ListPage({model: vList});
//      this.changePage(lPage);
//    },

    monitorCollection: function(collection) {
      var self = this;
      collection.on('queryChanged', function() {
        debugger;
        var updateHash = function() {
          debugger;
          self.navigate(U.makeMobileUrl('list', collection.vocModel.type, list.params), {trigger: false, replace: true}); // maybe trigger should be true? Otherwise it can't fetch resources from the server
        }
        
        var currentView = self.currentView;
        if (currentView && currentView.collection === collection)
          updateHash();
        else
          Events.once('navigateToList.' + collection.listId, updateHash);
      });
    },
    
//    loadViews: function(views, caller, args) {
//      views = $.isArray(views) ? views : [views];
//      var self = this;
//      var unloaded = _.filter(views, function(v) {return !self[v]});
//      if (unloaded.length) {
//        var unloadedMods = _.map(unloaded, function(v) {return 'views/' + v});
//        U.require(unloadedMods, function() {
//          var a = U.slice.call(arguments);
//          for (var i = 0; i < a.length; i++) {              
//            Modules[unloaded[i]] = a[i];
//          }
//          
//          caller.apply(self, args);
//        });
//      }
//    },
//
//    _backOrHome: function() {
//      if (this.urlsStack.length)
//        Events.trigger('back');
//      else
//        this.goHome();
//    },

    goHome: function() {
      window.location.href = G.pageRoot; 
    },
    
    _requestLogin: function(options) {
      Events.trigger('req-login', _.extend(options || {}));
    },
    
    make: function(path) {
      if (!this.routePrereqsFulfilled('make', arguments))
        return;
      
      var hashInfo = G.currentHashInfo,
          EditPage = Modules.EditPage, 
          type = hashInfo.type;
      
//      if (!this.isModelLoaded(type, 'make', arguments))
//        return;

      var vocModel = U.getModel(type),
          params = U.getHashParams(),
          makeId = params['-makeId'];
      
      makeId = makeId ? parseInt(makeId) : G.nextId();
      var mPage = C.getCachedView(); //this.MkResourceViews[makeId];
      if (mPage && !mPage.model.getUri()) {
        // all good, continue making ur mkresource
      }
      else {
        var model = U.getModel(type),
            modelParams = U.getQueryParams(hashInfo.params, model),
            resource = new model(U.filterInequalities(modelParams));
         
        if (!resource.getUri() && Redirecter.fastForwardMake(resource))
          return;
        
//        if (!_.size(U.getPropertiesForEdit(resource))) {
//          resource.save();
//          return;
//        }
        
        mPage = new EditPage({
          model: resource, 
          action: 'make', 
          makeId: makeId, 
          source: this.previousHash
        });
      }
      
      this.currentModel = mPage.resource;
      mPage.set({action: 'make'});
      try {
        this.changePage(mPage);
      } finally {
        if (G.currentUser.guest) {
          this._requestLogin();
        }
      }
    },

    getChangePageOptions: function(fragment) {
      return this.fragmentToOptions[fragment || U.getHash()] || {};
    },
    
    edit: function(path) {
      if (!this.routePrereqsFulfilled('edit', arguments))
        return;
      
      try {
        this.view(path, 'edit');
      } finally {
        if (G.currentUser.guest)
          this._requestLogin();
      }
    },

    chat: function(path) {
      if (!this.routePrereqsFulfilled('chat', arguments))
        return;
      
      try {
        this.view(path, 'chat');
      } finally {
        if (G.currentUser.guest)
          this._requestLogin();
      }
    },
    
    updateHashInfo: function() {
      G.previousHash = G.currentHash;
      G.previousHashInfo = G.currentHashInfo;
      G.currentHash = U.getHash();
      if (G.currentHash !== G.previousHash)
        G.currentHashInfo = U.getUrlInfo(G.currentHash);
      
      return G.currentHashInfo;
    },
    
    routePrereqsFulfilled: function(route, args) {
      Events.trigger('changingPage');
      return this._routePrereqsFulfilled.apply(this, arguments); 
    },
    
    _routePrereqsFulfilled: function(route, args) {
      this.updateHashInfo();
      var self = this,
          views,
          missingTypes,
          prereqs,
          installationState,
          isWriteRoute,
          hashInfo = G.currentHashInfo,
          type = hashInfo.type;
      
      if (G.currentUser.guest && /^(chat|edit|make|social)/.test(route)) {
        this._requestLogin();
        return false;
      }
      
      // the user is attempting to install the app, or at least pretending well
      isWriteRoute = this.isWriteRoute(route);
      if (!type || !type.endsWith(G.commonTypes.AppInstall)) {
        if (G.currentApp.forceInstall || isWriteRoute) {
          installationState = AppAuth.getAppInstallationState(); //hashInfo.type);
          if (!installationState.allowed) {
            if (G.currentUser.guest) {
              this._requestLogin();
              return false;
            }
  
            Voc.getModels(hashInfo.type);
            AppAuth.requestInstall(G.currentApp);
            return false;
          }
        }
      }

      switch (route) {
      case 'chat':        
        views = ['ChatPage'];
        break;
      case 'social':        
        views = ['SocialNetworkPage'];
        break;
      case 'static':        
        views = ['StaticPage'];
        break;
      case 'view':
        views = ['ViewPage'];
        break;
      case 'edit':
      case 'make':
        views = ['EditPage', 'EditView'];
        break;
      case 'templates':
      case 'list':
      case 'choose':
        views = ['ListPage'];
        break;
      }
      
      prereqs = [];
      if (views) {
        var missing = _.filter(views, function(view) {
          return !Modules[view];
        });
        
        if (missing.length) {
//          this.loadViews(missing, this[route], args);
//          return false;
          var unloadedMods = _.map(missing, function(v) {return 'views/' + v}),
              viewsPromise = U.require(unloadedMods, function() {
                for (var i = 0, l = arguments.length; i < l; i++) {              
                  Modules[missing[i]] = arguments[i];
                }
              });
          
          prereqs.push(viewsPromise);
        }
      }
 
      missingTypes = [];    
      var sub = hashInfo;
      while (sub) {
        if (sub.type) {
          sub.type = G.classMap[sub.type] || sub.type;
          if (!U.getModel(sub.type) && missingTypes.indexOf(sub.type) == -1)
            missingTypes.push(sub.type);
        }
        
        sub = sub.sub;
      }
      
      if (missingTypes.length)
        prereqs.push(Voc.getModels(missingTypes));
      
      if (!_.all(prereqs, function(p) { return p.state() == 'resolved' })) {
        $.whenAll.apply($, prereqs).then(function() {
          self[route].apply(self, args);
        });
        
        return false;
      }
      
      return true;
    },
    
    login: function(path) {
      if (!this.routePrereqsFulfilled('login', arguments))
        return;
      
      var self = this,
          hashInfo = U.getCurrentUrlInfo(),
          params = hashInfo.params;
      
      this._requestLogin({
        returnUri: params && params.$returnUri || G.appUrl,
        returnUriHash: params && params.$returnUriHash,
        onDismiss: function() {
          self.goHome();
        }
      });
    },
    
    /**
     * handles view, edit and chat mode (action)
     */
    view: function (path, action) {
      action = action || 'view';
      if (!this.routePrereqsFulfilled(action, arguments))
        return;
      
      var self = this,
          hashInfo = G.currentHashInfo,
          cachedView = C.getCachedView(),
          uri = hashInfo.uri,
          query = hashInfo.query,
          typeUri = hashInfo.type,
          views,
          edit = hashInfo.action == 'edit',
          chat = hashInfo.action == 'chat',
          viewPageCl,
          view,
          model,
          res;
      
      switch (action) {
        case 'chat':
          viewPageCl = Modules.ChatPage;
          break;
        case 'edit':
          viewPageCl = Modules.EditPage;
          break;
        default:
          viewPageCl = Modules.ViewPage;
      }

      if (hashInfo.special == 'profile') {
        if (G.currentUser.guest) {
          this._requestLogin();
          return;
        }
        else {
          this.navigate(U.makeMobileUrl('view', uri, hashInfo.params), {trigger: false, replace: true});
          hashInfo = this.updateHashInfo();
        }
      }
      
      if (chat && /^_/.test(uri)) {
        var chatPage = cachedView || new Modules.ChatPage();
        this.changePage(chatPage);
        return;
      }      

      model = U.getModel(typeUri);
      if (!model)
        return this;

      if (U.isAssignableFrom(model, 'Contact')) {
        var altType = G.serverName + '/voc/dev/' + G.currentApp.appPath + "/Urbien1";
        var altModel = U.getModel(altType);
        if (altModel) {
          typeUri = altType;
          model = altModel;
        }
      }
      
      res = C.getResource(uri);
      if (res && !res.loaded)
        res = null;

      var newUri = res && res.getUri();
      var wasTemp = U.isTempUri(uri);
      var isTemp = newUri && U.isTempUri(newUri);
      if (wasTemp) {
        function updateHash(resource) {
          self.navigate(U.makeMobileUrl(action, resource.getUri()), {trigger: false, replace: true});
        }
        
        if (isTemp || !newUri) {
          Events.once('synced:' + uri, function() {            
            var currentView = self.currentView;    
            if (currentView && currentView.resource === res) {
              updateHash(res);
            }
            else
              Events.once('navigateToResource:' + res.resourceId, updateHash);
          });
        }
        else {
          updateHash(res);
        }
      }

      var options = this.getChangePageOptions();
      var forceFetch = options.forceFetch;
      if (res) {
        this.currentModel = res;
        view = cachedView || new viewPageCl({model: res, source: this.previousHash});
        
        this.changePage(view);
        Events.trigger('navigateToResource:' + res.resourceId, res);
        res.fetch({forceFetch: forceFetch});
        if (wasTemp && !isTemp)
          this.navigate(U.makeMobileUrl(action, newUri), {trigger: false, replace: true});
        
        return this;
      }
      
      res = this.currentModel = new model({_uri: uri});
      view = new viewPageCl({model: res, source: this.previousHash});
      
      function success() {
        if (wasTemp)
          self._checkUri(res, uri, action);
        
        self.changePage(view);
        Events.trigger('navigateToResource:' + res.resourceId, res);
      };
      
      if (chat) {
        res.fetch();
        success();
      }
      else {
        res.fetch({
          sync: true, 
          forceFetch: forceFetch, 
          success: _.once(success)
        });
      }
      
      return true;
    },
    
//    tour: function(path) {
//      if (!this.routePrereqsFulfilled('tour', arguments))
//        return;
//      
//      var self = this,
//          hashInfo = G.currentHashInfo,
//          sub = hashInfo.sub,
//          params = hashInfo.params,
//          tourUri = hashInfo.uri,
//          tourModel = U.getModel(G.commonTypes.Tour),
//          stepUri = params.$step && U.getLongUri1(params.$step),
//          stepModel = U.getModel(G.commonTypes.TourStep);
//
////      else if (sub)
////        debugger; // TODO figure out what the hell the user is trying to do
////      else if (hashInfo.type == TOUR_STEP_TYPE)
////        stepUri = hashInfo.uri;
////      else if (hashInfo.type == TOUR_TYPE)
////        debugger; // TODO go to the first step
////
////          ,
////          steps,
////          tourUri,
////          tourRes;
//      
//      debugger;
//      if (!tourUri || !stepUri)
//        return fail();
//      
//      function fail() {
//        debugger;
////        self.navigate(hashInfo.sub.hash);
//      };
//
//      function success(tour, steps) {
//        step = steps.get(stepUri);
//        var action = step.get('action');
//        if (self._currentTour !== tour)
//          Events.trigger('tourStart', tour, steps);
//        
//        Events.trigger('tourStep', step);
////        if (sub.type)
////          self[route].apply(self, hashInfo.sub.hash);
////        else
////          self.navigate(U.makeMobileUrl('tour', U.makeMobileUri(step.get('action'), step.get('typeUri'), U.getParamMap(step.get('urlQuery') || ''))), {replace: true});
//        self[action].apply(self, U.makeMobileUrl(action, step.get('typeUri'), U.getParamMap(step.get('urlQuery') || '')));
//      }
//      
//      $.whenAll(
//          getTour(tourUri, tourModel), 
//          getSteps(tourUri, stepModel)
//      ).then(success, fail);
//    },
    
    _checkUri: function(res, uri, action) {
      if (U.isTempUri(uri)) {
        var newUri = res.getUri();
        if (!U.isTempUri(newUri))
          this.navigate(U.makeMobileUrl(action, newUri), {trigger: false, replace: true});            
      }
    },
    
/*    
    login: function() {
      console.log("#login page");
      if (!LoginView) {
        var args = arguments;
        var self = this;
        U.require(['views/LoginButton'], function(LV) {
          LoginView = LV;
          self.login.apply(self, args);
        })
        return;
      }
      if (!this.LoginView)
        this.LoginView = new LoginView();
      this.LoginView.showPopup();
    },
*/
    
    
//    loadExtras: function(params) {
//      if (params.length == 0)
//        return;
//      
//      paramToVal = {};
//      params = _.each(params.slice(1), 
//        function(nameVal) {
//          nameVal = nameVal.split("=");
//          paramToVal[nameVal[0]] = nameVal[1];
//        }
//      );
//      
//      params = paramToVal;
//      if (params["-map"] != 'y')
//        return;
//      
//      console.log("painting map");
//    },
//
//    isModelLoaded: function(type, method, args) {
//      return this.areModelsLoaded([type], method, args);
//    },
//
//    areModelsLoaded: function(types, method, args) {
//      var self = this,
//          missing = _.filter(types, U.negate(U.getModel));
//      
//      if (!missing.length)
//        return true;
//      
//      var fetchModels = Voc.getModels(missing, {sync: true});
//      method = typeof method == 'function' ? method : self[method];
////      Voc.loadStoredModels({models: [type]});
//      if (fetchModels.state() === 'resolved')
//        return true;
//      
//      fetchModels.done(function() {
//        method.apply(self, args);
//      }).fail(function() {
////          debugger;
//        Errors.getBackboneErrorHandler().apply(this, arguments);
//      });
//        
//      return false;
//    },

    checkErr: function() {
//      var q = U.getQueryParams();
//      var msg = q['-errMsg'] || q['-info'] || this.errMsg || this.info;
//      if (msg)
//        U.alert({msg: msg, persist: true});
//      
//      this.errMsg = null, this.info = null;
      var params = G.currentHashInfo.params,
          info = params['-info'] || params['-gluedInfo'],
          error = params['-error'] || params['-gluedError'];
          
      if (info || error) {
//        if (/^home\//.test(U.getHash())) {
////          Events.trigger('headerMessage', {
////            info: {
////              msg: info,
////              glued: info === params['-gluedInfo']
////            },
////            error: {
////              msg: error,
////              glued: error === params['-gluedError']
////            }
////          });
//          var errorBar = $.mobile.activePage.find('#headerMessageBar');
//          errorBar.html("");
//          errorBar.html(U.template('headerErrorBar')({error: error, info: info, style: "text-color:#FFFC40;"}));
//
//          if (!params['-gluedInfo']) {
//            var hash = U.getHash().slice(1);
//            delete params['-info'];
//            delete params['-error']; 
//            // so the dialog doesn't show again on refresh
//            Events.trigger('navigate', U.replaceParam(U.getHash(), {'-error': null, '-info': null}), {trigger: false, replace: true});
//          }
//        }
      
        var data = {};
        if (info) {
          data.info = {
            msg: info,
            glued: !!params['-gluedInfo']
          };
        }
        if (error) {
          data.error = {
            msg: error,
            glued: !!params['-gluedError']
          };
        }
        
        Events.trigger('headerMessage', data);
      }
    },
    changePage: function(view) {
      try {
        this.changePage1(view);
        return this;
      } finally {
        this.checkErr();
        var pageOptions = this.getChangePageOptions();
        this.fragmentToOptions = {};
        var redirect = pageOptions.postChangePageRedirect;
        if (redirect) {
          pageOptions.postChangePageRedirect = null;
          view.onload(function() {
            if (view.isActive())
              this.navigate(redirect, {trigger: true, replace: true});
          }.bind(this));
        }
//        else if (this.currentView === this.previousView) {
//          G.log(this.TAG, 'info', 'duplicate history, navigating back');
//          window.history.back();
//        }
      }
    },
    
    changePage1: function(view) {
      var activated = false,
          prev = this.currentView,
          options = this.getChangePageOptions(),
          replace = options.replace,
          transition = 'slide',
          isReverse = false;
      
      if (view == this.currentView) {
        G.log(this.TAG, "render", "Not replacing view with itself, but will refresh it");
        view.refresh();
        return;
      }
            
      if (prev) {
        if (prev == view) {
          G.log(this.TAG, 'history', 'Duplicate history entry, backing up some more');
          Events.trigger('back');
          return;
        }
//        else
//          prev.trigger('active', false);
      }

      Events.trigger('activeView', view);
      this.currentView = view;
      if (!view.rendered) {
//        view.trigger('active', true);
        activated = true;
        view.render();
        view.$el.attr('data-role', 'page'); //.attr('data-fullscreen', 'true');
      }

      if (this.firstPage)
        transition = 'none';
      
      this.checkBackClick();
      // HACK //
//      isReverse = false;
      // END HACK //

      // back button: remove highlighting after active page was changed
      $('div.ui-page-active #headerUl .ui-btn-active').removeClass('ui-btn-active');
      
//      if (!activated)
//        view.trigger('active', true);
      
      // perform transition        
      $m.changePage(view.$el, {changeHash: false, transition: this.nextTransition || transition, reverse: this.backClicked});
      this.nextTransition = null;
      Events.trigger('pageChange', prev, view);
      return view;
    },
    
    checkBackClick: function() {
      if (this.backClicked) {
        this.urlsStack.pop();
        return;
      }
      
      var options = this.getChangePageOptions(),
          replace = options.replace,
          here = window.location.href;
      
//      if (this.currentView instanceof Backbone.View  &&  this.currentView.clicked) {
//        this.currentView.clicked = false;
//        return;
//      }
//      // Check if browser's Back button was clicked
//      else 
      if (this.urlsStack.length != 0) {
        var url = this.urlsStack[this.urlsStack.length - 2];
        if (url == here) {
          this.backClicked = true;
          this.urlsStack.pop();
          return;
        }
      }
      
      if (replace)
        this.urlsStack = this.urlsStack.slice(0, this.urlsStack.length - 1);
      
      this.urlsStack.push(here);
    },
    
    checkTour: function() {
      if (G.tourGuideEnabled) {
        G.whenNotRendering(function() {          
          U.require('tourGuide').done(function(TourGuide) {
            TourGuide.getTour();
          });
        });
      }
    }
//    ,
//    
//    changePage2: function(view) {
//      if (view == this.currentView) {
//        G.log(this.TAG, "render", "Not replacing view with itself, but will refresh it");
//        view.refresh();
//        return;
//      }
//
//      var activated = false;
//      var prev = this.currentView;
//      if (prev && prev !== view)
//        prev.trigger('active', false);
//      
//      var options = this.getChangePageOptions();
//      var replace = options.replace;
//      var lostHistory = false;
//      if (this.backClicked) {
//        var currentView = this.currentView;
//        if (currentView && !(this.currentView instanceof Backbone.View))
//          debugger;
//        if (this.currentView instanceof Backbone.View  &&  this.currentView.clicked)
//          this.currentView.clicked = false;
//        
//        this.currentView = this.viewsStack.pop();
//        this.currentUrl = this.urlsStack.pop();
//        if (currentView && currentView === this.currentView) {
//          debugger;
//          G.log(this.TAG, 'history', 'Duplicate history entry, backing up some more');
//          Events.trigger('back');
//          return;
//        }
//        
//        if (this.currentView)
//          view = this.currentView;
//        else
//          lostHistory = true;
//      }
//      
//      var transition = "slide";
//      if (!this.backClicked || lostHistory) {
//        if (this.currentView instanceof Backbone.View  &&  this.currentView.clicked)
//          this.currentView.clicked = false;
//        // Check if browser's Back button was clicked
//        else if (!this.backClicked  &&  this.viewsStack.length != 0) {
//          var url = this.urlsStack[this.viewsStack.length - 1];
//          if (url == window.location.href) {
//            this.currentView = this.viewsStack.pop();
//            this.currentUrl = this.urlsStack.pop();
//            view = this.currentView;
//            this.backClicked = true;
//          }
//        }
//        if (!this.backClicked  ||  lostHistory) {
//          if (!view.rendered) {
//            view.$el.attr('data-role', 'page'); //.attr('data-fullscreen', 'true');
//            view.trigger('active', true);
//            activated = true;
//            view.render();
//          }
//      
////          transition = "slide"; //$m.defaultPageTransition;
//          if (!replace  &&  this.currentView  &&  this.currentUrl.indexOf('#menu') == -1) {
//            this.viewsStack.push(this.currentView);
//            this.urlsStack.push(this.currentUrl);
//          }
//          
//          this.currentView = view;
//          this.currentUrl = window.location.href;
//        }
//      }
//
//      if (this.firstPage) {
//        transition = 'none';
//        this.firstPage = false;
//      }
//      
//      // hot to transition
//      var isReverse = false;
//      if (this.backClicked == true) {
//        this.backClicked = false;
//        isReverse = true;
//      }
//
//      // back button: remove highlighting after active page was changed
//      $('div.ui-page-active #headerUl .ui-btn-active').removeClass('ui-btn-active');
//      
//      if (!activated)
//        view.trigger('active', true);
//      
//      // perform transition        
//      $m.changePage(view.$el, {changeHash: false, transition: this.nextTransition || transition, reverse: isReverse});
//      this.nextTransition = null;
//      Events.trigger('pageChange', prev, view);
//      return view;
//    }
    ,
    isListRoute: function(route) {
      return _.contains(['list', 'chooser', 'templates'], route);
    },
    isResourceRoute: function(route) {
      return !this.isListRoute(route);
    },
//    isProxyRoute: function(route) {
//      return _.contains(['templates'/*, 'tour'*/], route);
//    },
    isWriteRoute: function(route) {
      return _.contains(['make', 'edit'], route);
    }
  });
            
  return Router;
});
  
