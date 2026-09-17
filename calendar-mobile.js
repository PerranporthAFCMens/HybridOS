(function(){
  if(!location.pathname.endsWith('/classes.html')) return;
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  let selectedIndex=0;

  function fmtDay(el){
    const head=el.querySelector('.dayhead');
    const dow=head?.querySelector('b')?.textContent?.trim()||'';
    const dom=head?.querySelector('.datebubble')?.textContent?.trim()||'';
    return{dow,dom};
  }
  function choose(i,scroll=true){
    const days=$$('#calendar .day');
    if(!days.length)return;
    selectedIndex=Math.max(0,Math.min(i,days.length-1));
    days.forEach((d,n)=>d.classList.toggle('mobile-selected',n===selectedIndex));
    $$('.mobile-date-btn').forEach((b,n)=>b.classList.toggle('selected',n===selectedIndex));
    if(scroll){const b=$$('.mobile-date-btn')[selectedIndex];b?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'})}
  }
  function improveSessionCards(){
    $$('#calendar .session').forEach(card=>{
      if(card.dataset.mobilePolished==='1')return;
      card.dataset.mobilePolished='1';
      const bookedMeta=[...card.querySelectorAll('.meta')].find(x=>/booked/i.test(x.textContent||''));
      const status=card.querySelector('.status');
      if(bookedMeta&&status&&!/booked|cancelled/i.test(status.textContent||'')) status.textContent=bookedMeta.textContent.trim();
    });
  }
  function build(){
    if(innerWidth>800)return;
    const main=$('.main'),calendar=$('#calendar');
    if(!main||!calendar)return;
    if(!$('.classes-mobile-head')){
      const h=document.createElement('div');h.className='classes-mobile-head';
      h.innerHTML='<h1>Timetable</h1><div class="classes-mobile-tools"><button class="classes-mobile-tool mobile-jump-today" aria-label="Go to today">▣</button><button class="classes-mobile-tool mobile-filter-btn" aria-label="Filter timetable">▽</button></div>';
      main.insertBefore(h,main.firstChild);
      const strip=document.createElement('div');strip.className='mobile-date-strip';
      calendar.before(strip);
      const sheet=document.createElement('div');sheet.className='mobile-filter-sheet';sheet.innerHTML='<h3>Timetable</h3><div class="meta">Use the admin filters and richer Gym / Staff / Resource views as they are added. For now this keeps the timetable focused on the selected day.</div><button class="btn secondary mobile-filter-close">Close</button>';
      document.body.appendChild(sheet);
      $('.mobile-filter-btn').onclick=()=>document.body.classList.toggle('mobile-filter-open');
      $('.mobile-filter-close').onclick=()=>document.body.classList.remove('mobile-filter-open');
      $('.mobile-jump-today').onclick=()=>{$('#todayBtn')?.click();setTimeout(()=>sync(true),120)};
    }
    sync(false);
  }
  function sync(scroll){
    if(innerWidth>800)return;
    const days=$$('#calendar .day'),strip=$('.mobile-date-strip');
    if(!strip||!days.length)return;
    let today=days.findIndex(d=>d.classList.contains('today'));
    if(today<0)today=Math.min(selectedIndex,days.length-1);
    strip.innerHTML=days.map((d,i)=>{const x=fmtDay(d);return `<button class="mobile-date-btn ${i===today?'selected':''}" data-i="${i}"><span class="dow">${x.dow}</span><span class="dom">${x.dom}</span></button>`}).join('');
    $$('.mobile-date-btn').forEach(b=>b.onclick=()=>choose(Number(b.dataset.i),true));
    improveSessionCards();
    choose(today,scroll);
  }

  const observer=new MutationObserver(()=>{clearTimeout(observer._t);observer._t=setTimeout(()=>sync(false),35)});
  function start(){const cal=$('#calendar');if(!cal){setTimeout(start,80);return}observer.observe(cal,{childList:true,subtree:true});build()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  addEventListener('resize',()=>{if(innerWidth<=800)build()});
})();
