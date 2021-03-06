//'use strict';
define('views/LoginButton', [
  'globals',
  'underscore', 
  'utils',
  'views/BasicView',
  'events'
], function(G, _, U, BasicView, Events) {
  return BasicView.extend({
    loginTemplate: 'loginButtonTemplate',
//    logoutTemplate: 'logoutButtonTemplate',
//    popupTemplate: 'loginPopupTemplate',
    tagName: 'li',
    id: 'loginButton',
    events: {
      'click' : 'showPopup'
//        ,
//      'click #logout': 'logout'
    },
//    logout: function() {
////      var url = G.serverName + '/j_security_check?j_signout=true&returnUri=' + encodeURIComponent(G.serverName + '/' + G.pageRoot);
////      $.get(url, function() {
////          // may be current page is not public so go to home page (?)
////        window.location.hash = '';
////        window.location.reload();
////      });
//      Events.trigger('logout');
//    },
    initialize: function(options) {
      _.bindAll(this, 'render', 'showPopup'); //, 'logout');
      BasicView.prototype.initialize.apply(this, arguments);
//      this.popupTemplate = this.makeTemplate(this.popupTemplate);
//      this.makeTemplate(this.loginTemplate, 'loginTemplate');
//      this.logoutTemplate = this.makeTemplate(this.logoutTemplate);
      this.makeTemplate(this.loginTemplate, 'template', this.modelType); // = G.currentUser.guest ? this.loginTemplate : this.logoutTemplate;
      return this;
    },

    render: function(options) {
//      this.template = G.currentUser.guest ? this.loginTemplate : this.logoutTemplate;
//      this.makeTemplate('loginTemplate', 'template', this.vocModel.type); // = G.currentUser.guest ? this.loginTemplate : this.logoutTemplate;
      var method = options && options.append ? 'append' : 'html';
      var loginBtn = this.template();
//      if (_.isEmpty(G.socialNets)) {
//        this.$el[method](this.makeTemplate('logoutButtonTemplate')());
//        return this;
//      }
            
      this.$el[method](loginBtn);
      return this;
    },
    
    showPopup: function() {
      Events.trigger('req-login', {
        dismissible: true
      });
      
      return false;
//      var $popup = $('.ui-page-active #login_popup');
//      if ($popup.length == 0) {
//        $(document.body).append(this.popupTemplate({nets: G.socialNets}));
//        $popup = $('#login_popup');
//      }
//      $popup.trigger('create');
//      $popup.popup().popup("open");
//      return false; // prevents login button highlighting
    }

  },
  {
    displayName: 'LoginButton'
  });
});
