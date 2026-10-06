(function(){
  if(window.__hybridSupabaseRequestGuardInstalled)return;
  window.__hybridSupabaseRequestGuardInstalled=true;

  const nativeFetch=window.fetch.bind(window);
  const projectHost='mzgnhmeydhhpzgxlgudh.supabase.co';
  const windowMs=10000;
  const maxRequests=100;
  const cooldownMs=60000;
  const recent=[];
  let blockedUntil=0;
  let bannerShown=false;

  function protectedRequest(input){
    try{
      const raw=typeof input==='string'?input:input?.url;
      if(!raw)return false;
      const url=new URL(raw,location.href);
      if(url.hostname!==projectHost)return false;
      return url.pathname.startsWith('/rest/v1/')||url.pathname.startsWith('/functions/v1/');
    }catch(_e){return false}
  }

  function showBanner(){
    if(bannerShown)return;
    bannerShown=true;
    const render=()=>{
      if(document.getElementById('hybridRequestGuardBanner'))return;
      const el=document.createElement('div');
      el.id='hybridRequestGuardBanner';
      el.setAttribute('role','alert');
      el.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;padding:12px 14px;border-radius:12px;background:#7a271a;color:#fff;font:700 13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)';
      el.textContent='HybridOne stopped an unusually high number of data requests from this tab. Please reload the page if it does not recover within a minute.';
      document.body.appendChild(el);
      setTimeout(()=>el.remove(),65000);
    };
    if(document.body)render();else document.addEventListener('DOMContentLoaded',render,{once:true});
  }

  function blockedResponse(){
    return Promise.resolve(new Response(JSON.stringify({
      message:'HybridOne temporarily paused excessive Supabase requests from this browser tab.'
    }),{
      status:429,
      statusText:'Too Many Requests',
      headers:{'Content-Type':'application/json','Retry-After':'60'}
    }));
  }

  window.fetch=function(input,init){
    if(!protectedRequest(input))return nativeFetch(input,init);

    const now=Date.now();
    if(now<blockedUntil)return blockedResponse();

    while(recent.length&&recent[0]<=now-windowMs)recent.shift();
    recent.push(now);

    if(recent.length>maxRequests){
      blockedUntil=now+cooldownMs;
      recent.length=0;
      try{
        sessionStorage.setItem('hybrid-supabase-guard-tripped-at',new Date(now).toISOString());
      }catch(_e){}
      console.error('HybridOne Supabase request guard tripped: excessive request rate blocked for 60 seconds.');
      window.dispatchEvent(new CustomEvent('hybrid:supabase-request-guard',{detail:{blockedUntil}}));
      showBanner();
      return blockedResponse();
    }

    return nativeFetch(input,init);
  };
})();