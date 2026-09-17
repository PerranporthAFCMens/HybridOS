import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const isPreview=location.pathname.endsWith('/member-preview.html');
const supabase=isPreview?null:createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
let gymId=null,userId=null,sessions=[],filter='all',busy=new Set();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmtDate=d=>new Date(d).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
const fmtTime=d=>new Date(d).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});

function toast(msg){const el=document.createElement('div');el.className='member-booking-toast';el.textContent=msg;document.body.appendChild(el);setTimeout(()=>el.remove(),2200)}
function closeMobile(){document.body.classList.remove('mobile-nav-open');document.getElementById('mobileMenuBtn')?.setAttribute('aria-expanded','false')}

function ensureHomeActions(){
  const hero=document.querySelector('#home .hero'); if(!hero) return;
  let actions=hero.querySelector('.member-home-hero-actions');
  if(!actions){actions=document.createElement('div');actions.className='member-home-hero-actions';actions.innerHTML='<button class="btn primary" data-page="classes">Book a class</button><button class="btn secondary" data-page="workouts">Log workout</button><button class="btn secondary" data-page="pbs">View PBs</button>';hero.querySelector('.cta')?.remove();hero.appendChild(actions)}
  actions.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>openPage(b.dataset.page));
}
function openPage(id){document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id));document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===id));closeMobile();if(id==='classes')setTimeout(()=>document.getElementById('classList')?.scrollIntoView({block:'start'}),0)}

function ensureClassToolbar(){
  const list=document.getElementById('classList');if(!list||document.getElementById('memberClassToolbar'))return;
  const toolbar=document.createElement('div');toolbar.id='memberClassToolbar';toolbar.className='member-class-toolbar';toolbar.innerHTML='<div class="member-class-filters"><button class="member-filter active" data-filter="all">Upcoming</button><button class="member-filter" data-filter="booked">My bookings</button><button class="member-filter" data-filter="spaces">Spaces available</button></div><div class="muted" id="memberClassSummary"></div>';
  list.parentElement?.insertBefore(toolbar,list);
  toolbar.querySelectorAll('[data-filter]').forEach(btn=>btn.onclick=()=>{filter=btn.dataset.filter;toolbar.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===btn));renderClasses()});
}

