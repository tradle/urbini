//'use strict';
define([
  'globals',
  'templates',
  'events', 
  'utils',
  'error',
  'views/BasicView',
  'views/ResourceListView', 
  'views/Header', 
  'views/AddButton', 
  'views/BackButton', 
  'views/LoginButtons', 
  'views/AroundMeButton', 
  'views/MapItButton',
  'views/MenuButton'
], function(G, Templates, Events, U, Errors, BasicView, ResourceListView, Header, AddButton, BackButton, LoginButtons, AroundMeButton, MapItButton, MenuButton) {
  var MapView;
  return BasicView.extend({
    template: 'resource-list',
    clicked: false,
    initialize: function(options) {
      _.bindAll(this, 'render', 'home', 'submit', 'swipeleft', 'click', 'swiperight', 'pageshow', 'pageChanged', 'setMode');
      this.constructor.__super__.initialize.apply(this, arguments);
      Events.on('changePage', this.pageChanged);
      this.template = _.template(Templates.get(this.template));
      this.mode = options.mode || G.LISTMODES.DEFAULT;
      this.TAG = "ListPage";
      this.viewId = options.viewId;
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
      'pageshow': 'pageshow',
      'submit': 'submit'
    },
    swipeleft: function(e) {
      // open backlinks
    },
    swiperight: function(e) {
//      // open menu
//      var menuPanel = new MenuPanel({viewId: this.cid, model: this.model});
//      menuPanel.render();
////      G.Router.navigate('menu/' + U.encode(window.location.hash.slice(1)), {trigger: true, replace: false});
    },
    submit: function(e) {
//      Events.stopEvent(e);
//      var isEdit = (this.action === 'edit');
//      if (p && p.mode == G.LISTMODES.CHOOSER) {
      Events.stopEvent(e);
      var checked = $('input:checked');
      if (checked.length)
        Events.trigger('chooser', {model: this.model, checked: checked});
      else
        Errors.errDialog({msg: 'Choose first and then submit', delay: 100});
//      }
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
      var buyLink;
      var tryLink;
      if (!U.isA(this.vocModel, 'Buyable') || ((buyLink = $(e.target).closest($('#buyLink'))).length == 0  &&  (tryLink = $(e.target).closest($('#tryLink'))).length == 0)) {
//        Events.defaultClickHandler(e);
        return true;
      }

      Events.stopEvent(e);
      
      var uri = buyLink.length ? $(buyLink[0]).attr('href') :  $(tryLink[0]).attr('href');
      var models = this.model.models;
      var res = $.grep(models, function(item) {
        return item.getUri() == uri;
      })[0];
      if (!buyLink.length) {
        Events.trigger('chooser', {model: res, buy: true});
        return;
      }
      var newRes = new G.typeToModel[this.vocModel.type]();
      var p = U.getCloneOf(this.vocModel, 'Buyable.template');
      var props = {};
      props[p[0]] = uri;
      newRes.save(props, {
        success: function(resource, response, options) {
          if (response.error) {
            onSaveError(resource, response, options);
            return;
          }
          
          res.lastFetchOrigin = null;
          self.redirect(res, {trigger: true, replace: true, forceRefresh: true, removeFromView: true});
        }
        
      });

    },
    
    render:function (eventName) {
      G.log(this.TAG, 'render');  
      var rl = this.collection;
      
      var json = rl.toJSON();
      json.viewId = this.cid;
      var vocModel = this.vocModel;
      var viewMode = vocModel.viewMode;
      var isList = this.isList = (typeof viewMode != 'undefined'  &&  viewMode == 'List');
      var isChooser = window.location.hash  &&  window.location.hash.indexOf('#chooser/') == 0;  
      var isMasonry = this.isMasonry = !isChooser  &&  (vocModel.type.endsWith('/Theme') || vocModel.type.endsWith('/App') || vocModel.type.endsWith('/Goal') || vocModel.type.endsWith('/ThirtyDayTrial')); //  ||  vocModel.type.endsWith('/Vote'); //!isList  &&  U.isMasonry(vocModel); 
      _.extend(json, {isMasonry: isMasonry});  
      this.$el.html(this.template(json));
      
      var isGeo = (rl.isOneOf(["Locatable", "Shape"])) && _.any(rl.models, function(m) {return !_.isUndefined(m.get('latitude')) || !_.isUndefined(m.get('shapeJson'))});
      var hash = window.location.hash;
      var idx;
      var isChooser = window.location.hash  &&  window.location.hash.indexOf('#chooser/') == 0;
      var showAddButton = !isChooser  &&  vocModel.type.endsWith('/App'); 
      if (!showAddButton && hash  &&  (idx = hash.indexOf('?')) != -1) {
        var s = hash.substring(idx + 1).split('&');
        if (s && s.length > 0) {
          for (var i=0; i<s.length; i++) {
            var p = s[i].split('=');
            var prop = vocModel.properties[p[0]];
            if (!prop  ||  !prop.containerMember) 
              continue;
            var type = U.getLongUri1(prop.range);
            var cM = G.typeToModel[type];
            if (!cM) 
              continue;
            var blProps = U.getPropertiesWith(cM.properties, 'backLink');
            var bl = [];
            for (var p in blProps) {
              var b = blProps[p];
              if (!b.readOnly  &&  U.getLongUri1(b.range) == vocModel.type)
                bl.push(b);
            }
            if (bl.length > 0)
              showAddButton = true;
          }
        }
      }
        
      this.buttons = {
        left: [BackButton], // , LoginButtons
//        right: isGeo ? (showAddButton ? [AddButton, MapItButton, AroundMeButton, MenuButton] : [MapItButton, AroundMeButton, MenuButton] ) 
//                     : (showAddButton ? [AddButton, MenuButton] : [MenuButton]),
        right: isGeo ? (showAddButton ? [AddButton, MapItButton, AroundMeButton, MenuButton] : [AroundMeButton, MapItButton, MenuButton] ) 
            : (showAddButton ? [AddButton, MenuButton] : [MenuButton]),
        log: [LoginButtons]    
      };
      
      this.header = new Header({
        model: rl, 
        buttons: this.buttons,
        viewId: this.cid,
        el: $('#headerDiv', this.el)
      }).render();
  
      var models = rl.models;
      var isModification = U.isAssignableFrom(vocModel, 'Modification');

//      var meta = models[0].__proto__.constructor.properties;
//      meta = meta || models[0].properties;
      var meta = vocModel.properties;

//      var isMasonry = this.isMasonry = !isList && U.isA(vocModel, 'ImageResource')  &&  (U.getCloneOf(vocModel, 'ImageResource.mediumImage').length > 0 || U.getCloneOf(vocModel, 'ImageResource.bigMediumImage').length > 0  ||  U.getCloneOf(meta, 'ImageResource.bigImage').length > 0);
//      if (isMasonry) {
//        var key = this.vocModel.shortName + '-list-item';
//        var litemplate = U.getTypeTemplate('list-item', rl);
//        if (litemplate)
//          isMasonry = false;
//      }
      
      var isComment = this.isComment = !isModification  &&  !isMasonry &&  U.isAssignableFrom(vocModel, 'Comment');
      var isMV = window.location.hash  &&  window.location.hash.indexOf('$multiValue=') != -1;
//      var isModification = type.indexOf(cmpStr) == type.length - cmpStr.length;
      var containerTag = isMV ? '#mvChooser' : (isModification || isMasonry ? '#nabs_grid' : (isComment) ? '#comments' : '#sidebar');
      this.listView = new ResourceListView({el: $(containerTag, this.el), model: rl, mode: this.mode});
      this.listView.render();
      if (isGeo) {
        var self = this;
        G.require(['views/MapView'], function(MV) {
          MapView = MV;
          self.mapView = new MapView({model: rl, el: self.$('#mapHolder', self.el)});
          self.mapView.render();
        });
      }
      
      if (!this.$el.parentNode)  
        $('body').append(this.$el);
      if (!isMV)
        $('form#mv').hide();

      this.rendered = true;
      return this;
    }
  }, {
    displayName: 'ListPage'
  });
});
