
chrome.devtools.inspectedWindow.eval('document.location.hostname', function(host){
    host = host.replace('www.', '');
    var info = document.getElementById('info');
    info.innerHTML = '<b>' + host + '</b> ' + info.innerHTML;
    info.style.opacity = 1;
});