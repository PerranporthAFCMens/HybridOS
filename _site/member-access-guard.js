/* Membership status guard for member-facing pages (member, social, groups, integrations).
   UI layer only. Database enforcement is a separate, separately approved stage.
   The newest membership row for the SELECTED gym decides; owners, admins, staff and coaches bypass. */
(function(){
 if(window.HybridMemberAccessGuard)return;
 const SUPABASE_URL='https://mzgnhmeydhhpzgxlgudh.supabase.co',SUPABASE_KEY='sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD';
 const leaf=(location.pathname.split('/').pop()||'').toLowerCase();
 const isMemberHome=leaf==='member.html';
 const COPY={
  ended:{title:'Your membership has ended',body:'Contact your gym to renew your membership.'},
  paused:{title:'Your membership is paused',body:'This page is not available while your membership is paused. Contact your gym to resume it.'},
  pending:{title:'Your membership has not started yet',body:'This page is not available until your membership is active. Contact your gym if you need help.'}
 };
 const BANNER={
  paused:'Your membership is paused. You can still see your workouts and personal bests, but classes and booking are unavailable. Contact your gym to resume.',
  pending:'Your membership has not started yet. Contact your gym if you need help.'
 };
 let clientPromise=null;
 function makeClient(){
  if(!clientPromise)clientPromise=(async()=>{
   let createClient;
   try{({createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'))}
   catch(e){({createClient}=await import('https://esm.sh/@supabase/supabase-js@2'))}
   return createClient(SUPABASE_URL,SUPABASE_KEY);
  })();
  return clientPromise;
 }
 function onReady(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});else fn()}
 function addStyle(){
  if(document.getElementById('hybridMemberAccessStyle'))return;
  const st=document.createElement('style');st.id='hybridMemberAccessStyle';
  st.textContent=[
   '#hybridMemberStatusBanner{margin:0 0 14px;padding:12px 14px;border-radius:14px;background:#fffaeb;border:1px solid #fedf89;color:#93370d;font-size:14px;line-height:1.45;font-weight:600}',
   '#hybridMemberAccessBlock{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;background:#f5f7fb;color:#101828;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}',
   '#hybridMemberAccessBlock .hmab-card{max-width:440px;width:100%;background:#fff;border:1px solid #e7ebf2;border-radius:20px;padding:26px;box-shadow:0 14px 34px rgba(16,24,40,.08);text-align:center}',
   '#hybridMemberAccessBlock h1{font-size:22px;margin:0 0 10px}',
   '#hybridMemberAccessBlock p{margin:0 0 18px;color:#667085;line-height:1.5}',
   '#hybridMemberAccessBlock .hmab-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}',
   '#hybridMemberAccessBlock a{display:inline-block;padding:11px 16px;border-radius:12px;font-weight:800;text-decoration:none;border:1px solid #e7ebf2;color:#101828;background:#fff}',
   '#hybridMemberAccessBlock a.hmab-primary{background:#0b1020;color:#fff;border-color:#0b1020}',
   'html[data-member-access="paused"] [data-page="classes"],html[data-member-access="paused"] .nav a,html[data-member-access="paused"] #classes,html[data-member-access="paused"] .card:has(#nextClasses),html[data-member-access="paused"] .card:has(#upcomingCount),html[data-member-access="paused"] #newWorkoutBtn,html[data-member-access="paused"] #newPbBtn,html[data-member-access="paused"] [data-del-workout],html[data-member-access="paused"] [data-del-pb]{display:none!important}',
   'html[data-member-access="pending"] .nav>*:not([data-page="membership"]),html[data-member-access="pending"] .bottom{display:none!important}'
  ].join('\n');
  document.head.appendChild(st);
 }
 function block(kind,gymId){
  if(document.getElementById('hybridMemberAccessBlock'))return;
  const copy=COPY[kind]||COPY.ended;
  const wrap=document.createElement('div');wrap.id='hybridMemberAccessBlock';wrap.setAttribute('role','alertdialog');wrap.setAttribute('aria-modal','true');
  const card=document.createElement('div');card.className='hmab-card';
  const h=document.createElement('h1');h.textContent=copy.title;
  const p=document.createElement('p');p.textContent=copy.body;
  const actions=document.createElement('div');actions.className='hmab-actions';
  if(kind==='paused'||kind==='pending'){
   const back=document.createElement('a');back.className='hmab-primary';
   const u=new URL('./member.html',location.href);if(gymId)u.searchParams.set('gym_id',gymId);u.hash='membership';
   back.href=u.toString();back.textContent='My membership';actions.appendChild(back);
  }
  const out=document.createElement('a');out.href='./sign-out.html';out.textContent='Sign out';
  if(kind==='ended')out.className='hmab-primary';
  actions.appendChild(out);
  card.appendChild(h);card.appendChild(p);card.appendChild(actions);wrap.appendChild(card);document.body.appendChild(wrap);
 }
 function banner(kind){
  onReady(()=>{
   if(document.getElementById('hybridMemberStatusBanner'))return;
   const host=document.querySelector('main.main')||document.querySelector('main')||document.body;
   const el=document.createElement('div');el.id='hybridMemberStatusBanner';el.setAttribute('role','status');el.textContent=BANNER[kind]||'';
   host.insertBefore(el,host.firstChild);
  });
 }
 function apply(res){
  const access=res.access;
  document.documentElement.setAttribute('data-member-access',access);
  if(access==='active'||access==='privileged'||access==='none')return;
  addStyle();
  if(access==='ended'){onReady(()=>block('ended',res.gymId));return}
  if(!isMemberHome){onReady(()=>block(access,res.gymId));return}
  banner(access);
  try{
   if(access==='pending'&&location.hash!=='#membership')history.replaceState(null,'','#membership');
   else if(access==='paused'&&location.hash==='#classes')history.replaceState(null,'','#home');
  }catch(e){}
 }
 const open={resolved:false,blocked:false,access:'none',membership:null};
 async function resolve(options){
  const o=options||{};
  try{
   const ctx=window.HybridGymContext;
   if(!ctx||typeof ctx.getMembershipAccess!=='function')return {...open,reason:'no_context'};
   const gymId=o.gymId||new URLSearchParams(location.search).get('gym_id')||ctx.currentGymId();
   if(!gymId)return {...open,reason:'no_gym'};
   const client=o.client||await makeClient();
   let userId=o.userId||'';
   if(!userId){const s=await client.auth.getSession();userId=s?.data?.session?.user?.id||''}
   if(!userId)return {...open,reason:'no_session'};
   const res=await ctx.getMembershipAccess({client,userId,gymId});
   const blocked=res.access==='ended'||(!isMemberHome&&(res.access==='paused'||res.access==='pending'));
   const out={...res,resolved:true,blocked};
   apply(out);
   return out;
  }catch(e){
   console.warn('Membership access check failed; page left unrestricted at UI level',e);
   return {...open,reason:'error'};
  }
 }
 window.HybridMemberAccessGuard={resolve,apply};
 window.HybridMemberAccessReady=resolve();
})();
