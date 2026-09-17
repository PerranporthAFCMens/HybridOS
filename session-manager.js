(async function(){
  if(!location.pathname.endsWith('/classes.html')) return;
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fmt=v=>new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v));
  let gymId=null,currentId=null;
  const {data:{session}}=await sb.auth.getSession(); if(!session) return;
  const gm=await sb.from('gym_members').select('gym_id,role').eq('user_id',session.user.id).eq('is_active',true).limit(1);
  if(!gm.data?.length||!['owner','admin'].includes(gm.data[0].role)) return;
  gymId=gm.data[0].gym_id;

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

  async function load(id){
    currentId=id;overlay.classList.remove('hidden');document.body.style.overflow='hidden';body.innerHTML='<div class="session-manager-empty">Loading session…</div>';
    const [sr,br,sa,ra]=await Promise.all([
      sb.from('class_sessions').select('id,name,description,starts_at,ends_at,capacity,reserved_capacity,is_cancelled').eq('id',id).eq('gym_id',gymId).maybeSingle(),
      sb.from('class_bookings').select('id,user_id,status,booked_at').eq('session_id',id).in('status',['booked','attended','no_show']).order('booked_at'),
      sb.from('class_session_staff').select('user_id,is_lead,assignment_role').eq('session_id',id),
      sb.from('class_session_resources').select('resource_id,quantity').eq('session_id',id)
    ]);
    if(sr.error||!sr.data){body.innerHTML='<div class="session-manager-empty">Could not load this session.</div>';return}
    const s=sr.data,bookings=br.data||[],staff=sa.data||[],resourceLinks=ra.data||[];
    const pm=await profiles([...bookings.map(x=>x.user_id),...staff.map(x=>x.user_id)]);
    let resources=[];if(resourceLinks.length){const rr=await sb.from('resources').select('id,name,resource_type').in('id',resourceLinks.map(x=>x.resource_id));resources=rr.data||[]}
    title.textContent=s.name;when.textContent=fmt(s.starts_at)+' – '+new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit'}).format(new Date(s.ends_at));
    const attended=bookings.filter(x=>x.status==='attended').length,noShows=bookings.filter(x=>x.status==='no_show').length;
    const staffHtml=staff.length?staff.map(x=>`<span class="session-manager-chip">${esc(pm.get(x.user_id)||'Staff')}${x.is_lead?' · Lead':''}</span>`).join(''):'<span class="muted">No staff assigned</span>';
    const resourceHtml=resourceLinks.length?resourceLinks.map(x=>{const r=resources.find(y=>y.id===x.resource_id);return `<span class="session-manager-chip">${esc(r?.name||'Resource')}${x.quantity>1?' × '+x.quantity:''}</span>`}).join(''):'<span class="muted">No resource assigned</span>';
    const roster=bookings.length?bookings.map((b,i)=>`<div class="session-manager-person"><div><div class="session-manager-person-name">${i+1}. ${esc(pm.get(b.user_id)||'Member')}</div><div class="session-manager-person-meta">${b.status==='attended'?'Attended':b.status==='no_show'?'No-show':'Booked'}</div></div><div class="session-manager-attendance"><button data-booking="${b.id}" data-status="attended" class="${b.status==='attended'?'active attended':''}">✓ Attended</button><button data-booking="${b.id}" data-status="no_show" class="${b.status==='no_show'?'active no-show':''}">No-show</button><button data-booking="${b.id}" data-status="booked">Reset</button></div></div>`).join(''):'<div class="session-manager-empty">Nobody is booked into this class yet.</div>';
    body.innerHTML=`<div class="session-manager-summary"><div class="session-manager-stat"><small>Booked</small><strong>${bookings.length} / ${s.capacity}</strong></div><div class="session-manager-stat"><small>Attended</small><strong>${attended}</strong></div><div class="session-manager-stat"><small>No-shows</small><strong>${noShows}</strong></div></div>${s.description?`<div class="muted">${esc(s.description)}</div>`:''}<div class="session-manager-section"><div class="session-manager-title">Staff</div><div class="session-manager-chiprow">${staffHtml}</div></div><div class="session-manager-section"><div class="session-manager-title">Room & resources</div><div class="session-manager-chiprow">${resourceHtml}</div></div><div class="session-manager-section"><div class="session-manager-title">Roster</div><div class="session-manager-roster">${roster}</div></div><div class="session-manager-actions"><button id="smRefresh" class="session-manager-btn secondary">Refresh</button><button id="smCancel" class="session-manager-btn danger">${s.is_cancelled?'Reopen class':'Cancel class'}</button></div><div id="smMsg" class="session-manager-msg"></div>`;
    body.querySelectorAll('[data-booking]').forEach(btn=>btn.onclick=()=>mark(btn));
    body.querySelector('#smRefresh').onclick=()=>load(id);
    body.querySelector('#smCancel').onclick=()=>toggleCancelled(id,!s.is_cancelled);
  }

  async function mark(btn){
    const id=btn.dataset.booking,status=btn.dataset.status;btn.disabled=true;
    const r=await sb.from('class_bookings').update({status}).eq('id',id);
    if(r.error){body.querySelector('#smMsg').textContent=r.error.message;btn.disabled=false;return}
    await load(currentId);
  }
  async function toggleCancelled(id,value){
    const btn=body.querySelector('#smCancel');btn.disabled=true;btn.textContent=value?'Cancelling…':'Reopening…';
    const r=await sb.from('class_sessions').update({is_cancelled:value}).eq('id',id).eq('gym_id',gymId);
    if(r.error){body.querySelector('#smMsg').textContent=r.error.message;btn.disabled=false;return}
    await load(id);location.reload();
  }

  document.addEventListener('click',e=>{
    const card=e.target.closest('.session');if(!card||e.target.closest('button,a,input,select'))return;
    const id=card.dataset.sessionId;if(id)load(id);
  });
})();