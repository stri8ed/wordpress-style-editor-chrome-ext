var wpNonce = null;

function init(tabId){
    // establish connection with background page
    var port = chrome.runtime.connect({ name: 'contentscript:' + tabId });
    port.onMessage.addListener(function(msg){
        if(msg.type == 'saveStylesheet'){
            var response = { 
                requestId: msg.requestId,
                status: 1
            };
            saveStylesheet(msg.body).then(function(){
                 port.postMessage(response);
            }, function(err) {
                response.status = 0;
                response.errorMessage = err;
                port.postMessage(response);
            });
        }
    });
}

/*
 * Get a wp_nonce that we can use to authorize
 * the POST request to theme-editor.php
 */
function getWpNonce(themeEditorUrl){
    if(wpNonce) {
        return Promise.resolve(wpNonce);
    }
    return ajax({ type: 'GET', url: themeEditorUrl }).then(function(ajaxResult){
        return new Promise(function(res, rej) {
            // extract nonce from ajax response
            var regex = /id="_wpnonce".*?value="([^"]+)/;
            var nonce = regex.exec(ajaxResult);
            if(nonce) {
                res(nonce[1]);
                cacheNonce(nonce[1]);
            } else {
                rej("Failed to acquire Wordpress nonce.");
            }
        });
    });
}

/**
 * Cache Wordpress nonce. A nonce by default expires in 
 * 24 hours, but this can be reduced, so better to be safe
 * and expire sooner.
 */
function cacheNonce(val) {
    var expireTime = 1000 * 30 * 60;
    wpNonce = val;
    setTimeout(function() {
        wpNonce = null;
    }, expireTime);
}

/*
 * Make an ajax request.
 */
function ajax(options) {
    return new Promise(function(res, rej) {
        var xhr = new XMLHttpRequest();
        xhr.open(options.type, options.url, true);

        if(options.type.toLowerCase() === 'post') {
            xhr.setRequestHeader("Content-Type", 'application/x-www-form-urlencoded');
        }

        xhr.onreadystatechange = function(event) {
            if (xhr.readyState == 4) {
                if (xhr.status >= 200 && xhr.status <= 304) {
                    res(xhr.responseText);
                } 
                else {
                    rej("Request failed. HTTP status code: " + xhr.status);
                }
            }
        };
        xhr.send(options.data);
    });
}

function saveStylesheet(stylesheet, callback){
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
    
    return getWpNonce(themeEditorUrl).then(function(nonce) {
        // prepare data
        postBody._wpnonce = nonce;
        opts.data = serialize(postBody);
        return ajax(opts);
    });
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