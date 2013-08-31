
var sendRequest = chrome.runtime.sendMessage.bind(chrome.runtime);
var tabId = chrome.devtools.inspectedWindow.tabId;

// extract wordpress info from url hash
var wpInfo = JSON.parse(document.location.hash.substr(1));
$('subheader').html( $('subheader').html() + '<b>' + wpInfo.themeName + '</b>');

$('save').click(function(){

    // ensure user is Wordpress admin before attempting save
    isAdmin(function(result){
        if(result){
            $('error').hide();
            $('success').hide();
            $('saving').show();
            sendRequest({type: 'saveStylesheet', tabId: tabId }, function(result){
                $('saving').hide();
                if(result){
                    $('success').show();
                }
                else {
                    $('error').html("<b>Error:</b> Failed to save stylesheet. Check internet connection.").show();
                }
            });
        }
        else {
            $('error').html( $('error').html().replace('#', wpInfo.adminUrl) ).show();
        }
    });
    
});


/*
 * Basic dom helper.
 */
function $(id) {
    var el = document.getElementById(id);
    var helper = {
        
        hide: function(){
            el.style.display = 'none';
            el.style.opacity = 0;
            return this;
        },
        
        show: function(prop){
            el.style.display = prop ? prop : 'block';
            setTimeout(function(){ el.style.opacity = 1; }, 1);
            return this;
        },
        
        html: function(content){
            if(!content) return el.innerHTML;
            el.innerHTML = content;
            return this;
        },
        
        click: function(func){
            el.onclick = func;
            return this;
        }
    }
    
    return helper;
}

/*
 * Check if Wordpress is logged in as admin.
 */
function isAdmin(callback){
    var result = false;
    sendRequest({type: 'getCookies', tabId: tabId}, function(cookies){
        cookies.forEach(function(cookie){
           if(cookie.name.indexOf('wordpress_logged_in_') > -1) {
               result = true;
           }
        });
        callback(result);
    });
}


