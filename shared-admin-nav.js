(function(){
  const items=[
    {key:'dashboard',label:'⌂ Dashboard',href:'./index.html'},
    {key:'classes',label:'▦ Classes',href:'./classes.html'},
    {key:'class-setup',label:'⚙ Class setup',href:'./class-setup.html'},
    {key:'operations',label:'⚙ Staff & resources',href:'./admin-operations.html'},
    {key:'access',label:'🔑 Door access',href:'./access-settings.html'},
    {key:'reporting',label:'▥ Reporting',href:'./reporting.html'},
    {key:'memberships',label:'£ Memberships',href:'./index.html#memberships'},
    {key:'members',label:'◉ Members',href:'./index.html#members'},
    {key:'community',label:'✦ Community',href:'./index.html#community'},
    {key:'member-preview',label:'◎ Member preview',href:'./member-preview.html'}
  ];
  const adminPages=new Set(['index.html','classes.html','class-setup.html','admin-operations.html','access-settings.html','reporting.html']);

  function currentKey(){
    const p=location.pathname;
    if(p.endsWith('/classes.html')) return 'classes';
    if(p.endsWith('/class-setup.html')) return 'class-setup';
    if(p.endsWith('/admin-operations.html')) return 'operations';
    if(p.endsWith('/access-settings.html')) return 'access';
    if(p.endsWith('/reporting.html')) return 'reporting';
    if(p.endsWith('/member-preview.html')) return 'member-preview';
    if(p.endsWith('/index.html')||p.endsWith('/HybridOS/')||p.endsWith('/')){
      const h=location.hash.replace('#','');
      return ['memberships','members','community'].includes(h)?h:'dashboard';
    }
    return '';
  }

  function style(){
    if(document.getElementById('shared-admin-nav-style')) return;
    const s=document.createElement('style');
    s.id='shared-admin-nav-style';
    s.textContent=`
      .nav .admin-nav-link{display:block;width:100%;border:0;background:transparent;color:#a9b2c2;padding:12px;border-radius:12px;text-align:left;cursor:pointer;text-decoration:none;font:inherit}
      .nav .admin-nav-link:hover,.nav .admin-nav-link.active{background:rgba(255,255,255,.09);color:#fff}
    `;
    document.head.appendChild(s);
  }

  function showDashboardPage(key){
    if(!(location.pathname.endsWith('/index.html')||location.pathname.endsWith('/HybridOS/')||location.pathname.endsWith('/'))) return false;
    if(!['dashboard','memberships','members','community'].includes(key)) return false;
    const target=document.getElementById(key);
    if(!target) return false;
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===key));
    history.replaceState(null,'',key==='dashboard'?'./index.html':'./index.html#'+key);
    document.querySelectorAll('.admin-nav-link').forEach(a=>a.classList.toggle('active',a.dataset.adminKey===key));
    window.scrollTo({top:0,behavior:'smooth'});
    return true;
  }

  function prefetch(href){
    try{
      const u=new URL(href,location.href),file=u.pathname.split('/').pop()||'index.html';
      if(!adminPages.has(file)||u.origin!==location.origin)return;
      if(document.head.querySelector(`link[data-admin-prefetch="${file}"]`))return;
      const l=document.createElement('link');l.rel='prefetch';l.href=u.href;l.as='document';l.dataset.adminPrefetch=file;document.head.appendChild(l);
    }catch(_e){}
  }

  function render(){
    style();
    const active=currentKey();
    document.querySelectorAll('.side .nav').forEach(nav=>{
      nav.innerHTML=items.map(i=>`<a class="admin-nav-link ${i.key===active?'active':''}" data-admin-key="${i.key}" href="${i.href}">${i.label}</a>`).join('');
      nav.querySelectorAll('.admin-nav-link').forEach(a=>{
        a.addEventListener('pointerenter',()=>prefetch(a.href),{passive:true});
        a.addEventListener('touchstart',()=>prefetch(a.href),{passive:true});
        a.addEventListener('click',e=>{
          const key=a.dataset.adminKey;
          if(showDashboardPage(key)){e.preventDefault();return}
          try{
            const u=new URL(a.href,location.href);
            if(u.origin===location.origin && adminPages.has(u.pathname.split('/').pop()||'index.html')) document.body.classList.add('admin-leaving');
          }catch(_e){}
        });
      });
    });
    if((location.pathname.endsWith('/index.html')||location.pathname.endsWith('/HybridOS/')||location.pathname.endsWith('/')) && location.hash){
      showDashboardPage(currentKey());
    }
    if('requestIdleCallback' in window) requestIdleCallback(()=>items.forEach(i=>prefetch(i.href)),{timeout:1400});
    else setTimeout(()=>items.forEach(i=>prefetch(i.href)),700);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',render); else render();
})();