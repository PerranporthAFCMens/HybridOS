/* Hybrid Hub owner editor. Loaded by site.js only after "Owner login".
   Sign in with a HybridOne account that is an owner or admin of Hybrid Hub, click text or photos to change them,
   then Publish: the change is saved in HybridOne and every visitor sees it. The database rules decide who may save. */
(function(){
  var HH=window.HH,sb=null,user=null,dirty=false,editing=false,bar,toolbar,dialog,picker,target=-1;
  var LIB='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js';

  function el(tag,attrs,kids){
    var n=document.createElement(tag);
    Object.keys(attrs||{}).forEach(function(k){if(k==='text')n.textContent=attrs[k];else n.setAttribute(k,attrs[k])});
    (kids||[]).forEach(function(k){n.appendChild(k)});
    return n;
  }
  function client(){
    if(sb)return Promise.resolve(sb);
    return new Promise(function(res,rej){
      if(window.supabase)return res();
      var s=el('script',{src:LIB,crossorigin:'anonymous'});s.onload=res;s.onerror=function(){rej(new Error('Could not load the sign-in tools. Check your connection and try again.'))};
      document.head.appendChild(s);
    }).then(function(){sb=window.supabase.createClient(HH.url,HH.key);return sb});
  }
  function setResume(on){try{on?sessionStorage.setItem('hh-editing','1'):sessionStorage.removeItem('hh-editing')}catch(e){}}

  /* ---------- Sign in ---------- */
  function buildDialog(){
    var email=el('input',{type:'email',name:'email',autocomplete:'username',required:'',placeholder:'you@example.com'});
    var pass=el('input',{type:'password',name:'password',autocomplete:'current-password',required:''});
    var msg=el('p',{class:'ed-msg',role:'alert'});
    var go=el('button',{type:'submit',class:'primary',text:'Sign in'});
    var close=el('button',{type:'button',class:'ed-close','aria-label':'Close',text:'×'});
    var form=el('form',{class:'ed-login'},[
      close,
      el('h2',{text:'Owner login'}),
      el('p',{class:'ed-sub',text:'Use your HybridOne login. Owners and admins of Hybrid Hub can edit this site.'}),
      el('label',{},[document.createTextNode('Email'),email]),
      el('label',{},[document.createTextNode('Password'),pass]),
      msg,go,
      el('p',{class:'ed-sub'},[el('a',{href:'https://www.hybridone.co.uk/',target:'_blank',rel:'noopener',text:'Forgot your password? Reset it in HybridOne'})])
    ]);
    dialog=el('dialog',{class:'ed-dialog','aria-label':'Owner login'},[form]);
    close.addEventListener('click',function(){dialog.close()});
    form.addEventListener('submit',function(ev){
      ev.preventDefault();msg.textContent='';go.disabled=true;go.textContent='Signing in…';
      client().then(function(c){return c.auth.signInWithPassword({email:email.value.trim().toLowerCase(),password:pass.value})})
        .then(function(r){if(r.error)throw new Error(/invalid/i.test(r.error.message)?'That email and password don’t match a HybridOne account.':r.error.message);user=r.data.user;return checkAccess()})
        .then(function(){pass.value='';dialog.close();return HH.ready.then(startEditing)})
        .catch(function(e){msg.textContent=e.message})
        .then(function(){go.disabled=false;go.textContent='Sign in'});
    });
    document.body.appendChild(dialog);
    return dialog;
  }
  function checkAccess(){
    return sb.from('gym_members').select('role,access_status').eq('gym_id',HH.gym).eq('user_id',user.id).eq('is_active',true)
      .then(function(r){
        var ok=(r.data||[]).some(function(m){return (m.role==='owner'||m.role==='admin')&&m.access_status==='active'});
        if(!ok)throw new Error('You’re signed in, but this account isn’t an owner or admin of Hybrid Hub, so it can’t edit the site.');
      });
  }

  HH.openEditor=function(opts){
    opts=opts||{};
    if(editing)return;
    client().then(function(c){return c.auth.getSession()}).then(function(r){
      var s=r.data&&r.data.session;
      if(!s){setResume(false);if(!opts.quiet)(dialog||buildDialog()).showModal();return}
      user=s.user;
      return checkAccess().then(function(){return HH.ready.then(startEditing)},function(e){
        setResume(false);
        if(opts.quiet)return;
        (dialog||buildDialog()).showModal();dialog.querySelector('.ed-msg').textContent=e.message;
      });
    }).catch(function(e){if(!opts.quiet)window.alert(e.message)});
  };

  /* ---------- Editing ---------- */
  function status(t){bar.querySelector('.status').textContent=t}
  function markDirty(){if(!dirty){dirty=true;bar.classList.add('dirty')}status('Unpublished changes. Press Publish when you’re happy.')}

  function buildBar(){
    var who=el('b',{text:'Editing the site'});
    bar=el('div',{class:'edit-bar',role:'region','aria-label':'Edit mode'},[
      el('p',{},[who,document.createTextNode('Click any text to change it, or "Change photo" on a photo. '),el('span',{class:'status'})]),
      el('div',{class:'actions'},[
        el('button',{type:'button','data-act':'signout',text:'Sign out'}),
        el('button',{type:'button','data-act':'discard',text:'Discard'}),
        el('button',{type:'button',class:'primary','data-act':'publish',text:'Publish'})
      ])
    ]);
    bar.querySelector('[data-act="publish"]').addEventListener('click',publish);
    bar.querySelector('[data-act="discard"]').addEventListener('click',function(){
      if(dirty&&!window.confirm('Throw away the changes you haven’t published?'))return;
      dirty=false;bar.classList.remove('dirty');HH.apply(HH.published);status('Changes discarded.');
    });
    bar.querySelector('[data-act="signout"]').addEventListener('click',function(){
      if(dirty&&!window.confirm('You have unpublished changes. Sign out and lose them?'))return;
      dirty=false;sb.auth.signOut().then(function(){stopEditing();HH.apply(HH.published)});
    });
    document.body.appendChild(bar);

    toolbar=el('div',{class:'ed-tools',role:'toolbar','aria-label':'Text style'},[
      el('button',{type:'button','data-cmd':'bold',title:'Bold'},[el('b',{text:'B'})]),
      el('button',{type:'button','data-cmd':'italic',title:'Italic'},[el('i',{text:'I'})]),
      el('button',{type:'button','data-cmd':'link',title:'Add a link',text:'Link'}),
      el('button',{type:'button','data-cmd':'unlink',title:'Remove link',text:'Unlink'}),
      el('button',{type:'button','data-cmd':'removeFormat',title:'Clear style',text:'Clear'})
    ]);
    toolbar.addEventListener('mousedown',function(ev){ev.preventDefault()});
    toolbar.addEventListener('click',function(ev){
      var b=ev.target.closest('button');if(!b)return;
      var cmd=b.getAttribute('data-cmd');
      if(cmd==='link'){
        var url=window.prompt('Link to (a web address, email or phone number)');
        if(!url)return;url=url.trim();
        if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url))url='mailto:'+url;
        else if(/^\+?[\d\s]{7,}$/.test(url))url='tel:'+url.replace(/\s/g,'');
        else if(!/^(https?:|mailto:|tel:|#)/i.test(url)&&!/\.html(#.*)?$/.test(url))url='https://'+url;
        document.execCommand('createLink',false,url);
      }else document.execCommand(cmd,false,null);
      var slot=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('[data-ed]');
      if(slot)markDirty();
    });
    document.body.appendChild(toolbar);

    picker=el('input',{type:'file',accept:'image/jpeg,image/png,image/webp',hidden:''});
    picker.addEventListener('change',uploadPhoto);
    document.body.appendChild(picker);

    HH.texts.forEach(function(s){
      s.el.addEventListener('input',function(){if(editing)markDirty()});
      s.el.addEventListener('focus',function(){if(editing)placeTools(s.el)});
      s.el.addEventListener('blur',function(){toolbar.classList.remove('on')});
      s.el.addEventListener('paste',function(ev){if(!editing)return;ev.preventDefault();document.execCommand('insertText',false,(ev.clipboardData||window.clipboardData).getData('text/plain'))});
      s.el.addEventListener('keydown',function(ev){if(editing&&ev.key==='Enter'){ev.preventDefault();document.execCommand('insertLineBreak')}});
    });
    HH.imgs.forEach(function(s,i){
      var box=s.el.parentElement;
      if(getComputedStyle(box).position==='static')box.style.position='relative';
      var b=el('button',{type:'button',class:'img-swap',text:'Change photo'});
      b.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();target=i;picker.value='';picker.click()});
      box.appendChild(b);
    });
    // While editing, links inside the page content don't navigate (the menu and footer still do).
    document.addEventListener('click',function(ev){if(editing&&ev.target.closest('main a'))ev.preventDefault()},true);
    window.addEventListener('beforeunload',function(ev){if(dirty){ev.preventDefault();ev.returnValue=''}});
    window.addEventListener('scroll',function(){var a=document.activeElement;if(editing&&a&&a.hasAttribute&&a.hasAttribute('data-ed'))placeTools(a)},{passive:true});
  }
  function placeTools(target){
    var r=target.getBoundingClientRect();
    toolbar.classList.add('on');
    var top=r.top-toolbar.offsetHeight-8;if(top<8)top=r.bottom+8;
    toolbar.style.top=Math.round(top)+'px';
    toolbar.style.left=Math.round(Math.max(8,Math.min(r.left,window.innerWidth-toolbar.offsetWidth-8)))+'px';
  }
  function startEditing(){
    if(!bar)buildBar();
    editing=HH.editing=true;setResume(true);
    document.body.classList.add('editing');
    HH.texts.forEach(function(s){s.el.setAttribute('contenteditable','true');s.el.setAttribute('spellcheck','true')});
    status('Signed in as '+(user.email||'owner')+'.');
  }
  function stopEditing(){
    editing=HH.editing=false;setResume(false);
    document.body.classList.remove('editing');toolbar.classList.remove('on');
    HH.texts.forEach(function(s){s.el.removeAttribute('contenteditable')});
    if(document.activeElement)document.activeElement.blur();
  }

  /* ---------- Photos ---------- */
  function uploadPhoto(){
    var f=picker.files&&picker.files[0],i=target;if(!f||i<0)return;
    status('Uploading photo…');
    var url=URL.createObjectURL(f),im=new Image();
    im.onload=function(){
      URL.revokeObjectURL(url);
      var max=2000,sc=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');
      c.width=Math.round(im.width*sc);c.height=Math.round(im.height*sc);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      c.toBlob(function(blob){
        var path=HH.gym+'/'+HH.page+'-'+i+'-'+Date.now()+'.jpg';
        sb.storage.from('website-media').upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000',upsert:false}).then(function(r){
          if(r.error)throw r.error;
          var pub=sb.storage.from('website-media').getPublicUrl(path).data.publicUrl;
          var s=HH.imgs[i];s.el.removeAttribute('srcset');s.el.src=pub;markDirty();
        }).catch(function(e){status('Photo not uploaded: '+(e.message||e))});
      },'image/jpeg',0.82);
    };
    im.onerror=function(){status('That file isn’t a photo this browser can read.')};
    im.src=url;
  }

  /* ---------- Publish ---------- */
  function collect(){
    var c={t:{},i:{}};
    HH.texts.forEach(function(s,i){var h=HH.clean(s.el.innerHTML);if(h!==HH.clean(s.html))c.t[i]={o:s.o,h:h}});
    HH.imgs.forEach(function(s,i){var src=s.el.getAttribute('src');if(src!==s.o&&/^https:\/\//.test(src))c.i[i]={o:s.o,u:src}});
    return c;
  }
  function publish(){
    var btn=bar.querySelector('[data-act="publish"]');btn.disabled=true;status('Publishing…');
    var c=collect();
    sb.from('website_pages').upsert({gym_id:HH.gym,page:HH.page,content:c},{onConflict:'gym_id,page'}).then(function(r){
      if(r.error)throw r.error;
      HH.published=c;dirty=false;bar.classList.remove('dirty');
      try{localStorage.setItem(HH.cacheKey,JSON.stringify(c))}catch(e){}
      status('Published. Everyone visiting the site now sees this.');
    }).catch(function(e){
      status(/row-level|permission|42501/i.test(e.message||'')?'Not published: this account isn’t allowed to edit Hybrid Hub’s site.':'Not published: '+(e.message||e));
    }).then(function(){btn.disabled=false});
  }
})();
