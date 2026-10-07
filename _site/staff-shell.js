(function(){
  if(!location.pathname.endsWith('/staff.html'))return;
  function close(){document.body.classList.remove('staff-mobile-open');document.querySelector('.staff-mobile-menu-btn')?.setAttribute('aria-expanded','false')}
  function init(){
    if(document.querySelector('.staff-mobile-menu-btn'))return;
    const side=document.querySelector('.side');if(!side)return;
    const btn=document.createElement('button');btn.type='button';btn.className='staff-mobile-menu-btn';btn.setAttribute('aria-label','Open staff menu');btn.setAttribute('aria-expanded','false');btn.textContent='☰';
    const backdrop=document.createElement('div');backdrop.className='staff-mobile-backdrop';
    const x=document.createElement('button');x.type='button';x.className='staff-mobile-menu-close';x.setAttribute('aria-label','Close staff menu');x.textContent='×';x.onclick=close;side.prepend(x);
    document.body.append(btn,backdrop);
    btn.onclick=function(){const open=!document.body.classList.contains('staff-mobile-open');document.body.classList.toggle('staff-mobile-open',open);btn.setAttribute('aria-expanded',open?'true':'false')};
    backdrop.onclick=close;
    side.querySelectorAll('a,button').forEach(el=>{if(!el.classList.contains('staff-mobile-menu-close'))el.addEventListener('click',()=>setTimeout(close,0))});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
