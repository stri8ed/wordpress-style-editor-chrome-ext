
// instances of tabs with devtools active, indexed by tabId.
// tab = { devtools: port, contentscript: port, stylesheet: {}, autoSave: false }
var tabs = {};

// callback functions mapped to requestsId's
var callbacks = {};

// listen for connections from devtools or contentscripts
chrome.runtime.onConnect.addListener(function(port) {
   var portInfo = port.name.split(':');
   var portType = portInfo[0];
   var tabId = parseInt(portInfo[1]);
   
   if(portType == 'devtools'){
       if(tabs[tabId]){
           tabs[tabId].devtools = port;
       } else {
            tabs[tabId] = { devtools: port };
       }  
       port.postMessage({ type: 'init' });
   } else if(portType == 'contentscript'){
       if(tabs[tabId]) {
           tabs[tabId].contentscript = port;
       }
   }
   port.onMessage.addListener(onMessage.bind(null, tabId, port));
});

// listen for requests from popups
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
      onMessage(msg.tabId, sendResponse, msg);
      return true;
});

function onMessage(tabId, port, msg) {
    var method = msg.type;
    if(method && api[method]){
        api[method](tabId, msg.body, port);
    } else if(msg.requestId){
       var id = msg.requestId;
       if(callbacks[id]){
            delete msg.requestId;
            callbacks[id](msg);
            delete callbacks[id];
        }
    }
}

/**
 * API exposed to extension components, via chrome.runtime.port.
 */
var api = {
    
    updateStylesheet: function(tabId, req, res){
        tabs[tabId].stylesheet = req;
        if(tabs[tabId].autoSave){
            api.saveStylesheet(tabId, null, function(result){
                if(result.status == 1){
                    tabs[tabId].stylesheet = null;
                } else {
                    tabs[tabId].autoSave = false;
                    chrome.pageAction.setIcon({ tabId: tabId, path: '/img/icon-error.png' });
                }
            });
        }
    },
    
    saveStylesheet: function(tabId, req, res){
        var tab = tabs[tabId];
        if(tab && tab.stylesheet){
            var requestId = Math.random();
            callbacks[requestId] = function(result){
                if(result.status == 1){
                    tab.stylesheet = null;
                }
                res(result);
            };
            tab.contentscript.postMessage({ 
                type: 'saveStylesheet', 
                body: tab.stylesheet, 
                requestId: requestId 
            });
        } else {
            res({ status: 1 }); // nothing to save
        }
    },
    
    initPage: function(tabId, req, res){
        if(tabs[tabId].contentscript){  
            return; // page is already initialized with contentscript and pageAction
        }
        req.tabId = tabId;
        var wpInfo = JSON.stringify(req); // pass info to popup via url hash
        chrome.pageAction.setPopup({ tabId: tabId, popup: '/html/popup.html#' + wpInfo })
        chrome.pageAction.show(tabId);
        chrome.tabs.executeScript(tabId, { file: '/js/contentscript.js' }, function(){
            chrome.tabs.executeScript(tabId, { code: 'init(' + tabId + ');' });
        });
    },
    
    isWpAdmin: function(tabId, req, res){
        getCookies(tabId, function(cookies){ 
            cookies.forEach(function(cookie){
               if(cookie.name.indexOf('wordpress_logged_in_') > -1) {
                   return res(true);
               }
            });
            res(false);
        });
    },
    
    setAutoSave: function(tabId, req, res){
        tabs[tabId].autoSave = req;
        if(req){
            animateActionIcon(tabId);
        }
    },
    
    isAutoSave: function(tabId, req, res){
        res(tabs[tabId].autoSave || false);
    },
    
    log: function(tabId, req, res){
        console.log('Log: ' + req);
    }
}

/*
 * Listen for events on our tabs. If URL changes,
 * notify the associated devtools page.
 */
function onTabEvent(tabID, eventInfo){
    if(!tabs[tabID]) return;
    if(eventInfo.status == 'complete'){
        // url has changed
        tabs[tabID].contentscript = null;
        tabs[tabID].stylesheet = null;
        tabs[tabID].autoSave = null;
        try{
            tabs[tabID].devtools.postMessage({ type: 'init' })
        }
        catch(e){
            // devtools is closed, cant notify of changes
            delete tabs[tabID];
        }
    }
    else if(eventInfo.windowId){
        // tab was closed
        delete tabs[tabID];
    }
}
chrome.tabs.onUpdated.addListener(onTabEvent);
chrome.tabs.onRemoved.addListener(onTabEvent);

/*
 * Retrieve cookies from a tab.
 */
function getCookies(tabId, callback){
    if(!callback) return;
    chrome.tabs.get(tabId, function(tab){
        chrome.cookies.getAll({"url": tab.url }, function (cookies){
            callback(cookies);
        });
    });
}

function animateActionIcon(tabId){
    var frames = ['frame1.png', 'frame2.png', 'frame3.png'];
    var index = 2;
    var direction = 1;
    var interval = setInterval(function(){
        if(!tabs[tabId] || !tabs[tabId].autoSave){
            return clearInterval(interval);
        }
        chrome.pageAction.setIcon({ tabId: tabId, path: '/img/frames/' + frames[index] });
        if(index == frames.length -1 || index == 0){
            direction = direction ? 0 : 1;
        }
        index = (direction == 1) ? index + 1 : index - 1;
    }, 300);
    chrome.pageAction.setIcon({ tabId: tabId, path: '/img/frames/' + frames[1] });
}
