var tabId = chrome.devtools.inspectedWindow.tabId;
var resourceListener = null;

var port = chrome.runtime.connect({ name: 'devtools:' + tabId });
port.onMessage.addListener(function(msg) {
    if(msg.type == 'init'){
        init();
    }
});

function init(){
    isWp(function(wpInfo){ 
        if(wpInfo){ 
            watchStylesheet();
            port.postMessage({ type: 'initPage', body: wpInfo });
        } else {
            unWatchStylesheet();
        }
    });
}

/*
 * Watch Wordpress style.css file for modifications.
 * 
 * @future add support for subdirectory css files (eg: theme/colors/red.css)
 * via a Wordpress plugin, since the default theme-editor.php wont edit subdirs
 * 
 * @future add revision history, which persists between sessions,
 * via localStorage wpUrl.fileName.time = stylesheet
 */
function watchStylesheet(){
    if(resourceListener) return;
    
    resourceListener = function(resource, content) {
        if (resource.type != "stylesheet") return;
        
        if(/wp-content\/themes\/.+?\/style\.css/.test(resource.url)){
            var request = { type: 'updateStylesheet', body: { url: resource.url, content: content } };
            port.postMessage(request); 
        }
    }
    chrome.devtools.inspectedWindow.onResourceContentCommitted.addListener(resourceListener);
}

/*
 * Stop watching stylesheet for modifications.
 */
function unWatchStylesheet(){
    if(resourceListener){
        chrome.devtools.inspectedWindow.onResourceContentCommitted.removeListener(resourceListener);
        resourceListener = null;
    }
}

/*
 * Determine if site is a Wordpress site.
 */
function isWp(callback){
    chrome.devtools.inspectedWindow.getResources(function(resources){
        var regex = /wp-content\/themes\/(.+?style\.css)/;
        var result = false;
        // look for wp-content style.css file
        for(var i = 0, resource; i < resources.length; i++){
           resource = resources[i];
           if(resource.type == "stylesheet") {
               if(regex.test(resource.url)){
                   
                   // return some basic info about the Wordpress site
                   result = {
                       adminUrl: resource.url.split('/wp-content/')[0] + '/wp-admin',
                       themeName: /themes\/([^\/]+)/.exec(resource.url)[1]
                   };
                   break;
               }
           }
        }
        callback(result);
    });   
}

 