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
 window.HybridGymContext={SESSION_KEY,LAST_KEY,currentGymId,setGym,clearGym,safeReturn,destination,loginUrl,chooserUrl};
})();