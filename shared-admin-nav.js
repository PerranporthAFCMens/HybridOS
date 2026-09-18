(function(){
  const sidebar=[
    {key:'dashboard',label:'Dashboard',icon:'dashboard',href:'./index.html'},
    {key:'community-group',label:'Community',icon:'community',href:'./community.html'},
    {key:'classes-group',label:'Classes',icon:'classes',href:'./classes.html'},
    {key:'services-group',label:'Services & resources',icon:'services',href:'./admin-operations.html#resources'},
    {key:'staff-group',label:'Staff management',icon:'staff',href:'./admin-operations.html#staff'},
    {key:'members-group',label:'Members',icon:'members',href:'./index.html#members'},
    {key:'reporting',label:'Reporting',icon:'reporting',href:'./reporting.html'}
  ];

  const contextTabs={
    'community-group':[
      {key:'community-social',label:'Social feed',href:'./community.html'},
      {key:'community',label:'Channels',href:'./index.html#community'}
    ],
    'classes-group':[
      {key:'classes',label:'Timetable',href:'./classes.html'},
      {key:'class-setup',label:'Class setup',href:'./class-setup.html'}
    ],
    'services-group':[
      {key:'resources',label:'Rooms & equipment',href:'./admin-operations.html#resources'},
      {key:'services',label:'Service dependencies',href:'./admin-operations.html#services'},
      {key:'resource-availability',label:'Resource availability',href:'./resource-availability.html'}
    ],
    'staff-group':[
      {key:'staff',label:'Staff & working hours',href:'./admin-operations.html#staff'},
      {key:'staff-access',label:'Staff access',href:'./staff-permissions.html'}
    ],
    'members-group':[
      {key:'members',label:'Members',href:'./index.html#members'},
      {key:'memberships',label:'Memberships',href:'./index.html#memberships'},
      {key:'member-view',label:'Member view',href:'./member-view-settings.html'},
      {key:'access',label:'Door access',href:'./access-settings.html'}
    ]
  };

  const ICONS={
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect>',
    community:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.6-4.8A7 7 0 0 1 3 12c0-4 3.6-7 8-7h3c4.4 0 8 3 8 7 0 1.1-.3 2.1-1 3z"></path><path d="M8 12h.01M12 12h.01M16 12h.01"></path>',
    classes:'<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"></path>',
    services:'<rect x="3" y="4" width="8" height="6" rx="1.5"></rect><rect x="13" y="4" width="8" height="6" rx="1.5"></rect><rect x="3" y="14" width="8" height="6" rx="1.5"></rect><rect x="13" y="14" width="8" height="6" rx="1.5"></rect><path d="M7 10v4M17 10v4"></path>',
    staff:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>',
    members:'<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>',
    reporting:'<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"></path><path d="M2 21h22"></path>'
  };
  function icon(name){return '<svg class="admin-nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[name]||'')+'</svg>';}

  const adminPages=new Set(['index.html','community.html','classes.html','class-setup.html','admin-operations.html','resource-availability.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html']);

  function normaliseSidebarChrome(){
    document.querySelectorAll('.side').forEach(side=>{
      let brand=side.querySelector('.brand-logo,.brand,.logo');
      if(!brand){
        brand=document.createElement('div');
        side.prepend(brand);
      }
      brand.className='logo brand-logo admin-brand-lock';
      brand.innerHTML='<svg class="brand-mark" viewBox="0 0 54 48" aria-hidden="true"><path d="M6 42 L27 6 M12 42 L30 11 M18 42 L33 16 M48 42 L27 6 M42 42 L24 11 M36 42 L21 16"/></svg><span class="brand-word">HYBRID <b>OS</b></span>';

      const gym=side.querySelector('.gym');
      if(gym){
        gym.classList.add('admin-gym-lock');
        if(!gym.querySelector('.tenant-gym-logo')){
          const legacy=gym.querySelector('img');
          if(legacy)legacy.classList.add('tenant-gym-logo');
          else{
            const img=document.createElement('img');
            img.src='./assets/hybrid-hub-logo-horizontal.svg';
            img.alt='Hybrid Hub';
            img.className='tenant-gym-logo';
            gym.insertBefore(img,gym.firstChild);
          }
        }
      }
    });
  }



  function currentKey(){
    const p=location.pathname,h=location.hash.replace('#','');
    if(p.endsWith('/community.html'))return'community-social';
    if(p.endsWith('/classes.html'))return'classes';
    if(p.endsWith('/class-setup.html'))return'class-setup';
    if(p.endsWith('/admin-operations.html'))return['staff','resources','services'].includes(h)?h:'staff';
    if(p.endsWith('/resource-availability.html'))return'resource-availability';
    if(p.endsWith('/staff-permissions.html'))return'staff-access';
    if(p.endsWith('/access-settings.html'))return'access';
    if(p.endsWith('/reporting.html'))return'reporting';
    if(p.endsWith('/member-view-settings.html'))return'member-view';
    if(p.endsWith('/index.html')||p.endsWith('/HybridOS/')||p.endsWith('/')){
      return['memberships','members','community'].includes(h)?h:'dashboard';
    }
    return'';
  }

  function groupFor(key){
    if(['community-social','community'].includes(key))return'community-group';
    if(['classes','class-setup'].includes(key))return'classes-group';
    if(['resources','services','resource-availability'].includes(key))return'services-group';
    if(['staff','staff-access'].includes(key))return'staff-group';
    if(['members','memberships','member-view','access'].includes(key))return'members-group';
    return key;
  }

  function style(){
    if(document.getElementById('shared-admin-nav-style'))return;
    const s=document.createElement('style');s.id='shared-admin-nav-style';
    s.textContent=`
      .nav .admin-nav-link{display:flex;width:100%;min-height:44px;border:0;background:transparent;color:#a9b2c2;padding:11px 12px;border-radius:12px;text-align:left;cursor:pointer;text-decoration:none;font:inherit;align-items:center;gap:11px}
      .admin-nav-icon{width:18px;height:18px;flex:0 0 18px;opacity:.9}.admin-nav-link.active .admin-nav-icon{opacity:1}
      .nav .admin-nav-link:hover,.nav .admin-nav-link.active{background:rgba(255,255,255,.09);color:#fff}
      .admin-context-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 20px;padding:4px 0}
      .admin-context-tab{display:inline-flex;align-items:center;min-height:40px;padding:9px 13px;border:1px solid var(--hybrid-line,#e7ebf2);border-radius:12px;background:#fff;color:var(--hybrid-ink,#101828);font-weight:800;text-decoration:none;cursor:pointer;box-shadow:0 4px 12px rgba(16,24,40,.04)}
      .admin-context-tab:hover{border-color:#cfd6e1;background:#fafbfc}
      .admin-context-tab.active{background:var(--hybrid-dark,#0b1020);border-color:var(--hybrid-dark,#0b1020);color:#fff;box-shadow:none}
      body:has(.admin-context-tabs) .main>.tabs{display:none!important}
      @media(max-width:700px){.admin-context-tabs{overflow-x:auto;flex-wrap:nowrap;padding-bottom:6px;scrollbar-width:none}.admin-context-tabs::-webkit-scrollbar{display:none}.admin-context-tab{white-space:nowrap;flex:0 0 auto}}
    `;
    document.head.appendChild(s);
  }

  function closeMobile(){document.body.classList.remove('admin-mobile-open');document.querySelector('.admin-mobile-menu-btn')?.setAttribute('aria-expanded','false')}
  function ensureMobileMenu(){
    if(document.querySelector('.admin-mobile-menu-btn'))return;
    const btn=document.createElement('button');btn.className='admin-mobile-menu-btn';btn.type='button';btn.setAttribute('aria-label','Open admin menu');btn.setAttribute('aria-expanded','false');btn.textContent='☰';
    const backdrop=document.createElement('div');backdrop.className='admin-mobile-backdrop';document.body.append(btn,backdrop);
    document.querySelectorAll('.side').forEach(side=>{if(!side.querySelector('.admin-mobile-menu-close')){const close=document.createElement('button');close.className='admin-mobile-menu-close';close.type='button';close.setAttribute('aria-label','Close admin menu');close.textContent='×';close.onclick=closeMobile;side.prepend(close)}});
    btn.onclick=()=>{const open=!document.body.classList.contains('admin-mobile-open');document.body.classList.toggle('admin-mobile-open',open);btn.setAttribute('aria-expanded',open?'true':'false')};
    backdrop.onclick=closeMobile;document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobile()});
  }

  function showDashboardPage(key){
    if(!(location.pathname.endsWith('/index.html')||location.pathname.endsWith('/HybridOS/')||location.pathname.endsWith('/')))return false;
    if(!['dashboard','memberships','members','community'].includes(key))return false;
    const target=document.getElementById(key);if(!target)return false;
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===key));
    history.replaceState(null,'',key==='dashboard'?'./index.html':'./index.html#'+key);
    refresh();closeMobile();window.scrollTo({top:0,behavior:'smooth'});return true;
  }

  function renderContextTabs(){
    const key=currentKey(),group=groupFor(key),tabs=contextTabs[group];
    document.querySelector('.admin-context-tabs')?.remove();
    if(!tabs)return;
    const host=document.querySelector('.main');if(!host)return;
    const top=host.querySelector('.top')||host.firstElementChild;
    const wrap=document.createElement('nav');wrap.className='admin-context-tabs';wrap.setAttribute('aria-label','Section navigation');
    wrap.innerHTML=tabs.map(tab=>'<a class="admin-context-tab '+(tab.key===key?'active':'')+'" data-admin-context="'+tab.key+'" href="'+tab.href+'">'+tab.label+'</a>').join('');
    if(top?.nextSibling)host.insertBefore(wrap,top.nextSibling);else host.appendChild(wrap);
    wrap.querySelectorAll('.admin-context-tab').forEach(a=>a.addEventListener('click',e=>{if(showDashboardPage(a.dataset.adminContext)){e.preventDefault();return}closeMobile()}));
  }

  function refresh(){
    const key=currentKey(),group=groupFor(key);
    document.querySelectorAll('.admin-nav-link').forEach(a=>a.classList.toggle('active',a.dataset.adminKey===group));
    renderContextTabs();
  }

  function prefetch(href){
    try{
      const u=new URL(href,location.href),file=u.pathname.split('/').pop()||'index.html';
      if(!adminPages.has(file)||u.origin!==location.origin)return;
      if(document.head.querySelector('link[data-admin-prefetch="'+file+'"]'))return;
      const l=document.createElement('link');l.rel='prefetch';l.href=u.href;l.as='document';l.dataset.adminPrefetch=file;document.head.appendChild(l)
    }catch(_e){}
  }

  function render(){
    style();normaliseSidebarChrome();ensureMobileMenu();
    const group=groupFor(currentKey());
    document.querySelectorAll('.side .nav').forEach(nav=>{
      nav.innerHTML=sidebar.map(i=>'<a class="admin-nav-link '+(i.key===group?'active':'')+'" data-admin-key="'+i.key+'" href="'+i.href+'">'+icon(i.icon)+'<span>'+i.label+'</span></a>').join('');
      nav.querySelectorAll('.admin-nav-link').forEach(a=>{
        a.addEventListener('pointerenter',()=>prefetch(a.href),{passive:true});
        a.addEventListener('touchstart',()=>prefetch(a.href),{passive:true});
        a.addEventListener('click',e=>{
          const targetKey=a.dataset.adminKey==='members-group'?'members':a.dataset.adminKey;
          if(showDashboardPage(targetKey)){e.preventDefault();return}
          closeMobile();
          try{const u=new URL(a.href,location.href);if(u.origin===location.origin&&adminPages.has(u.pathname.split('/').pop()||'index.html'))document.body.classList.add('admin-leaving')}catch(_e){}
        });
      });
    });
    refresh();
    if((location.pathname.endsWith('/index.html')||location.pathname.endsWith('/HybridOS/')||location.pathname.endsWith('/'))&&location.hash)showDashboardPage(currentKey());
    const hrefs=[...sidebar,...Object.values(contextTabs).flat()].map(i=>i.href).filter(Boolean);
    if('requestIdleCallback'in window)requestIdleCallback(()=>hrefs.forEach(prefetch),{timeout:1400});else setTimeout(()=>hrefs.forEach(prefetch),700);
  }

  window.addEventListener('hashchange',refresh);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})();