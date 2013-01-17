define([
  'globals',
  'cache!jquery', 
  'cache!underscore', 
  'cache!backbone', 
  'cache!templates',
  'cache!events', 
  'cache!utils',
  'cache!vocManager',
  'cache!views/BasicView',
  'cache!views/ResourceListView', 
  'cache!views/Header', 
  'cache!views/AddButton', 
  'cache!views/BackButton', 
  'cache!views/LoginButtons', 
  'cache!views/AroundMeButton', 
  'cache!views/MapItButton',
  'cache!views/MenuButton'
], function(G, $, _, Backbone, Templates, Events, U, Voc, BasicView, ResourceListView, Header, AddButton, BackButton, LoginButtons, AroundMeButton, MapItButton, MenuButton) {
  var MapView;
  return BasicView.extend({
    template: 'resource-list',
    clicked: false,
    initialize: function(options) {
      _.bindAll(this, 'render','click', 'home', 'swipeleft', 'swiperight', 'pageshow', 'pageChanged', 'setMode');
      this.constructor.__super__.initialize.apply(this, arguments);
      Events.on('changePage', this.pageChanged);
      this.template = _.template(Templates.get(this.template));
      this.mode = options.mode || G.LISTMODES.DEFAULT;
      this.TAG = "ListPage";
    },
    setMode: function(mode) {
      if (!G.LISTMODES[mode])
        throw new Error('this view doesn\'t have a mode ' + mode);
      
      this.mode = mode;
      if (this.listView)
        this.listView.setMode(mode);
    },
    events: {
      'click': 'click',
      'click #nextPage': 'getNextPage',
      'click #homeBtn': 'home',
      'swiperight': 'swiperight',
      'swipeleft': 'swipeleft',
      'pageshow': 'pageshow'
    },
    swipeleft: function(e) {
      // open backlinks
    },
    swiperight: function(e) {
      // open menu
      G.Router.navigate('menu/' + U.encode(window.location.hash.slice(1)), {trigger: true, replace: false});
    },
    pageshow: function(e) {
      G.log(this.TAG, 'events', 'pageshow');
/*
*      if (this.isMasonry)
*        $('#nabs_grid', this.$el).masonry();
*/
    },
    pageChanged: function(view) {
      G.log(this.TAG, 'events', 'changePage');
      this.visible = (this == view || this.listView == view);
      this.listView && (this.listView.visible = this.visible);
    },
    home: function() {
      var here = window.location.href;
      window.location.href = here.slice(0, here.indexOf('#'));
      return this;
    },
    getNextPage: function() {
      if (!this.visible)
        return;
      
      this.listView && this.listView.getNextPage();
    },
  //  nextPage: function(e) {
  //    Events.trigger('nextPage', this.resource);    
  //  },
//    tap: Events.defaultTapHandler,
    click: function(e) {
      clicked = true;
      Events.defaultClickHandler(e);  
    },
    
    render:function (eventName) {
      G.log(this.TAG, 'render');  
      var rl = this.collection;
      this.$el.html(this.template(rl.toJSON()));
      
      var isGeo = (rl.isA("Locatable") || rl.isA("Shape")) && _.filter(rl.models, function(m) {return m.get('latitude') || m.get('shapeJson')}).length;
      var vocModel = this.vocModel;
      var hash = window.location.hash;
      var idx;
      var showAddButton;
      if (hash  &&  (idx = hash.indexOf('?')) != -1) {
        var s = hash.substring(idx + 1).split('&');
        if (s && s.length > 0) {
          for (var i=0; i<s.length; i++) {
            var p = s[i].split('=');
            var prop = vocModel.properties[p[0]];
            if (prop  &&  prop.containerMember  &&  U.isPropVisible(vocModel, prop)) {
              showAddButton = true;
            }
          }
        }
      }
        
      this.buttons = {
        left: [BackButton], // , LoginButtons
        right: isGeo ? (showAddButton ? [AddButton, MapItButton, AroundMeButton, MenuButton] : [MapItButton, AroundMeButton, MenuButton] ) 
                     : (showAddButton ? [AddButton, MenuButton] : [MenuButton]),
        log: [LoginButtons]    
      };
      
      this.header = new Header({
        model: rl, 
        buttons: this.buttons,
        el: $('#headerDiv', this.el)
      }).render();
  
      var models = rl.models;
      var isModification = U.isAssignableFrom(vocModel, 'Modification', Voc.typeToModel);

//      var meta = models[0].__proto__.constructor.properties;
//      meta = meta || models[0].properties;
      var meta = vocModel.properties;

      var viewMode = vocModel.viewMode;
      var isList = this.isList = (typeof viewMode != 'undefined'  &&  viewMode == 'List');
//      var isMasonry = this.isMasonry = !isList && U.isA(vocModel, 'ImageResource')  &&  (U.getCloneOf(meta, 'ImageResource.mediumImage').length > 0 || U.getCloneOf(meta, 'ImageResource.bigMediumImage').length > 0  ||  U.getCloneOf(meta, 'ImageResource.bigImage').length > 0);
      
      var isMasonry = false; //this.isMasonry = !isList  &&  U.isMasonry(vocModel);
      
      var isComment = this.isComment = !isModification  &&  !isMasonry &&  U.isAssignableFrom(vocModel, 'Comment', Voc.typeToModel);
//      var isModification = type.indexOf(cmpStr) == type.length - cmpStr.length;
      var containerTag = isModification ? '#nabs_grid' :  isMasonry ? '#columns' : (isComment) ? '#comments' : '#sidebar';
      this.listView = new ResourceListView({el: $(containerTag, this.el), model: rl, mode: this.mode});
      this.listView.render();
      if (isGeo) {
        var self = this;
        require(['cache!views/MapView'], function(MV) {
          MapView = MV;
          self.mapView = new MapView({model: rl, el: self.$('#mapHolder', self.el)});
          self.mapView.render();
        });
      }
      
      if (!this.$el.parentNode) 
        $('body').append(this.$el);

      if (isMasonry) {
        var self = this;
        this.$wall = $('#nabs_grid');
        this.$wall.imagesLoaded( function() { 
          self.$wall.masonry(); 
        });
      }
//      if (isMasonry) {
//        this.$el.on('pageshow',function(event, ui){
//          $('#nabs_grid').masonry();
//          ////          $(window).resize();
//        });
//      }
      
      this.rendered = true;
      return this;
    }
  }, {
    displayName: 'ListPage'
  });
});
