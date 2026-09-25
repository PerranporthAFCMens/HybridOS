(async function(){
  if(document.documentElement.classList.contains('admin-embedded'))return;
  const side=()=>document.querySelector('.side .gym,.side .hybrid-shell-gym');
  const {data:{session}}=await (async()=>{
    const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const sb=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
    window.__hybridGymSwitcherSb=sb;
    return sb.auth.getSession();
  })();
  if(!session)return;
  const sb=window.__hybridGymSwitcherSb;
  const{data,error}=await sb.from('gym_members').select('gym_id,access_status').eq('user_id',session.user.id).eq('is_active',true).eq('access_status','active');
  delete window.__hybridGymSwitcherSb;
  if(error||!data||data.length<2)return;
  function wire(){
    const gym=side();if(!gym||gym.dataset.gymSwitchReady==='1')return !!gym;
    gym.dataset.gymSwitchReady='1';gym.classList.add('hybrid-gym-switchable');gym.setAttribute('role','button');gym.setAttribute('tabindex','0');gym.setAttribute('aria-label','Switch gym');
    if(!gym.querySelector('.hybrid-gym-switch-note')){const note=document.createElement('div');note.className='hybrid-gym-switch-note';note.textContent='Switch gym';gym.appendChild(note)}
    const open=e=>{e?.preventDefault();location.href='./choose-gym.html?switch=1'};
    gym.addEventListener('click',open);gym.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(e)}});
    return true;
  }
  if(!wire()){let attempts=0;const timer=setInterval(()=>{if(wire()||++attempts>20)clearInterval(timer)},100)}
})().catch(e=>console.warn('Gym switcher unavailable',e));