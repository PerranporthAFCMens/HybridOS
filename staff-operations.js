(async function(){
  if(!location.pathname.endsWith('/staff.html'))return;
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const shortTime=v=>String(v||'').slice(0,5);
  const {data:{session}}=await sb.auth.getSession();if(!session)return;
  const {data:gm}=await sb.from('gym_members').select('gym_id,role').eq('user_id',session.user.id).eq('is_active',true).limit(1);
  if(!gm?.length||!['staff','coach','admin','owner'].includes(gm[0].role))return;
  const gymId=gm[0].gym_id,role=gm[0].role;
  let permissions={};
  if(['staff','coach'].includes(role)){
    const r=await sb.from('staff_access').select('permissions').eq('gym_id',gymId).eq('user_id',session.user.id).maybeSingle();
    permissions=r.data?.permissions||{};
  }
  const has=k=>['owner','admin'].includes(role)||permissions[k]===true;
  const grid=document.querySelector('.main .grid');if(!grid)return;

  const rota=document.createElement('section');rota.className='card staff-ops-card';rota.innerHTML='<div class="staff-ops-title"><h3>My working hours</h3><span class="tag">Weekly rota</span></div><div id="staffRotaBody" class="staff-rota"><div class="staff-ops-empty">Loading working hours…</div></div>';
  grid.appendChild(rota);
  const {data:hours,error:hoursErr}=await sb.from('staff_working_hours').select('weekday,start_time,end_time,is_working').eq('gym_id',gymId).eq('user_id',session.user.id).order('weekday');
  const byDay=new Map((hours||[]).map(x=>[Number(x.weekday),x]));
  const today=new Date().getDay(),todayRow=byDay.get(today);
  const body=rota.querySelector('#staffRotaBody');
  if(hoursErr){body.innerHTML='<div class="staff-ops-empty">Could not load your working hours.</div>'}
  else body.innerHTML=days.map((d,i)=>{const h=byDay.get(i),working=h?.is_working!==false&&h?.start_time&&h?.end_time;return `<div class="staff-rota-row"><div class="staff-rota-day">${d}${i===today?' · Today':''}</div><div class="staff-rota-hours ${working?'working':''}">${working?`${shortTime(h.start_time)}–${shortTime(h.end_time)}`:'Not working'}</div></div>`}).join('');

  const todayCard=document.createElement('section');todayCard.className='card staff-ops-card';
  todayCard.innerHTML=`<div class="staff-ops-title"><h3>Shift snapshot</h3><span class="tag ${todayRow?.is_working!==false&&todayRow?.start_time?'good':''}">${todayRow?.is_working!==false&&todayRow?.start_time?'Working today':'Off today'}</span></div><div class="staff-today-strip"><div class="staff-today-pill"><small>Start</small><strong>${todayRow?.is_working!==false&&todayRow?.start_time?shortTime(todayRow.start_time):'—'}</strong></div><div class="staff-today-pill"><small>Finish</small><strong>${todayRow?.is_working!==false&&todayRow?.end_time?shortTime(todayRow.end_time):'—'}</strong></div><div class="staff-today-pill"><small>Access</small><strong>${has('view_timetable')?'Full timetable':'Assigned classes'}</strong></div></div>`;
  grid.appendChild(todayCard);

  if(has('view_member_contact')||has('view_member_notes')){
    const card=document.createElement('section');card.className='card staff-ops-card full';
    card.innerHTML='<div class="staff-ops-title"><div><h3>Member lookup</h3><div class="muted" style="font-size:13px;margin-top:3px">Find an active member quickly.</div></div></div><input id="staffMemberSearch" class="staff-member-search" type="search" placeholder="Search by member name…" autocomplete="off"><div id="staffMemberResults" class="staff-member-results"><div class="staff-ops-empty">Start typing a name.</div></div>';
    grid.appendChild(card);
    const input=card.querySelector('#staffMemberSearch'),results=card.querySelector('#staffMemberResults');
    let timer=null;
    input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>lookup(input.value.trim()),180)});
    async function lookup(q){
      if(q.length<2){results.innerHTML='<div class="staff-ops-empty">Type at least 2 characters.</div>';return}
      results.innerHTML='<div class="staff-ops-empty">Searching…</div>';
      const {data:members,error}=await sb.from('gym_members').select('user_id,role').eq('gym_id',gymId).eq('is_active',true).eq('role','member');
      if(error){results.innerHTML='<div class="staff-ops-empty">Could not search members.</div>';return}
      const ids=(members||[]).map(x=>x.user_id);if(!ids.length){results.innerHTML='<div class="staff-ops-empty">No active members.</div>';return}
      const {data:profiles,error:pe}=await sb.from('profiles').select('id,display_name,first_name,last_name,phone').in('id',ids);
      if(pe){results.innerHTML='<div class="staff-ops-empty">Could not load member profiles.</div>';return}
      const term=q.toLowerCase();
      const matches=(profiles||[]).map(p=>({...p,name:p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||'Member'})).filter(p=>p.name.toLowerCase().includes(term)).slice(0,12);
      if(!matches.length){results.innerHTML='<div class="staff-ops-empty">No matching members.</div>';return}
      results.innerHTML=matches.map(p=>`<div class="staff-member-result"><div class="staff-member-result-top"><div><b>${esc(p.name)}</b><div class="staff-member-meta">Active member</div></div><span class="tag good">Member</span></div>${has('view_member_contact')&&p.phone?`<a class="staff-member-phone" href="tel:${esc(p.phone)}">${esc(p.phone)}</a>`:''}</div>`).join('');
    }
  }
})();
