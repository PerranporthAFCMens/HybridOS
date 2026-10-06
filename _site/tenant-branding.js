(function(){
  const HYBRID_HUB_ID='242f57c2-6e37-4977-b3c5-1c87de7d0b98';
  const TENANT_BRANDS={
    [HYBRID_HUB_ID]:{name:'Hybrid Hub',logo:'./assets/hybrid-hub-logo-horizontal.svg'}
  };
  const activeTenant=()=>TENANT_BRANDS[sessionStorage.getItem('hybrid-gym-id')||'']||null;

  function addLogoToGymCards(){
    const tenant=activeTenant();
    document.querySelectorAll('.gym').forEach(function(card){
      const existing=card.querySelector('.tenant-gym-logo');
      if(!tenant){
        if(existing&&/hybrid-hub-logo-horizontal\.svg(?:$|[?#])/.test(existing.getAttribute('src')||'')) existing.remove();
        return;
      }
      const img=existing||document.createElement('img');
      img.src=tenant.logo;
      img.alt=tenant.name;
      img.className='tenant-gym-logo';
      img.dataset.hybridTenantLogo='1';
      if(!existing) card.insertBefore(img,card.firstChild);
    });
  }

  function addTopBrand(){
    const path=location.pathname;
    if(!(path.endsWith('/member.html')||path.endsWith('/member-preview.html'))) return;
    const tenant=activeTenant();
    if(!tenant){document.querySelector('.tenant-top-brand')?.remove();return}
    const main=document.querySelector('.main');
    const top=document.querySelector('.main .top');
    if(!main||!top||document.querySelector('.tenant-top-brand')||document.querySelector('.member-gym-logo')) return;
    const wrap=document.createElement('div');
    wrap.className='tenant-top-brand';
    const img=document.createElement('img');
    img.src=tenant.logo;
    img.alt=tenant.name;
    wrap.appendChild(img);
    main.insertBefore(wrap,top);
  }

  async function addDoorAccessCard(){
    const path=location.pathname;
    if(!(path.endsWith('/member.html')||path.endsWith('/member-preview.html'))) return;
    const gym=document.querySelector('.side .gym');
    if(!gym||document.querySelector('.door-access-card')) return;
    try{
      const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      const sb=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return;
      const {data:gm}=await sb.from('gym_members').select('gym_id').eq('user_id',session.user.id).eq('is_active',true);
      if(!gm?.length) return;
      const storedGymId=sessionStorage.getItem('hybrid-gym-id')||'';
      let selectedGymId=storedGymId,membership=selectedGymId?gm.find(x=>x.gym_id===selectedGymId):null;
      if(!membership&&!storedGymId&&gm.length===1){membership=gm[0];selectedGymId=membership.gym_id;sessionStorage.setItem('hybrid-gym-id',selectedGymId)}
      if(!membership) return;
      const {data:settings}=await sb.from('gym_access_settings').select('access_enabled,access_code,member_label,member_note').eq('gym_id',membership.gym_id).maybeSingle();
      if(!settings?.access_enabled||!settings.access_code) return;

      const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
      const card=document.createElement('div');
      card.className='door-access-card';
      card.innerHTML='<div class="door-access-head"><span class="door-key-icon" aria-hidden="true">🔑</span><div><small>'+esc(settings.member_label||'Door access')+'</small><strong>Gym PIN</strong></div></div><button type="button" class="door-code-reveal" aria-expanded="false">Tap to reveal</button><div class="door-code-value" hidden>'+esc(settings.access_code)+'</div><div class="door-code-note">'+esc(settings.member_note||'Set by your gym.')+'</div>';
      gym.insertAdjacentElement('afterend',card);
      const reveal=card.querySelector('.door-code-reveal');
      const value=card.querySelector('.door-code-value');
      reveal.addEventListener('click',function(){
        const showing=!value.hidden;
        value.hidden=showing;
        reveal.textContent=showing?'Tap to reveal':'Hide code';
        reveal.setAttribute('aria-expanded',showing?'false':'true');
      });
    }catch(err){
      console.warn('Door access unavailable',err);
    }
  }

  function init(){
    addLogoToGymCards();
    addTopBrand();
    addDoorAccessCard();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();