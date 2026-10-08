import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const sb=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
const shellVersion=new URL(import.meta.url).searchParams.get('v')||Date.now().toString();
const HUB_GYM_ID='242f57c2-6e37-4977-b3c5-1c87de7d0b98',PUFFIN_GYM_ID='aec16956-3793-4543-873b-4412646ca1eb';
function routeGymId(){return new URLSearchParams(location.search).get('gym_id')||sessionStorage.getItem('hybrid-gym-id')||''}
function gymEntryUrl(gymId=routeGymId()){const u=new URL('./choose-gym.html',location.href);if(gymId)u.searchParams.set('gym_id',gymId);return u.toString()}
function gymLoginUrl(returnHere=true){
  const gymId=routeGymId(),u=new URL('./login.html',location.href);
  if(gymId)u.searchParams.set('gym_id',gymId);
  if(returnHere){const ret=new URL(location.href);if(gymId)ret.searchParams.set('gym_id',gymId);u.searchParams.set('return_to',ret.toString())}
  return u.toString();
}
const adminPages=new Set(['index.html','community.html','classes.html','class-setup.html','workout-builder.html','admin-access.html','admin-operations.html','resource-availability.html','gym-layout.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html','member-memberships.html','communications.html']);
const routes=[
 {key:'dashboard',label:'Today',icon:'home',view:'index.html'},
 {key:'members',label:'Members',icon:'members',view:'index.html#members'},
 {key:'classes',label:'Classes and workouts',icon:'classes',view:'classes.html'},
 {key:'community',label:'Messages and community',icon:'community',view:'communications.html'},
 {key:'reporting',label:'Reports',icon:'reporting',view:'reporting.html'},
 {key:'settings',label:'Settings and staff',icon:'admin',view:'admin-operations.html#staff'},
 {key:'member-view',label:'Preview as member',icon:'profile',href:'./member.html?view=member',section:'Preview'},
 {key:'staff-view',label:'Preview as staff',icon:'staff',href:'./staff.html?view=staff'}
];
const frameA=document.getElementById('adminContentFrameA'),frameB=document.getElementById('adminContentFrameB'),nav=document.getElementById('adminFrameNav'),gymName=document.getElementById('adminFrameGym'),frameMain=document.querySelector('.admin-frame-main');
let activeFrame=frameA,inactiveFrame=frameB,currentView='',loadSeq=0,pendingSwap=null,initialReadyFallback=null;
function markFrameReady(){
 if(initialReadyFallback){clearTimeout(initialReadyFallback);initialReadyFallback=null}
 frameMain?.classList.add('admin-frame-content-ready');
 frameMain?.setAttribute('aria-busy','false');
}

