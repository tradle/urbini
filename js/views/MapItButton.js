define([
  'underscore', 
  'cache!backbone', 
  'cache!templates',
  'cache!events', 
  'cache!views/ToggleButton' 
], function(_, Backbone, Templates, Events, ToggleButton) {
  return ToggleButton.extend({
    btnId: 'mapIt',
    template: 'mapItButtonTemplate',
    events: {
      'click #mapIt': 'mapIt'
    },
    initialize: function(options) {
      _.bindAll(this, 'render', 'mapIt');
      this.template = _.template(Templates.get(this.template));
      return this;
    },
    mapIt: function(e) {
      this.active = !this.active;
      Events.trigger('mapIt', {active: this.active});
      this.resetStyle();
      return this;
    }
  });
});
