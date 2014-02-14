var port = null;

function init(tabId){
    // establish connection with background page
    var port = chrome.runtime.connect({ name: 'contentscript:' + tabId });
    port.onMessage.addListener(function(msg){
        if(msg.type == 'saveStylesheet'){
            saveStylesheet(msg.body, function(result){
                port.postMessage({ requestId: msg.requestId, body: result });
            });
        }
    })
}

/*
 * Get a wp_nonce that we can use to authorize
 * the POST request to theme-editor.php
 * 
 */
function getWpNonce(themeEditorUrl, callback){
    ajax({ type: 'GET', url: themeEditorUrl }, function(res){
        if(!res){
            return callback(null);
        }
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
    
    // get wpnonce so we can authorize the stylesheet update
    getWpNonce(themeEditorUrl, function(nonce){
        if(nonce){
            
            // prepare data
            postBody._wpnonce = nonce;
            opts.data = serialize(postBody);

            ajax(opts, function(result){
                if(result && result.indexOf('File edited successfully') > -1 ){
                    callback(true);
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
 * Generate an http query string from json object.
 */
function serialize(obj) {
  var str = [];
  for(var p in obj)
     str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
  return str.join("&");
}