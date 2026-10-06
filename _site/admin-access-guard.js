(function(){
  const URL='https://mzgnhmeydhhpzgxlgudh.supabase.co';
  const KEY='sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD';
  async function init(){
    try{
      const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      const sb=mod.createClient(URL,KEY);
      const{data:{session}}=await sb.auth.getSession();if(!session)return;
      const requestedGymId=new URLSearchParams(location.search).get('gym_id')||sessionStorage.getItem('hybrid-gym-id')||'';
      if(!requestedGymId)return;
      const{data:membership,error:membershipErr}=await sb.from('gym_members').select('gym_id,role,access_status,gyms(name)').eq('user_id',session.user.id).eq('gym_id',requestedGymId).eq('is_active',true).in('role',['owner','admin']).maybeSingle();
      if(membershipErr)throw membershipErr;
      if(!membership||!['admin','owner'].includes(membership.role)||membership.access_status!=='pending')return;
      window.HybridAccess={...(window.HybridAccess||{}),readOnly:true,gymId:membership.gym_id,accessStatus:'pending'};
      document.documentElement.classList.add('hybrid-admin-readonly');
      const banner=document.createElement('div');banner.id='hybridReadonlyBanner';const roleLabel=membership.role==='owner'?'Owner':'Admin';banner.innerHTML='<b>Read-only preview</b><span>Waiting for the required Owner approval for your '+roleLabel+' access.</span>';
      banner.style.cssText='position:fixed;left:50%;bottom:calc(12px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483646;width:min(560px,calc(100vw - 24px));display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;padding:11px 14px;border:1px solid #fedf89;border-radius:14px;background:#fffaeb;color:#7a2e0e;font:13px/1.35 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 10px 30px rgba(16,24,40,.14)';
      document.body.appendChild(banner);
      const deny=()=>{let n=document.getElementById('hybridReadonlyNotice');if(!n){n=document.createElement('div');n.id='hybridReadonlyNotice';n.textContent='Read-only until the required Owner approval is complete.';n.style.cssText='position:fixed;left:50%;top:calc(14px + env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483647;padding:10px 13px;border-radius:12px;background:#0b1020;color:#fff;font:12px/1.3 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2)';document.body.appendChild(n);setTimeout(()=>n.remove(),2200)}};
      document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();deny()},true);
      document.addEventListener('click',e=>{
        const b=e.target.closest?.('button,[role="button"]');if(!b)return;
        if(b.matches('.admin-mobile-menu-btn,.admin-mobile-menu-close')||b.closest('.nav,.admin-context-tabs,.tabs,[data-readonly-nav]'))return;
        const text=(b.textContent||'').trim().toLowerCase();
        if(/save|create|add|delete|remove|approve|publish|assign|book|cancel|confirm|update|connect|disconnect|send|post|new|upload|invite/.test(text)){e.preventDefault();e.stopImmediatePropagation();deny()}
      },true);
    }catch(e){console.warn('Hybrid read-only guard failed',e)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();