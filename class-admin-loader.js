(function(){
  if(!location.pathname.endsWith('/classes.html')) return;

  function ensureScript(src,marker){
    if(document.querySelector('script['+marker+']')) return;
    const s=document.createElement('script');
    s.src=src;
    s.defer=true;
    s.setAttribute(marker,'1');
    document.head.appendChild(s);
  }

  function init(){
    ensureScript('./class-admin-enhancements.js','data-class-admin-enhancements');
    ensureScript('./class-admin-live-refresh.js','data-class-admin-live-refresh');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();