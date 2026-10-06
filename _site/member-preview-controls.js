(function(){
  if(!location.pathname.endsWith('/member-preview.html')) return;

  const ACCOUNT_KEY='hybridOS_memberPreviewAccount';

  function renderTrackingFields(select){
    const card=select.closest('.exercise-card');
    if(!card) return;
    const type=select.value;
    card.querySelectorAll('.set-row').forEach(function(row){
      const a=row.querySelector('.metricA');
      const b=row.querySelector('.metricB');
      if(!a||!b) return;
      if(type==='strength'){
        a.innerHTML='<label>Reps</label><input type="number" value="10" inputmode="numeric">';
        b.innerHTML='<label>Weight (kg)</label><input type="number" step="0.5" value="10" inputmode="decimal">';
      }else if(type==='time'){
        a.innerHTML='<label>Time</label><input type="number" placeholder="Seconds" inputmode="decimal">';
        b.innerHTML='<label>Note</label><input type="text" placeholder="Optional">';
      }else if(type==='distance'){
        a.innerHTML='<label>Distance</label><input type="number" step="0.01" placeholder="Metres" inputmode="decimal">';
        b.innerHTML='<label>Time (sec)</label><input type="number" placeholder="Optional" inputmode="decimal">';
      }else if(type==='calories'){
        a.innerHTML='<label>Calories</label><input type="number" placeholder="kcal" inputmode="numeric">';
        b.innerHTML='<label>Time (min)</label><input type="number" placeholder="Optional" inputmode="decimal">';
      }else{
        a.innerHTML='<label>Value</label><input type="number" step="0.01" inputmode="decimal">';
        b.innerHTML='<label>Unit</label><input type="text" placeholder="e.g. lengths">';
      }
    });
  }

  function syncPbUnit(select){
    const unit=document.getElementById('pbUnit');
    if(!unit) return;
    const units={weight:'kg',reps:'reps',time:'sec',distance:'m',calories:'kcal'};
    if(select.value!=='custom') unit.value=units[select.value]||'';
  }

  function closeMobileNav(){
    document.body.classList.remove('mobile-nav-open');
    document.getElementById('mobileMenuBtn')?.setAttribute('aria-expanded','false');
  }

  function openPreviewPage(id){
    const target=document.getElementById(id);
    if(!target) return false;
    document.querySelectorAll('.page').forEach(function(page){page.classList.toggle('active',page===target)});
    document.querySelectorAll('[data-page]').forEach(function(control){control.classList.toggle('active',control.dataset.page===id)});
    closeMobileNav();
    window.scrollTo({top:0,behavior:'smooth'});
    return true;
  }

  function wireNavigation(){
    document.querySelectorAll('[data-page]').forEach(function(control){
      control.setAttribute('type',control.tagName==='BUTTON'?'button':control.getAttribute('type')||'button');
      control.onclick=function(event){
        event.preventDefault();
        event.stopPropagation();
        openPreviewPage(control.dataset.page);
      };
      control.style.pointerEvents='auto';
    });
    document.querySelectorAll('.side .nav button').forEach(function(button){button.style.pointerEvents='auto'});
  }

  function accountDefaults(){
    return {name:'Alex Taylor',email:'member@puffin.test',phone:'07700 900123',dob:'1994-06-14'};
  }

  function loadAccount(){
    try{return Object.assign(accountDefaults(),JSON.parse(localStorage.getItem(ACCOUNT_KEY)||'{}'))}catch{return accountDefaults()}
  }

  function initials(name){
    return String(name||'Member').trim().split(/\s+/).slice(0,2).map(function(part){return part[0]||''}).join('').toUpperCase()||'M';
  }

  function applyAccount(account){
    const h1=document.querySelector('.top h1');
    if(h1) h1.textContent='Hi, '+String(account.name||'Member').split(/\s+/)[0];
    const who=document.querySelector('.top .who b');
    if(who) who.textContent=account.name||'Member';
    const email=document.querySelector('.top .who .muted');
    if(email) email.textContent=account.email||'';
    const avatar=document.querySelector('.top .avatar');
    if(avatar && !avatar.querySelector('img')) avatar.textContent=initials(account.name);
  }

  function ensureAccountPage(){
    const profile=document.getElementById('profile');
    if(!profile) return;
    const account=loadAccount();
    profile.innerHTML=`
      <div class="member-account-heading"><div class="eyebrow">Your account</div><h2>My account</h2><p class="muted">Update the details used across your member profile.</p></div>
      <div class="card member-account-card">
        <div class="member-account-form">
          <div class="field"><label>Name</label><input id="previewAccountName" autocomplete="name"></div>
          <div class="field"><label>Email</label><input id="previewAccountEmail" type="email" autocomplete="email"></div>
          <div class="field"><label>Phone</label><input id="previewAccountPhone" type="tel" autocomplete="tel"></div>
          <div class="field"><label>Date of birth</label><input id="previewAccountDob" type="date"></div>
        </div>
        <div class="actions"><button id="previewAccountSave" class="btn primary" type="button">Save changes</button><span id="previewAccountMsg" class="muted" aria-live="polite"></span></div>
      </div>`;
    profile.querySelector('#previewAccountName').value=account.name||'';
    profile.querySelector('#previewAccountEmail').value=account.email||'';
    profile.querySelector('#previewAccountPhone').value=account.phone||'';
    profile.querySelector('#previewAccountDob').value=account.dob||'';
    profile.querySelector('#previewAccountSave').onclick=function(){
      const next={
        name:profile.querySelector('#previewAccountName').value.trim()||'Member',
        email:profile.querySelector('#previewAccountEmail').value.trim(),
        phone:profile.querySelector('#previewAccountPhone').value.trim(),
        dob:profile.querySelector('#previewAccountDob').value
      };
      localStorage.setItem(ACCOUNT_KEY,JSON.stringify(next));
      applyAccount(next);
      const msg=profile.querySelector('#previewAccountMsg');
      msg.textContent='Saved ✓';
      setTimeout(function(){msg.textContent=''},1800);
    };
  }

  function ensureAccountMenu(){
    const chip=document.querySelector('.top .userchip');
    if(!chip || document.getElementById('memberPreviewAccountMenu')) return;
    chip.setAttribute('role','button');
    chip.setAttribute('tabindex','0');
    chip.setAttribute('aria-haspopup','menu');
    chip.setAttribute('aria-expanded','false');
    chip.classList.add('member-account-trigger');
    const menu=document.createElement('div');
    menu.id='memberPreviewAccountMenu';
    menu.className='member-account-menu hidden';
    menu.setAttribute('role','menu');
    menu.innerHTML='<button type="button" role="menuitem" data-account-action="profile">My account</button><button type="button" role="menuitem" data-account-action="admin">Back to admin</button>';
    chip.parentElement.style.position='relative';
    chip.parentElement.appendChild(menu);

    function setOpen(open){menu.classList.toggle('hidden',!open);chip.setAttribute('aria-expanded',open?'true':'false')}
    function toggle(event){event?.stopPropagation();setOpen(menu.classList.contains('hidden'))}
    chip.onclick=toggle;
    chip.onkeydown=function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle(event)}if(event.key==='Escape')setOpen(false)};
    menu.querySelector('[data-account-action="profile"]').onclick=function(event){event.stopPropagation();setOpen(false);openPreviewPage('profile')};
    menu.querySelector('[data-account-action="admin"]').onclick=function(){location.href='./index.html'};
    document.addEventListener('click',function(event){if(!menu.contains(event.target)&&!chip.contains(event.target))setOpen(false)});
  }

  function addStyles(){
    if(document.getElementById('member-preview-control-fixes')) return;
    const style=document.createElement('style');
    style.id='member-preview-control-fixes';
    style.textContent=`
      .field select,.pb-field select{pointer-events:auto!important;touch-action:manipulation;position:relative;z-index:1;-webkit-appearance:auto;appearance:auto}
      .side .nav button,[data-page]{pointer-events:auto!important;touch-action:manipulation}
      .member-account-trigger{cursor:pointer;user-select:none;transition:border-color .15s ease,box-shadow .15s ease}
      .member-account-trigger:hover,.member-account-trigger:focus-visible{border-color:#cfd6e2;box-shadow:0 8px 24px rgba(16,24,40,.1);outline:none}
      .member-account-menu{position:absolute;right:0;top:calc(100% + 8px);width:180px;background:#fff;border:1px solid #e7ebf2;border-radius:14px;padding:6px;box-shadow:0 18px 45px rgba(16,24,40,.16);z-index:120}
      .member-account-menu button{display:block;width:100%;border:0;background:transparent;text-align:left;padding:10px 11px;border-radius:10px;font:inherit;font-weight:750;color:#101828;cursor:pointer}
      .member-account-menu button:hover{background:#f5f7fb}
      .member-account-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 14px;max-width:760px}
      .member-account-heading{margin-bottom:16px}.member-account-heading h2{margin:4px 0 6px}.member-account-heading p{margin:0}
      .member-account-card .actions{align-items:center}.member-account-card #previewAccountMsg{font-size:13px;font-weight:750}
      @media(max-width:700px){.member-account-menu{position:fixed;right:14px;top:70px;width:min(220px,calc(100vw - 28px))}.member-account-form{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('change',function(event){
    const target=event.target;
    if(!(target instanceof HTMLSelectElement)) return;
    if(target.matches('.trackingType')) renderTrackingFields(target);
    if(target.id==='pbMetric') syncPbUnit(target);
  });

  function init(){
    addStyles();
    document.querySelectorAll('.trackingType').forEach(renderTrackingFields);
    ensureAccountPage();
    applyAccount(loadAccount());
    wireNavigation();
    ensureAccountMenu();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();