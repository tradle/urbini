    // cross-browser - getCurrentTarget
    /*
     * Cross-browser method of adding event handlers.
     * If useCapture is true - handler is registered for 'capture phase', otherwise for 'bubbling phase'.
     * Although IE6- does not support capture - so we always pass false.
     */
    function addEvent(obj, evType, fn, useCapture) {
      if (obj.getAttribute) {
	      var handler = obj.getAttribute('handler_' + evType);
	      if (handler && handler == fn) {
	        //alert("Error: duplicate " + evType + " event handler " + fn + " for " + obj.tagName + " with id " + obj.id);
	        return;
	      }
	      obj.setAttribute('handler_' + evType, fn);
	    }
      if (obj.addEventListener) { // NS
       obj.addEventListener(evType, fn, useCapture);
       return true;
      }
      else if (obj.attachEvent) { // IE
        var r = obj.attachEvent("on" + evType, fn);
        return r;
      }
      else {
        alert("You need to upgrade to a newer browser. Error: 'event handler could not be be added'");
      }
    }

    function removeEvent(obj, evType, fn, useCapture) {
      if (obj.removeEventListener) {
        obj.removeEventListener(evType, fn, useCapture);
        return true;
      }
      else if (obj.detachEvent) {
        var r = obj.detachEvent("on" + evType, fn);
        return r;
      }
      else {
        alert("You need to upgrade to a newer browser. Error: 'event handler could not be removed'");
      }
    }

    // returns true if the field was modified since the page load
    function wasFormFieldModified(elem) {
      var initialValue = getFormFieldInitialValue(elem);
      if (initialValue == null)
        return true; // assume it was modified if no info exists
      if (elem.value == initialValue) {
        //alert("not modified: elem.name: " + elem.name + ", initialValue: " + initialValue);
        return false;
      }
      else {
        //alert("modified: elem.name: " + elem.name + ", initialValue: " + initialValue);
        return true;
      }
    }
    // returns value of the field saved right after the page load (does not support multiple selections)
    function getFormFieldInitialValue(elem, attribute) {
      if (formInitialValues) {
        var formValues = formInitialValues[elem.form.name];
        if (formValues) {
          if (attribute)
            return formValues[elem.name + '.attributes.' + attribute];
          else
            return formValues[elem.name];
        }
      }
      return null;
    }

    //***** upon iframe loading inform the parent
    function onLoadPopup() {
      if (parent && parent.frameLoaded)
        parent.frameLoaded[window.name] = true;
    }

    //***** Add smartlistbox handlers
    function addHandlers() {
//      Packages.java.lang.System.out.println('onLoad 0: ' + new Date());
      if (window.parent != window) {
        onLoadPopup();
        return;
      }
//      Packages.java.lang.System.out.println('onLoad 1: ' + new Date());
      interceptLinkClicks();
//      Packages.java.lang.System.out.println('onLoad 2: ' + new Date());
      initListBoxes(null);
//      Packages.java.lang.System.out.println('onLoad 3: ' + new Date());
      uiFocus();
      addEventOnSchedule();
//      Packages.java.lang.System.out.println('onLoad 4: ' + new Date());
//      if (typeof searchHighlighting != 'undefined')
//        searchHighlighting();
//      if (typeof replaceAllTooltips != 'undefined')
//        replaceAllTooltips();
		// initialize the drag & drop engine.
		  DragEngine.initialize();
		  addSpellcheck();
		  dictionaryHandler.init();
		  Tooltip.init();
    }

    /*
    function resourceListEdit(div) {
      var elements;
      if (div)
        elements = div.getElementsByTagName('img');
      else
        elements = document.getElementsByTagName('img');
      llen = elements.length;
      for (var i=0;i<llen; i++) {
        var elem = elements[i];
        addBooleanToggle(elem);
      }
    }
    */

    var formInitialValues;

    /****************** launch JS on "DOM ready" ****************/
    var isIE   = (typeof ActiveXObject != 'undefined');
    var agent = navigator.userAgent;
    var isGecko  = (agent.indexOf("Gecko") != -1 && agent.indexOf("Safari") == -1);

    var versionindex = agent.indexOf("Opera") + 6;
    var ver = agent.substring(versionindex);
    var v = parseFloat(ver);
    var isOpera9 = (typeof opera != 'undefined') && (v >= 9);

    if (isIE)
      document.attachEvent('onactivate', addHandlers);
    else if (isOpera9 || isGecko)
      document.addEventListener("DOMContentLoaded", addHandlers, false);
    else if (/WebKit/i.test(agent)) { // sniff
      var _timer = setInterval(function() {
          if (/loaded|complete/.test(document.readyState)) {
              clearInterval(_timer);
              addHandlers(); // call the onload handler
          }
      }, 10);
    }
    else
      addEvent(window, 'load', addHandlers, false);
