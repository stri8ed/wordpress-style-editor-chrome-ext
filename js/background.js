
// storage for modified stylesheets, indexed by tabId
var stylesheets = {};

// list of tabs with devtools open
var tabs = {};

/*
 * Handle requests from devtools.js or panel.js.
 */
function onRequest(req, sender, sendResponse) {
    if(req.type == 'updateStylesheet'){
        stylesheets[req.tabId] = { url: req.body.url, content: req.body.content };
    }
    else if(req.type == 'saveStylesheet'){
        saveStylesheet(req.tabId, sendResponse);
    }
    else if(req.type == 'onUrlChange'){
        tabs[req.tabId] = sendResponse;
    }
    else if(req.type == 'getCookies'){
        getCookies(req.tabId, sendResponse);
    }
    else if(req.type == 'log'){
        console.log(req.body);
    }
    return true;
}
chrome.runtime.onMessage.addListener(onRequest);

/*
 * Listen for events on our tabs. If URL changes,
 * notify the relevent devtools page.
 */
function onTabEvent(tabID, eventInfo){
    if(!tabs[tabID]) return;
    if(eventInfo.status == 'complete'){
        // url has changed
        delete stylesheets[tabID];
        try{
            tabs[tabID].call();
        }
        catch(e){
            // devtools is closed, cant notify of changes
            delete tabs[tabID];
        }
    }
    else if(eventInfo.windowId){
        // tab was closed
        delete stylesheets[tabID];
        delete tabs[tabID];
    }
}
chrome.tabs.onUpdated.addListener(onTabEvent);
chrome.tabs.onRemoved.addListener(onTabEvent);


/*
 * Execute JS script inside a tab.
 * 
 * If a callback is passed in, the script can utilize
 * the special 'extCallback' function to pass
 * async data back to the callback.
 * 
 */
function execScript(script, tabId, callback){

    if(typeof callback === 'function'){
        
        // random token for security
        var token = Math.round(Math.random()*10000000);
        
        // start listening for the async return
        var listener = function(request, sender, sendResponse){
            if(request.tabId == tabId && request.token == token) {
                callback(request.body);
                chrome.runtime.onMessage.removeListener(listener);
            }
        };
        chrome.runtime.onMessage.addListener(listener);
        
        // listen on window for the return message
        // from executed script
        var init = function(){
            window.addEventListener("message", function listener(event) {
                if (event.data.tabId == tabId && event.data.token == token) {
                    
                    // got data from script, pass it to background listener
                    chrome.runtime.sendMessage(event.data);

                    // Our job is done. Stop listening for messages.
                    window.removeEventListener("message", listener);
                }
            });
        };
        
        // pseudo callback functionality
        var extCallback = function(data){
            window.postMessage({ tabId: tabId, token: token, body: data }, "*");
        }
        
        // Prepend our callback functionality to the script
        init = compileFunction(init, { tabId: tabId, token: token, extCallback: extCallback });
        script = init + script;
    }
    
    chrome.tabs.executeScript(tabId, { code: script });
}

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

/*
 * Save modified Wordpress stylesheet.
 * 
 * We execute ajax saving logic inside the Wordpress tab,
 * this way all the cookies and header.origins are good to go.
 */
function saveStylesheet(tabId, callback){

    // if stylesheet has not been modified, dont bother
    if(!stylesheets[tabId]) return callback(true);
    
    var stylesheet = stylesheets[tabId];
    var regex = /\/themes\/(.*)\//;
    var baseUrl = stylesheet.url.split('/wp-content/')[0];
    var themeName = regex.exec(stylesheet.url)[1];
    var themeEditorUrl = baseUrl + '/wp-admin/theme-editor.php';
    
    var postBody = {
        action: 'update',
        _wpnonce: null,
        file: '', // theme-editor defaults to style.css
        theme: themeName,
        _wp_http_referer: themeEditorUrl,
        newcontent: stylesheet.content
    };
    
    var opts = {
        url: themeEditorUrl,
        data: null,
        type: 'POST'
    };
    
    // get wpnonce so we can authorize the stylesheet update
    getWpNonce(tabId, themeEditorUrl, function(nonce){
        if(nonce){
            
            // prepare data
            postBody._wpnonce = nonce;
            opts.data = serialize(postBody);
            
            // prepare function to exec in tab
            var func = function(){
                ajax(opts, function(res){
                    extCallback(res);
                });
            };
            
            func = compileFunction(func, {opts: opts});
            execScript(func, tabId, function(result){
                if(result && result.indexOf('File edited successfully') > -1 ){
                    callback(true);
                    delete stylesheets[tabId];
                }
                else {
                    callback(false);
                }
            });
        }
        else {
            callback(false);
        }
    });

}

/*
 * Get a wp_nonce that we can use to authorize
 * the POST request to theme-editor.php
 * 
 */
function getWpNonce(tabId, themeEditorUrl, callback){
    var func = function(){
        ajax({ type: 'GET', url: themeEditorUrl }, function(res){
            extCallback(res);
        });
    };
    func = compileFunction(func, { ajax: ajax, themeEditorUrl: themeEditorUrl } );
    
    execScript(func, tabId, function(res){
        if(!res) callback(null);
        // extract nonce from ajax response
        var regex = /id="_wpnonce".*?value="([^"]+)/;
        var nonce = regex.exec(res)[1] || null;
        callback(nonce);
    });
}

/*
 * Make an ajax request.
 */
function ajax(options, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open(options.type, options.url, true);
    xhr.setRequestHeader("Content-Type", 'application/x-www-form-urlencoded');
    
    xhr.onreadystatechange = function(event) {
        if (xhr.readyState == 4) {
            if (xhr.status === 200) {
                // success
                callback(xhr.responseText);
                
            } 
            else if(xhr.status === 0) {
                callback(0);
            }
        }
    };
    xhr.send(options.data);
}

/*
 * Generate an http query string from json object.
 */
function serialize(obj) {
  var str = [];
  for(var p in obj)
     str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
  return str.join("&");
}

/*
 * Convert a function into a self-executing string.
 * 
 * If dependencies are passed it, prepend them to the
 * function, so it has access to them upon execution.
 */
function compileFunction(func, depends){
    var result = '';
    depends = depends || {};
    
    // inject any dependencies
    Object.keys(depends).forEach(function(name){
        var val = depends[name];
        result += 'var ' + name + ' = ';
        
        // handle various types
        if(typeof val === 'string'){
            result += '"' + val + '"';
        }
        else if(typeof val === 'function'){
            result += val;
        }
        else if(typeof val === 'number'){
            result += val;
        }
        else if(typeof val === 'object'){
            result += JSON.stringify(val);
        }
        result += ';';
    });
    
    // finally append the function
    result += '(' + func.toString() + ')();';
    return result;
}