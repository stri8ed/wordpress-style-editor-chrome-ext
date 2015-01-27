
localizeTexts();
// extract config info from url hash
var wpInfo = JSON.parse(document.location.hash.substr(1));
var tabId = wpInfo.tabId;
var loginMessage = getText("loginMessage").replace("#", wpInfo.adminUrl);
$('header').html( $('header').html() + ' <span>' + wpInfo.themeName + '</span>' );

function sendRequest(req, callback){
    req.tabId = tabId;
    chrome.runtime.sendMessage(req, callback);
}

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
                 showError(loginMessage);
                 
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
            showError(loginMessage);
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
    $('error').html("<b>" + getText('error') + ":</b> " + msg).show();
}

function localizeTexts() {
    var elms = document.querySelectorAll('[data-message]');
    for(var msg, el, i = 0, l = elms.length; i < l; i++) {
        el = elms[i];
        msg = chrome.i18n.getMessage(el.dataset.message);
        el.innerHTML = msg;
    }
}

/**
 * Get localized text.
 */
function getText(id) {
    return chrome.i18n.getMessage(id);
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





