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
/* Read de-duplication (speed). Identical read requests to the project database
   that are already in flight share one network call, and identity look-ups
   (who am I, which gyms) are reused for a few seconds, also across the admin
   shell and the pages inside it. Any write, RPC, function call or sign-in
   change clears the saved reads, so data is never shown stale after a change. */
(function(){
  if(window.__hybridReadDedupeInstalled)return;
  window.__hybridReadDedupeInstalled=true;
  const projectHost='mzgnhmeydhhpzgxlgudh.supabase.co';
  const ttlMs=15000;
  const ttlTables=new Set(['gym_members','gyms','profiles']);
  let store;
  try{
    let w=window;
    while(w.parent&&w.parent!==w&&w.parent.location.origin===location.origin)w=w.parent;
    w.__hybridReadStore=w.__hybridReadStore||{saved:new Map(),flight:new Map(),gen:0};
    store=w.__hybridReadStore;
  }catch(_e){store={saved:new Map(),flight:new Map(),gen:0}}
  const baseFetch=window.fetch.bind(window);

  function headerList(h){
    const out=[];
    if(!h)return out;
    if(typeof h.forEach==='function'&&!Array.isArray(h)){h.forEach((v,k)=>out.push([String(k).toLowerCase(),String(v)]))}
    else if(Array.isArray(h)){h.forEach(p=>out.push([String(p[0]).toLowerCase(),String(p[1])]))}
    else Object.keys(h).forEach(k=>out.push([k.toLowerCase(),String(h[k])]));
    return out.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  }
  function describe(input,init){
    if(typeof input!=='string')return null;
    let url;try{url=new URL(input,location.href)}catch(_e){return null}
    if(url.hostname!==projectHost)return null;
    const method=String((init&&init.method)||'GET').toUpperCase();
    const isRest=url.pathname.startsWith('/rest/v1/'),isUser=url.pathname==='/auth/v1/user';
    return{url,method,isRest,isUser};
  }
  function build(rec){
    return new Response([101,204,205,304].includes(rec.status)?null:rec.body,{status:rec.status,statusText:rec.statusText,headers:rec.headers});
  }

  window.fetch=function(input,init){
    const d=describe(input,init);
    if(!d)return baseFetch(input,init);
    if(d.method!=='GET'){
      store.saved.clear();store.flight.clear();store.gen++;
      return baseFetch(input,init);
    }
    if((!d.isRest&&!d.isUser)||(init&&init.signal))return baseFetch(input,init);
    const key=d.url.href+'|'+JSON.stringify(headerList(init&&init.headers));
    const table=d.isRest?d.url.pathname.split('/')[3]:'';
    const canSave=d.isUser||ttlTables.has(table);
    const now=Date.now();
    const hit=store.saved.get(key);
    if(hit&&now-hit.t<ttlMs)return Promise.resolve(build(hit.rec));
    if(hit)store.saved.delete(key);
    let flight=store.flight.get(key);
    if(!flight){
      const gen=store.gen;
      flight=baseFetch(input,init).then(async res=>{
        const rec={status:res.status,statusText:res.statusText,headers:[...res.headers.entries()],body:await res.text()};
        return rec;
      });
      store.flight.set(key,flight);
      const done=()=>{if(store.flight.get(key)===flight)store.flight.delete(key)};
      flight.then(rec=>{done();if(canSave&&rec.status===200&&gen===store.gen)store.saved.set(key,{t:Date.now(),rec})},done);
    }
    return flight.then(build);
  };
})();
