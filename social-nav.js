(function(){
  function add(){
    const path=location.pathname;
    if(!(path.endsWith('/member.html')||path.endsWith('/member-preview.html'))) return;
    document.querySelectorAll('.side .nav').forEach(nav=>{
      if(nav.querySelector('[data-social-link]')) return;
      const isAnchorNav=!!nav.querySelector('a');
      const item=isAnchorNav?document.createElement('a'):document.createElement('button');
      if(isAnchorNav){item.href='./social.html'}else{item.type='button';item.onclick=()=>location.href='./social.html'}
      item.dataset.socialLink='1';item.textContent='✦ Social';
      const children=[...nav.querySelectorAll('button,a')];
      const workouts=children.find(x=>/Workouts/i.test(x.textContent||''));
      if(workouts) nav.insertBefore(item,workouts); else nav.appendChild(item);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',add);else add();
})();