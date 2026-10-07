/* Swipe in from the left to open the mobile menu; swipe left to close it (phones only). */
(function(){
  var btn=null;
  var sx=0,sy=0,t0=0,tracking=false,opening=false;
  function visible(){btn=document.getElementById('mobileMenuBtn');return !!btn&&getComputedStyle(btn).display!=='none'}
  function isOpen(){return document.body.classList.contains('mobile-nav-open')}
  function scrollable(el){for(;el&&el!==document.body;el=el.parentElement){if(el.scrollWidth>el.clientWidth+4){var o=getComputedStyle(el).overflowX;if(o==='auto'||o==='scroll')return true}}return false}
  document.addEventListener('touchstart',function(e){
    tracking=false;if(e.touches.length!==1||!visible())return;
    var t=e.touches[0];sx=t.clientX;sy=t.clientY;t0=Date.now();
    if(isOpen()){tracking=true;opening=false;return}
    if(sx<=90&&!scrollable(e.target)){tracking=true;opening=true}
  },{passive:true});
  document.addEventListener('touchend',function(e){
    if(!tracking)return;tracking=false;
    var t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy;
    if(Math.abs(dy)>Math.abs(dx)*0.6||Date.now()-t0>700)return;
    if(opening&&dx>60&&!isOpen()){if(e.cancelable)e.preventDefault();btn.click()}
    else if(!opening&&dx<-60&&isOpen()){if(e.cancelable)e.preventDefault();var c=document.getElementById('mobileMenuClose');(c||btn).click()}
  },{passive:false});
})();
