define([
  'globals',
  'underscore', 
  'backbone', 
  'utils',
  'error',
  'events'
], function(G, _, Backbone, U, Error, Events) {
  var willSave = function(res, prop, val) {
    var prev = res.get(prop);
    if (U.isNully(prev))
      return !U.isNully(val);
    else if (prev !== val && prev.toString() !== val)
      return true;
    
    return false;
  }

  var Resource = Backbone.Model.extend({
    idAttribute: "_uri",
    initialize: function(options) {
      _.bindAll(this, 'getKey', 'parse', 'url', 'validate', 'validateProperty', 'fetch', 'set', 'remove', 'onchange', 'onsync', 'cancel'); // fixes loss of context for 'this' within methods
      if (options && options._query)
        this.urlRoot += "?" + options._query;
      
      this.on('cancel', this.remove);
      this.on('change', this.onchange);
      this.on('sync', this.onsync);
      this.vocModel = this.constructor;
    },
    onsync: function() {
//      debugger;
    },
    cancel: function(options) {
      var props = this.vocModel.properties;
      var canceled = U.getCloneOf(this.vocModel, 'Cancellable.cancelled');
      if (!canceled.length)
        throw new Error("{0} can not be canceled because it does not have a 'canceled' property".format(U.getDisplayName(this)));
      
      canceled = canceled[0];
      var props = {};
      props[canceled] = true;
      var self = this;
//      this.save(props, options);
      var success = options.success;
      options.success = function(resource, response, options) {
        success && success.apply(this, arguments);
        if (!response.error)          
          self.trigger('cancel');
      }

      this.save(props, options);
    },
    onchange: function(e) {
      if (this.lastFetchOrigin !== 'server')
        return;
      
      Events.trigger('resourcesChanged', [this]);
    },
    remove: function() {
      this.collection && this.collection.remove(this);
    },
    url: function() {
      var uri = this.get('_uri');
      var type = this.vocModel.type;
//      type = type.startsWith(G.defaultVocPath) ? type.slice(G.defaultVocPath.length) : type;
      return G.apiUrl + encodeURIComponent(type) + "?$blCounts=y&$minify=y&_uri=" + U.encode(uri);
    },
    saveUrl: function(attrs) {
      var type = this.vocModel.type;
      var isNew = this.isNew();
      return G.apiUrl + (isNew ? 'm/' : 'e/') + encodeURIComponent(type) ;
    },
    getKey: function() {
      return U.getLongUri(this.get('_uri'));
    },
    getUri: function() {
      return this.get('_uri');
    },
    parse: function (resp) {
      if (this.loaded && this.lastFetchOrigin == 'db')
        return resp;
      
      if (!resp || resp.error)
        return null;

      var uri = resp._uri;
      if (!uri) {      
        resp = resp.data[0];
        uri = resp._uri;
      }
      resp._shortUri = U.getShortUri(uri, this.constructor);
      var primaryKeys = U.getPrimaryKeys(this.constructor);
      resp._uri = U.getLongUri(resp._uri, {type: this.constructor.type, primaryKeys: primaryKeys});
      this.loaded = true;
      return resp;
    },
    
    set: function(props, options) {
      var self = this;
      if (!options || !options.silent) {
        props = U.filterObj(props, function(name, val) {
          return willSave(self, name, val);
        })
        
        if (!_.size(props))
          return;
      }
      
      return Backbone.Model.prototype.set.apply(this, [props].concat(U.slice.call(arguments, 1)));
    },
    
    validate: function(attrs, options) {
      if (this.lastFetchOrigin !== 'edit')
        return;
      
      var errors = {};
      var props = options.validateAll ? this.constructor.properties : attrs;
      var values = attrs;
      for (var name in props) {
        var error = this.validateProperty(name, attrs[name]);
        if (error !== true)
          errors[name] = typeof error === 'string' ? error : "Please enter a valid " + name;
      }
      
      if (_.size(errors))
        return errors;
    },
    
    validateProperty: function(name, value) {
      var prop = this.constructor.properties[name];
      if (!prop || prop.readOnly || prop.backLink || prop.virtual || prop.propertyGroupList)
        return true;
      
      if (value == null || value === '') {
        if (prop.required) {
          if (!prop.writeJS && !prop.formulaJS && !prop.formula && !U.isCloneOf(prop, 'Submission.submittedBy'))
            return U.getPropDisplayName(prop) + ' is a required field';
        }
        else
          return true;
      }
      else if (value === this.get(name))
        return true;
      
      if (prop.range === 'enum')
        return true;
      
      var facet = prop.facet;
      if (facet) {
        if (facet.endsWith('emailAddress'))
          return U.validateEmail(value) || 'Please enter a valid email';
        else if (facet.toLowerCase().endsWith('phone'))
          return U.validatePhone(value) || 'Please enter a valid phone number';
        else { 
          var val = U.getTypedValue(this, name, value);
          if (val == null || val !== val) // test for NaN
            return 'Please enter a valid ' + U.getPropDisplayName(prop);
        }
      }
        
      var cloneOf = prop.cloneOf;
      if (cloneOf) {
        if (/^Address1?\.postalCode1?$/.test(cloneOf))
          return U.validateZip(value) || 'Please enter a valid Postal Code';
      }
      
      return true;
    },
    isA: function(interfaceName) {
      return U.isA(this.vocModel, interfaceName);
    },
    fetch: function(options) {
      var self = this;
      options = options || {};
      options.error = options.error || Error.getDefaultErrorHandler();
      options.url = this.url();
      return Backbone.Model.prototype.fetch.call(this, options);
    },
    
    save: function(attrs, options) {
      options = options || {};
      var data = U.flattenModelJson(options.data || attrs || this.resource.attributes, this.vocModel);
      if (!data.$returnMade)
        data.$returnMade = 'y';
      if (!this.isNew())
        data._uri = this.getUri();

      var self = this;
      options = _.extend({url: this.saveUrl(attrs), emulateHTTP: true, silent: true, patch: true}, options, {data: U.getQueryString(data)});
      
      var success = options.success;
      options.success = function(resource, response, opts) {
        success && success.apply(this, arguments);
        if (response.error)
          return;
        
        Events.trigger('resourcesChanged', [self]);
      };
      
//      var error = options.error;
//      options.error = function(reosurce, xhr, options) {
//        
//        error && error.apply(this, arguments);
//      }
      
      return Backbone.Model.prototype.save.call(this, attrs, options);
    }
  },
  {
    type: "http://www.w3.org/TR/1999/PR-rdf-schema-19990303#Resource",
    shortName: "Resource",
    displayName: "Resource",
    myProperties: {
      davDisplayName: {type: "string"},
      _uri: {type: "resource"},
      _shortUri: {type: "resource"}
    },
    myInterfaces : {}
  }, {
    displayName: 'Resource'
  });
  
  Resource.properties = _.clone(Resource.myProperties);
  Resource.interfaces = _.clone(Resource.myInterfaces);  
  return Resource;
});
