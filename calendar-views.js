(async function(){
  if(!location.pathname.endsWith('/classes.html'))return;
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  let gymId=null,weekOffset=0,view='gym',selected='',staffMap=new Map(),resourceMap=new Map(),weekSessions=[];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const monday=(d=new Date())=>{const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
  const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
  const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const currentStart=()=>addDays(monday(),weekOffset*7);
  const nameOf=p=>p?.display_name||[p?.first_name,p?.last_name].filter(Boolean).join(' ')||'Staff';

  const {data:{session}}=await sb.auth.getSession();if(!session)return;
  const gm=await sb.from('gym_members').select('gym_id,role').eq('user_id',session.user.id).eq('is_active',true).limit(1);
  if(!gm.data?.length||!['owner','admin'].includes(gm.data[0].role))return;gymId=gm.data[0].gym_id;

  async function loadDirectory(){
    const [members,resources]=await Promise.all([
      sb.from('gym_members').select('user_id,role').eq('gym_id',gymId).eq('is_active',true).in('role',['owner','admin','staff','coach']),
      sb.from('resources').select('id,name,resource_type').eq('gym_id',gymId).eq('is_active',true).order('name')
    ]);
    const ids=(members.data||[]).map(x=>x.user_id);let profiles=[];
    if(ids.length){const pr=await sb.from('profiles').select('id,display_name,first_name,last_name').in('id',ids);profiles=pr.data||[]}
    const pm=new Map(profiles.map(p=>[p.id,p]));
    staffMap=new Map((members.data||[]).map(m=>[m.user_id,nameOf(pm.get(m.user_id))]));
    resourceMap=new Map((resources.data||[]).map(r=>[r.id,r]));
  }

  function controlsHTML(mobile=false){
    const options=view==='staff'?[...staffMap].sort((a,b)=>a[1].localeCompare(b[1])).map(([id,n])=>`<option value="${id}" ${selected===id?'selected':''}>${esc(n)}</option>`).join(''):view==='resource'?[...resourceMap].sort((a,b)=>a[1].name.localeCompare(b[1].name)).map(([id,r])=>`<option value="${id}" ${selected===id?'selected':''}>${esc(r.name)} · ${esc(r.resource_type)}</option>`).join(''):'';
    return `<div class="calendar-view-tabs"><button class="calendar-view-tab ${view==='gym'?'active':''}" data-view="gym">Gym</button><button class="calendar-view-tab ${view==='staff'?'active':''}" data-view="staff">Staff</button><button class="calendar-view-tab ${view==='resource'?'active':''}" data-view="resource">Resource</button></div>${view==='gym'?'<div class="calendar-filter-summary">Showing the full gym timetable</div>':`<div class="calendar-view-filter"><label>${view==='staff'?'Staff member':'Room / resource'}</label><select class="calendar-filter-select"><option value="">All ${view==='staff'?'staff':'resources'}</option>${options}</select></div><div class="calendar-filter-summary"></div>`}${mobile?'<button class="btn secondary mobile-filter-close">Done</button>':''}`;
  }

  function bindControls(root){
    root.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;selected='';renderControls();applyFilter()});
    const sel=root.querySelector('.calendar-filter-select');if(sel)sel.onchange=()=>{selected=sel.value;applyFilter()};
    const close=root.querySelector('.mobile-filter-close');if(close)close.onclick=()=>document.body.classList.remove('mobile-filter-open');
  }
  function renderControls(){
    let bar=$('.calendar-viewbar');
    if(!bar){bar=document.createElement('div');bar.className='calendar-viewbar';const cal=$('#calendar');cal?.before(bar)}
    if(bar){bar.innerHTML=controlsHTML(false);bindControls(bar)}
    const sheet=$('.mobile-filter-sheet');if(sheet){sheet.innerHTML='<h3>Timetable view</h3>'+controlsHTML(true);bindControls(sheet)}
  }

  async function loadWeekData(){
    const start=currentStart(),end=addDays(start,7);
    const cs=await sb.from('class_sessions').select('id,name,starts_at,ends_at,capacity,is_cancelled').eq('gym_id',gymId).gte('starts_at',start.toISOString()).lt('starts_at',end.toISOString()).order('starts_at');
    weekSessions=cs.data||[];const ids=weekSessions.map(x=>x.id);
    let staff=[],resources=[];
    if(ids.length){
      const [sa,ra]=await Promise.all([
        sb.from('class_session_staff').select('session_id,user_id,is_lead,assignment_role').in('session_id',ids),
        sb.from('class_session_resources').select('session_id,resource_id,quantity').in('session_id',ids)
      ]);staff=sa.data||[];resources=ra.data||[];
    }
    weekSessions.forEach(s=>{
      s.staff=staff.filter(x=>x.session_id===s.id).map(x=>({id:x.user_id,name:staffMap.get(x.user_id)||'Staff',lead:x.is_lead}));
      s.resources=resources.filter(x=>x.session_id===s.id).map(x=>({id:x.resource_id,...(resourceMap.get(x.resource_id)||{name:'Resource',resource_type:'resource'}),quantity:x.quantity||1}));
    });
    attachMetadata();applyFilter();
  }

  function attachMetadata(){
    const days=$$('#calendar .day');if(!days.length)return;
    for(let i=0;i<days.length;i++){
      const date=ymd(addDays(currentStart(),i));
      const sessions=weekSessions.filter(s=>ymd(new Date(s.starts_at))===date).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
      const cards=[...days[i].querySelectorAll('.session')];
      cards.forEach((card,n)=>{
        const s=sessions[n];if(!s)return;
        card.dataset.sessionId=s.id;card.dataset.staffIds=s.staff.map(x=>x.id).join(',');card.dataset.resourceIds=s.resources.map(x=>x.id).join(',');
        let extra=card.querySelector('.calendar-extra');if(!extra){extra=document.createElement('div');extra.className='calendar-extra';card.appendChild(extra)}
        const staffChip=s.staff.length?`<span class="calendar-chip staff">${esc(s.staff.map(x=>x.name).join(', '))}</span>`:'';
        const resourceChip=s.resources.length?`<span class="calendar-chip resource">${esc(s.resources.map(x=>x.name).join(', '))}</span>`:'';
        extra.innerHTML=staffChip+resourceChip;
      });
    }
  }

  function applyFilter(){
    let shown=0,total=0;
    $$('#calendar .session').forEach(card=>{
      total++;
      const values=view==='staff'?(card.dataset.staffIds||'').split(',').filter(Boolean):view==='resource'?(card.dataset.resourceIds||'').split(',').filter(Boolean):[];
      const show=view==='gym'||!selected||values.includes(selected);card.classList.toggle('calendar-hidden',!show);if(show)shown++;
    });
    $$('.calendar-filter-summary').forEach(el=>{if(view==='gym')el.textContent=`${total} sessions this week`;else if(!selected)el.textContent=`${total} sessions · choose a ${view==='staff'?'staff member':'resource'} to focus`;else el.textContent=`${shown} matching session${shown===1?'':'s'} this week`});
    $$('#calendar .day').forEach(day=>{
      const visible=[...day.querySelectorAll('.session:not(.calendar-hidden)')];
      let empty=day.querySelector('.calendar-empty-filter');
      if(!visible.length&&day.querySelectorAll('.session').length){if(!empty){empty=document.createElement('div');empty.className='calendar-empty-filter';empty.textContent='No sessions match this view.';day.appendChild(empty)}}else empty?.remove();
    });
  }

  function hookNavigation(){
    const prev=$('#prevBtn'),next=$('#nextBtn'),today=$('#todayBtn');
    prev?.addEventListener('click',()=>{weekOffset--;setTimeout(loadWeekData,180)});
    next?.addEventListener('click',()=>{weekOffset++;setTimeout(loadWeekData,180)});
    today?.addEventListener('click',()=>{weekOffset=0;setTimeout(loadWeekData,180)});
    const obs=new MutationObserver(()=>{clearTimeout(obs._t);obs._t=setTimeout(()=>{attachMetadata();applyFilter()},60)});
    const cal=$('#calendar');if(cal)obs.observe(cal,{childList:true,subtree:true});
  }

  await loadDirectory();
  const wait=()=>new Promise(resolve=>{const tick=()=>$('#calendar .day')?resolve():setTimeout(tick,80);tick()});
  await wait();renderControls();hookNavigation();await loadWeekData();
})();
