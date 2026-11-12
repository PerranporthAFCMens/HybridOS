/* Hybrid Hub concept preview: menu, "text to check" highlighting and the demo edit mode. */
(function(){
  var header=document.querySelector('.header'),toggle=document.querySelector('.menu-toggle');
  toggle.addEventListener('click',function(){var open=header.classList.toggle('open');toggle.setAttribute('aria-expanded',open)});
})();
(function(){
  var KEY='hh-preview-show-drafts',btn=document.querySelector('.draft-toggle');
  function set(on){document.body.classList.toggle('show-drafts',on);btn.setAttribute('aria-pressed',on);btn.textContent=on?'Hide highlights':'Highlight text to check';try{sessionStorage.setItem(KEY,on?'1':'')}catch(e){}}
  btn.addEventListener('click',function(){set(!document.body.classList.contains('show-drafts'))});
  var start=/[?&]check=1/.test(location.search);try{start=start||sessionStorage.getItem(KEY)==='1'}catch(e){}
  if(start)set(true);
})();
/* Owner edit mode. Demo only: edits are kept in this browser's localStorage, not on a server. */
(function(){
  var KEY='hh-preview-edits-v2:'+((location.pathname.split('/').pop()||'index.html').replace(/^$/,'index.html'));
  var TEXT='main h1,main h2,main h3,main p,main li,main .price,main .note,main .plan-tag,main .eyebrow,main .badge,main .btn,main .fact b,main .fact span,main .date b,main .date span,main .way-num,main .more,main .kit-num,main .info span,main .crumb,main .tile p,main .steps span,main .steps b,footer p,footer li,footer h4,.legal span';
  var store={};
  try{store=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){store={}}
  store.t=store.t||{};store.i=store.i||{};
  var texts=[];
  document.querySelectorAll(TEXT).forEach(function(el){
    if(el.closest('[data-ed]'))return;
    if(el.querySelector('iframe,img'))return;
    el.setAttribute('data-ed',texts.length);texts.push(el);
  });
  var imgs=Array.prototype.slice.call(document.querySelectorAll('main img'));
  function applySaved(){
    texts.forEach(function(el,i){if(store.t[i]!=null)el.innerHTML=store.t[i]});
    imgs.forEach(function(img,i){if(store.i[i]){img.removeAttribute('srcset');img.src=store.i[i]}});
  }
  applySaved();
  function save(){
    var status=document.querySelector('.edit-bar .status');
    try{localStorage.setItem(KEY,JSON.stringify(store));status.textContent='Saved in this browser.'}
    catch(e){status.textContent='Could not save (browser storage full or blocked).'}
  }
  texts.forEach(function(el,i){
    el.addEventListener('input',function(){store.t[i]=el.innerHTML;save()});
    el.addEventListener('paste',function(ev){ev.preventDefault();var t=(ev.clipboardData||window.clipboardData).getData('text/plain');document.execCommand('insertText',false,t)});
  });
  // Photo swap buttons
  var picker=document.getElementById('img-picker'),target=-1;
  imgs.forEach(function(img,i){
    var box=img.parentElement;
    if(getComputedStyle(box).position==='static')box.style.position='relative';
    img.classList.add('img-ed');
    var b=document.createElement('button');b.type='button';b.className='img-swap';b.textContent='Change photo';
    b.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();target=i;picker.value='';picker.click()});
    box.appendChild(b);
  });
  picker.addEventListener('change',function(){
    var f=picker.files&&picker.files[0];if(!f||target<0)return;
    var r=new FileReader();
    r.onload=function(){
      var im=new Image();
      im.onload=function(){
        var max=1600,sc=Math.min(1,max/Math.max(im.width,im.height));
        var c=document.createElement('canvas');c.width=Math.round(im.width*sc);c.height=Math.round(im.height*sc);
        c.getContext('2d').drawImage(im,0,0,c.width,c.height);
        var url=c.toDataURL('image/jpeg',0.78);
        var img=imgs[target];img.removeAttribute('srcset');img.src=url;store.i[target]=url;save();
      };
      im.src=r.result;
    };
    r.readAsDataURL(f);
  });
  function setEditing(on){
    document.body.classList.toggle('editing',on);
    texts.forEach(function(el){if(on){el.setAttribute('contenteditable','true');el.setAttribute('spellcheck','true')}else{el.removeAttribute('contenteditable')}});
    if(!on&&document.activeElement)document.activeElement.blur();
  }
  // While editing, links and buttons in the page don't navigate.
  document.addEventListener('click',function(ev){
    if(!document.body.classList.contains('editing'))return;
    var a=ev.target.closest('a');
    if(a&&!a.closest('.edit-bar'))ev.preventDefault();
  },true);
  document.querySelector('.edit-launch').addEventListener('click',function(){setEditing(true);document.querySelector('.edit-bar .status').textContent='Demo: changes are saved in this browser only.'});
  document.querySelector('[data-act="done"]').addEventListener('click',function(){save();setEditing(false)});
  document.querySelector('[data-act="reset"]').addEventListener('click',function(){
    if(!window.confirm('Remove your edits on this page and go back to the original?'))return;
    try{localStorage.removeItem(KEY)}catch(e){}
    location.reload();
  });
  if(/[?&]edit=1/.test(location.search))setEditing(true);
})();
