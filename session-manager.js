(async function(){
  if(!location.pathname.endsWith('/classes.html')) return;
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fmt=v=>new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v));
  const localDate=v=>{const d=new Date(v);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const localTime=v=>{const d=new Date(v);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
  let gymId=null,currentId=null,staffDirectory=[],resourceDirectory=[];
  const {data:{session}}=await sb.auth.getSession(); if(!session) return;
  const gm=await sb.from('gym_members').select('gym_id,role').eq('user_id',session.user.id).eq('is_active',true).limit(1);
  if(!gm.data?.length||!['owner','admin'].includes(gm.data[0].role)) return;
  gymId=gm.data[0].gym_id;

  async function loadDirectory(){
    const [members,resources]=await Promise.all([
      sb.from('gym_members').select('user_id,role').eq('gym_id',gymId).eq('is_active',true).in('role',['owner','admin','staff','coach']),
      sb.from('resources').select('id,name,resource_type,capacity,is_bookable,is_active').eq('gym_id',gymId).eq('is_active',true).order('name')
    ]);
    const ids=(members.data||[]).map(x=>x.user_id);
    let pm=new Map();
    if(ids.length){
      const p=await sb.from('profiles').select('id,display_name,first_name,last_name').in('id',ids);
      pm=new Map((p.data||[]).map(x=>[x.id,x.display_name||[x.first_name,x.last_name].filter(Boolean).join(' ')||'Staff']));
    }
    staffDirectory=(members.data||[]).map(x=>({id:x.user_id,role:x.role,name:pm.get(x.user_id)||x.role})).sort((a,b)=>a.name.localeCompare(b.name));
    resourceDirectory=(resources.data||[]).filter(x=>x.is_bookable!==false);
  }
  await loadDirectory();

  const overlay=document.createElement('div');
  overlay.className='session-manager-overlay hidden';
  overlay.innerHTML='<section class="session-manager-panel" role="dialog" aria-modal="true"><div class="session-manager-head"><div><div class="eyebrow">Session management</div><h2 id="smTitle">Class</h2><div id="smWhen" class="muted"></div></div><button class="session-manager-close" aria-label="Close">×</button></div><div id="smBody" class="session-manager-body"></div></section>';
  document.body.appendChild(overlay);
  const body=overlay.querySelector('#smBody'),title=overlay.querySelector('#smTitle'),when=overlay.querySelector('#smWhen');
  const close=()=>{overlay.classList.add('hidden');document.body.style.overflow='';currentId=null};
  overlay.querySelector('.session-manager-close').onclick=close;
  overlay.onclick=e=>{if(e.target===overlay)close()};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.classList.contains('hidden'))close()});

  async function profiles(ids){
    if(!ids.length)return new Map();
    const r=await sb.from('profiles').select('id,display_name,first_name,last_name').in('id',[...new Set(ids)]);
    return new Map((r.data||[]).map(p=>[p.id,p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||'Member']));
  }
  function durationMinutes(s){return Math.max(5,Math.round((new Date(s.ends_at)-new Date(s.starts_at))/60000))}
  function selectedStaff(){return [...body.querySelectorAll('[data-sm-staff]:checked')].map(x=>x.value)}
  function selectedResources(){return [...body.querySelectorAll('[data-sm-resource]:checked')].map(x=>({resource_id:x.value,quantity:Math.max(1,Number(body.querySelector(`[data-sm-qty="${x.value}"]`)?.value||1))}))}
  function updateCard(id,s){
    const card=document.querySelector(`.session[data-session-id="${CSS.escape(id)}"]`);if(!card)return;
    const h=card.querySelector('h3');if(h)h.textContent=s.name;
    const time=card.querySelector('.time');if(time)time.textContent=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit'}).format(new Date(s.starts_at));
  }
  async function validateSchedule(s,staffIds,startsAt,endsAt,capacity){
    if(!s.class_type_id)return{ok:true};
    const {data,error}=await sb.rpc('validate_class_schedule',{p_gym_id:gymId,p_class_type_id:s.class_type_id,p_starts_at:startsAt,p_ends_at:endsAt,p_capacity:capacity,p_staff_ids:staffIds,p_exclude_session_id:s.id});
    if(error)return{ok:false,errors:[error.message]};
    return data||{ok:false,errors:['Schedule validation failed.']};
  }

  async function load(id){
    currentId=id;overlay.classList.remove('hidden');document.body.style.overflow='hidden';body.innerHTML='<div class="session-manager-empty">Loading session…</div>';
    const [sr,br,sa,ra]=await Promise.all([
      sb.from('class_sessions').select('id,class_type_id,name,description,starts_at,ends_at,capacity,reserved_capacity,is_cancelled').eq('id',id).eq('gym_id',gymId).maybeSingle(),
      sb.from('class_bookings').select('id,user_id,status,booked_at').eq('session_id',id).in('status',['booked','attended','no_show']).order('booked_at'),
      sb.from('class_session_staff').select('user_id,is_lead,assignment_role').eq('session_id',id),
      sb.from('class_session_resources').select('resource_id,quantity').eq('session_id',id)
    ]);
    if(sr.error||!sr.data){body.innerHTML='<div class="session-manager-empty">Could not load this session.</div>';return}
    const s=sr.data,bookings=br.data||[],staff=sa.data||[],resourceLinks=ra.data||[];
    const pm=await profiles([...bookings.map(x=>x.user_id),...staff.map(x=>x.user_id)]);
    title.textContent=s.name;when.textContent=fmt(s.starts_at)+' – '+new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit'}).format(new Date(s.ends_at));
    const attended=bookings.filter(x=>x.status==='attended').length,noShows=bookings.filter(x=>x.status==='no_show').length;
    const roster=bookings.length?bookings.map((b,i)=>`<div class="session-manager-person"><div><div class="session-manager-person-name">${i+1}. ${esc(pm.get(b.user_id)||'Member')}</div><div class="session-manager-person-meta">${b.status==='attended'?'Attended':b.status==='no_show'?'No-show':'Booked'}</div></div><div class="session-manager-attendance"><button data-booking="${b.id}" data-status="attended" class="${b.status==='attended'?'active attended':''}">✓ Attended</button><button data-booking="${b.id}" data-status="no_show" class="${b.status==='no_show'?'active no-show':''}">No-show</button><button data-booking="${b.id}" data-status="booked">Reset</button></div></div>`).join(''):'<div class="session-manager-empty">Nobody is booked into this class yet.</div>';
    const assignedStaff=new Set(staff.map(x=>x.user_id)),leadId=staff.find(x=>x.is_lead)?.user_id||staff[0]?.user_id||'';
    const assignedResources=new Map(resourceLinks.map(x=>[x.resource_id,x.quantity]));
    const staffEditor=staffDirectory.length?staffDirectory.map(x=>`<label class="session-manager-check"><input type="checkbox" data-sm-staff value="${x.id}" ${assignedStaff.has(x.id)?'checked':''}><span><b>${esc(x.name)}</b><small>${esc(x.role)}</small></span></label>`).join(''):'<div class="muted">No staff available.</div>';
    const resourceEditor=resourceDirectory.length?resourceDirectory.map(x=>`<label class="session-manager-check resource"><input type="checkbox" data-sm-resource value="${x.id}" ${assignedResources.has(x.id)?'checked':''}><span><b>${esc(x.name)}</b><small>${esc(x.resource_type)}${x.capacity?' · cap '+x.capacity:''}</small></span><input class="session-manager-qty" type="number" min="1" data-sm-qty="${x.id}" value="${assignedResources.get(x.id)||1}" aria-label="Quantity"></label>`).join(''):'<div class="muted">No resources available.</div>';
    const leadOptions=staffDirectory.map(x=>`<option value="${x.id}" ${x.id===leadId?'selected':''}>${esc(x.name)}</option>`).join('');
    const mins=durationMinutes(s);
    body.innerHTML=`
      <div class="session-manager-summary"><div class="session-manager-stat"><small>Booked</small><strong>${bookings.length} / ${s.capacity}</strong></div><div class="session-manager-stat"><small>Attended</small><strong>${attended}</strong></div><div class="session-manager-stat"><small>No-shows</small><strong>${noShows}</strong></div></div>
      <details class="session-manager-edit"><summary>Edit session details</summary><div class="session-manager-form"><label>Name<input id="smName" value="${esc(s.name)}"></label><label>Date<input id="smDate" type="date" value="${localDate(s.starts_at)}"></label><label>Start<input id="smStart" type="time" value="${localTime(s.starts_at)}"></label><label>Duration (minutes)<input id="smDuration" type="number" min="5" value="${mins}"></label><label>Capacity<input id="smCapacity" type="number" min="1" value="${s.capacity}"></label><label>Reserved spaces<input id="smReserved" type="number" min="0" value="${s.reserved_capacity||0}"></label><label class="wide">Description<textarea id="smDescription">${esc(s.description||'')}</textarea></label></div><button id="smSaveDetails" class="session-manager-btn primary">Save session details</button><div id="smDetailsMsg" class="session-manager-msg"></div></details>
      <details class="session-manager-edit"><summary>Staff & resources</summary><div class="session-manager-title">Assigned staff</div><div class="session-manager-checkgrid">${staffEditor}</div><label class="session-manager-field">Lead staff<select id="smLead"><option value="">No lead</option>${leadOptions}</select></label><div class="session-manager-title">Room & resources</div><div class="session-manager-checkgrid">${resourceEditor}</div><button id="smSaveAssignments" class="session-manager-btn primary">Save assignments</button><div id="smAssignmentsMsg" class="session-manager-msg"></div></details>
      <div class="session-manager-section"><div class="session-manager-title">Roster</div><div class="session-manager-roster">${roster}</div></div>
      <div class="session-manager-actions"><button id="smRefresh" class="session-manager-btn secondary">Refresh</button><button id="smCancel" class="session-manager-btn danger">${s.is_cancelled?'Reopen class':'Cancel class'}</button></div><div id="smMsg" class="session-manager-msg"></div>`;
    body.querySelectorAll('[data-booking]').forEach(btn=>btn.onclick=()=>mark(btn));
    body.querySelector('#smRefresh').onclick=()=>load(id);
    body.querySelector('#smCancel').onclick=()=>toggleCancelled(id,!s.is_cancelled);
    body.querySelector('#smSaveDetails').onclick=()=>saveDetails(s);
    body.querySelector('#smSaveAssignments').onclick=()=>saveAssignments(s,staff,resourceLinks);
    body.querySelectorAll('[data-sm-staff]').forEach(cb=>cb.addEventListener('change',()=>{const lead=body.querySelector('#smLead');if(lead?.value&&!selectedStaff().includes(lead.value))lead.value=''}));
  }

  async function saveDetails(s){
    const btn=body.querySelector('#smSaveDetails'),msg=body.querySelector('#smDetailsMsg');
    const name=body.querySelector('#smName').value.trim(),date=body.querySelector('#smDate').value,start=body.querySelector('#smStart').value,mins=Number(body.querySelector('#smDuration').value),capacity=Number(body.querySelector('#smCapacity').value),reserved=Number(body.querySelector('#smReserved').value||0);
    if(!name||!date||!start||!Number.isInteger(mins)||mins<5||!Number.isInteger(capacity)||capacity<1||!Number.isInteger(reserved)||reserved<0||reserved>capacity){msg.textContent='Check the name, date, time, duration and capacity values.';return}
    const starts=new Date(`${date}T${start}:00`),ends=new Date(starts.getTime()+mins*60000),staffIds=selectedStaff();
    btn.disabled=true;btn.textContent='Checking…';msg.textContent='';
    const check=await validateSchedule(s,staffIds,starts.toISOString(),ends.toISOString(),capacity);
    if(!check.ok){msg.textContent=(check.errors||['This change conflicts with the schedule.']).join(' ');btn.disabled=false;btn.textContent='Save session details';return}
    btn.textContent='Saving…';
    const payload={name,description:body.querySelector('#smDescription').value.trim()||null,starts_at:starts.toISOString(),ends_at:ends.toISOString(),capacity,reserved_capacity:reserved,updated_at:new Date().toISOString()};
    const r=await sb.from('class_sessions').update(payload).eq('id',s.id).eq('gym_id',gymId);
    if(r.error){msg.textContent=r.error.message;btn.disabled=false;btn.textContent='Save session details';return}
    updateCard(s.id,{...s,...payload});
    await load(s.id);
  }

  async function replaceRows(table,id,oldRows,newRows){
    const del=await sb.from(table).delete().eq('session_id',id).eq('gym_id',gymId);if(del.error)return del.error;
    if(!newRows.length)return null;
    const ins=await sb.from(table).insert(newRows);if(!ins.error)return null;
    if(oldRows.length)await sb.from(table).insert(oldRows.map(x=>({...x,gym_id:gymId,session_id:id})));
    return ins.error;
  }

  async function saveAssignments(s,oldStaff,oldResources){
    const btn=body.querySelector('#smSaveAssignments'),msg=body.querySelector('#smAssignmentsMsg'),staffIds=selectedStaff(),lead=body.querySelector('#smLead').value,resources=selectedResources();
    if(lead&&!staffIds.includes(lead)){msg.textContent='Lead staff must also be selected as assigned staff.';return}
    btn.disabled=true;btn.textContent='Checking…';msg.textContent='';
    const check=await validateSchedule(s,staffIds,s.starts_at,s.ends_at,s.capacity);
    if(!check.ok){msg.textContent=(check.errors||['These assignments conflict with the schedule.']).join(' ');btn.disabled=false;btn.textContent='Save assignments';return}
    btn.textContent='Saving…';
    const staffRows=staffIds.map(uid=>({gym_id:gymId,session_id:s.id,user_id:uid,assignment_role:'coach',is_lead:uid===lead}));
    const resourceRows=resources.map(r=>({gym_id:gymId,session_id:s.id,resource_id:r.resource_id,quantity:r.quantity}));
    const oldStaffRows=oldStaff.map(x=>({user_id:x.user_id,assignment_role:x.assignment_role||'coach',is_lead:!!x.is_lead}));
    const oldResourceRows=oldResources.map(x=>({resource_id:x.resource_id,quantity:x.quantity||1}));
    const staffErr=await replaceRows('class_session_staff',s.id,oldStaffRows,staffRows);
    if(staffErr){msg.textContent=staffErr.message;btn.disabled=false;btn.textContent='Save assignments';return}
    const resourceErr=await replaceRows('class_session_resources',s.id,oldResourceRows,resourceRows);
    if(resourceErr){
      await replaceRows('class_session_staff',s.id,staffRows,oldStaffRows.map(x=>({...x,gym_id:gymId,session_id:s.id})));
      msg.textContent=resourceErr.message;btn.disabled=false;btn.textContent='Save assignments';return;
    }
    await load(s.id);
  }

  async function mark(btn){
    const id=btn.dataset.booking,status=btn.dataset.status;btn.disabled=true;
    const r=await sb.from('class_bookings').update({status}).eq('id',id);
    if(r.error){body.querySelector('#smMsg').textContent=r.error.message;btn.disabled=false;return}
    await load(currentId);
  }
  async function toggleCancelled(id,value){
    const btn=body.querySelector('#smCancel');btn.disabled=true;btn.textContent=value?'Cancelling…':'Reopening…';
    const r=await sb.from('class_sessions').update({is_cancelled:value,updated_at:new Date().toISOString()}).eq('id',id).eq('gym_id',gymId);
    if(r.error){body.querySelector('#smMsg').textContent=r.error.message;btn.disabled=false;return}
    const card=document.querySelector(`.session[data-session-id="${CSS.escape(id)}"]`);card?.classList.toggle('cancelled',value);
    await load(id);
  }

  document.addEventListener('click',e=>{
    const card=e.target.closest('.session');if(!card||e.target.closest('button,a,input,select,textarea,label'))return;
    const id=card.dataset.sessionId;if(id)load(id);
  });
})();