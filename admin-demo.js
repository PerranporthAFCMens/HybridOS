(function(){
  const DEMO_EMAIL='demo@hybridhub.co.uk';
  const DEMO_PASSWORD='HybridHubDemo26!';
  const byId=id=>document.getElementById(id);

  function money(pence){return '£'+(pence/100).toFixed(2)}
  function openPage(page){
    document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===page));
    document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
  }

  function planCard(p){
    return `<div class="plan"><div style="display:flex;justify-content:space-between;gap:10px"><div><span class="tag good">Active</span><h3 style="margin:10px 0 0">${p.name}</h3></div><span class="tag">${p.access}</span></div><div class="price">${money(p.price)} <span class="muted" style="font-size:13px">/ month</span></div><div class="muted" style="margin-top:8px">${p.desc}</div><div class="muted" style="margin-top:8px;font-size:12px">${p.includes}</div></div>`;
  }

  function memberRow(name,plan,role='member'){
    const initials=name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
    return `<div class="member-row"><div class="member-name"><div class="avatar">${initials}</div><div><b>${name}</b><div class="muted">${plan} · active · ${role}</div></div></div><button class="btn secondary small" disabled title="Demo mode">Manage</button></div>`;
  }

  function enterDemo(){
    window.__HYBRID_OS_DEMO__=true;
    byId('authView')?.classList.add('hidden');
    byId('appView')?.classList.remove('hidden');
    document.title='Hybrid Hub · Hybrid OS Demo';

    if(byId('sideGym')) byId('sideGym').textContent='Hybrid Hub';
    if(byId('heroTitle')) byId('heroTitle').textContent='Hybrid Hub is live.';
    if(byId('userName')) byId('userName').textContent='Demo Admin';
    if(byId('userEmail')) byId('userEmail').textContent=DEMO_EMAIL;
    if(byId('userAvatar')) byId('userAvatar').textContent='DA';
    if(byId('welcomeTitle')) byId('welcomeTitle').textContent='Welcome back, Demo';
    if(byId('todayLabel')) byId('todayLabel').textContent='Hybrid Hub demo workspace';

    if(byId('memberCount')) byId('memberCount').textContent='250';
    if(byId('activeMembershipCount')) byId('activeMembershipCount').textContent='236';
    if(byId('mrr')) byId('mrr').textContent='£11,540.00';

    const plans=[
      {name:'Gym Only',price:3000,access:'gym',desc:'Open gym access for members training independently.',includes:'Open gym'},
      {name:'Hybrid Lite',price:4000,access:'hybrid',desc:'Gym access plus coached classes.',includes:'Open gym · Classes'},
      {name:'Unlimited',price:6500,access:'hybrid',desc:'Unlimited gym and class access.',includes:'Open gym · Unlimited classes'},
      {name:'Hybrid Gold',price:8000,access:'hybrid',desc:'Premium membership with PT benefits.',includes:'Open gym · Classes · PT'}
    ];

    if(byId('dashPlans')){
      byId('dashPlans').className='';
      byId('dashPlans').innerHTML=plans.map(p=>`<div class="channel"><b>${p.name}</b><div class="muted">${money(p.price)} / month · ${p.access}</div></div>`).join('');
    }
    if(byId('plansGrid')) byId('plansGrid').innerHTML=plans.map(planCard).join('');
    if(byId('planSummary')) byId('planSummary').textContent='4 active · 4 total';

    const channels=`<div class="channel"><b># announcements</b><div class="muted">News and important gym updates</div></div><div class="channel"><b># general</b><div class="muted">Hybrid Hub member community</div></div><div class="channel"><b># challenges</b><div class="muted">Monthly gym challenges and leaderboards</div></div>`;
    if(byId('channelsList')){byId('channelsList').className='';byId('channelsList').innerHTML=channels}
    if(byId('communityList')){byId('communityList').className='';byId('communityList').innerHTML=channels}

    const members=[
      ['Badger Faulks','Hybrid Gold'],
      ['Harvey Price','Unlimited'],
      ['Tylorz Alex','Hybrid Lite'],
      ['Watson Read','Gym Only'],
      ['Mia Bennett','Unlimited'],
      ['Jack Morgan','Hybrid Lite'],
      ['Sophie Carter','Hybrid Gold'],
      ['Liam Harris','Gym Only'],
      ['Chloe Evans','Unlimited'],
      ['Noah Clarke','Hybrid Lite'],
      ['Ruby Collins','Hybrid Gold'],
      ['Theo Mitchell','Unlimited'],
      ['Ella Parker','Hybrid Lite'],
      ['Finley Cooper','Gym Only'],
      ['Isla Roberts','Hybrid Gold'],
      ['Oscar Turner','Unlimited'],
      ['Grace Phillips','Hybrid Lite'],
      ['Leo Williams','Gym Only'],
      ['Freya Davies','Hybrid Gold'],
      ['Charlie Edwards','Unlimited']
    ];
    if(byId('membersSummary')) byId('membersSummary').textContent='250 members · 20 demo members shown';
    if(byId('membersList')){byId('membersList').className='';byId('membersList').innerHTML=members.map(m=>memberRow(m[0],m[1])).join('')}

    const newPlan=byId('newPlanBtn');
    if(newPlan){newPlan.disabled=true;newPlan.title='Disabled in demo mode'}

    document.querySelectorAll('[data-page]').forEach(btn=>{
      btn.addEventListener('click',e=>{
        if(!window.__HYBRID_OS_DEMO__) return;
        const target=btn.dataset.page;
        if(target && byId(target)){e.preventDefault();e.stopImmediatePropagation();openPage(target)}
      },true);
    });

    document.querySelectorAll('button[onclick*="classes.html"]').forEach(btn=>{
      btn.addEventListener('click',e=>{
        if(!window.__HYBRID_OS_DEMO__) return;
        e.preventDefault();e.stopImmediatePropagation();
        alert('Class timetable is available in the live Hybrid OS build. This shared demo is read-only.');
      },true);
    });

    const logout=byId('logoutBtn');
    if(logout){
      logout.addEventListener('click',e=>{
        if(!window.__HYBRID_OS_DEMO__) return;
        e.preventDefault();e.stopImmediatePropagation();
        window.__HYBRID_OS_DEMO__=false;
        byId('appView')?.classList.add('hidden');
        byId('authView')?.classList.remove('hidden');
        if(byId('passwordInput')) byId('passwordInput').value='';
      },true);
    }

    openPage('dashboard');
  }

  function init(){
    const email=byId('emailInput'), password=byId('passwordInput'), auth=byId('authBtn');
    if(!email||!password||!auth) return;

    const params=new URLSearchParams(location.search);
    if(params.get('demo')==='1'){
      email.value=DEMO_EMAIL;
      const sub=byId('authSub');
      if(sub) sub.textContent='Hybrid Hub demo account — use the shared demo password.';
    }

    auth.addEventListener('click',e=>{
      if(email.value.trim().toLowerCase()!==DEMO_EMAIL || password.value!==DEMO_PASSWORD) return;
      e.preventDefault();e.stopImmediatePropagation();enterDemo();
    },true);

    password.addEventListener('keydown',e=>{
      if(e.key!=='Enter') return;
      if(email.value.trim().toLowerCase()===DEMO_EMAIL && password.value===DEMO_PASSWORD){e.preventDefault();enterDemo()}
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0)); else setTimeout(init,0);
})();