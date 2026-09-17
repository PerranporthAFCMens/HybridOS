(async function(){
  if(!location.pathname.endsWith('/classes.html')) return;
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const supabase=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
  const labels={beginner:'Beginner',intermediate:'Intermediate',advanced:'Advanced',all_levels:'All levels'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const {data:{session}}=await supabase.auth.getSession();
  if(!session) return;
  const {data:gm}=await supabase.from('gym_members').select('gym_id,role').eq('user_id',session.user.id).eq('is_active',true).limit(1);
  if(!gm?.length||!['owner','admin'].includes(gm[0].role)) return;
  const gymId=gm[0].gym_id;

  async function refreshTemplates(){
    const modal=document.getElementById('modal');
    const select=document.getElementById('classTypeTemplate');
    if(!modal||!select) return;
    const previous=select.value;
    select.disabled=true;
    select.innerHTML='<option value="">Loading saved classes…</option>';
    const [{data:types,error},{data:reqs}]=await Promise.all([
      supabase.from('class_types').select('id,name,description,duration_minutes,default_capacity,difficulty_level').eq('gym_id',gymId).eq('is_active',true).order('name'),
      supabase.from('service_requirements').select('class_type_id,resource_id,resources(name)').eq('gym_id',gymId).not('resource_id','is',null)
    ]);
    if(error){select.innerHTML='<option value="">Could not load saved classes</option>';select.disabled=false;return}
    const rows=types||[];
    select.innerHTML='<option value="">Custom / one-off class</option>'+rows.map(t=>`<option value="${t.id}">${esc(t.name)} · ${esc(labels[t.difficulty_level]||'All levels')}</option>`).join('');
    if(rows.some(t=>t.id===previous)) select.value=previous;
    select.disabled=false;
    select.onchange=()=>{
      const t=rows.find(x=>x.id===select.value);
      let note=document.getElementById('classTypeScheduleDependency');
      if(!t){if(note)note.remove();return}
      const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val};
      set('name',t.name);set('desc',t.description||'');set('duration',t.duration_minutes);set('capacity',t.default_capacity);
      const req=(reqs||[]).find(r=>r.class_type_id===t.id&&r.resource_id);
      if(!note){note=document.createElement('div');note.id='classTypeScheduleDependency';note.className='notice';select.closest('.field')?.insertAdjacentElement('afterend',note)}
      if(note)note.textContent=req?.resources?.name?'Requires: '+req.resources.name+'. Hybrid OS will check this resource when the class is scheduled.':'No room/equipment dependency.';
    };
  }

  function attach(){
    const modal=document.getElementById('modal');
    if(!modal||modal.dataset.liveTemplateRefresh==='1') return false;
    modal.dataset.liveTemplateRefresh='1';
    new MutationObserver(()=>{if(!modal.classList.contains('hidden'))refreshTemplates()}).observe(modal,{attributes:true,attributeFilter:['class']});
    const add=document.getElementById('addBtn');
    if(add)add.addEventListener('click',()=>setTimeout(refreshTemplates,0),true);
    return true;
  }
  if(!attach()){
    const timer=setInterval(()=>{if(attach())clearInterval(timer)},100);
    setTimeout(()=>clearInterval(timer),10000);
  }
})();