(function(){
  if(document.documentElement.classList.contains('admin-embedded'))return;
  let enabled=false,wireTimer=null;

  function shellGym(){return document.querySelector('.side .gym,.side .hybrid-shell-gym')}
  function wire(){
    if(!enabled)return false;
    const gym=shellGym();if(!gym)return false;
    if(gym.dataset.gymSwitchReady==='1')return true;
    gym.dataset.gymSwitchReady='1';
    gym.classList.add('hybrid-gym-switchable');
    gym.setAttribute('role','button');
    gym.setAttribute('tabindex','0');
    gym.setAttribute('aria-label','Switch gym');
    if(!gym.querySelector('.hybrid-gym-switch-note')){
      const note=document.createElement('div');
      note.className='hybrid-gym-switch-note';
      note.innerHTML='<i class="hi hi-repeat" aria-hidden="true"></i><span>Switch gym</span>';
      gym.appendChild(note);
    }
    const open=e=>{e?.preventDefault();location.href='./choose-gym.html?switch=1'};
    gym.addEventListener('click',open);
    gym.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(e)}});
    return true;
  }
  function enable(count){
    if(Number(count)<2)return;
    enabled=true;
    if(wire())return;
    if(wireTimer)return;
    let attempts=0;
    wireTimer=setInterval(()=>{
      if(wire()||++attempts>30){clearInterval(wireTimer);wireTimer=null}
    },100);
  }

  window.addEventListener('hybrid:memberships-loaded',e=>enable(e.detail?.count||0));
  enable(window.__hybridActiveMemberships?.length||0);

  (async()=>{
    const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const sb=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
    const{data:{session}}=await sb.auth.getSession();
    if(!session)return;
    const{data,error}=await sb.from('gym_members').select('gym_id,access_status').eq('user_id',session.user.id).eq('is_active',true).eq('access_status','active');
    if(!error)enable(data?.length||0);
  })().catch(e=>console.warn('Gym switcher unavailable',e));
})();
