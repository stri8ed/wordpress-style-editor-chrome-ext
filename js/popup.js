var tabId = null;

function sendRequest(req, callback){
    req.tabId = tabId;
    chrome.runtime.sendMessage(req, callback);
}

// extract config info from url hash
var wpInfo = JSON.parse(document.location.hash.substr(1));
tabId = wpInfo.tabId;
$('header').html( $('header').html() + '<span>' + wpInfo.themeName + '</span>' );

sendRequest({ type: 'isAutoSave'}, function(result){
   if(result){
       $('auto').elm.checked = true;
       toggleButton();
   } 
});

$('auto').click(function(e){ 
     if(this.checked){
         sendRequest({ type: 'isWpAdmin' }, function(result){
             if(result){
                 sendRequest({ type: 'setAutoSave', body: true });
                 toggleButton();
             } else {
                 $('auto').elm.checked = false;
                 $('error').html( $('error').html().replace('#', wpInfo.adminUrl) ).show();
                 
             }
         });
     } else {
         sendRequest({ type: 'setAutoSave', body: false });
         toggleButton();
     }     
});

$('save').click(function(){
    if(this.disabled){
        return;
    }
    // ensure user is Wordpress admin before attempting save
    sendRequest({ type: 'isWpAdmin' }, function(result){
        if(result){
            $('error').hide();
            $('success').hide();
            $('saving').show();
            
            sendRequest({type: 'saveStylesheet' }, function(result){
                $('saving').hide();
                if(result){
                    $('success').show();
                }
                else {
                    $('error').html("<b>Error:</b> Failed to save changes. Check your internet connection.").show();
                }
            });
        } else {
            $('error').html( $('error').html().replace('#', wpInfo.adminUrl) ).show();
        }
    });
});

function toggleButton(){
    var button = $('save').elm;
    if(button.className.indexOf('disabled') == -1){
        button.className += ' disabled';
        button.disabled = true;
    } else {
        button.className = button.className.replace('disabled', '');
        button.disabled = false;
    }
}

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
        },

        elm: el
    }
    
    return helper;
}





