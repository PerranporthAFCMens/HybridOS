import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const sb=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=p=>'£'+((Number(p)||0)/100).toFixed(2);

function ensureModal(){
  let m=document.getElementById('classAccessModal');
  if(m)return m;
  m=document.createElement('div');
  m.id='classAccessModal';
  m.className='modal hidden';
  m.innerHTML=`<div class="modal-card"><div class="section-title"><div><div class="eyebrow">Class access</div><h3 id="classAccessTitle" style="margin:4px 0">Booking options</h3></div><button id="classAccessClose" class="btn secondary">Close</button></div>
    <div id="classAccessBody"></div><div id="classAccessMsg" class="msg"></div></div>`;
  document.body.appendChild(m);
  m.querySelector('#classAccessClose').onclick=()=>m.classList.add('hidden');
  m.addEventListener('click',e=>{if(e.target===m)m.classList.add('hidden')});
  return m;
}

async function check(sessionId,className='Class'){
  const {data,error}=await sb.rpc('get_class_booking_options',{p_session_id:sessionId});
  if(error)throw error;
  if(data?.included_with_membership||data?.already_paid)return true;

  const m=ensureModal(),body=m.querySelector('#classAccessBody'),msg=m.querySelector('#classAccessMsg');
  m.querySelector('#classAccessTitle').textContent=className;
  msg.textContent='';msg.className='msg';

  const plans=Array.isArray(data?.upgrade_plans)?data.upgrade_plans:[];
  const pay=data?.can_pay_drop_in
    ? `<div class="card" style="box-shadow:none;margin-top:12px"><div class="eyebrow">Pay as you go</div><h3 style="margin:5px 0">${money(data.drop_in_price_pence)} for this class</h3><div class="muted">Your current membership does not include classes.</div><button id="classPayBtn" class="btn primary" style="margin-top:12px">Pay ${money(data.drop_in_price_pence)}</button></div>`
    : `<div class="notice">This class is not currently available as a drop-in. Choose a membership that includes classes to book it.</div>`;

  const upgrades=plans.length
    ? `<div style="margin-top:16px"><div class="eyebrow">Membership options</div><div class="list" style="margin-top:8px">${plans.map(p=>`<div class="row"><div class="rowtop"><div><h4>${esc(p.name)}</h4><div class="muted">${money(p.price_pence)} / ${esc(p.billing_interval)}</div></div><button class="btn secondary class-upgrade-choice" data-plan="${p.id}">View option</button></div></div>`).join('')}</div></div>`
    : '';

  body.innerHTML=`<p class="muted">This booking is not included with your current membership.</p>${pay}${upgrades}`;
  const payBtn=body.querySelector('#classPayBtn');
  if(payBtn)payBtn.onclick=async()=>{
    payBtn.disabled=true;payBtn.textContent='Preparing…';
    const {data:p,error:e}=await sb.rpc('prepare_class_drop_in_purchase',{p_session_id:sessionId});
    payBtn.disabled=false;payBtn.textContent='Pay '+money(data.drop_in_price_pence);
    if(e){msg.textContent=e.message;msg.className='msg bad';return}
    if(p?.status==='paid'){m.classList.add('hidden');return}
    msg.textContent='Payment checkout is not connected yet. No payment has been taken and the class has not been booked.';
    msg.className='msg';
  };
  body.querySelectorAll('.class-upgrade-choice').forEach(b=>b.onclick=()=>{
    m.classList.add('hidden');
    if(location.pathname.endsWith('/member.html')){
      location.hash='membership';
      document.querySelector('[data-page="membership"]')?.click();
    }else{
      location.href='./member.html#membership';
    }
  });
  m.classList.remove('hidden');
  return false;
}

window.HybridClassAccess={check};
