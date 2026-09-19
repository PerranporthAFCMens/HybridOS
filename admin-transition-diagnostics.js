(function(){
  const KEY='hybrid-admin-transition-diag';
  const START='hybrid-admin-transition-start';
  const TARGET='hybrid-admin-transition-target';
  const q=new URLSearchParams(location.search);
  if(q.get('diag')==='1')sessionStorage.setItem(KEY,'1');
  if(q.get('diag')==='0'){sessionStorage.removeItem(KEY);sessionStorage.removeItem(START);sessionStorage.removeItem(TARGET);return}
  if(sessionStorage.getItem(KEY)!=='1')return;

  const navStart=performance.timeOrigin;
  const previousStart=Number(sessionStorage.getItem(START)||0);
  const previousTarget=sessionStorage.getItem(TARGET)||'';
  const metrics={
    tapToNav:previousStart?Math.max(0,Math.round(navStart-previousStart)):null,
    navStart:0,
    firstPaint:null,
    shellVisible:null,
    appReady:null
  };

  function elapsed(){return Math.round(performance.timeOrigin+performance.now()-navStart)}
  function visible(el){
    if(!el)return false;
    const s=getComputedStyle(el);
    return s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'&&!el.classList.contains('hidden');
  }
  function shellIsVisible(){
    const loading=document.getElementById('loading');
    const app=document.getElementById('app')||document.getElementById('appView');
    if(!app)return false;
    return !visible(loading)&&visible(app);
  }
  function ready(){
    return window.__hybridAppReady===true||shellIsVisible();
  }
  function row(label,value){
    return '<div style="display:flex;justify-content:space-between;gap:16px"><span>'+label+'</span><b>'+((value===null||value===undefined)?'…':value+' ms')+'</b></div>';
  }
  function render(){
    let box=document.getElementById('hybridAdminDiag');
    if(!box){
      box=document.createElement('div');
      box.id='hybridAdminDiag';
      box.style.cssText='position:fixed;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:2147483647;width:min(290px,calc(100vw - 20px));padding:12px 13px;border-radius:14px;background:rgba(11,16,32,.94);color:#fff;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:0 12px 36px rgba(0,0,0,.28);pointer-events:none';
      document.body.appendChild(box);
    }
    box.innerHTML='<div style="font-weight:900;margin-bottom:7px">ADMIN TRANSITION DIAG</div>'+
      '<div style="opacity:.7;margin-bottom:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+location.pathname.split('/').pop()+(location.hash||'')+'</div>'+
      row('tap → navigation',metrics.tapToNav)+
      row('navigation start',metrics.navStart)+
      row('first paint',metrics.firstPaint)+
      row('shell visible',metrics.shellVisible)+
      row('app ready',metrics.appReady)+
      (previousTarget?'<div style="opacity:.55;margin-top:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">from '+previousTarget+'</div>':'');
  }

  function capturePaint(){
    const paints=performance.getEntriesByType('paint');
    const fp=paints.find(x=>x.name==='first-contentful-paint')||paints.find(x=>x.name==='first-paint');
    if(fp&&metrics.firstPaint===null){metrics.firstPaint=Math.round(fp.startTime);render()}
  }

  function sample(){
    if(metrics.shellVisible===null&&shellIsVisible())metrics.shellVisible=elapsed();
    if(metrics.appReady===null&&ready())metrics.appReady=elapsed();
    capturePaint();
    render();
    if(metrics.firstPaint===null||metrics.shellVisible===null||metrics.appReady===null)requestAnimationFrame(sample);
  }

  try{
    const po=new PerformanceObserver(()=>capturePaint());
    po.observe({type:'paint',buffered:true});
  }catch(_e){}

  document.addEventListener('click',e=>{
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    const a=e.target.closest?.('a[href]');
    if(!a||a.target==='_blank'||a.hasAttribute('download'))return;
    try{
      const u=new URL(a.href,location.href);
      if(u.origin!==location.origin)return;
      const file=u.pathname.split('/').pop()||'index.html';
      if(!['index.html','community.html','classes.html','class-setup.html','workout-builder.html','admin-operations.html','resource-availability.html','gym-layout.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html','member-memberships.html'].includes(file))return;
      sessionStorage.setItem(START,String(Date.now()));
      sessionStorage.setItem(TARGET,location.pathname.split('/').pop()+(location.hash||''));
    }catch(_e){}
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{render();requestAnimationFrame(sample)},{once:true});
  else{render();requestAnimationFrame(sample)}
})();