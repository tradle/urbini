'use strict';
define('views/IntersectionListView', [
  'globals',
  'utils',
  'events',
  'views/ResourceListView',
  'views/IntersectionListItemView'
//  'views/mixins/Scrollable'
], function(G, U, Events, ResourceListView, IntersectionListItemView) {
  return ResourceListView.extend({
//    _renderedIntersectionUris: [],
    initialize: function(options) {
      ResourceListView.prototype.initialize.apply(this, arguments);
      _.extend(this, options);
    },
    
    doRenderItem: function(res, info) {
      var source = this.parentView.resource,
//          xUris = this._renderedIntersectionUris,
          html = '<div style="display:block">',
          liView,
          a,
          b;

      source = source && source.getUri();
      var liView = new this._preinitializedItem({
        resource: res
      });
      
      var rendered = liView.render({
        force: true,
        renderToHtml: true
      });
      
//      if (rendered === false)
//        return false;
//      
//      html += liView._html + '</div>';
      
      this.addChild(liView);
      return liView;
    },
    
    postRender: function() {
      if (!this._visible) {
        this._visible = true;
        this.el.$data('viewid', this.cid);
        this.el.classList.remove("hidden");
        this.el.$trigger("create");
      }
    }
  }, {
    displayName: "IntersectionListView",
    _itemView: IntersectionListItemView
  });
});