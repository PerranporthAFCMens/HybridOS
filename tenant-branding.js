(function(){
  const logo='./assets/hybrid-hub-logo-horizontal.svg';
  const gymName='Hybrid Hub';

  function addLogoToGymCards(){
    document.querySelectorAll('.gym').forEach(function(card){
      if(card.querySelector('.tenant-gym-logo')) return;
      const img=document.createElement('img');
      img.src=logo; img.alt=gymName; img.className='tenant-gym-logo';
      card.insertBefore(img,card.firstChild);
    });
  }

  function addTopBrand(){
    const path=location.pathname;
    if(!(path.endsWith('/member.html')||path.endsWith('/member-preview.html'))) return;
    const main=document.querySelector('.main'),top=document.querySelector('.main .top');
    if(!main||!top||document.querySelector('.tenant-top-brand')||document.querySelector('.member-gym-logo')) return;
    const wrap=document.createElement('div'); wrap.className='tenant-top-brand';
    wrap.innerHTML='<img src="'+logo+'" alt="'+gymName+'">'; main.insertBefore(wrap,top);
  }

  function ensureGymName(){
    document.querySelectorAll('.gym').forEach(function(card){
      [...card.querySelectorAll('div')].forEach(function(node){if((node.textContent||'').trim()==='Puffin Performance') node.textContent=gymName;});
    });
  }

  function addAdminOperationsNav(){
    if(!location.pathname.endsWith('/index.html') && !location.pathname.endsWith('/HybridOS/')) return;
    document.querySelectorAll('.nav').forEach(function(nav){
      if(nav.querySelector('[data-operations-link]')) return;
      const reference=[...nav.querySelectorAll('button')].find(b=>/Memberships/i.test(b.textContent||''));
      const b=document.createElement('button'); b.type='button'; b.dataset.operationsLink='1'; b.textContent='⚙ Staff & resources';
      b.onclick=()=>location.href='./admin-operations.html';
      if(reference) nav.insertBefore(b,reference); else nav.appendChild(b);
    });
    document.querySelectorAll('.mobile-nav').forEach(function(nav){
      if(nav.querySelector('[data-operations-link]')) return;
      const b=document.createElement('button'); b.type='button'; b.dataset.operationsLink='1'; b.innerHTML='⚙<br>Ops'; b.onclick=()=>location.href='./admin-operations.html'; nav.appendChild(b);
      nav.style.gridTemplateColumns='repeat('+nav.children.length+',1fr)';
    });
  }

  function isoWeek(date){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const y=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil((((d-y)/86400000)+1)/7)}
  function demoWeeklyCode(){return String(3100+((isoWeek(new Date())*137)%5900)).padStart(4,'0')}

  function addDoorAccessCard(){
    if(!location.pathname.endsWith('/member-preview.html')) return;
    const gym=document.querySelector('.side .gym'); if(!gym||document.querySelector('.door-access-card')) return;
    const card=document.createElement('div'); card.className='door-access-card';
    card.innerHTML='<div class="door-access-head"><span class="door-key-icon" aria-hidden="true">🔑</span><div><small>Door access</small><strong>Weekly code</strong></div></div><button type="button" class="door-code-reveal" aria-expanded="false">Tap to reveal</button><div class="door-code-value" hidden>'+demoWeeklyCode()+'</div><div class="door-code-note">Changes each week</div>';
    gym.insertAdjacentElement('afterend',card); const reveal=card.querySelector('.door-code-reveal'),value=card.querySelector('.door-code-value');
    reveal.addEventListener('click',function(){const showing=!value.hidden;value.hidden=showing;reveal.textContent=showing?'Tap to reveal':'Hide code';reveal.setAttribute('aria-expanded',showing?'false':'true')});
  }

  function fixMemberPreviewClasses(){
    if(!location.pathname.endsWith('/member-preview.html')) return;
    if(!document.getElementById('member-preview-class-modal-style')){
      const style=document.createElement('style');style.id='member-preview-class-modal-style';style.textContent=`
        .hidden{display:none!important} #homeClassModal.modal{position:fixed!important;inset:0!important;z-index:1000!important;background:rgba(11,16,32,.58)!important;display:grid!important;place-items:center!important;padding:20px!important}
        #homeClassModal.modal.hidden{display:none!important} #homeClassModal .modal-card{background:#fff!important;border-radius:22px!important;padding:22px!important;width:min(560px,100%)!important;max-height:90vh!important;overflow:auto!important;box-shadow:0 28px 80px rgba(0,0,0,.28)!important}
        #homeClassModal .actions{display:flex!important;gap:10px!important;flex-wrap:wrap!important;margin-top:18px!important} #homeClassModal .btn.primary{background:#0b1020!important;color:#fff!important} #homeClassModal .section-title{align-items:flex-start!important} #homeClassModal h3{font-size:24px!important} #homeClassModal .msg{min-height:20px!important;margin-top:10px!important;font-size:13px!important;color:#067647!important}
        #home .wide .row,#classes .row{cursor:pointer!important;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease} #home .wide .row:hover,#classes .row:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(16,24,40,.08);border-color:#cfd6e2}
        @media(max-width:700px){#homeClassModal.modal{place-items:end center!important;padding:0!important}#homeClassModal .modal-card{width:100%!important;max-width:none!important;border-radius:22px 22px 0 0!important;padding:22px 18px 28px!important;max-height:78vh!important}}
      `;document.head.appendChild(style);
    }
    const modal=document.getElementById('homeClassModal'),title=document.getElementById('homeClassTitle'),time=document.getElementById('homeClassTime'),desc=document.getElementById('homeClassDesc'),availability=document.getElementById('homeClassAvailability'),bookBtn=document.getElementById('homeClassBook'),closeBtn=document.getElementById('homeClassClose'),msg=document.getElementById('homeClassMsg');
    if(!modal||!title||!time||!desc||!availability||!bookBtn||!closeBtn)return;modal.classList.add('hidden');
    const descriptions={'Early Engine':'A coached conditioning session focused on aerobic capacity, pacing and building your engine.','Hybrid Strength':'A full-body strength session combining compound lifts, accessories and progressive overload.','Express Conditioning':'A shorter, high-quality conditioning session designed to fit into a busy day.','Hybrid Conditioning':'A mixed functional fitness session combining strength, cardio and work capacity.','Evening Engine':'An evening conditioning session mixing cardio intervals and functional work.'};let activeRow=null;
    function openClass(row){const name=row.querySelector('h4')?.textContent?.trim();if(!name)return;activeRow=row;const meta=row.querySelector('.muted')?.textContent?.trim()||'',tag=row.querySelector('.tag'),booked=!!(tag&&/booked/i.test(tag.textContent));title.textContent=name;time.textContent=meta;desc.textContent=descriptions[name]||'A coached Hybrid Hub class. Tap below to manage your booking.';availability.textContent=tag?.textContent||'';bookBtn.dataset.booked=booked?'1':'0';bookBtn.textContent=booked?'Cancel booking':'Book class';bookBtn.className=booked?'btn secondary':'btn primary';if(msg)msg.textContent='';modal.classList.remove('hidden');document.body.style.overflow='hidden'}
    function closeClass(){modal.classList.add('hidden');document.body.style.overflow='';activeRow=null}
    document.querySelectorAll('#home .wide .row,#classes .row').forEach(function(row){row.setAttribute('role','button');row.setAttribute('tabindex','0');row.onclick=function(e){if(e.target.closest('button,a'))return;openClass(row)};row.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openClass(row)}}});
    closeBtn.onclick=closeClass;modal.onclick=e=>{if(e.target===modal)closeClass()};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.classList.contains('hidden'))closeClass()});
    bookBtn.onclick=function(){const wasBooked=bookBtn.dataset.booked==='1';bookBtn.disabled=true;bookBtn.textContent=wasBooked?'Cancelling…':'Booking…';setTimeout(function(){const nowBooked=!wasBooked;bookBtn.disabled=false;bookBtn.dataset.booked=nowBooked?'1':'0';bookBtn.textContent=nowBooked?'Cancel booking':'Book class';bookBtn.className=nowBooked?'btn secondary':'btn primary';if(msg)msg.textContent=nowBooked?'Class booked.':'Booking cancelled.';if(activeRow){let tag=activeRow.querySelector('.tag');if(!tag){tag=document.createElement('span');tag.className='tag';activeRow.querySelector('.rowtop')?.appendChild(tag)}if(nowBooked){tag.textContent='Booked';tag.classList.add('good')}else{tag.textContent='Space available';tag.classList.remove('good')}}},250)};
  }

  function loadClassAdminEnhancements(){if(!location.pathname.endsWith('/classes.html'))return;if(document.querySelector('script[data-class-admin-enhancements]'))return;const s=document.createElement('script');s.src='./class-admin-enhancements.js';s.defer=true;s.dataset.classAdminEnhancements='1';document.head.appendChild(s)}
  function init(){addLogoToGymCards();addTopBrand();ensureGymName();addAdminOperationsNav();addDoorAccessCard();fixMemberPreviewClasses();loadClassAdminEnhancements()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();