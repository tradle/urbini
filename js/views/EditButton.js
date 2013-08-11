//'use strict';
define('views/EditButton', [
  'globals',
  'events',
  'views/BasicView'
], function(G, Events, BasicView) {
  return BasicView.extend({
    template: 'editButtonTemplate',
    events: {
      'vclick #edit': 'edit'
    },
    initialize: function(options) {
      _.bindAll(this, 'render', 'edit');
      this.constructor.__super__.initialize.apply(this, arguments);
      this.makeTemplate(this.template, 'template', this.vocModel.type);
      return this;
    },
    edit: function(e) {
      Events.stopEvent(e);
      var hash = window.location.hash.slice(1);
      this.router.navigate('edit/' + encodeURIComponent(this.resource.getUri()), {trigger: true});
      return this;
    },
    render: function(options) {
      if (!this.template)
        return this;
      
      if (typeof options !== 'undefined' && options.append)
        this.$el.append(this.template());
      else
        this.$el.html(this.template());
      
      this.$('a').button();
      return this;
    }
  });
});