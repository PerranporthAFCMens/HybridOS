(function(){
  if(window.__hybridStabilityLoaded)return;
  window.__hybridStabilityLoaded=true;

  var started=Date.now();
  var lastError=null;
  var recoveryShown=false;
  var navMask=null;
  var mobileViewport=window.matchMedia('(max-width:900px)');
  var mobileChromeColor='#0B1020';

  function syncMobileBrowserChrome(){
    if(!mobileViewport.matches)return;
    var meta=document.querySelector('meta[name="theme-color"]');
    if(!meta){
      meta=document.createElement('meta');
      meta.setAttribute('name','theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content',mobileChromeColor);
    document.documentElement.style.backgroundColor=mobileChromeColor;
    if(document.body)document.body.style.backgroundColor=mobileChromeColor;
  }

  /* iOS Safari tints its top/bottom bars grey while an overlay (menu, popup) is open and can leave them grey
     after it closes. When the last overlay closes, re-assert the page colour and re-create the theme-color tag. */
  var overlaySel='.account-modal.open,.modal:not(.hidden),body.mobile-nav-open,body.admin-mobile-open,body.staff-mobile-open,body.admin-frame-menu-open';
  var overlayWas=false,chromeTimer=null;
  function refreshChrome(){
    if(!mobileViewport.matches)return;
    var old=document.querySelector('meta[name="theme-color"]');
    if(old)old.parentNode.removeChild(old);
    syncMobileBrowserChrome();
  }
  function watchOverlays(){
    if(!window.MutationObserver||!document.body)return;
    new MutationObserver(function(){
      var now=!!document.querySelector(overlaySel);
      if(overlayWas&&!now){clearTimeout(chromeTimer);chromeTimer=setTimeout(refreshChrome,320)}
      overlayWas=now;
    }).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class','hidden']});
  }

  function beginNavigation(){
    syncMobileBrowserChrome();
    if(mobileViewport.matches)return;
    if(navMask)return;
    navMask=document.createElement('div');
    navMask.id='hybridNavigationMask';
    navMask.setAttribute('aria-hidden','true');
    navMask.innerHTML='<div class="hybrid-nav-mask-side"><div class="hybrid-nav-mask-brand">HYBRID<b>ONE</b></div><div class="hybrid-nav-mask-gym"></div><div class="hybrid-nav-mask-lines"><i></i><i></i><i></i><i></i><i></i></div></div><div class="hybrid-nav-mask-main"><div class="hybrid-nav-mask-bar"></div><div class="hybrid-nav-mask-card"></div><div class="hybrid-nav-mask-card short"></div></div>';
    document.body.appendChild(navMask);
    requestAnimationFrame(function(){navMask.classList.add('show')});
  }
  window.HybridNavigation={begin:beginNavigation};

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
    loading.innerHTML='<div style="max-width:560px;margin:40px auto;padding:22px;border:1px solid var(--hybrid-line);border-radius:16px;background:var(--hybrid-panel);box-shadow:none;font-family:var(--hybrid-font);color:var(--hybrid-ink)"><div style="font-size:12px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--hybrid-muted)">HybridOne</div><h2 style="margin:7px 0 8px;font-size:24px">This page did not finish loading</h2><p style="margin:0;color:var(--hybrid-muted);line-height:1.5">Please try again. Your saved data has not been changed.</p><div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:16px"><button id="hybridRetryBtn" style="border:0;border-radius:10px;padding:10px 14px;background:#0b1020;color:#fff;font:inherit;font-weight:500;border-radius:10px;padding:10px 14px;background:var(--hybrid-panel);color:var(--hybrid-ink);text-decoration:none;font-weight:500;color:var(--hybrid-muted);font-size:12px"><summary>Technical detail</summary><div style="margin-top:7px;overflow-wrap:anywhere">'+escapeHtml(reason||'Startup timed out')+'</div></details></div>';
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
    var el=document.createElement('div');el.id=id;el.textContent='You appear to be offline. Some HybridOne features may not update until your connection returns.';
    el.style.cssText='position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom) + 12px);z-index:9999;padding:10px 14px;border-radius:12px;background:#fffaeb;color:#854a0e;border:1px solid #fedf89;font:600 13px/1.4 Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 10px 30px rgba(16,24,40,.14)';
    document.body.appendChild(el);
  }
  window.addEventListener('online',connectionBanner);window.addEventListener('offline',connectionBanner);
  window.addEventListener('pageshow',syncMobileBrowserChrome);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)syncMobileBrowserChrome()});

  document.addEventListener('click',function(e){
    if(document.documentElement.classList.contains('admin-embedded'))return;
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;
    if(a.target&&a.target!=='_self'||a.hasAttribute('download'))return;
    try{
      var u=new URL(a.href,location.href);
      if(u.origin!==location.origin)return;
      if(u.pathname===location.pathname&&u.search===location.search)return;
      if(!/\.html$|\/$/.test(u.pathname))return;
      var adminFiles=['index.html','community.html','classes.html','class-setup.html','workout-builder.html','admin-access.html','admin-operations.html','resource-availability.html','gym-layout.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html','member-memberships.html'];
      var currentFile=location.pathname.split('/').pop()||'index.html';
      var targetFile=u.pathname.split('/').pop()||'index.html';
      if(adminFiles.indexOf(currentFile)!==-1&&adminFiles.indexOf(targetFile)!==-1)return;
      beginNavigation();
    }catch(_e){}
  },true);

  document.addEventListener('DOMContentLoaded',function(){
    watchOverlays();
    syncMobileBrowserChrome();
    requestAnimationFrame(syncMobileBrowserChrome);
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
