(function(){
  const ICONS={
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect>',
    home:'<path d="M3 11.5 12 4l9 7.5"></path><path d="M5 10.5V20h5v-5h4v5h5v-9.5"></path>',
    community:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.6-4.8A7 7 0 0 1 3 12c0-4 3.6-7 8-7h3c4.4 0 8 3 8 7 0 1.1-.3 2.1-1 3z"></path><path d="M8 12h.01M12 12h.01M16 12h.01"></path>',
    social:'<path d="M4 5.5h11a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H9l-4.5 3 .9-3.5A3 3 0 0 1 3 11V8.5a3 3 0 0 1 1-3z"></path><path d="M13 17h3l4 2.5-.8-3.1A3 3 0 0 0 21 13.7V11a3 3 0 0 0-2-2.8"></path><path d="M7 9.5h7M7 12h4"></path>',
    groups:'<circle cx="12" cy="7" r="3"></circle><circle cx="5.5" cy="10" r="2.5"></circle><circle cx="18.5" cy="10" r="2.5"></circle><path d="M6.8 20a5.2 5.2 0 0 1 10.4 0"></path><path d="M1.8 19a4 4 0 0 1 5.4-3.7M22.2 19a4 4 0 0 0-5.4-3.7"></path>',
    classes:'<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path>',
    services:'<rect x="3" y="4" width="8" height="6" rx="1.5"></rect><rect x="13" y="4" width="8" height="6" rx="1.5"></rect><rect x="3" y="14" width="8" height="6" rx="1.5"></rect><rect x="13" y="14" width="8" height="6" rx="1.5"></rect><path d="M7 10v4M17 10v4"></path>',
    staff:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>',
    members:'<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>',
    profile:'<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>',
    reporting:'<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"></path><path d="M2 21h22"></path>',
    workouts:'<path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"></path>',
    pbs:'<path d="M8 21h8M12 17v4"></path><path d="M7 4h10v4a5 5 0 0 1-10 0V4z"></path><path d="M7 6H4v1a4 4 0 0 0 4 4M17 6h3v1a4 4 0 0 1-4 4"></path>',
    membership:'<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M7 9h4M7 13h2M15 9h2"></path>',
    integrations:'<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"></path><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"></path>',
    timetable:'<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path>',
    admin:'<path d="M12 3 4 7v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V7l-8-4z"></path><path d="M9 12h6M12 9v6"></path>'
  };

  function icon(name,cls='hybrid-nav-icon'){
    return '<svg class="'+cls+'" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[name]||'')+'</svg>';
  }

  function normaliseChrome(side){
    if(!side)return;
    let brand=side.querySelector('.brand-logo,.brand,.logo');
    if(!brand){brand=document.createElement('div');side.prepend(brand)}
    brand.className='logo brand-logo hybrid-shell-brand';
    brand.innerHTML='<svg class="brand-mark" viewBox="0 0 54 48" aria-hidden="true"><path d="M6 42 L27 6 M12 42 L30 11 M18 42 L33 16 M48 42 L27 6 M42 42 L24 11 M36 42 L21 16"/></svg><span class="brand-word">HYBRID <b>OS</b></span>';

    const gym=side.querySelector('.gym');
    if(gym){
      gym.classList.add('hybrid-shell-gym');
      let logo=gym.querySelector('.tenant-gym-logo');
      if(!logo){
        logo=gym.querySelector('img');
        if(logo)logo.classList.add('tenant-gym-logo');
        else{
          logo=document.createElement('img');
          logo.src='./assets/hybrid-hub-logo-horizontal.svg';
          logo.alt='Hybrid Hub';
          logo.className='tenant-gym-logo';
          gym.insertBefore(logo,gym.firstChild);
        }
      }
    }
  }

  function decorateNav(side){
    if(!side)return;
    side.querySelectorAll('.nav [data-shell-icon]').forEach(item=>{
      item.querySelectorAll('.hybrid-nav-icon').forEach(svg=>svg.remove());
      item.insertAdjacentHTML('afterbegin',icon(item.dataset.shellIcon));
      if(!item.querySelector(':scope > span')){
        const text=[...item.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim();
        if(text){
          [...item.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.remove());
          const span=document.createElement('span');span.textContent=text;item.appendChild(span);
        }
      }
    });
  }

  function apply(root=document){
    root.querySelectorAll('.side').forEach(side=>{normaliseChrome(side);decorateNav(side)});
  }

  window.HybridShell={ICONS,icon,apply,normaliseChrome,decorateNav};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>apply());else apply();
})();