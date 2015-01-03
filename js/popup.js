
var LOGIN_ERROR = 'You must be logged into Wordpress as admin. <a target="_blank" href="#">Login</a> and try again.';
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
                 showError( LOGIN_ERROR.replace('#', wpInfo.adminUrl) );
                 
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
                if(result.status == 1){
                    $('success').show();
                }
                else {
                    showError(result.errorMessage);
                }
            });
        } else {
            showError( LOGIN_ERROR.replace('#', wpInfo.adminUrl) );
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

function showError(msg) {
    $('error').html("<b>Error:</b> " + msg).show();
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





