(async function(){
  const chip=document.querySelector('.userchip');
  if(!chip||chip.dataset.accountMenuReady==='1') return;
  chip.dataset.accountMenuReady='1';

  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');

  const style=document.createElement('style');
  style.textContent=`
    .userchip{position:relative;cursor:pointer;user-select:none;transition:border-color .15s ease,box-shadow .15s ease,transform .12s ease}
    .userchip:hover{border-color:#d0d5dd;box-shadow:0 8px 24px rgba(16,24,40,.07)}
    .userchip:active{transform:scale(.99)}
    .userchip:after{content:"";width:7px;height:7px;border-right:1.8px solid #667085;border-bottom:1.8px solid #667085;transform:rotate(45deg) translateY(-2px);margin-left:3px}
    .account-popover{position:absolute;right:0;top:calc(100% + 10px);width:min(300px,calc(100vw - 28px));background:#fff;border:1px solid #e7ebf2;border-radius:18px;box-shadow:0 22px 60px rgba(16,24,40,.17);padding:8px;z-index:120;display:none}
    .account-popover.open{display:block}
    .account-popover-head{padding:10px 11px 12px;border-bottom:1px solid #eef1f5;margin-bottom:6px}
    .account-popover-head b{display:block;font-size:14px;color:#101828}.account-popover-head span{display:block;font-size:12px;color:#667085;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .account-menu-action{width:100%;border:0;background:transparent;border-radius:12px;padding:11px 12px;text-align:left;color:#344054;font-weight:750;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px}
    .account-menu-action:hover{background:#f7f8fa}.account-menu-action.danger{color:#b42318}
    .account-modal{position:fixed;inset:0;background:rgba(11,16,32,.55);display:none;place-items:center;padding:18px;z-index:130;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
    .account-modal.open{display:grid}
    .account-modal-card{width:min(620px,100%);max-height:min(88vh,760px);overflow:auto;background:#fff;border:1px solid #e7ebf2;border-radius:24px;box-shadow:0 30px 90px rgba(0,0,0,.25);padding:22px}
    .account-modal-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.account-modal-top h2{margin:4px 0 0;font-size:25px}.account-close{width:38px;height:38px;border:1px solid #e7ebf2;border-radius:12px;background:#fff;color:#344054;font-size:22px;cursor:pointer}
    .account-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}.account-field{margin:11px 0}.account-field.full{grid-column:1/-1}.account-field label{display:block;font-size:12px;font-weight:850;color:#344054;margin:0 0 6px}.account-field input{width:100%;padding:12px 13px;border:1px solid #d9dee7;border-radius:13px;background:#fff;color:#101828;outline:none}.account-field input:focus{border-color:#a9a1ff;box-shadow:0 0 0 3px rgba(109,93,252,.09)}
    .account-divider{height:1px;background:#eef1f5;margin:15px 0}.account-help{font-size:12px;color:#667085;line-height:1.45;margin-top:5px}.account-msg{font-size:13px;min-height:20px;margin:10px 0}.account-msg.good{color:#067647}.account-msg.error{color:#b42318}.account-save{width:100%;border:0;background:#0b1020;color:#fff;border-radius:13px;padding:13px 15px;font-weight:850;cursor:pointer}.account-save:disabled{opacity:.55;cursor:not-allowed}
    @media(max-width:900px){.userchip .who{display:block!important}.userchip{padding:6px 8px}.userchip #userEmail{display:none}.userchip:after{display:none}.account-popover{position:fixed;right:14px;top:72px}.account-modal-card{padding:18px;border-radius:20px}.account-grid{grid-template-columns:1fr}.account-field.full{grid-column:auto}}
  `;
  document.head.appendChild(style);

  const pop=document.createElement('div');
  pop.className='account-popover';
  pop.innerHTML=`<div class="account-popover-head"><b id="accountMenuName">My account</b><span id="accountMenuEmail"></span></div><button type="button" class="account-menu-action" id="accountEditBtn"><span>Account settings</span><span>›</span></button><button type="button" class="account-menu-action danger" id="accountSignOutBtn"><span>Sign out</span><span>↗</span></button>`;
  chip.appendChild(pop);

  const modal=document.createElement('div');
  modal.className='account-modal';
  modal.innerHTML=`<div class="account-modal-card" role="dialog" aria-modal="true" aria-labelledby="accountModalTitle">
    <div class="account-modal-top"><div><div class="eyebrow">Personal account</div><h2 id="accountModalTitle">Account settings</h2><div class="muted" style="font-size:13px;margin-top:4px">Update your own Hybrid OS sign-in and profile details.</div></div><button type="button" class="account-close" id="accountCloseBtn" aria-label="Close">×</button></div>
    <div class="account-grid">
      <div class="account-field full"><label>Display name</label><input id="accountDisplayName" autocomplete="name" placeholder="Your name"></div>
      <div class="account-field"><label>First name</label><input id="accountFirstName" autocomplete="given-name"></div>
      <div class="account-field"><label>Last name</label><input id="accountLastName" autocomplete="family-name"></div>
      <div class="account-field full"><label>Email address</label><input id="accountEmail" type="email" autocomplete="email"><div class="account-help">If email confirmation is enabled, a confirmation link will be sent before the new address becomes active.</div></div>
    </div>
    <div class="account-divider"></div>
    <div class="account-grid">
      <div class="account-field"><label>New password</label><input id="accountPassword" type="password" autocomplete="new-password" placeholder="Leave blank to keep current password"></div>
      <div class="account-field"><label>Confirm new password</label><input id="accountPassword2" type="password" autocomplete="new-password"></div>
    </div>
    <div class="account-help">Changing your password takes effect immediately. Use at least 6 characters.</div>
    <div id="accountMsg" class="account-msg"></div>
    <button type="button" id="accountSaveBtn" class="account-save">Save changes</button>
  </div>`;
  document.body.appendChild(modal);

  const q=s=>document.querySelector(s);
  const menuName=q('#accountMenuName'),menuEmail=q('#accountMenuEmail');
  const displayInput=q('#accountDisplayName'),firstInput=q('#accountFirstName'),lastInput=q('#accountLastName'),emailInput=q('#accountEmail');
  const passwordInput=q('#accountPassword'),password2Input=q('#accountPassword2'),msg=q('#accountMsg'),saveBtn=q('#accountSaveBtn');
  let user=null,profile=null;

  async function loadAccount(){
    const {data:{user:u},error}=await sb.auth.getUser();
    if(error||!u) return false;
    user=u;
    const {data:p}=await sb.from('profiles').select('display_name,first_name,last_name').eq('id',u.id).maybeSingle();
    profile=p||{};
    const display=profile.display_name||[profile.first_name,profile.last_name].filter(Boolean).join(' ')||u.user_metadata?.display_name||u.user_metadata?.full_name||u.email?.split('@')[0]||'Account';
    menuName.textContent=display; menuEmail.textContent=u.email||'';
    displayInput.value=display; firstInput.value=profile.first_name||''; lastInput.value=profile.last_name||''; emailInput.value=u.email||'';
    return true;
  }

  function closeMenu(){pop.classList.remove('open')}
  function closeModal(){modal.classList.remove('open');passwordInput.value='';password2Input.value='';msg.textContent='';msg.className='account-msg'}
  chip.setAttribute('role','button');chip.setAttribute('tabindex','0');chip.setAttribute('aria-haspopup','menu');chip.setAttribute('aria-expanded','false');
  function toggleMenu(e){e?.stopPropagation();const open=!pop.classList.contains('open');pop.classList.toggle('open',open);chip.setAttribute('aria-expanded',String(open))}
  chip.addEventListener('click',e=>{if(e.target.closest('.account-popover'))return;toggleMenu(e)});
  chip.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleMenu(e)}});
  document.addEventListener('click',e=>{if(!chip.contains(e.target))closeMenu()});
  q('#accountEditBtn').onclick=async()=>{closeMenu();await loadAccount();modal.classList.add('open');setTimeout(()=>displayInput.focus(),20)};
  q('#accountCloseBtn').onclick=closeModal;
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();if(modal.classList.contains('open'))closeModal()}});
  q('#accountSignOutBtn').onclick=async()=>{q('#accountSignOutBtn').disabled=true;await sb.auth.signOut();location.href='./index.html'};

  saveBtn.onclick=async()=>{
    msg.textContent='';msg.className='account-msg';
    if(!user&&!(await loadAccount())){msg.textContent='Could not load your account.';msg.className='account-msg error';return}
    const display=displayInput.value.trim(),first=firstInput.value.trim(),last=lastInput.value.trim(),email=emailInput.value.trim();
    const p1=passwordInput.value,p2=password2Input.value;
    if(!display){msg.textContent='Add a display name.';msg.className='account-msg error';return}
    if(!email||!email.includes('@')){msg.textContent='Enter a valid email address.';msg.className='account-msg error';return}
    if((p1||p2)&&p1!==p2){msg.textContent='The new passwords do not match.';msg.className='account-msg error';return}
    if(p1&&p1.length<6){msg.textContent='Your new password must be at least 6 characters.';msg.className='account-msg error';return}
    saveBtn.disabled=true;saveBtn.textContent='Saving…';
    try{
      const profileUpdate=await sb.from('profiles').update({display_name:display,first_name:first||null,last_name:last||null}).eq('id',user.id);
      if(profileUpdate.error) throw profileUpdate.error;
      const authChanges={data:{display_name:display,full_name:display}};
      const emailChanged=(email.toLowerCase()!==(user.email||'').toLowerCase());
      if(emailChanged) authChanges.email=email;
      if(p1) authChanges.password=p1;
      const {data:authData,error:authError}=await sb.auth.updateUser(authChanges);
      if(authError) throw authError;
      const nameNode=document.getElementById('userName'),emailNode=document.getElementById('userEmail'),avatar=document.getElementById('userAvatar');
      if(nameNode) nameNode.textContent=display;
      if(emailNode&&!emailChanged) emailNode.textContent=email;
      if(avatar&&!avatar.querySelector('img')) avatar.textContent=display.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'H';
      menuName.textContent=display;menuEmail.textContent=email;
      const welcome=document.getElementById('welcomeTitle');if(welcome){const h=new Date().getHours();welcome.textContent='Good '+(h<12?'morning':h<18?'afternoon':'evening')+', '+display.split(' ')[0]}
      user=authData?.user||user;profile={display_name:display,first_name:first,last_name:last};
      passwordInput.value='';password2Input.value='';
      msg.textContent=emailChanged?'Profile saved. Check your email to confirm the new address.':'Account details updated.';msg.className='account-msg good';
    }catch(err){msg.textContent=err?.message||'Could not update your account.';msg.className='account-msg error'}
    finally{saveBtn.disabled=false;saveBtn.textContent='Save changes'}
  };

  await loadAccount();
})();