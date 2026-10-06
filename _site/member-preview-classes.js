(function(){
  if(!location.pathname.endsWith('/member-preview.html')) return;

  function addStyle(){
    if(document.getElementById('member-preview-class-modal-style')) return;
    const style=document.createElement('style');
    style.id='member-preview-class-modal-style';
    style.textContent=`
      .hidden{display:none!important}
      #homeClassModal.modal{position:fixed!important;inset:0!important;z-index:1000!important;background:rgba(11,16,32,.58)!important;display:grid!important;place-items:center!important;padding:20px!important}
      #homeClassModal.modal.hidden{display:none!important}
      #homeClassModal .modal-card{background:#fff!important;border-radius:22px!important;padding:22px!important;width:min(560px,100%)!important;max-height:90vh!important;overflow:auto!important;box-shadow:0 28px 80px rgba(0,0,0,.28)!important}
      #homeClassModal .actions{display:flex!important;gap:10px!important;flex-wrap:wrap!important;margin-top:18px!important}
      #homeClassModal .btn.primary{background:#0b1020!important;color:#fff!important}
      #homeClassModal .section-title{align-items:flex-start!important}
      #homeClassModal h3{font-size:24px!important}
      #homeClassModal .msg{min-height:20px!important;margin-top:10px!important;font-size:13px!important;color:#067647!important}
      #home .wide .row,#classes .row{cursor:pointer!important;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
      #home .wide .row:hover,#classes .row:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(16,24,40,.08);border-color:#cfd6e2}
      @media(max-width:700px){#homeClassModal.modal{place-items:end center!important;padding:0!important}#homeClassModal .modal-card{width:100%!important;max-width:none!important;border-radius:22px 22px 0 0!important;padding:22px 18px 28px!important;max-height:78vh!important}}
    `;
    document.head.appendChild(style);
  }

  function init(){
    addStyle();
    const modal=document.getElementById('homeClassModal');
    const title=document.getElementById('homeClassTitle');
    const time=document.getElementById('homeClassTime');
    const desc=document.getElementById('homeClassDesc');
    const availability=document.getElementById('homeClassAvailability');
    const bookBtn=document.getElementById('homeClassBook');
    const closeBtn=document.getElementById('homeClassClose');
    const msg=document.getElementById('homeClassMsg');
    if(!modal||!title||!time||!desc||!availability||!bookBtn||!closeBtn) return;

    modal.classList.add('hidden');
    const descriptions={
      'Early Engine':'A coached conditioning session focused on aerobic capacity, pacing and building your engine.',
      'Hybrid Strength':'A full-body strength session combining compound lifts, accessories and progressive overload.',
      'Express Conditioning':'A shorter, high-quality conditioning session designed to fit into a busy day.',
      'Hybrid Conditioning':'A mixed functional fitness session combining strength, cardio and work capacity.',
      'Evening Engine':'An evening conditioning session mixing cardio intervals and functional work.'
    };
    let activeRow=null;

    function openClass(row){
      const name=row.querySelector('h4')?.textContent?.trim();
      if(!name) return;
      activeRow=row;
      const meta=row.querySelector('.muted')?.textContent?.trim()||'';
      const tag=row.querySelector('.tag');
      const booked=!!(tag&&/booked/i.test(tag.textContent));
      title.textContent=name;
      time.textContent=meta;
      desc.textContent=descriptions[name]||'A coached Hybrid Hub class. Tap below to manage your booking.';
      availability.textContent=tag?.textContent||'';
      bookBtn.dataset.booked=booked?'1':'0';
      bookBtn.textContent=booked?'Cancel booking':'Book class';
      bookBtn.className=booked?'btn secondary':'btn primary';
      if(msg) msg.textContent='';
      modal.classList.remove('hidden');
      document.body.style.overflow='hidden';
    }

    function closeClass(){
      modal.classList.add('hidden');
      document.body.style.overflow='';
      activeRow=null;
    }

    document.querySelectorAll('#home .wide .row,#classes .row').forEach(function(row){
      row.setAttribute('role','button');
      row.setAttribute('tabindex','0');
      row.onclick=function(e){if(!e.target.closest('button,a')) openClass(row)};
      row.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openClass(row)}};
    });

    closeBtn.onclick=closeClass;
    modal.onclick=e=>{if(e.target===modal) closeClass()};
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.classList.contains('hidden')) closeClass()});
    bookBtn.onclick=function(){
      const wasBooked=bookBtn.dataset.booked==='1';
      bookBtn.disabled=true;
      bookBtn.textContent=wasBooked?'Cancelling…':'Booking…';
      setTimeout(function(){
        const nowBooked=!wasBooked;
        bookBtn.disabled=false;
        bookBtn.dataset.booked=nowBooked?'1':'0';
        bookBtn.textContent=nowBooked?'Cancel booking':'Book class';
        bookBtn.className=nowBooked?'btn secondary':'btn primary';
        if(msg) msg.textContent=nowBooked?'Class booked.':'Booking cancelled.';
        if(activeRow){
          let tag=activeRow.querySelector('.tag');
          if(!tag){
            tag=document.createElement('span');
            tag.className='tag';
            activeRow.querySelector('.rowtop')?.appendChild(tag);
          }
          if(nowBooked){tag.textContent='Booked';tag.classList.add('good')}
          else{tag.textContent='Space available';tag.classList.remove('good')}
        }
      },250);
    };
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();