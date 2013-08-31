
var sendRequest = chrome.runtime.sendMessage.bind(chrome.runtime);
var tabId = chrome.devtools.inspectedWindow.tabId
var sidebarPane = null;
var resourceListener = null;

createSidebarPane(function(pane){
    sidebarPane = pane;
    (function init(){
        sendRequest({ type: 'onUrlChange', tabId: tabId }, function(){
            initSidebarPane();
            init();
        }); 
    })();
    initSidebarPane();
});

function initSidebarPane(){
    isWp(function(wpInfo){
        if(wpInfo){
            // tab is a Wordpress site
            sidebarPane.setPage("../html/panel.html#" + JSON.stringify(wpInfo));
            sidebarPane.setHeight("27ex");
            watchStylesheet();
        }
        else {
            sidebarPane.setHeight("15ex");
            sidebarPane.setPage("../html/invalid.html");
            unWatchStylesheet();
        }
    });
}

/*
 * create and display the sidebar pane
 */
function createSidebarPane(callback){
    chrome.devtools.panels.elements.createSidebarPane("Wordpress Style Editor", function(pane) {
      callback(pane);
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
        
        if(/.+?style\.css/.test(resource.url)){
            var request = { type: 'updateStylesheet', tabId: tabId, body: { url: resource.url, content: content } };
            sendRequest(request); 
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
        var regex = /wp-content(.+?style\.css)/;
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

 