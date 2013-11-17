'use strict';
define('views/MasonryListView', [
  'globals',
  'utils',
  'events',
  'views/ResourceListView',
  'views/ResourceMasonryItemView',
  'collections/ResourceList',
  '@widgets',
  'jqueryImagesLoaded'
], function(G, U, Events, ResourceListView, ResourceMasonryItemView, ResourceList, $m) {
  var MASONRY_FN = 'masonry', // in case we decide to switch to Packery or some other plugin
      ITEM_SELECTOR = '.nab';
  
  return ResourceListView.extend({
    autoFinish: false, // we want to say we finished rendering after the masonry is done doing its magic, which may happen async
    type: 'masonry',
    _elementsPerPage: Math.round(window.innerWidth / 100 * window.innerHeight / 100) + 3,
    events: {
      'orientationchange': 'reloadMasonry',
      'refresh': 'refresh'
//        ,
//      'page_show': 'reloadMasonry'
    },
    
    windowEvents: {
      'resize': 'reloadMasonry',
      'orientationChange': 'reloadMasonry'
    },
    
    initialize: function(options) {
      var self = this;
      _.bindAll(this, 'reloadMasonry');
      ResourceListView.prototype.initialize.apply(this, arguments);
//      this.listenTo(Events, 'pageChange', function(prev, current) {
//        if (self.pageView == current && self.rendered) {
////          self.$el.imagesLoaded(function() {
//            self.masonry('reload');
////          });
//        }
//      });
    },
    
    _updateConstraints: function() {
      ResourceListView.prototype._updateConstraints.call(this);
      if (this._viewportDim) {
        if (G.browser.mobile && this._viewportDim < 500)
          this._elementsPerPage = 4;
        else
          this._elementsPerPage = 20;
      }
    },    

    masonry: function() {
      this.$el[MASONRY_FN].apply(this.$el, arguments);
      this.trigger('invalidateSize');
      this.pageView.trigger('invalidateSize');
    },
    
//    getListItems: function() {
//      return this.$(ITEM_SELECTOR);
//      return this.$el.children();
//    },

    getPageTag: function() {
      return 'div';
    },

    preinitializeItem: function(res) {
      return ResourceMasonryItemView.preinitialize({
        vocModel: this.vocModel,
        className: 'nab nabBoard',
        parentView: this
      });
    },
    
    renderItem: function(res, info) {
      var liView = this.addChild(new this._preinitializedItem({
        resource: res
      }));
      
      liView.render(this._itemRenderOptions);
      return liView;
    },
    
    reloadMasonry: function(e) {
      if (!this.rendered) 
        return;
      
      var ww = G.viewport.width;
      var brickW = (G.viewport.height > ww  &&  ww < 420) ? 272 : 205;
      var w = $(this.$el.find('.nab')).attr('width');
      if (!w) {
        w = $(this.$el.find('.nab')).css('width');
        if (w)
          w = w.substring(0, w.length - 2);
      }
      
      var imgP = U.getImageProperty(this.collection);
      if (imgP) {
        var prop = this.vocModel.properties[imgP];
        brickW = prop.imageWidth || prop.maxImageDimension;
      }
      if (w < brickW  ||  w > brickW + 20) 
        this.refresh({orientation: true});
      else 
        this.masonry('reload');
      this.centerMasonry(this);
    },
    
    postRender: function(info) {
      var self = this,
//          appended = info.appended,
          appended = info.pages,
          updated = info.updated;
      
      if (this.rendered) {
        if (appended.length || _.size(updated)) {
          this.$el.imagesLoaded(function() {
            if (appended.length) 
              self.masonry('appended', appended instanceof $ ? appended : $(appended));
            if (_.size(updated))
              self.masonry('reload');
            
            self.trigger('refreshed');
          });
        }
      }
      else {
        this.$el.imagesLoaded(function() {
          self.masonry({
            itemSelector: ITEM_SELECTOR
          });
   
          self.centerMasonry(self);
//          self.pageView.el.addEventListener('page_show', function reload() {
//            self.pageView.el.removeEventListener('page_show', reload);
//            self.reloadMasonry();
//          });
          self.finish();
        });
      }
    },
    
    centerMasonry: function(list) {
//      var l = _.filter(list.$el.find('.nab'), function(a) {
//          return $(a).css('top') == '0px';
//        }),
//        len = l.length;
//      
//      if (len) {
//        var w = $(l[0]).css('width');
//        w = w.substring(0, w.length - 2);
//        len = l.length * w;
////        len += l.length * 18;
//        var d = (($(window).width() - len) / 2) - 10;
//        var style = list.$el.attr('style'); 
//        var left = list.$el.css('left');
//        if (left)
//          list.$el.css('left', d + 'px');
//        else
//          list.$el.attr('style', style + 'left: ' + d + 'px;');
//      }
    }
  }, {
    displayName: "MasonryListView",
    _itemView: ResourceMasonryItemView
  });
});