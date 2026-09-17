(async function(){
  if(!location.pathname.endsWith('/staff.html'))return;
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const shortTime=v=>String(v||'').slice(0,5);
  const fmt=v=>new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v));
  const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
  const canPT=role==='coach'||has('view_member_notes');
  const grid=document.querySelector('.main .grid');if(!grid)return;

  let memberProfiles=[];
  async function loadMembers(){
    if(memberProfiles.length)return memberProfiles;
    const {data:members,error}=await sb.from('gym_members').select('user_id').eq('gym_id',gymId).eq('is_active',true).eq('role','member');
    if(error||!members?.length)return[];
    const {data:profiles}=await sb.from('profiles').select('id,display_name,first_name,last_name,phone').in('id',members.map(x=>x.user_id));
    memberProfiles=(profiles||[]).map(p=>({...p,name:p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||'Member'})).sort((a,b)=>a.name.localeCompare(b.name));
    return memberProfiles;
  }

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

  const resourceCard=document.createElement('section');resourceCard.className='card staff-ops-card';resourceCard.innerHTML='<div class="staff-ops-title"><h3>Today’s resources</h3><span class="tag">Assigned classes</span></div><div id="staffResources"><div class="staff-ops-empty">Loading resources…</div></div>';
  grid.appendChild(resourceCard);
  const startOfDay=new Date();startOfDay.setHours(0,0,0,0);const endOfDay=new Date(startOfDay);endOfDay.setDate(endOfDay.getDate()+1);
  const {data:assignments}=await sb.from('class_session_staff').select('session_id,class_sessions(id,name,starts_at,ends_at,is_cancelled)').eq('gym_id',gymId).eq('user_id',session.user.id);
  const todays=(assignments||[]).filter(x=>x.class_sessions&&!x.class_sessions.is_cancelled&&new Date(x.class_sessions.starts_at)>=startOfDay&&new Date(x.class_sessions.starts_at)<endOfDay);
  const sessionIds=todays.map(x=>x.session_id);
  let resourceHtml='';
  if(sessionIds.length){
    const {data:links}=await sb.from('class_session_resources').select('session_id,resource_id,quantity').in('session_id',sessionIds);
    const ids=[...new Set((links||[]).map(x=>x.resource_id))];
    let resMap=new Map();if(ids.length){const {data:rs}=await sb.from('resources').select('id,name,resource_type').in('id',ids);resMap=new Map((rs||[]).map(r=>[r.id,r]));}
    resourceHtml=todays.map(a=>{const rows=(links||[]).filter(x=>x.session_id===a.session_id);const list=rows.length?rows.map(x=>{const r=resMap.get(x.resource_id);return `${esc(r?.name||'Resource')}${x.quantity>1?' × '+x.quantity:''}`}).join(', '):'No specific resource';return `<div class="staff-resource-row"><div><b>${esc(a.class_sessions.name)}</b><small>${shortTime(new Date(a.class_sessions.starts_at).toTimeString())}</small></div><span>${list}</span></div>`}).join('');
  }
  resourceCard.querySelector('#staffResources').innerHTML=resourceHtml||'<div class="staff-ops-empty">No assigned resources today.</div>';

  const accessCard=document.createElement('section');accessCard.className='card staff-ops-card';accessCard.innerHTML='<div class="staff-ops-title"><h3>Gym access</h3><span class="tag">Staff quick access</span></div><div id="staffAccess"><div class="staff-ops-empty">Loading access…</div></div>';
  grid.appendChild(accessCard);
  const {data:access}=await sb.from('gym_access_settings').select('access_enabled,access_code,member_label,member_note').eq('gym_id',gymId).maybeSingle();
  accessCard.querySelector('#staffAccess').innerHTML=access?.access_enabled?`<div class="staff-access-code"><small>${esc(access.member_label||'Door access')}</small><strong>${esc(access.access_code||'—')}</strong><span>${esc(access.member_note||'')}</span></div>`:'<div class="staff-ops-empty">Door access is not enabled.</div>';

  if(canPT){
    const pt=document.createElement('section');pt.className='card staff-ops-card full';
    pt.innerHTML=`<div class="staff-ops-title"><div><h3>PT appointments</h3><div class="muted" style="font-size:13px;margin-top:3px">Manage your one-to-one sessions.</div></div><button id="staffPtNew" class="staff-ops-btn">+ New appointment</button></div><div id="staffPtForm" class="staff-pt-form hidden"><label>Member<select id="staffPtMember"><option value="">Select member</option></select></label><label>Date<input id="staffPtDate" type="date"></label><label>Start<input id="staffPtTime" type="time"></label><label>Duration<select id="staffPtDuration"><option value="30">30 min</option><option value="45">45 min</option><option value="60" selected>60 min</option><option value="90">90 min</option></select></label><label class="wide">Notes<textarea id="staffPtNotes" placeholder="Optional coaching notes"></textarea></label><div class="wide staff-pt-actions"><button id="staffPtSave" class="staff-ops-btn primary">Save appointment</button><button id="staffPtCancelForm" class="staff-ops-btn secondary">Cancel</button><span id="staffPtMsg" class="staff-member-meta"></span></div></div><div id="staffPtList"><div class="staff-ops-empty">Loading appointments…</div></div>`;
    grid.appendChild(pt);
    const form=pt.querySelector('#staffPtForm'),memberSelect=pt.querySelector('#staffPtMember'),dateInput=pt.querySelector('#staffPtDate'),timeInput=pt.querySelector('#staffPtTime');
    const members=await loadMembers();memberSelect.innerHTML='<option value="">Select member</option>'+members.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('');
    const defaultStart=new Date(Date.now()+3600000);dateInput.value=localDate(defaultStart);timeInput.value=`${String(defaultStart.getHours()).padStart(2,'0')}:${String(Math.ceil(defaultStart.getMinutes()/15)*15%60).padStart(2,'0')}`;
    pt.querySelector('#staffPtNew').onclick=()=>form.classList.remove('hidden');pt.querySelector('#staffPtCancelForm').onclick=()=>form.classList.add('hidden');
    async function loadPt(){
      const now=new Date(),to=new Date(Date.now()+14*86400000);
      const {data,error}=await sb.from('pt_appointments').select('id,member_user_id,starts_at,ends_at,status,notes').eq('gym_id',gymId).eq('staff_user_id',session.user.id).gte('starts_at',now.toISOString()).lt('starts_at',to.toISOString()).order('starts_at');
      const list=pt.querySelector('#staffPtList');if(error){list.innerHTML='<div class="staff-ops-empty">Could not load PT appointments.</div>';return}
      const map=new Map(members.map(m=>[m.id,m.name]));
      list.innerHTML=(data||[]).length?(data||[]).map(a=>`<div class="staff-pt-row"><div><b>${esc(map.get(a.member_user_id)||'Member')}</b><div class="staff-member-meta">${fmt(a.starts_at)} · ${Math.round((new Date(a.ends_at)-new Date(a.starts_at))/60000)} min</div>${a.notes?`<small>${esc(a.notes)}</small>`:''}</div><div class="staff-pt-status"><span class="tag ${a.status==='completed'?'good':a.status==='cancelled'?'warn':''}">${esc(a.status.replace('_',' '))}</span>${a.status==='booked'?`<button data-pt="${a.id}" data-status="completed">Complete</button><button data-pt="${a.id}" data-status="no_show">No-show</button><button data-pt="${a.id}" data-status="cancelled">Cancel</button>`:''}</div></div>`).join(''):'<div class="staff-ops-empty">No PT appointments in the next 14 days.</div>';
      list.querySelectorAll('[data-pt]').forEach(b=>b.onclick=async()=>{b.disabled=true;const r=await sb.from('pt_appointments').update({status:b.dataset.status,updated_at:new Date().toISOString()}).eq('id',b.dataset.pt);if(r.error)alert(r.error.message);await loadPt()});
    }
    pt.querySelector('#staffPtSave').onclick=async()=>{
      const member=memberSelect.value,date=dateInput.value,time=timeInput.value,duration=Number(pt.querySelector('#staffPtDuration').value),msg=pt.querySelector('#staffPtMsg'),btn=pt.querySelector('#staffPtSave');
      if(!member||!date||!time){msg.textContent='Choose a member, date and time.';return}
      const starts=new Date(`${date}T${time}:00`),ends=new Date(starts.getTime()+duration*60000);btn.disabled=true;btn.textContent='Saving…';msg.textContent='';
      const {error}=await sb.from('pt_appointments').insert({gym_id:gymId,staff_user_id:session.user.id,member_user_id:member,starts_at:starts.toISOString(),ends_at:ends.toISOString(),notes:pt.querySelector('#staffPtNotes').value.trim()||null,created_by:session.user.id});
      btn.disabled=false;btn.textContent='Save appointment';if(error){msg.textContent=error.message;return}form.classList.add('hidden');pt.querySelector('#staffPtNotes').value='';await loadPt();
    };
    await loadPt();
  }

  if(has('view_member_contact')||has('view_member_notes')){
    const card=document.createElement('section');card.className='card staff-ops-card full';
    card.innerHTML='<div class="staff-ops-title"><div><h3>Member lookup</h3><div class="muted" style="font-size:13px;margin-top:3px">Find an active member quickly.</div></div></div><input id="staffMemberSearch" class="staff-member-search" type="search" placeholder="Search by member name…" autocomplete="off"><div id="staffMemberResults" class="staff-member-results"><div class="staff-ops-empty">Start typing a name.</div></div>';
    grid.appendChild(card);
    const input=card.querySelector('#staffMemberSearch'),results=card.querySelector('#staffMemberResults');let timer=null;
    input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>lookup(input.value.trim()),180)});
    async function lookup(q){
      if(q.length<2){results.innerHTML='<div class="staff-ops-empty">Type at least 2 characters.</div>';return}
      results.innerHTML='<div class="staff-ops-empty">Searching…</div>';const profiles=await loadMembers();const term=q.toLowerCase();const matches=profiles.filter(p=>p.name.toLowerCase().includes(term)).slice(0,12);
      if(!matches.length){results.innerHTML='<div class="staff-ops-empty">No matching members.</div>';return}
      results.innerHTML=matches.map(p=>`<div class="staff-member-result"><div class="staff-member-result-top"><div><b>${esc(p.name)}</b><div class="staff-member-meta">Active member</div></div><span class="tag good">Member</span></div>${has('view_member_contact')&&p.phone?`<a class="staff-member-phone" href="tel:${esc(p.phone)}">${esc(p.phone)}</a>`:''}</div>`).join('');
    }
  }
})();