function visibleSessions(){return sessions.filter(s=>filter==='booked'?s.is_booked:filter==='spaces'?s.available_spaces>0||s.is_booked:true)}
function rowHTML(s){
  const full=s.available_spaces<=0&&!s.is_booked;const label=s.is_booked?'Cancel booking':full?'Full':'Book class';
  const btnClass=s.is_booked?'btn secondary':'btn primary';
  return `<div class="row member-class-row" data-session-id="${esc(s.session_id)}"><div class="member-class-main"><h4>${esc(s.name||'Class')}</h4><div class="member-class-meta"><span>${esc(fmtDate(s.starts_at))}</span><span>${esc(fmtTime(s.starts_at))}–${esc(fmtTime(s.ends_at))}</span>${s.description?`<span>${esc(s.description)}</span>`:''}</div></div><div class="member-class-actions"><span class="member-spaces ${full?'full':''}">${s.is_booked?'Booked':full?'Full':`${s.available_spaces} space${s.available_spaces===1?'':'s'} left`}</span><button class="${btnClass}" data-book-action ${full?'disabled':''}>${busy.has(s.session_id)?'Saving…':label}</button></div></div>`;
}
function renderClasses(){
  const list=document.getElementById('classList');if(!list)return;const data=visibleSessions();
  document.getElementById('memberClassSummary')?.replaceChildren(document.createTextNode(`${data.length} class${data.length===1?'':'es'}`));
  list.innerHTML=data.length?data.map(rowHTML).join(''):'<div class="empty">No classes match this view.</div>';
  list.querySelectorAll('[data-session-id]').forEach(row=>{const id=row.dataset.sessionId;row.querySelector('[data-book-action]')?.addEventListener('click',()=>toggleBooking(id));row.addEventListener('click',e=>{if(!e.target.closest('button'))openDetails(id)})});
}
function renderNextClasses(){
  const target=document.getElementById('nextClasses');if(!target)return;const next=sessions.filter(s=>s.is_booked).slice(0,3);
  target.innerHTML=next.length?next.map(s=>`<div class="row member-class-row" data-session-id="${esc(s.session_id)}"><div class="member-class-main"><h4>${esc(s.name)}</h4><div class="member-class-meta"><span>${esc(fmtDate(s.starts_at))}</span><span>${esc(fmtTime(s.starts_at))}</span></div></div><span class="tag good">Booked</span></div>`).join(''):'<div class="empty">No classes booked yet. <button class="btn secondary" data-page="classes" style="margin-top:10px">Find a class</button></div>';
  target.querySelectorAll('[data-session-id]').forEach(r=>r.onclick=()=>openDetails(r.dataset.sessionId));target.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>openPage('classes'));
  const count=sessions.filter(s=>s.is_booked).length;const el=document.getElementById('upcomingCount');if(el)el.textContent=String(count);
}
function openDetails(id){
  const s=sessions.find(x=>x.session_id===id);if(!s)return;const modal=document.getElementById('homeClassModal');if(!modal)return;
  document.getElementById('homeClassTitle').textContent=s.name||'Class';document.getElementById('homeClassTime').textContent=`${fmtDate(s.starts_at)} · ${fmtTime(s.starts_at)}–${fmtTime(s.ends_at)}`;document.getElementById('homeClassDesc').textContent=s.description||'A coached class at your gym.';document.getElementById('homeClassAvailability').textContent=s.is_booked?'You are booked in.':s.available_spaces>0?`${s.available_spaces} spaces remaining`:'This class is full.';
  const b=document.getElementById('homeClassBook');b.dataset.sessionId=id;b.disabled=s.available_spaces<=0&&!s.is_booked;b.className=s.is_booked?'btn secondary':'btn primary';b.textContent=s.is_booked?'Cancel booking':s.available_spaces<=0?'Full':'Book class';b.onclick=()=>toggleBooking(id);document.getElementById('homeClassMsg').textContent='';modal.classList.remove('hidden');document.body.style.overflow='hidden';
}
function closeDetails(){document.getElementById('homeClassModal')?.classList.add('hidden');document.body.style.overflow=''}

async function toggleBooking(id){
  if(busy.has(id))return;const s=sessions.find(x=>x.session_id===id);if(!s)return;busy.add(id);renderClasses();
  if(isPreview){await new Promise(r=>setTimeout(r,250));s.is_booked=!s.is_booked;s.available_spaces=Math.max(0,s.available_spaces+(s.is_booked?-1:1));busy.delete(id);renderClasses();renderNextClasses();closeDetails();toast(s.is_booked?'Class booked':'Booking cancelled');return}
  const fn=s.is_booked?'member_cancel_class':'member_book_class';const {error}=await supabase.rpc(fn,{p_session_id:id});busy.delete(id);if(error){renderClasses();toast(error.message||'Could not update booking');return}await loadSchedule();closeDetails();toast(s.is_booked?'Booking cancelled':'Class booked');
}

