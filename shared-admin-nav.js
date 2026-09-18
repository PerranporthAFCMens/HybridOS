(function(){
  const groups=[
    {key:'dashboard',label:'⌂ Dashboard',href:'./index.html'},
    {key:'community',label:'✦ Community',href:'./index.html#community'},
    {key:'classes-group',label:'▦ Classes',children:[
      {key:'classes',label:'Timetable',href:'./classes.html'},
      {key:'class-setup',label:'Class setup',href:'./class-setup.html'}
    ]},
    {key:'services-group',label:'◇ Services & resources',children:[
      {key:'resources',label:'Rooms & equipment',href:'./admin-operations.html#resources'},
      {key:'services',label:'Service dependencies',href:'./admin-operations.html#services'},
      {key:'resource-availability',label:'Resource availability',href:'./resource-availability.html'}
    ]},
    {key:'staff-group',label:'◈ Staff management',children:[
      {key:'staff',label:'Staff & working hours',href:'./admin-operations.html#staff'},
      {key:'staff-access',label:'Staff access',href:'./staff-permissions.html'}
    ]},
    {key:'members-group',label:'◉ Members',children:[
      {key:'members',label:'Members',href:'./index.html#members'},
      {key:'memberships',label:'Memberships',href:'./index.html#memberships'},
      {key:'member-view',label:'Member view',href:'./member-view-settings.html'},
      {key:'access',label:'Door access',href:'./access-settings.html'}
    ]},
    {key:'reporting',label:'▥ Reporting',href:'./reporting.html'}
  ];
  const adminPages=new Set(['index.html','classes.html','class-setup.html','admin-operations.html','resource-availability.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html']);

  function currentKey(){
    const p=location.pathname,h=location.hash.replace('#','');
    if(p.endsWith('/classes.html')) return 'classes';
    if(p.endsWith('/class-setup.html')) return 'class-setup';
    if(p.endsWith('/admin-operations.html')) return ['staff','resources','services'].includes(h)?h:'staff';
    if(p.endsWith('/resource-availability.html')) return 'resource-availability';
    if(p.endsWith('/staff-permissions.html')) return 'staff-access';
    if(p.endsWith('/access-settings.html')) return 'access';
    if(p.endsWith('/reporting.html')) return 'reporting';
    if(p.endsWith('/member-view-settings.html')) return 'member-view';
    if(p.endsWith('/index.html')||p.endsWith('/HybridOS/')||p.endsWith('/')){
      return ['memberships','members','community'].includes(h)?h:'dashboard';
    }
    return '';
  }

  function activeGroup(key){
    const g=groups.find(group=>group.key===key||group.children?.some(child=>child.key===key));
    return g?.key||'';
  }

  function style(){
    if(document.getElementById('shared-admin-nav-style')) return;
    const s=document.createElement('style');
    s.id='shared-admin-nav-style';
    s.textContent=`
      .nav .admin-nav-link,.nav .admin-nav-group{display:flex;width:100%;min-height:44px;border:0;background:transparent;color:#a9b2c2;padding:11px 12px;border-radius:12px;text-align:left;cursor:pointer;text-decoration:none;font:inherit;align-items:center;gap:8px}
      .nav .admin-nav-link:hover,.nav .admin-nav-link.active,.nav .admin-nav-group:hover,.nav .admin-nav-group.active{background:rgba(255,255,255,.09);color:#fff}
      .nav .admin-nav-group{justify-content:space-between;font-weight:750}
      .admin-nav-caret{font-size:11px;opacity:.7;transition:transform .16s ease}.admin-nav-section.open .admin-nav-caret{transform:rotate(90deg)}
      .admin-nav-children{display:none;margin:2px 0 6px 18px;padding-left:8px;border-left:1px solid rgba(255,255,255,.12);gap:2px}.admin-nav-section.open .admin-nav-children{display:grid}
      .nav .admin-nav-child{min-height:38px!important;padding:8px 10px!important;font-size:13px}
      .nav .admin-nav-child.active{background:rgba(255,255,255,.10)!important;color:#fff!important}
    `;
    document.head.appendChild(s);
  }

  function closeMobile(){document.body.classList.remove('admin-mobile-open');document.querySelector('.admin-mobile-menu-btn')?.setAttribute('aria-expanded','false')}
  function ensureMobileMenu(){
    if(document.querySelector('.admin-mobile-menu-btn'))return;
    const btn=document.createElement('button');btn.className='admin-mobile-menu-btn';btn.type='button';btn.setAttribute('aria-label','Open admin menu');btn.setAttribute('aria-expanded','false');btn.textContent='☰';
    const backdrop=document.createElement('div');backdrop.className='admin-mobile-backdrop';
    document.body.append(btn,backdrop);
    document.querySelectorAll('.side').forEach(side=>{if(!side.querySelector('.admin-mobile-menu-close')){const close=document.createElement('button');close.className='admin-mobile-menu-close';close.type='button';close.setAttribute('aria-label','Close admin menu');close.textContent='×';close.onclick=closeMobile;side.prepend(close)}});
    btn.onclick=()=>{const open=!document.body.classList.contains('admin-mobile-open');document.body.classList.toggle('admin-mobile-open',open);btn.setAttribute('aria-expanded',open?'true':'false')};
    backdrop.onclick=closeMobile;
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobile()});
  }

  function showDashboardPage(key){
    if(!(location.pathname.endsWith('/index.html')||location.pathname.endsWith('/HybridOS/')||location.pathname.endsWith('/'))) return false;
    if(!['dashboard','memberships','members','community'].includes(key)) return false;
    const target=document.getElementById(key);
    if(!target) return false;
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===key));
    history.replaceState(null,'',key==='dashboard'?'./index.html':'./index.html#'+key);
    refreshActive(key);closeMobile();window.scrollTo({top:0,behavior:'smooth'});
    return true;
  }

  function refreshActive(key=currentKey()){
    const group=activeGroup(key);
    document.querySelectorAll('.admin-nav-link').forEach(a=>a.classList.toggle('active',a.dataset.adminKey===key));
    document.querySelectorAll('.admin-nav-section').forEach(section=>{
      const isGroup=section.dataset.adminGroup===group;
      section.classList.toggle('open',isGroup||section.dataset.userOpen==='1');
      section.querySelector('.admin-nav-group')?.classList.toggle('active',isGroup);
    });
  }

  function prefetch(href){
    try{
      const u=new URL(href,location.href),file=u.pathname.split('/').pop()||'index.html';
      if(!adminPages.has(file)||u.origin!==location.origin)return;
      if(document.head.querySelector(`link[data-admin-prefetch="${file}"]`))return;
      const l=document.createElement('link');l.rel='prefetch';l.href=u.href;l.as='document';l.dataset.adminPrefetch=file;document.head.appendChild(l);
    }catch(_e){}
  }

  function itemHtml(item,active){
    return `<a class="admin-nav-link ${item.key===active?'active':''}" data-admin-key="${item.key}" href="${item.href}">${item.label}</a>`;
  }

  function render(){
    style();ensureMobileMenu();
    const active=currentKey(),activeParent=activeGroup(active);
    document.querySelectorAll('.side .nav').forEach(nav=>{
      nav.innerHTML=groups.map(group=>{
        if(!group.children)return itemHtml(group,active);
        const open=group.key===activeParent;
        return `<div class="admin-nav-section ${open?'open':''}" data-admin-group="${group.key}">
          <button class="admin-nav-group ${open?'active':''}" type="button" aria-expanded="${open?'true':'false}"><span>${group.label}</span><span class="admin-nav-caret">▶</span></button>
          <div class="admin-nav-children">${group.children.map(child=>itemHtml(child,active).replace('admin-nav-link','admin-nav-link admin-nav-child')).join('')}</div>
        </div>`;
      }).join('');

      nav.querySelectorAll('.admin-nav-group').forEach(btn=>btn.onclick=()=>{
        const section=btn.closest('.admin-nav-section'),open=!section.classList.contains('open');
        section.classList.toggle('open',open);section.dataset.userOpen=open?'1':'0';btn.setAttribute('aria-expanded',String(open));
      });

      nav.querySelectorAll('.admin-nav-link').forEach(a=>{
        a.addEventListener('pointerenter',()=>prefetch(a.href),{passive:true});
        a.addEventListener('touchstart',()=>prefetch(a.href),{passive:true});
        a.addEventListener('click',e=>{
          const key=a.dataset.adminKey;
          if(showDashboardPage(key)){e.preventDefault();return}
          closeMobile();
          try{
            const u=new URL(a.href,location.href);
            if(u.origin===location.origin&&adminPages.has(u.pathname.split('/').pop()||'index.html'))document.body.classList.add('admin-leaving');
          }catch(_e){}
        });
      });
    });
    if((location.pathname.endsWith('/index.html')||location.pathname.endsWith('/HybridOS/')||location.pathname.endsWith('/'))&&location.hash)showDashboardPage(currentKey());
    const hrefs=groups.flatMap(g=>g.children||[g]).map(i=>i.href).filter(Boolean);
    if('requestIdleCallback' in window)requestIdleCallback(()=>hrefs.forEach(prefetch),{timeout:1400});else setTimeout(()=>hrefs.forEach(prefetch),700);
  }

  window.addEventListener('hashchange',()=>refreshActive());
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})();