(function(){
  const logo='./assets/hybrid-hub-logo-horizontal.svg';
  const gymName='Hybrid Hub';

  function addLogoToGymCards(){
    document.querySelectorAll('.gym').forEach(function(card){
      if(card.querySelector('.tenant-gym-logo')) return;
      const img=document.createElement('img');
      img.src=logo;
      img.alt=gymName;
      img.className='tenant-gym-logo';
      card.insertBefore(img,card.firstChild);
    });
  }

  function addTopBrand(){
    const path=location.pathname;
    if(!(path.endsWith('/member.html')||path.endsWith('/member-preview.html'))) return;
    const main=document.querySelector('.main');
    const top=document.querySelector('.main .top');
    if(!main||!top||document.querySelector('.tenant-top-brand')||document.querySelector('.member-gym-logo')) return;
    const wrap=document.createElement('div');
    wrap.className='tenant-top-brand';
    wrap.innerHTML='<img src="'+logo+'" alt="'+gymName+'">';
    main.insertBefore(wrap,top);
  }

  function ensureGymName(){
    document.querySelectorAll('.gym').forEach(function(card){
      const nodes=[...card.querySelectorAll('div')];
      nodes.forEach(function(node){
        const t=(node.textContent||'').trim();
        if(t==='Puffin Performance') node.textContent=gymName;
      });
    });
  }

  function init(){addLogoToGymCards();addTopBrand();ensureGymName();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
