define([
  'globals',
  'cache!jquery', 
  'cache!underscore', 
  'cache!events', 
  'cache!templates', 
  'cache!utils',
  'cache!views/BasicView',
  'cache!vocManager'
], function(G, $, _, Events, Templates, U, BasicView, Voc) {
  return BasicView.extend({
    TAG: 'ResourceListItemView',
    tagName:"li",
    isCommonTemplate: true,
    initialize: function(options) {
      _.bindAll(this, 'render', 'click', 'shoppingListHack'); // fixes loss of context for 'this' within methods
      this.constructor.__super__.initialize.apply(this, arguments);
      var key = this.vocModel.shortName + '-list-item';
      this.template = U.getTypeTemplate('list-item', this.resource);
      if (this.template) 
        this.isCommonTemplate = false;
      else {
        if (options.hasImages)
          this.template = _.template(Templates.get('listItemTemplate'));
        else
          this.template = _.template(Templates.get('listItemTemplateNoImage'));
      }
      // resourceListView will call render on this element
  //    this.model.on('change', this.render, this);
      this.parentView = options && options.parentView;
      return this;
    },
    events: {
      'click': 'click',
      'click .recipeShoppingList': 'shoppingListHack'
    },
    shoppingListHack: function(e) {
      Events.stopEvent(e);
      var self = this;
      var args = arguments;
      if (!Voc.shortNameToModel.RecipeShoppingList) {
        Voc.loadStoredModels({models: [G.defaultVocPath + 'commerce/urbien/RecipeShoppingList']});
        var allGood = Voc.fetchModels(null, { 
           success: function() {
             self.shoppingListHack.apply(self, args);
           },
           sync: true,
        });
        
        return;
      }
        
      var a = $(e.target).parent('a');
      var href = a.attr('href') || a.attr('link');
      var params = U.getQueryParams(href);
      var recipeShoppingList = new Voc.shortNameToModel.RecipeShoppingList();
      var props = {};
      var shoppingList = props[params.backLink] = U.getLongUri(params.on);
      var recipe = props.recipe = U.getLongUri(this.resource.get('recipe').value);
      recipeShoppingList.save(props, {
        success: function(model, response, options) {
          self.router.navigate(encodeURIComponent('commerce/urbien/ShoppingListItem') + '?shoppingList=' + encodeURIComponent(shoppingList), {trigger: true});
        }, 
        error: function(model, xhr, options) {
          G.log(self.TAG, 'error', 'couldn\'t create shopping list items');
        }
      });
    },
    click: function(e) {
      var p = this.parentView;
      if (p && p.mode == G.LISTMODES.CHOOSER) {
        Events.stopEvent(e);
        Events.trigger('chooser', this.model);
      }
    },
    render: function(event) {
      var m = this.resource;
      var meta = this.vocModel.properties;
      meta = meta || m.properties;
      if (!meta)
        return this;
      
      var json = this.resource.toJSON();
      var distance = this.resource.get('distance');
      if (typeof distance != 'undefined') {
        var meta = this.vocModel.properties;
        var prop = meta['distance'];
        var d = U.getCloneOf(meta, 'Distance.distance');
        if (d)
          json['distance'] = distance + ' mi';
      }
      if (!this.isCommonTemplate) {
        this.$el.html(this.template(json));
        return this;
      }
      var grid = U.getGridCols(m);
      var viewCols = '';
          
      if (grid) {
        for (var row in grid) {
          if (i == 0)
            i++;
          else
            viewCols += "<br/>";
          var pName = grid[row].propertyName;
          // show groupped gridCols properties in one line
          var prop = meta[pName];
          var pGr = prop.propertyGroupList;
          if (pGr) {
            var props = pGr.split(",");
            var first = true;
            for (var j = 0; j < props.length; j++) {
              var p = props[j].trim();
              if (!_.has(json, p)) //  || _.contains(gridCols, p))
                continue;
              
              var prop1 = meta[p];
              if (!prop1) {
                delete json[p];
                continue;
              }
                    
              if (p.charAt(0) == '_')
                continue;
              if (p == 'davDisplayName')
                continue;
              if (prop1['displayNameElm'])
                continue;
              if (!U.isPropVisible(m, prop1))
                continue;
    
              if (first) {
                first = false;
                viewCols += '<div data-theme="d" style="padding: 5px 0 5px 0;"><i><u>' + prop.displayName + '</u></i></div>';                
              }
              json[p] = U.makeProp(prop1, json[p]);
//              var v = json[p].value.replace(/(<([^>]+)>)/ig, '').trim();
              var range = prop1.range;
              var s = range.indexOf('/') != -1 ? json[p].displayName  ||  json[p] : json[p].value;
              var isDate = prop1.range == 'date';
              if (!prop1.skipLabelInGrid) 
                viewCols += '<div style="display:inline"><span class="label">' + prop1.displayName + ':</span><span style="font-weight:normal">' + s + '</span></div>';
              else
                viewCols += '<span style="font-weight:normal">' + s + '</span>';
              viewCols += '&#160;';
            }
            continue;
          }
          
          var range = meta[pName].range;
          var s = range.indexOf('/') != -1 ? json[pName].displayName  ||  json[pName] : grid[row].value;
          var isDate = meta[pName].range == 'date'; 
          if (!meta[pName].skipLabelInGrid) {
//            if (isDate)
//              viewCols += '<div style="float:right;clear: both;"><span class="label">' + row + ':</span><span style="font-weight:normal">' + s + '</span></div>';
//            else
              viewCols += '<div style="display:inline"><span class="label">' + row + ':</span><span style="font-weight:normal">' + s + '</span></div>';
          }
          else
            viewCols += '<span style="font-weight:normal">' + s + '</span>';
        }
      }
      var dn = U.getDisplayName(m);
      json['davDisplayName'] = dn;
      if (!viewCols.length) 
        viewCols = '<h3>' + dn + '</h3>';
      json['viewCols'] = viewCols;

      // fit image to rectangle 90px x 80px (1.125) 
      if (typeof json['originalWidth'] != 'undefined' &&
          typeof  json['originalHeight'] != 'undefined' ) {
        var dim = U.fitToFrame(90, 80, json['originalWidth'] / json['originalHeight'])
        json['top'] = dim.y;
        json['right'] = dim.w - dim.x;
        json['bottom'] = dim.h - dim.y;
        json['left'] = dim.x;
      }
      
      this.$el.html(this.template(json));
      return this;
    }
  });  
});
