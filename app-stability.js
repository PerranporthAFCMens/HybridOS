(function(){
  if(window.__hybridStabilityLoaded)return;
  window.__hybridStabilityLoaded=true;

  var started=Date.now();
  var lastError=null;
  var recoveryShown=false;

  function byId(id){return document.getElementById(id)}
  function loadingStillVisible(){
    var loading=byId('loading'),app=byId('app');
    if(!loading)return false;
    var ls=getComputedStyle(loading),as=app?getComputedStyle(app):null;
    var loadingVisible=ls.display!=='none'&&!loading.classList.contains('hidden');
    var appHidden=!app||(as&&as.display==='none')||app.classList.contains('hidden');
    return loadingVisible&&appHidden;
  }
  function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]})}
  function retry(){
    var u=new URL(location.href);u.searchParams.set('_retry',Date.now());location.replace(u.toString());
  }
  function showRecovery(reason){
    if(recoveryShown||!loadingStillVisible())return;
    recoveryShown=true;
    var loading=byId('loading');if(!loading)return;
    loading.innerHTML='<div style="max-width:560px;margin:40px auto;padding:22px;border:1px solid #e7ebf2;border-radius:20px;background:#fff;box-shadow:0 14px 34px rgba(16,24,40,.08);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#101828"><div style="font-size:12px;font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:#7a8494">Hybrid OS</div><h2 style="margin:7px 0 8px;font-size:24px">This page did not finish loading</h2><p style="margin:0;color:#667085;line-height:1.5">Please try again. Your saved data has not been changed.</p><div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:16px"><button id="hybridRetryBtn" style="border:0;border-radius:12px;padding:10px 14px;background:#0b1020;color:#fff;font:inherit;font-weight:800">Try again</button><a href="./index.html" style="border:1px solid #e7ebf2;border-radius:12px;padding:10px 14px;background:#fff;color:#101828;text-decoration:none;font-weight:800">Back to Hybrid OS</a></div><details style="margin-top:14px;color:#98a2b3;font-size:12px"><summary>Technical detail</summary><div style="margin-top:7px;overflow-wrap:anywhere">'+escapeHtml(reason||'Startup timed out')+'</div></details></div>';
    var b=byId('hybridRetryBtn');if(b)b.onclick=retry;
  }
  function markReady(){
    if(!loadingStillVisible())window.__hybridAppReady=true;
  }
  function errorReason(evt){
    if(evt&&evt.reason){return evt.reason.message||String(evt.reason)}
    if(evt&&evt.error){return evt.error.message||String(evt.error)}
    return evt&&evt.message||'Unexpected startup error';
  }
  function recordError(evt){
    lastError=errorReason(evt);
    setTimeout(function(){if(loadingStillVisible())showRecovery(lastError)},1200);
  }
  window.addEventListener('error',recordError);
  window.addEventListener('unhandledrejection',recordError);

  function connectionBanner(){
    var id='hybridConnectionBanner',old=byId(id);
    if(navigator.onLine){if(old)old.remove();return}
    if(old)return;
    var el=document.createElement('div');el.id=id;el.textContent='You appear to be offline. Some Hybrid OS features may not update until your connection returns.';
    el.style.cssText='position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom) + 12px);z-index:9999;padding:10px 14px;border-radius:12px;background:#fffaeb;color:#854a0e;border:1px solid #fedf89;font:600 13px/1.4 Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 10px 30px rgba(16,24,40,.14)';
    document.body.appendChild(el);
  }
  window.addEventListener('online',connectionBanner);window.addEventListener('offline',connectionBanner);

  document.addEventListener('DOMContentLoaded',function(){
    connectionBanner();
    var obs=new MutationObserver(markReady),loading=byId('loading'),app=byId('app');
    if(loading)obs.observe(loading,{attributes:true,attributeFilter:['class','style']});
    if(app)obs.observe(app,{attributes:true,attributeFilter:['class','style']});
    setTimeout(function(){
      markReady();
      if(loadingStillVisible())showRecovery(lastError||('Startup exceeded '+Math.round((Date.now()-started)/1000)+' seconds'));
      obs.disconnect();
    },10000);
  });
})();
