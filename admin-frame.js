import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const sb=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
const adminPages=new Set(['index.html','community.html','classes.html','class-setup.html','admin-operations.html','resource-availability.html','gym-layout.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html','member-memberships.html']);
const routes=[
 {key:'dashboard',label:'Dashboard',icon:'dashboard',view:'index.html'},
 {key:'community',label:'Community',icon:'community',view:'community.html'},
 {key:'classes',label:'Classes',icon:'classes',view:'classes.html'},
 {key:'services',label:'Services & resources',icon:'services',view:'admin-operations.html#resources'},
 {key:'staff',label:'Staff management',icon:'staff',view:'admin-operations.html#staff'},
 {key:'members',label:'Members',icon:'members',view:'index.html#members'},
 {key:'member-view',label:'Member view',icon:'profile',view:'member-view-settings.html'},
 {key:'reporting',label:'Reporting',icon:'reporting',view:'reporting.html'}
];
const frameA=document.getElementById('adminContentFrameA'),frameB=document.getElementById('adminContentFrameB'),nav=document.getElementById('adminFrameNav'),gymName=document.getElementById('adminFrameGym');
let activeFrame=frameA,inactiveFrame=frameB,currentView='',loadSeq=0;

function cleanView(raw){
 raw=String(raw||'index.html').replace(/^\.\//,'');
 const [path,hash='']=raw.split('#');
 const file=path.split('/').pop()||'index.html';
 if(!adminPages.has(file))return'index.html';
 return file+(hash?'#'+hash:'');
}
function embeddedUrl(view){
 const [file,hash='']=cleanView(view).split('#');
 const bust=file==='gym-layout.html'?'&v='+Date.now():'';
 return './'+file+'?embedded=1'+bust+(hash?'#'+hash:'');
}
function keyFor(view){
 const v=cleanView(view),[file,hash='']=v.split('#');
 if(file==='community.html')return'community';
 if(file==='classes.html'||file==='class-setup.html')return'classes';
 if(file==='admin-operations.html')return hash==='staff'?'staff':'services';
 if(file==='staff-permissions.html')return'staff';
 if(file==='resource-availability.html'||file==='gym-layout.html')return'services';
 if(file==='reporting.html')return'reporting';
 if(file==='member-view-settings.html')return'member-view';
 if(file==='index.html'&&hash==='members')return'members';
 if(file==='index.html')return'dashboard';
 return '';
}
function drawNav(){
 const active=keyFor(currentView);
 nav.innerHTML=routes.map(r=>'<a href="./admin.html?view='+encodeURIComponent(r.view)+'" data-view="'+r.view+'" class="'+(r.key===active?'active':'')+'">'+(window.HybridShell?.icon(r.icon)||'')+'<span>'+r.label+'</span></a>').join('');
 nav.querySelectorAll('[data-view]').forEach(a=>a.onclick=e=>{e.preventDefault();navigate(a.dataset.view,true);closeMenu()});
}
function swapTo(view){
 const seq=++loadSeq,target=inactiveFrame,previous=activeFrame;
 target.onload=()=>{
   if(seq!==loadSeq)return;
   target.onload=null;
   target.classList.add('active');
   previous.classList.remove('active');
   activeFrame=target;
   inactiveFrame=previous;
 };
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
 const b=document.createElement('button');b.className='admin-frame-mobile';b.type='button';b.setAttribute('aria-label','Open admin menu');b.textContent='☰';
 const d=document.createElement('div');d.className='admin-frame-backdrop';d.onclick=closeMenu;
 b.onclick=()=>document.body.classList.toggle('admin-frame-menu-open');
 document.body.append(b,d);
}
async function init(){
 const{data:{session}}=await sb.auth.getSession();if(!session){location.replace('./index.html');return}
 const{data:gm}=await sb.from('gym_members').select('gym_id,role,gyms(name)').eq('user_id',session.user.id).eq('is_active',true).limit(1);
 if(!gm?.length){location.replace('./index.html');return}
 let allowed=['owner','admin'].includes(gm[0].role);
 if(!allowed&&['staff','coach'].includes(gm[0].role)){
   const{data:sa}=await sb.from('staff_access').select('permissions').eq('gym_id',gm[0].gym_id).eq('user_id',session.user.id).maybeSingle();
   allowed=sa?.permissions?.full_access===true;
 }
 if(!allowed){location.replace('./staff.html');return}
 gymName.textContent=gm[0].gyms?.name||'Gym';
 window.HybridShell?.apply();
 mobile();
 const start=cleanView(new URLSearchParams(location.search).get('view')||'index.html');
 currentView=start;drawNav();activeFrame.src=embeddedUrl(start);
}
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.data?.type!=='hybrid-admin-nav')return;
 if(e.source!==activeFrame.contentWindow)return;
 navigate(e.data.view,true);
});
window.addEventListener('popstate',()=>navigate(new URLSearchParams(location.search).get('view')||'index.html',false));
init();
