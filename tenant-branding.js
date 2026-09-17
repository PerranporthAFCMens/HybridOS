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

  function isoWeek(date){
    const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
    const day=d.getUTCDay()||7;
    d.setUTCDate(d.getUTCDate()+4-day);
    const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d-yearStart)/86400000)+1)/7);
  }

  function demoWeeklyCode(){
    const d=new Date();
    const week=isoWeek(d);
    return String(3100+((week*137)%5900)).padStart(4,'0');
  }

  function addDoorAccessCard(){
    if(!location.pathname.endsWith('/member-preview.html')) return;
    const side=document.querySelector('.side');
    const gym=document.querySelector('.side .gym');
    if(!side||!gym||document.querySelector('.door-access-card')) return;
    const card=document.createElement('div');
    card.className='door-access-card';
    card.innerHTML='\
      <div class="door-access-head">\
        <span class="door-key-icon" aria-hidden="true">🔑</span>\
        <div><small>Door access</small><strong>Weekly code</strong></div>\
      </div>\
      <button type="button" class="door-code-reveal" aria-expanded="false">Tap to reveal</button>\
      <div class="door-code-value" hidden>'+demoWeeklyCode()+'</div>\
      <div class="door-code-note">Changes each week</div>';
    gym.insertAdjacentElement('afterend',card);
    const reveal=card.querySelector('.door-code-reveal');
    const value=card.querySelector('.door-code-value');
    reveal.addEventListener('click',function(){
      const showing=!value.hidden;
      value.hidden=showing;
      reveal.textContent=showing?'Tap to reveal':'Hide code';
      reveal.setAttribute('aria-expanded',showing?'false':'true');
    });
  }

  function init(){addLogoToGymCards();addTopBrand();ensureGymName();addDoorAccessCard();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