function ensureHomeSchedule(){
  const grid=document.querySelector('#home .grid');if(!grid||document.getElementById('memberHomeSchedule'))return;
  const wrap=document.createElement('div');wrap.id='memberHomeSchedule';wrap.className='member-home-schedule';wrap.innerHTML='<div class="card member-schedule-card"><div class="section-title"><h3>My booked classes</h3><button class="btn secondary" data-page="classes">Manage</button></div><div id="memberBookedSummary" class="member-schedule-list"></div></div><div class="card member-schedule-card"><div class="section-title"><h3>PT appointments</h3><span class="muted">Upcoming</span></div><div id="memberPtSummary" class="member-schedule-list"><div class="member-classes-loading">Loading…</div></div></div>';
  grid.appendChild(wrap);wrap.querySelector('[data-page]')?.addEventListener('click',()=>openPage('classes'));
}
function renderBookedSummary(){const el=document.getElementById('memberBookedSummary');if(!el)return;const booked=sessions.filter(s=>s.is_booked).slice(0,3);el.innerHTML=booked.length?booked.map(s=>`<div class="member-schedule-item"><div><b>${esc(s.name)}</b><div class="member-schedule-time">${esc(fmtDate(s.starts_at))} · ${esc(fmtTime(s.starts_at))}</div></div><span class="tag good member-schedule-badge">Booked</span></div>`).join(''):'<div class="empty">Nothing booked yet.</div>'}
async function loadPt(){const el=document.getElementById('memberPtSummary');if(!el)return;if(isPreview){el.innerHTML='<div class="member-schedule-item"><div><b>1:1 Strength</b><div class="member-schedule-time">Sat 19 Sep · 10:00</div></div><span class="tag">PT</span></div>';return}
  const {data,error}=await supabase.from('pt_appointments').select('id,starts_at,ends_at,status,notes').eq('member_user_id',userId).gte('starts_at',new Date().toISOString()).neq('status','cancelled').order('starts_at').limit(3);if(error){el.innerHTML='<div class="empty">PT schedule unavailable.</div>';return}el.innerHTML=data?.length?data.map(a=>`<div class="member-schedule-item"><div><b>PT appointment</b><div class="member-schedule-time">${esc(fmtDate(a.starts_at))} · ${esc(fmtTime(a.starts_at))}–${esc(fmtTime(a.ends_at))}${a.notes?` · ${esc(a.notes)}`:''}</div></div><span class="tag">${esc(a.status||'scheduled')}</span></div>`).join(''):'<div class="empty">No upcoming PT appointments.</div>'}

async function loadSchedule(){
  if(isPreview){
    if(!sessions.length){const now=Date.now(),hr=3600000;sessions=[
      {session_id:'preview-1',name:'Early Engine',description:'Conditioning and aerobic capacity.',starts_at:new Date(now+8*hr).toISOString(),ends_at:new Date(now+9*hr).toISOString(),capacity:20,available_spaces:6,is_booked:true},
      {session_id:'preview-2',name:'Hybrid Strength',description:'Full-body strength and progressive overload.',starts_at:new Date(now+28*hr).toISOString(),ends_at:new Date(now+29*hr).toISOString(),capacity:20,available_spaces:5,is_booked:false},
      {session_id:'preview-3',name:'Evening Engine',description:'Intervals and functional conditioning.',starts_at:new Date(now+34*hr).toISOString(),ends_at:new Date(now+35*hr).toISOString(),capacity:20,available_spaces:8,is_booked:false},
      {session_id:'preview-4',name:'Hybrid Conditioning',description:'Mixed functional fitness.',starts_at:new Date(now+52*hr).toISOString(),ends_at:new Date(now+53*hr).toISOString(),capacity:16,available_spaces:2,is_booked:false}
    ]}
  }else{
    const from=new Date().toISOString(),to=new Date(Date.now()+30*86400000).toISOString();const {data,error}=await supabase.rpc('member_class_schedule',{p_gym_id:gymId,p_from:from,p_to:to});if(error){document.getElementById('classList').innerHTML=`<div class="empty">${esc(error.message||'Could not load classes.')}</div>`;return}sessions=data||[];
  }
  renderClasses();renderNextClasses();renderBookedSummary();
}

async function init(){
  if(!location.pathname.endsWith('/member.html')&&!isPreview)return;ensureHomeActions();ensureClassToolbar();ensureHomeSchedule();
  document.getElementById('homeClassClose')?.addEventListener('click',closeDetails);document.getElementById('homeClassModal')?.addEventListener('click',e=>{if(e.target.id==='homeClassModal')closeDetails()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetails()});
  if(isPreview){await loadSchedule();await loadPt();return}
  const {data:{session}}=await supabase.auth.getSession();if(!session?.user)return;userId=session.user.id;const {data:members}=await supabase.from('gym_members').select('gym_id').eq('user_id',userId).eq('is_active',true).limit(1);gymId=members?.[0]?.gym_id||null;if(!gymId)return;await Promise.all([loadSchedule(),loadPt()]);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
