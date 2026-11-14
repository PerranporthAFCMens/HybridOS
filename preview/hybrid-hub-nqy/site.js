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
/* Published owner edits. Every visitor loads the page's saved text and photos from HybridOne (Supabase).
   The owners edit them after "Owner login" (editor.js, loaded only when needed). */
(function(){
  var HH=window.HH={
    url:'https://mzgnhmeydhhpzgxlgudh.supabase.co',
    key:'sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD', // public key; the database rules are the protection
    gym:'242f57c2-6e37-4977-b3c5-1c87de7d0b98',           // Hybrid Hub
    page:(location.pathname.split('/').pop()||'index').replace(/\.html$/,'')||'index'
  };
  if(!/^[a-z0-9-]{1,40}$/.test(HH.page))HH.page='index';
  var OK_TAGS={B:1,STRONG:1,I:1,EM:1,U:1,BR:1,SMALL:1,A:1};
  var OK_HREF=/^(https?:|mailto:|tel:|#|[a-z0-9._-]+\.html(#[a-z0-9_-]*)?$)/i;
  /* Only plain formatting survives: bold, italic, small, line breaks and links. */
  HH.clean=function(html){
    var t=document.createElement('template');t.innerHTML=String(html||'');
    (function walk(node){
      Array.prototype.slice.call(node.childNodes).forEach(function(n){
        if(n.nodeType===3)return;
        if(n.nodeType!==1){n.remove();return}
        walk(n);
        if(!OK_TAGS[n.tagName]){
          if(/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|TEMPLATE)$/.test(n.tagName)){n.remove();return}
          var block=/^(DIV|P|LI)$/.test(n.tagName)&&n.previousSibling;
          if(block)n.parentNode.insertBefore(document.createElement('br'),n);
          while(n.firstChild)n.parentNode.insertBefore(n.firstChild,n);
          n.remove();return;
        }
        var href=n.getAttribute('href');
        Array.prototype.slice.call(n.attributes).forEach(function(a){n.removeAttribute(a.name)});
        if(n.tagName==='A'&&href&&OK_HREF.test(href.trim()))n.setAttribute('href',href.trim());
      });
    })(t.content);
    return t.innerHTML;
  };
  HH.norm=function(s){return String(s||'').replace(/\s+/g,' ').trim()};
  /* Editable slots: numbered in page order; each remembers its built-in wording so a saved edit
     is only applied to the same text it was made on (a later layout change can't misplace it). */
  var SEL='main h1,main h2,main h3,main p,main li,main .tag,main .link,main .btn,main .amount,main .details span,main .details b';
  HH.texts=[];HH.imgs=[];
  document.querySelectorAll(SEL).forEach(function(el){
    if(el.closest('[data-ed]')||el.querySelector('iframe,img'))return;
    el.setAttribute('data-ed',HH.texts.length);
    HH.texts.push({el:el,o:HH.norm(el.textContent),html:el.innerHTML});
  });
  document.querySelectorAll('main img').forEach(function(img){HH.imgs.push({el:img,o:img.getAttribute('src'),srcset:img.getAttribute('srcset')})});
  HH.apply=function(c){
    c=c||{};var t=c.t||{},im=c.i||{};
    HH.texts.forEach(function(s,i){var e=t[i];s.el.innerHTML=(e&&e.o===s.o&&typeof e.h==='string')?HH.clean(e.h):s.html});
    HH.imgs.forEach(function(s,i){var e=im[i];
      if(e&&e.o===s.o&&/^https:\/\//.test(e.u||'')){s.el.removeAttribute('srcset');s.el.src=e.u}
      else if(s.el.getAttribute('src')!==s.o){s.el.src=s.o;if(s.srcset)s.el.setAttribute('srcset',s.srcset)}
    });
    HH.published=c;
  };
  var CACHE='hh-site:'+HH.gym+':'+HH.page,root=document.documentElement;
  function show(){root.classList.remove('hh-wait')}
  try{var cached=JSON.parse(localStorage.getItem(CACHE)||'null');if(cached){HH.apply(cached);show()}}catch(e){}
  setTimeout(show,1200);
  HH.ready=fetch(HH.url+'/rest/v1/website_pages?select=content&gym_id=eq.'+HH.gym+'&page=eq.'+HH.page,{headers:{apikey:HH.key,Authorization:'Bearer '+HH.key}})
    .then(function(r){return r.ok?r.json():null})
    .then(function(rows){
      if(!rows)return;
      var c=rows[0]?rows[0].content:{};
      if(!HH.editing)HH.apply(c);
      try{rows[0]?localStorage.setItem(CACHE,JSON.stringify(c)):localStorage.removeItem(CACHE)}catch(e){}
    })
    .catch(function(){})
    .then(show);
  HH.cacheKey=CACHE;
  /* Owner login: loads the editor. Also resumes editing when moving between pages. */
  function loadEditor(){
    if(HH.editorLoading)return HH.editorLoading;
    HH.editorLoading=new Promise(function(res,rej){var s=document.createElement('script');s.src='editor.js?v=1';s.onload=res;s.onerror=rej;document.body.appendChild(s)});
    return HH.editorLoading;
  }
  document.querySelectorAll('.owner-login').forEach(function(b){b.addEventListener('click',function(){loadEditor().then(function(){HH.openEditor()})})});
  var resume=false;try{resume=sessionStorage.getItem('hh-editing')==='1'}catch(e){}
  if(resume||/[?&]edit=1/.test(location.search))loadEditor().then(function(){HH.openEditor({quiet:resume})});
})();
