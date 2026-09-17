(function(){
  function add(){
    if(!location.pathname.endsWith('/member.html')) return;
    document.querySelectorAll('.side .nav').forEach(nav=>{
      if(nav.querySelector('[data-social-link]')) return;
      const b=document.createElement('button');
      b.type='button';b.dataset.socialLink='1';b.textContent='✦ Social';b.onclick=()=>location.href='./social.html';
      const workouts=[...nav.querySelectorAll('button')].find(x=>/Workouts/i.test(x.textContent||''));
      if(workouts) nav.insertBefore(b,workouts); else nav.appendChild(b);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',add);else add();
})();