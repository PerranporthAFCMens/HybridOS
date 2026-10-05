(function(){
 const SESSION_KEY='hybrid-gym-id',LAST_KEY='hybrid-last-gym-id';
 function currentGymId(){return sessionStorage.getItem(SESSION_KEY)||''}
 function setGym(id){const value=String(id||'');if(!value)return;sessionStorage.setItem(SESSION_KEY,value);try{localStorage.setItem(LAST_KEY,value)}catch{}}
 function clearGym(){sessionStorage.removeItem(SESSION_KEY)}
 function appRoot(){return location.pathname.includes('/HybridOS/')?'/HybridOS/':'/'}
 function safeReturn(raw,gymId=''){if(!raw)return'';try{const target=new URL(raw,location.href);if(target.origin!==location.origin||!target.pathname.startsWith(appRoot()))return'';const leaf=target.pathname.split('/').pop()||'';if(['login.html','choose-gym.html','hybrid-hub-login.html','puffin-performance-login.html'].includes(leaf))return'';if(gymId)target.searchParams.set('gym_id',gymId);return target.toString()}catch{return''}}
 function destination(membership){const gymId=String(membership?.gym_id||''),role=String(membership?.role||'');let page='./member.html';if(['owner','admin'].includes(role))page='./admin.html';else if(['staff','coach'].includes(role))page='./staff.html';const url=new URL(page,location.href);if(gymId)url.searchParams.set('gym_id',gymId);return url.toString()}
 function loginUrl({gymId='',returnTo=''}={}){const u=new URL('./login.html',location.href);if(gymId)u.searchParams.set('gym_id',gymId);if(returnTo)u.searchParams.set('return_to',returnTo);return u.toString()}
 function chooserUrl({returnTo='',switching=false}={}){const u=new URL('./choose-gym.html',location.href);if(returnTo)u.searchParams.set('return_to',returnTo);if(switching)u.searchParams.set('switch','1');return u.toString()}
 /* Membership access for the SELECTED gym only. The newest membership row for this user and gym governs,
    whatever its status (never filter by status before choosing the row, and never fall back to another gym).
    access: privileged | active | paused | pending | ended | none. 'none' means no usable gym access (the page's own routing handles it). */
 async function getMembershipAccess({client,userId,gymId,includeMembership=false}={}){
  const uid=String(userId||''),gid=String(gymId||currentGymId()||'');
  const base={gymId:gid,userId:uid,role:'',privileged:false,membership:null,status:'',effectiveStatus:'',access:'none',reason:''};
  if(!client)throw new Error('A Supabase client is required');
  if(!uid||!gid)return {...base,reason:'missing_context'};
  const gmq=await client.from('gym_members').select('gym_id,role,is_active,access_status').eq('gym_id',gid).eq('user_id',uid).maybeSingle();
  if(gmq.error)throw gmq.error;
  const gm=gmq.data;
  if(!gm||gm.is_active!==true||gm.access_status!=='active')return {...base,role:String(gm?.role||''),reason:'no_active_gym_access'};
  const role=String(gm.role||'');
  const privileged=['owner','admin','staff','coach'].includes(role);
 /* Privileged roles bypass blocking screens only. Callers that need the role-holder's own membership (Member Coach) pass includeMembership. */
 if(privileged&&!includeMembership)return {...base,role,privileged:true,status:'active',effectiveStatus:'active',access:'privileged',reason:'role_bypass'};
  const mq=await client.from('memberships').select('id,status,starts_on,ends_on,created_at,membership_plans(name,description,price_pence,billing_interval)').eq('gym_id',gid).eq('user_id',uid).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1);
  if(mq.error)throw mq.error;
  const membership=mq.data?.[0]||null;
  if(!membership)return privileged?{...base,role,privileged:true,access:'privileged',reason:'role_bypass_no_membership'}:{...base,role,access:'pending',status:'pending',effectiveStatus:'pending',reason:'no_membership'};
  let effective=String(membership.status||'pending');
  const today=new Date().toISOString().slice(0,10);
  if(!['cancelled','expired'].includes(effective)&&membership.ends_on&&String(membership.ends_on)<today)effective='expired';
  const access=effective==='active'?'active':effective==='paused'?'paused':effective==='pending'?'pending':'ended';
  if(privileged)return {...base,role,privileged:true,membership,status:String(membership.status||''),effectiveStatus:effective,access:'privileged',reason:'role_bypass_membership'};
 return {...base,role,membership,status:String(membership.status||''),effectiveStatus:effective,access,reason:'membership'};
 }
 window.HybridGymContext={SESSION_KEY,LAST_KEY,currentGymId,setGym,clearGym,safeReturn,destination,loginUrl,chooserUrl,getMembershipAccess};
})();
