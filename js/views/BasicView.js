//'use strict';
define('views/BasicView', [
  'globals',
  'backbone',
  'utils',
  'templates',
  'events',
  'lib/lazyImages'
], function(G, _Backbone, U, Templates, Events) {
  var basicOptions = ['source', 'parentView', 'returnUri'],
      AP = Array.prototype,
      lazyAttr = G.lazyImgSrcAttr,
      WIN_HEIGHT,
      // Vertical offset in px. Used for preloading images while scrolling
      IMG_OFFSET = 200,
      $wnd = $(window);

  function cleanImage(img) {
    img.onload = null;
    img.removeAttribute('onload');
    // on IE < 8 we get an onerror event instead of an onload event
    img.onerror = null;
    img.removeAttribute('onerror');
    img.removeAttribute(lazyAttr);
  };
  
  function viewport() {
    if (document.documentElement.clientHeight >= 0) {
      return document.documentElement.clientHeight;
    } else if (document.body && document.body.clientHeight >= 0) {
      return document.body.clientHeight
    } else if (window.innerHeight >= 0) {
      return window.innerHeight;
    } else {
      return 0;
    }
  };

  function saveViewport() {
    WIN_HEIGHT = G.viewportHeight = viewport();
  };
  
  saveViewport();
  $wnd.on('resize', _.throttle(saveViewport));
  
  function getDummyImages($el) {
    return $el.find('img[{0}]'.format(lazyAttr));
  }

  function getLoadedImages($el) {
    return $el.find('img:not([{0}])'.format(lazyAttr));
  }

  // Override image element .getAttribute globally so that we give the real src
  // does not works for ie < 8: http://perfectionkills.com/whats-wrong-with-extending-the-dom/
  // Internet Explorer 7 (and below) [...] does not expose global Node, Element, HTMLElement, HTMLParagraphElement
  window['HTMLImageElement'] && overrideGetattribute();
  function overrideGetattribute() {
    var original = HTMLImageElement.prototype.getAttribute;
    HTMLImageElement.prototype.getAttribute = function(name) {
      if(name === 'src') {
        var realSrc = original.call(this, lazyAttr);
        return realSrc || original.call(this, name);
      } else {
        // our own lazyloader will go through theses lines
        // because we use getAttribute(lazyAttr)
        return original.call(this, name);
      }
    }
  }
    
  function disableHover($el) {
    $el.bind('mouseover', function() {
      return false;
    });
  }

  var BasicView = Backbone.View.extend({
    initialize: function(options) {
//      this._initOptions = options;
      _.bindAll(this, 'reverseBubbleEvent', 'render', 'refresh', '_showImages', 'destroy');
      this.TAG = this.TAG || this.constructor.displayName;
      this.log('newView', ++this.constructor._instanceCounter);
      
      var superCtor = this.constructor;
      while (superCtor.__super__) {
        var superDuperCtor = superCtor.__super__.constructor;
        if (superCtor === superDuperCtor) // prevent infinite loops
          break;
        
        _.defaults(this.events, superDuperCtor.prototype.events);
        superCtor = superDuperCtor;
      }
      
      // replace click with vclick and so on, if necessary
      for (var eventSelectorName in this.events) {
        var eventName = eventSelectorName.match(/^([^\.\ ]+)/);
        if (!eventName)
          continue;
        
        eventName = eventName[1];
        var actualName = Events.getEventName(eventName);
        if (actualName !== eventName && !events[actualName]) {
          this.events[eventSelectorName.replace(eventName, actualName)] = this.events[eventSelectorName];
          delete this.events[eventSelectorName];
        }
      }
      
      options = options || {};
      this._updateHashInfo();
      this._loadingDfd = new $.Deferred();
      this._loadingDfd.promise().done(function() {
        if (!this.rendered)
          this.rendered = true;
      }.bind(this));
      
      this._taskQueue = [];      
      this._templates = [];
      this._templateMap = {};
      _.extend(this, _.pick(options, basicOptions));
      this.pageView = this.getPageView();
      
      var res = this.data = this.model = this.model || options.resource || options.collection;
      if (res) {
        if (this.model instanceof Backbone.Collection) {
          this.collection = res;
          this.vocModel = res.model;
        }
        else {
          this.resource = res;
          this.collection = res.collection;
          this.vocModel = res.constructor;
          res.on('modelChanged', function() {
            this.vocModel = res.vocModel;
          }.bind(this));
        }
        
        this.modelType = this.vocModel.type;
      }
      
      this.router = window.router || Backbone.history; //G.Router || Backbone.history;
      var refresh = this.refresh;
      this.refresh = function(rOptions) {
        var force = rOptions && rOptions.force;
        if (!force && !this.rendered)
          return this;
        
//        var delay = !force && !this.isPanel && !this.isActive(); // to avoid rendering views 10 times in the background. Render when it's about to be visible
        G.log(this.TAG, 'refresh', 'page title:', this.getPageTitle());
        this._queueTask(refresh, this, arguments);
        return this;
      };
      
      var render = this.render;
      function doRender() {
        render.apply(this, arguments);
        if (this.autoFinish !== false)
          this.finish();

        if (G.browser.mobile)
          disableHover(this.$el);
      }

      this.render = function(rOptions) {
//        var delay = (!rOptions || !rOptions.force) && !this.isPanel && !this.isActive(); // to avoid rendering views 10 times in the background. Render when it's about to be visible
        G.log(this.TAG, 'render', 'page title:', this.getPageTitle());
        this._queueTask(doRender, this, arguments); //, !delay);
        return this;
      }.bind(this);

      var self = this;
      this.on('active', function() {
        self.active = true;
        self.triggerChildren('active');
        self._updateHashInfo();
        self._processQueue();
      });
      
      this.on('inactive', function() {
        self.active = false;
        self.triggerChildren('inactive');
      });

      _.each(['onorientationchange', 'onresize'], function(listener) {
        if (listener in window) {
          var event = listener.slice(2),
              _event = '_' + event;
          
          window.addEventListener(event, function() {
            if (self.isActive())
              self[_event](event);
            else {
              self.once('active', function() {
                self[_event](event);
              });
            }
          }, false);
          
          self[_event] = _.debounce(function(e) {
            G.log(self.TAG, 'events', e);
            self.$el.trigger(e);
          }, 100);          
        }
      });

//      this.initialized = true;
      var localize = G.localize,
          ctx = G.localizationContext;
      
      this.loc = function() {
        return localize.apply(ctx, arguments);
      };

      this._subscribeToImageEvents();
      G.log(this.TAG, 'new view', this.getPageTitle());
      return this;
    },
    
    events: {
      'imageOnload': '_loadImage'
    },
    
    _updateHashInfo: function() {
      this._hashInfo = U.getCurrentUrlInfo();
      this.hash = U.getHash();
      this.hashParams = this._hashInfo && this._hashInfo.params || {};
    },

    getBaseTemplateData: function() {
      var data = {
        viewId: this.cid
      };
      
      if (this.resource)
        data._uri = this.resource.get('_uri');
      
      return data;
    },
    
    refresh: function() {
      // override this
    },
    
    isChildless: function() {
      return !_.size(this.children);
    },
    
    update: function() {
      if (this.rendered)
        this.refresh.apply(this, arguments);
      else
        this.render.apply(this, arguments);      
    },
    
    destroy: function() {
      if (this._destroyed)
        return;
      
      this._destroyed = true;
      this.trigger('destroyed');
      Events.trigger('viewDestroyed', this);
      Events.trigger('viewDestroyed:' + this.cid, this);
      if (this.$el)
        this.remove();
    },
    
    _getChildrenLoadingDeferreds: function() {
      return _.pluck(this.getDescendants(), '_loadingDfd');
    },
    
    _getLoadingDeferreds: function() {
      return [this._loadingDfd].concat(this._getChildrenLoadingDeferreds());
    },
    
    isDoneLoading: function() {
      return _.all(this._getLoadingDeferreds(), function(c) {
        return c.state() !== 'pending';
      });
    },

    onload: function(callback) {
      return $.whenAll.apply($, this._getLoadingDeferreds()).then(callback);
    },

//    onload: function(callback) {
//      return this._loadingDfd.promise().then(callback);
//    },
//
//    onChildrenLoaded: function(callback) {
//      var promise = $.whenAll.apply($, this._getChildrenLoadingDeferreds());
//      callback && promise.then(callback);
//      return promise;
//    },
    
    finish: function() {
      this._loadingDfd.resolve();
    },
    
    _queueTask: function(fn, scope, args) {
      var self = this,
          lazyDfd = $.Deferred();
      
      this._taskQueue.push(lazyDfd);
      lazyDfd.start = function() {
        this._started = true;
        self.log('info', 'running {0} task'.format(self.TAG));
        var promise = fn.apply(scope, args || []);
        if (U.isPromise(promise))
          promise.then(lazyDfd.resolve, lazyDfd.reject);
        else
          lazyDfd.resolve();
      };
      
      lazyDfd.promise().always(function() {
        self._dequeueTask(lazyDfd);
        self._processQueue();
      });
      
      this._processQueue();
    },

    _dequeueTask: function(task) {
      Array.remove(this._taskQueue, task);
    },

    _processQueue: function() {
      if (!this.isActive())
        return;
      
      var next = this._taskQueue[0];
      if (next) {
        if (!next._started) {
          G.q({
            name: this.TAG + ':task:' + this.cid,
            task: next.start.bind(next)
          });
        }
        else
          this.log('info', 'postponing {0} {1} task'.format(this.TAG, this.cid));
      }
    },
    
    getTemplate: function(templateName, type) {
      return Templates.get(templateName, type);
    },

    getOriginalTemplate: function(templateName) {
      return Templates.getOriginalTemplate(templateName);
    },

    makeTemplate: function(templateName, localName, type, dontFallBackToDefault) {
//      localName = localName || templateName;
      var template = this[localName] = U.template(templateName, type, this);
      if (!template) {
        if (!dontFallBackToDefault && type)
          return this.makeTemplate(templateName, localName);
        else
          return template;
      }
        
      U.pushUniq(this._templates, templateName);
      this._templateMap[templateName] = localName;
      this._monitorTemplate(templateName);
      return template;
    },  
    
    _monitorTemplate: function(templateName) {
      var event = 'templateUpdate:' + templateName;
      this.stopListening(Events, event);
      this.listenTo(Events, event, function(template) {
        var dClUri = template.get('modelDavClassUri');
        if (dClUri) {
          var type = U.getTypeUri(dClUri);
          if (U.getTypes(this.vocModel).indexOf(type) == -1)
            return;
        }
        
        this.makeTemplate(templateName, this._templateMap[templateName], dClUri);
        this[this.rendered ? 'render' : 'refresh']();
        this.restyle();
      }.bind(this));
    },
    
    atBottom: function() {
      var $w = $(window);
      return this.pageView.$el.height() - $w.height() - $w.scrollTop() < 20;
    },
    
//    onInactive: function(callback) {
//      this._inactiveDfd.done(callback);
//    },
//
//    onActive: function(callback) {
//      this._activeDfd.done(callback);
//    },
    
    addChild: function(view) {
      var self = this;
      if (!this.children)
        this.children = {};
      
      this.children[view.cid] = view;
      view.parentView = view.parentView || this;
      view.pageView = this.getPageView() || view.pageView;
      view.once('destroyed', function(view) {
        if (self.children)
          delete self.children[view.cid];
        
        for (var prop in self) {
          if (self[prop] === view)
            self[prop] = null;
        }
      });
      
      return view;
    },
    
    getChildViews: function() {
      return this.children;
    },

    empty: function() {
//      U.wipe(this.children);
      this.$el.empty();
    },

    html: function(html) {
//      U.wipe(this.children);
      this.$el.html(html);
    },
    
    getDescendants: function() {
      if (!this.children)
        return [];
      else {
        var childViews = _.values(this.children);
        return _.union([], childViews, _.union.apply(_, _.map(childViews, function(child) {return child.getDescendants()})));
      }
    },
    
    reverseBubbleEvent: function(e) {
      if (!this.isActive())
        return;
      
      _.each(this.children, function(child) {
        child.$el && child.$el.triggerHandler(e.type, e); // triggerHandler will prevent the event from bubbling back up and creating an infinite loop
      });
    },
    
    triggerChildren: function(event) {
      var args = _.tail(arguments);
      args.unshift(event);
      _.each(this.children, function(child) {
        child.trigger.apply(child, args);
      }); // keep this
    },
    
    showLoadingIndicator: function() {
      var page = this.pageView;
      if (page)
        page.showLoadingIndicator.apply(page, arguments);
    },

    hideLoadingIndicator: function() {
      var page = this.pageView;
      if (page)
        page.hideLoadingIndicator.apply(page, arguments);
    },

    isPageView: function(view) {
      return false;
    },
    
    getPageView: function() {
      if (this.pageView)
        return this.pageView;
      
      var parent = this;
      while (parent.parentView) {
        parent = parent.parentView;
        if (parent.isPageView())
          return parent;
      }
    },
    
    getPageTitle: function() {
      return this.pageView && this.pageView.getPageTitle();
    },
    
    isActive: function() {
//      if (this.active)
//        return true;
//      
//      var view = this.parentView;
//      while (view) {
//        if (view.active)
//          return true;
//        
//        view = view.parentView;
//      }
//      
//      return false;
      return this.active || (this.pageView && this.pageView.isActive());
    },
  
    isChildOf: function(view) {
      var parent = this.parentView;
      while (parent) {
        if (view === parent)
          return true;
        
        parent = parent.parentView;
      }
      
      return false;
    },
    
    isGeo: function() {
      if (this.collection) {
        return this.collection.isOneOf(["Locatable", "Shape"]);
      }
      else {
        var res = this.resource;
        return !!((res.isA("Locatable") && res.get('latitude') && res.get('longitude')) || 
                  (res.isA("Shape") && res.get('shapeJson')))
      }
    },
    
    assign: function (selector, view, renderOptions) {
      var selectors;
      if (_.isObject(selector)) {
        selectors = selector;
      }
      else {
        selectors = {};
        selectors[selector] = view;
      }
      
      if (!selectors) 
        return;
      
      _.each(selectors, function (view, selector) {
          view.setElement(this.$(selector)).render(renderOptions);
      }, this);
    },
    
    finalize: function () {
    },

//    isPortrait: function() {
//      return window.innerHeight > window.innerWidth;
//    },
//    
//    isLandscape: function() {
//      return !this.isPortrait();
//    },
    
    padding: function(horizontal) {
      var one = horizontal ? 'left' : 'top';
      var two = horizontal ? 'right' : 'bottom';
      var padding = this.$el.css('padding') || "0px";
      var onePadding = this.$el.css('padding-' + one) || "0px",
          twoPadding = this.$el.css('padding-' + two) || "0px";
      
      padding = parseFloat(padding);
      return (parseFloat(onePadding) || padding) 
           + (parseFloat(twoPadding) || padding);
    },
    
    innerHeight: function() {
      return this.el.clientHeight ? this.el.clientHeight - this.padding(false) : this.parentView ? this.parentView.innerHeight() - this.padding(false) : null;
    },

    innerWidth: function() {
      return this.el.clientWidth ? this.el.clientWidth - this.padding(true) : this.parentView ? this.parentView.innerWidth() - this.padding(true) : null;
    },
    
    restyle: function() {
      this.$el.find('ul[data-role]').listview();
      this.$el.find('div[data-role="fieldcontain"]').fieldcontain();
      this.$el.find('button[data-role="button"]').button();
      this.$el.find('input,textarea').textinput();
//      this.$el.page();
    },
    
    getHashInfo: function() {
      return _.clone(this._hashInfo);
    },
    
    isCacheable: function() {
      return true;
    },

    isPortrait: function() {
      return this.getOrientation() == 'portrait';
    },
    
    isLandscape: function() {
      return this.getOrientation() == 'landscape';
    },

    getTitle: function() {
      if (this.resource)
        return U.getDisplayName(this.resource);
      else if (this.collection)
        return this.collection.models[0] && U.getDisplayName(this.collection.models[0]);
      else
        return "Unknown";
    },
    
    isInViewport: function() {
      return this.el && U.isInViewport(this.el);
    },

    isAtLeastPartiallyInViewport: function() {
      return this.el && U.isAtLeastPartiallyInViewport(this.el);
    },

    logVisibility: function() {      
      var numVisible = 0,
          numPartiallyVisible = 0,
          numInvisible = 0;
      
      _.each(this.children, function(child) {
        child.logVisibility();
        var isVisible = child.isInViewport(),
            isPartiallyVisible = child.isAtLeastPartiallyInViewport();
        
        isVisible ? numVisible++ && numPartiallyVisible++ : numInvisible++;
        child.log('visibility', '"{0}" is {1}visible'.format(child.getTitle(), isVisible ? '' : 
                                                                                 isPartiallyVisible ? 'partially ' : 'in'));
      });
    },
  
    getPreviousHash: function() {
      return this.getPageView().source;
    },
    
    getOrientation: function() {
      return ($(window).height() > $(window).width()) ? 'portrait' : 'landscape';
    },

    navigate: function(fragment, options) {
      Events.trigger('navigate', fragment, options);
    },
    
    log: function() {
      if (G.DEBUG) {
        var args = _.toArray(arguments);
        args.unshift(this.TAG);
        G.log.apply(G, args);
      }
    },
   
    _subscribeToImageEvents: function() {
      if (this._subscribedToImageEvents)
        return;
      
      var self = this;
      this.onload(function() {
        if (!self.isChildless()) // let each view handle its own images
          return;

        self.getPageView().$el.on('scroll', self._showImages);
      });
      
      this._subscribedToImageEvents = true;
    },

    _unsubscribeFromImageEvents: function() {
      this.$el.off('scroll', this._showImages);
      this._subscribedToImageEvents = false;
    },

    _showImages: _.throttle(function() {
      if (!this._imgs || !this._imgs.length)
        this._imgs = getDummyImages(this.$el);
      
      if (!this._imgs.length)
        return;
      
      var imgs = this._imgs,
          last = imgs.length,
          current,
          allImagesDone = true;

      for (current = 0; current < last; current++) {
        var img = imgs[current];
        
        // if showIfVisible is false, it means we have some waiting images to be
        // shown
        if (img && !this._loadImage(img))
          allImagesDone = false;
        else
          this._imgs.splice(img, 1);
      }
  
      if (allImagesDone)
        this._unsubscribeFromImageEvents();

    }, 20),
    
    _loadImage: function(img) {
      this._subscribeToImageEvents();
      
      img = img.target || img;
      if (!img.getAttribute(lazyAttr))
        return true;
      
      var dataUrl = img.getAttribute('data-url');
      if (dataUrl)
        img.src = dataUrl;
      
      var inDoc = $.contains(document.documentElement, img),
          inBounds = img.getBoundingClientRect().top < WIN_HEIGHT + IMG_OFFSET;
      
      if (inDoc && inBounds) {
        // To avoid onload loop calls
        // removeAttribute on IE is not enough to prevent the event to fire
        this._fetchImage(img);
        return true;
      }
      else if (inDoc) {
        // wait till it's scrolled into the viewport
        return false; 
      }
      else {
        // should be here in a bit
        setTimeout(U.partialWith(this._loadImage, this, img), 100);
        return false;
      }
    },
    
    _fetchImage1: function(img) {
      img.src = img.getAttribute(lazyAttr);
      cleanImage(img);
    },
    
    _fetchImage: function(img) {
      var url = img.getAttribute(lazyAttr);
      cleanImage(img);
      
      U.getImage(url).done(function(dataUrl) {
        img.src = dataUrl;
        var data = img.dataset,
            prop = img.prop,
            res = img.resourceCid,
            res = res && C.getResourceByCid(res);
        
//        var $img = $(img),
//            propParent = $img.parents('[data-prop]'),
//            resParent = $img.parents('[data-resource]'),
            
        if (res && prop) {
          var data = parents[0].dataset,
              prop = data.prop,
              res = data.resource,
              atts = {};
          
          atts[prop + '.dataUrl'] = dataUrl;
          res.save(atts, {
            dbOnly: true,
            silent: true
          });
        }
      });
    }    
  }, {
    displayName: 'BasicView',
    _instanceCounter: 0
  });

  return BasicView; 
});