function cleanView(raw){
 raw=String(raw||'index.html').replace(/^\.\//,'');
 const [path,hash='']=raw.split('#');
 const file=path.split('/').pop()||'index.html';
 if(!adminPages.has(file))return'index.html';
 return file+(hash?'#'+hash:'');
}
function embeddedUrl(view){
 const [file,hash='']=cleanView(view).split('#');
 const gymId=sessionStorage.getItem('hybrid-gym-id')||'';
 return './'+file+'?embedded=1&v='+encodeURIComponent(shellVersion)+(gymId?'&gym_id='+encodeURIComponent(gymId):'')+(hash?'#'+hash:'');
}
function keyFor(view){
 const v=cleanView(view),[file,hash='']=v.split('#');
 if(file==='community.html'||file==='communications.html')return'community';
 if(file==='classes.html'||file==='class-setup.html'||file==='workout-builder.html')return'classes';
 if(['admin-operations.html','staff-permissions.html','admin-access.html','resource-availability.html','gym-layout.html','access-settings.html','member-view-settings.html'].includes(file))return'settings';
 if(file==='reporting.html')return'reporting';
 if(file==='index.html'&&(hash==='members'||hash==='memberships'))return'members';
 if(file==='index.html'&&hash==='community')return'community';
 if(file==='index.html')return'dashboard';
 return '';
}
function drawNav(){
 const active=keyFor(currentView);
 nav.innerHTML=routes.map(r=>{
   const section=r.section?'<div class="admin-frame-section-label">'+r.section+'</div>':'';
   const link=r.href?'<a href="'+r.href+'" class="'+(r.key===active?'active':'')+'">'+(window.HybridShell?.icon(r.icon)||'')+'<span>'+r.label+'</span></a>':'<a href="./admin.html?view='+encodeURIComponent(r.view)+'" data-view="'+r.view+'" class="'+(r.key===active?'active':'')+'">'+(window.HybridShell?.icon(r.icon)||'')+'<span>'+r.label+'</span></a>';
   return section+link;
 }).join('');
 nav.querySelectorAll('[data-view]').forEach(a=>a.onclick=e=>{e.preventDefault();navigate(a.dataset.view,true);closeMenu()});
}
function completeSwap(seq,target,previous){
 if(!pendingSwap||pendingSwap.seq!==seq||seq!==loadSeq||pendingSwap.target!==target)return;
 clearTimeout(pendingSwap.fallback);
 pendingSwap=null;
 target.classList.add('active');
 previous.classList.remove('active');
 activeFrame=target;
 inactiveFrame=previous;
 markFrameReady();
}
function swapTo(view){
 const seq=++loadSeq,target=inactiveFrame,previous=activeFrame;
 if(pendingSwap?.fallback)clearTimeout(pendingSwap.fallback);
 target.onload=()=>{
   if(seq!==loadSeq)return;
   target.onload=null;
   // Fallback only. Keep the previous page visible while the destination starts.
   // Eight seconds gives the embedded page time to render or show its own recovery state.
   if(pendingSwap)pendingSwap.fallback=setTimeout(()=>completeSwap(seq,target,previous),8000);
 };
 pendingSwap={seq,target,previous,fallback:null};
 target.src=embeddedUrl(view);
}
function navigate(view,push){
 view=cleanView(view);
 if(view===currentView)return;
 currentView=view;drawNav();
 swapTo(view);
 if(push){
   const u=new URL(location.href);u.searchParams.set('view',view);history.pushState({view},'',u);
 }
}
function closeMenu(){document.body.classList.remove('admin-frame-menu-open')}
function mobile(){
 const b=document.createElement('button');b.className='admin-frame-mobile';b.type='button';b.setAttribute('aria-label','Open admin menu');b.innerHTML='<i class="hi hi-menu" aria-hidden="true"></i>';
 const d=document.createElement('div');d.className='admin-frame-backdrop';d.onclick=closeMenu;
 b.onclick=()=>document.body.classList.toggle('admin-frame-menu-open');
 document.body.append(b,d);
}
async function init(){
 const requested=cleanView(new URLSearchParams(location.search).get('view')||'index.html');
 const{data:{session}}=await sb.auth.getSession();if(!session){location.replace(gymLoginUrl(true));return}
 const{data:gms,error:gmErr}=await sb.from('gym_members').select('gym_id,role,gyms(name,logo_url)').eq('user_id',session.user.id).eq('is_active',true);
 if(gmErr||!gms?.length){location.replace(gymEntryUrl());return}
 const params=new URLSearchParams(location.search);
 const explicitGymId=params.get('gym_id')||'';
 const storedGymId=sessionStorage.getItem('hybrid-gym-id')||'';
 let selectedGymId=explicitGymId||storedGymId||'';
 let membership=selectedGymId?gms.find(x=>x.gym_id===selectedGymId):null;
 if(!membership&&!explicitGymId&&!storedGymId&&gms.length===1){
   membership=gms[0];
   selectedGymId=membership.gym_id;
 }
 if(!membership){location.replace(gymEntryUrl(selectedGymId));return}
 window.HybridGymContext.setGym(membership.gym_id);
 if(!params.get('gym_id')){
   params.set('gym_id',membership.gym_id);
   history.replaceState(history.state,'',location.pathname+'?'+params.toString());
 }
 let allowed=['owner','admin'].includes(membership.role);
 if(!allowed&&['staff','coach'].includes(membership.role)){
   const{data:sa}=await sb.from('staff_access').select('permissions').eq('gym_id',membership.gym_id).eq('user_id',session.user.id).maybeSingle();
   allowed=sa?.permissions?.full_access===true;
 }
 if(!allowed){location.replace('./staff.html');return}
 gymName.textContent=membership.gyms?.name||'Gym';
 {const card=gymName.closest('.gym'),url=membership.gyms?.logo_url;
  if(card&&url&&/^https?:/i.test(url)){let img=card.querySelector('.tenant-gym-logo');if(!img){img=document.createElement('img');card.insertBefore(img,card.firstChild)}img.className='tenant-gym-logo uploaded';img.src=url;img.alt=membership.gyms?.name||'Gym logo'}}
 window.HybridShell?.apply();
 mobile();
 const start=requested;
 currentView=start;drawNav();
 frameMain?.classList.remove('admin-frame-content-ready');
 frameMain?.setAttribute('aria-busy','true');
 activeFrame.onload=()=>{
   activeFrame.onload=null;
   // The explicit ready message normally wins. If it never arrives, reveal the
   // embedded page after its own startup/recovery layer has had time to settle.
   initialReadyFallback=setTimeout(markFrameReady,8000);
 };
 activeFrame.src=embeddedUrl(start);
}
window.addEventListener('message',e=>{
 if(e.origin!==location.origin)return;
 if(e.data?.type==='hybrid-admin-ready'){
   if(pendingSwap&&e.source===pendingSwap.target.contentWindow)completeSwap(pendingSwap.seq,pendingSwap.target,pendingSwap.previous);
   else if(e.source===activeFrame.contentWindow)markFrameReady();
   return;
 }
 if(e.data?.type!=='hybrid-admin-nav'||e.source!==activeFrame.contentWindow)return;
 navigate(e.data.view,true);
});
window.addEventListener('popstate',()=>navigate(new URLSearchParams(location.search).get('view')||'index.html',false));
init();
