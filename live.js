 /*
  Live.js - One script closer to Designing in the Browser
  Written for Handcraft.com by Martin Kool (@mrtnkl).

  Version 4.
  Recent change: Made stylesheet and mimetype checks case insensitive.

  http://livejs.com
  http://livejs.com/license (MIT)  
  @livejs

  Include live.js#css to monitor css changes only.
  Include live.js#js to monitor js changes only.
  Include live.js#html to monitor html changes only.
  Mix and match to monitor a preferred combination such as live.js#html,css  

  By default, just include live.js to monitor all css, js and html changes.
  
  Live.js can also be loaded as a bookmarklet. It is best to only use it for CSS then,
  as a page reload due to a change in html or css would not re-include the bookmarklet.
  To monitor CSS and be notified that it has loaded, include it as: live.js#css,notify
*/
(function () {

  var headers = { "Etag": 1, "Last-Modified": 1, "Content-Length": 1, "Content-Type": 1 },
      resources = {},
      pendingRequests = {},
      currentLinkElements = {},
      oldLinkElements = {},
      interval = 1000,
      loaded = false,
      active = { "html": 1, "css": 1, "js": 1 };

  var Live = {

    // performs a cycle per interval
    heartbeat: function () {      
      if (document.body) {        
        // make sure all resources are loaded on first activation
        if (!loaded) Live.loadresources();
        Live.checkForChanges();
      }
      setTimeout(Live.heartbeat, interval);
    },

    // loads all local css and js resources upon first activation
    loadresources: function () {

      // helper method to assert if a given url is local
      function isLocal(url) {
        var loc = document.location,
            reg = new RegExp("^\\.|^\/(?!\/)|^[\\w]((?!://).)*$|" + loc.protocol + "//" + loc.host);
        return url.match(reg);
      }

      // gather all resources
      var scripts = document.getElementsByTagName("script"),
          links = document.getElementsByTagName("link"),
          styles = document.getElementsByTagName("style"),
          uris = [];

      // track local js urls
      for (var i = 0; i < scripts.length; i++) {
        var script = scripts[i], src = script.getAttribute("src");
        if (src && isLocal(src) && ! src.match(/\blive.js/))
          uris.push(src);
        if (src && src.match(/\blive.js#/)) {
          for (var type in active)
            active[type] = src.match("[#,|]" + type) != null
          if (src.match("notify")) 
            alert("Live.js is loaded.");
        }
      }
      if (!active.js) uris = [];
      if (active.html) uris.push(document.location.href);

      // track local css urls
      for (var i = 0; i < links.length && active.css; i++) {
        var link = links[i], rel = link.getAttribute("rel"), href = link.getAttribute("href", 2);
        if (href && rel && rel.match(new RegExp("stylesheet", "i")) && isLocal(href)) {
          uris.push(href);
          link.xtype = 'link';
          currentLinkElements[href] = link;
        }
      }
      
      // track local prefixstyle
      if (window.PrefixFree)
      {
          for (var i = 0; i < styles.length && active.css; i++) {
            var link = styles[i], 
                href = link.getAttribute("data-href");
            if (href && isLocal(href)) {
                uris.push(href);
                // extra option
                link.xtype = 'prefixfree';
                link.base = href.replace(/[^\/]+$/, '');
                link.base_scheme = (/^[a-z]{3,10}:/.exec(link.base) || [''])[0];
                link.base_domain = (/^[a-z]{3,10}:\/\/[^\/]+/.exec(link.base) || [''])[0];
                link.base_query = /^([^?]*)\??/.exec(link.href)[1];
                currentLinkElements[href] = link;
            }
          }
      }
      

      // initialize the resources info
      for (var i = 0; i < uris.length; i++) {
        var url = uris[i];
        Live.getHead(url, function (url, info) {
          resources[url] = info;
        });
      }

      // add rule for morphing between old and new css files
      var head = document.getElementsByTagName("head")[0],
          style = document.createElement("style"),
          rule = "transition: all .3s ease-out;"
      css = [".livejs-loading * { ", rule, " -webkit-", rule, "-moz-", rule, "-o-", rule, "}"].join('');
      style.setAttribute("type", "text/css");
      head.appendChild(style);
      style.styleSheet ? style.styleSheet.cssText = css : style.appendChild(document.createTextNode(css));

      // yep
      loaded = true;
    },

    // check all tracking resources for changes
    checkForChanges: function () {
      for (var url in resources) {
        if (pendingRequests[url])
          continue;

        Live.getHead(url, function (url, newInfo) {
          var oldInfo = resources[url],
              hasChanged = false;
          resources[url] = newInfo;
          for (var header in oldInfo) {
            // do verification based on the header type
            var oldValue = oldInfo[header],
                newValue = newInfo[header],
                contentType = newInfo["Content-Type"];
            switch (header.toLowerCase()) {
              case "etag":
                if (!newValue) break;
                // fall through to default
              default:
                hasChanged = oldValue != newValue;
                break;
            }
            // if changed, act
            if (hasChanged) {
              Live.refreshResource(url, contentType);
              break;
            }
          }
        });
      }
    },

    refreshPrefixFree: function (elem, link, url, callback) {
        request = new XMLHttpRequest();
            request.open('GET', url, true);
            request.onreadystatechange = function()
            {
                if (this.readyState === 4)
                {
                    if (this.status >= 200 && this.status < 400)
                    {
                        var css = this.responseText;
                        css = css.replace(/url\(\s*?((?:"|')?)(.+?)\1\s*?\)/gi, function($0, quote, url) {
                            if(/^([a-z]{3,10}:|#)/i.test(url)) { // Absolute & or hash-relative
                                url = $0;
                            }
                            else if(/^\/\//.test(url)) { // Scheme-relative
                                // May contain sequences like /../ and /./ but those DO work
                                url = 'url("' + link.base_scheme + url + '")';
                            }
                            else if(/^\//.test(url)) { // Domain-relative
                                url = 'url("' + link.base_domain + url + '")';
                            }
                            else if(/^\?/.test(url)) { // Query-relative
                                url = 'url("' + link.base_query + url + '")';
                            }
                            else {
                                // Path-relative
                                url = 'url("' + link.base + url + '")';
                            }
                            return url;
                        });
                        
                        elem.innerHTML = PrefixFree.prefixCSS(css);
                        callback.call(this, elem, link, url);
                    }
                }
            };

            request.send();
            request = null;
    },
    
    // act upon a changed url of certain content type
    refreshResource: function (url, type) {
      switch (type.toLowerCase()) {
        // css files can be reloaded dynamically by replacing the link element                               
        case "text/css":
          var link = currentLinkElements[url];
          if (link.xtype == 'prefixfree')
          {
			var newLink = document.createElement("style");
			newLink.xtype = "prefixfree";
			newLink.base = link.base;
			newLink.base_scheme = link.base_scheme;
			newLink.base_domain = link.base_domain;
			newLink.base_query = link.base_query;
			Live.refreshPrefixFree(newLink, link, url, function(newLink, link, url){
			  var head = link.parentNode,
				next = link.nextSibling;
			  next ? head.insertBefore(newLink, next) : head.appendChild(newLink);
			  currentLinkElements[url] = newLink;
			  oldLinkElements[url] = link;

			  // schedule removal of the old link
			  Live.removeoldLinkElements();
			});
          }
          else
          {
              var html = document.body.parentNode,
                  head = link.parentNode,
                  next = link.nextSibling,
                  newLink = document.createElement("link");

              html.className = html.className.replace(/\s*livejs\-loading/gi, '') + ' livejs-loading';
              newLink.setAttribute("type", "text/css");
              newLink.setAttribute("rel", "stylesheet");
              newLink.setAttribute("href", url + "?now=" + new Date() * 1);
              next ? head.insertBefore(newLink, next) : head.appendChild(newLink);
              currentLinkElements[url] = newLink;
              oldLinkElements[url] = link;

              // schedule removal of the old link
              Live.removeoldLinkElements();
          }
          
          
          break;

        // check if an html resource is our current url, then reload                               
        case "text/html":
          if (url != document.location.href)
            return;

          // local javascript changes cause a reload as well
        case "text/javascript":
        case "application/javascript":
        case "application/x-javascript":
          document.location.reload();
      }
    },

    // removes the old stylesheet rules only once the new one has finished loading
    removeoldLinkElements: function () {
      var pending = 0;
      for (var url in oldLinkElements) {
        // if this sheet has any cssRules, delete the old link
        try {
          var link = currentLinkElements[url],
              oldLink = oldLinkElements[url];
          
          if (oldLink.xtype == 'prefixfree')              
          {
              oldLink.parentNode.removeChild(oldLink);
              delete oldLinkElements[url];
              setTimeout(function () {
                html.className = html.className.replace(/\s*livejs\-loading/gi, '');
              }, 100);
          }
          else
          {
              var html = document.body.parentNode,
                  sheet = link.sheet || link.styleSheet,
                  rules = sheet.rules || sheet.cssRules;
              if (rules.length >= 0) {
                oldLink.parentNode.removeChild(oldLink);
                delete oldLinkElements[url];
                setTimeout(function () {
                  html.className = html.className.replace(/\s*livejs\-loading/gi, '');
                }, 100);
              }
          }
          
        } catch (e) {
          pending++;
        }
        if (pending) setTimeout(Live.removeoldLinkElements, 50);
      }
    },

    // performs a HEAD request and passes the header info to the given callback
    getHead: function (url, callback) {
      pendingRequests[url] = true;
      var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XmlHttp");
      xhr.open("HEAD", url, true);
      xhr.onreadystatechange = function () {
        delete pendingRequests[url];
        if (xhr.readyState == 4 && xhr.status != 304) {
          xhr.getAllResponseHeaders();
          var info = {};
          for (var h in headers) {
            var value = xhr.getResponseHeader(h);
            // adjust the simple Etag variant to match on its significant part
            if (h.toLowerCase() == "etag" && value) value = value.replace(/^W\//, '');
            if (h.toLowerCase() == "content-type" && value) value = value.replace(/^(.*?);.*?$/i, "$1");
            info[h] = value;
          }
          callback(url, info);
        }
      }
      xhr.send();
    }
  };

  // start listening
  if (document.location.protocol != "file:") {
    if (!window.liveJsLoaded)
      Live.heartbeat();

    window.liveJsLoaded = true;
  }
  else if (window.console)
    console.log("Live.js doesn't support the file protocol. It needs http.");    
})();