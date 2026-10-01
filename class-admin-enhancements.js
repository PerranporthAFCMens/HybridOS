(async function(){
  if(!location.pathname.endsWith('/classes.html')) return;
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const supabase=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));
  const labels={beginner:'Beginner',intermediate:'Intermediate',advanced:'Advanced',all_levels:'All levels'};
  let gymId=null,types=[],resources=[],requirements=[];

  const {data:{session}}=await supabase.auth.getSession();
  if(!session) return;
  const {data:gm}=await supabase.from('gym_members').select('gym_id,role').eq('user_id',session.user.id).eq('is_active',true).limit(1);
  if(!gm?.length || !['owner','admin'].includes(gm[0].role)) return;
  gymId=gm[0].gym_id;

  const style=document.createElement('style');
  style.textContent=`#classTypeScheduleDependency{grid-column:1/-1;margin:0 0 12px}`;
  document.head.appendChild(style);

  const topActions=document.querySelector('.top .actions'); if(!topActions) return;
  const setupBtn=document.createElement('button'); setupBtn.className='btn secondary'; setupBtn.textContent='⚙ Class setup'; setupBtn.onclick=()=>location.href='./class-setup.html'; topActions.insertBefore(setupBtn,topActions.firstChild);

  async function loadData(){
    const [tr,rr,reqr]=await Promise.all([
      supabase.from('class_types').select('id,name,description,duration_minutes,default_capacity,difficulty_level,is_active').eq('gym_id',gymId).eq('is_active',true).order('name'),
      supabase.from('resources').select('id,name,resource_type,capacity,is_active').eq('gym_id',gymId).eq('is_active',true).order('name'),
      supabase.from('service_requirements').select('id,class_type_id,resource_id,quantity').eq('gym_id',gymId).not('resource_id','is',null)
    ]);
    types=tr.data||[]; resources=rr.data||[]; requirements=reqr.data||[];
    refreshSessionTemplateSelect();
  }
  function resourcesForType(typeId){return requirements.filter(r=>r.class_type_id===typeId&&r.resource_id).map(req=>resources.find(x=>x.id===req.resource_id)).filter(Boolean)}

  function refreshSessionTemplateSelect(){
    const nameInput=$('name'); if(!nameInput) return;
    let select=$('classTypeTemplate');
    if(!select){
      const wrap=document.createElement('div'); wrap.className='field';
      wrap.innerHTML='<label>Class type</label><select id="classTypeTemplate"></select><div class="meta" style="margin-top:5px">Choose a saved class. Its description, duration and capacity will fill automatically.</div>';
      const grid=nameInput.closest('.grid2');
      if(grid) grid.insertBefore(wrap,grid.firstChild); else nameInput.closest('.field')?.before(wrap);
      select=$('classTypeTemplate');
    }
    if(!select) return;
    const previous=select.value;
    select.innerHTML='<option value="">Custom / one-off class</option>'+types.map(t=>`<option value="${t.id}">${esc(t.name)} · ${esc(labels[t.difficulty_level]||'All levels')}</option>`).join('');
    if(types.some(t=>t.id===previous)) select.value=previous;
    select.onchange=()=>{
      const t=types.find(x=>x.id===select.value);
      let note=$('classTypeScheduleDependency');
      if(!t){if(note)note.remove();return}
      $('name').value=t.name;$('desc').value=t.description||'';$('duration').value=t.duration_minutes;$('capacity').value=t.default_capacity;
      const rs=resourcesForType(t.id);
      if(!note){note=document.createElement('div');note.id='classTypeScheduleDependency';note.className='notice';select.closest('.field')?.insertAdjacentElement('afterend',note)}
      if(note) note.textContent=rs.length?'Requires: '+rs.map(r=>r.name).join(', ')+'. HybridOne will check these resources when the class is scheduled.':'No room/equipment dependency.';
    };
  }

  await loadData();
  const addBtn=$('addBtn');
  if(addBtn) addBtn.addEventListener('click',async()=>{await loadData();refreshSessionTemplateSelect()});
})();