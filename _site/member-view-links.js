/* "View as member": keep the view flag on every link between the member pages.
   member.html only lets an owner/admin/staff/coach in when the URL says view=member, so any link to a
   member page that drops the flag sends them back to the admin dashboard. Real members (no flag) are untouched. */
(function(){
  const params=new URLSearchParams(location.search);
  const flag=params.get('view')==='member'?'view':params.get('preview')==='member'?'preview':'';
  if(!flag)return;
  const FAMILY=['member.html','social.html','groups.html','integrations.html'];
  function fix(root){
    (root||document).querySelectorAll('a[href]').forEach(a=>{
      const raw=a.getAttribute('href');
      if(!raw||raw.charAt(0)==='#')return;
      let u;try{u=new URL(raw,location.href)}catch(e){return}
      if(u.origin!==location.origin)return;
      const leaf=u.pathname.split('/').pop();
      if(!FAMILY.includes(leaf)||u.searchParams.has('view')||u.searchParams.has('preview'))return;
      u.searchParams.set(flag,'member');
      a.setAttribute('href','./'+leaf+u.search+u.hash);
    });
  }
  let queued=false;
  function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;fix()},0)}
  function start(){fix();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
