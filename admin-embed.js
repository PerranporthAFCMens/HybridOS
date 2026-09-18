(function(){
  const qs=new URLSearchParams(location.search);
  if(qs.get('embedded')!=='1')return;
  document.documentElement.classList.add('admin-embedded');
  const adminPages=new Set(['index.html','community.html','classes.html','class-setup.html','admin-operations.html','resource-availability.html','staff-permissions.html','access-settings.html','reporting.html','member-view-settings.html','member-memberships.html']);

  function viewFromUrl(href){
    try{
      const u=new URL(href,location.href);
      if(u.origin!==location.origin)return null;
      const file=u.pathname.split('/').pop()||'index.html';
      if(!adminPages.has(file))return null;
      return file+(u.hash||'');
    }catch(_e){return null}
  }
  function send(view){
    if(!view)return false;
    parent.postMessage({type:'hybrid-admin-nav',view},location.origin);
    return true;
  }

  function signalReady(){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      parent.postMessage({type:'hybrid-admin-ready'},location.origin);
    }));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',signalReady,{once:true});
  else signalReady();

  document.addEventListener('click',e=>{
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    const a=e.target.closest?.('a[href]');if(!a||a.target==='_blank'||a.hasAttribute('download'))return;
    const view=viewFromUrl(a.href);if(!view)return;
    e.preventDefault();send(view);
  },true);

  window.HybridAdminFrame={navigate:send};
})();