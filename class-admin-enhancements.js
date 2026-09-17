(async function(){
  if(!location.pathname.endsWith('/classes.html')) return;
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const supabase=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const labels={beginner:'Beginner',intermediate:'Intermediate',advanced:'Advanced',all_levels:'All levels'};
  let gymId=null,types=[];

  const {data:{session}}=await supabase.auth.getSession();
  if(!session) return;
  const {data:gm}=await supabase.from('gym_members').select('gym_id,role').eq('user_id',session.user.id).eq('is_active',true).limit(1);
  if(!gm?.length || !['owner','admin'].includes(gm[0].role)) return;
  gymId=gm[0].gym_id;

  const style=document.createElement('style');
  style.textContent=`
    .class-setup-modal{position:fixed;inset:0;background:rgba(11,16,32,.62);display:grid;place-items:center;padding:18px;z-index:80}
    .class-setup-modal.hidden{display:none!important}.class-setup-card{width:min(900px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:22px;padding:20px}
    .class-type-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}.class-type-item{border:1px solid #e7ebf2;border-radius:16px;padding:14px}
    .difficulty{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:800;background:#f2f4f7}.difficulty.beginner{background:#ecfdf3;color:#067647}.difficulty.intermediate{background:#fffaeb;color:#b54708}.difficulty.advanced{background:#fef3f2;color:#b42318}
    .class-type-form{border-top:1px solid #e7ebf2;margin-top:18px;padding-top:18px}.class-type-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.class-type-grid .full{grid-column:1/-1}
    .class-type-grid label{display:block;font-size:12px;font-weight:800;margin-bottom:5px}.class-type-grid input,.class-type-grid select,.class-type-grid textarea{width:100%;padding:11px;border:1px solid #d9dee7;border-radius:12px}.class-type-grid textarea{min-height:90px;resize:vertical}
    @media(max-width:700px){.class-type-list,.class-type-grid{grid-template-columns:1fr}.class-type-grid .full{grid-column:auto}.class-setup-card{border-radius:20px 20px 0 0;align-self:end;max-height:88vh}}
  `;
  document.head.appendChild(style);

  const topActions=document.querySelector('.top .actions');
  if(!topActions) return;
  const setupBtn=document.createElement('button');
  setupBtn.className='btn secondary'; setupBtn.textContent='⚙ Class setup';
  topActions.insertBefore(setupBtn, topActions.firstChild);

  const modal=document.createElement('div');
  modal.className='class-setup-modal hidden';
  modal.innerHTML=`<div class="class-setup-card">
    <div class="modal-top"><div><div class="eyebrow">Class library</div><h2 style="margin:4px 0">Class setup</h2><div class="meta">Create the reusable classes members will see when booking.</div></div><button id="classSetupClose" class="btn secondary">Close</button></div>
    <div id="classTypeList" class="class-type-list"></div>
    <div class="class-type-form"><h3 id="classTypeFormTitle" style="margin:0 0 10px">Add class type</h3><input id="classTypeId" type="hidden">
      <div class="class-type-grid">
        <div><label>Class name</label><input id="classTypeName" placeholder="Hybrid Strength"></div>
        <div><label>Level</label><select id="classTypeLevel"><option value="all_levels">All levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div>
        <div><label>Default duration (minutes)</label><input id="classTypeDuration" type="number" min="5" value="60"></div>
        <div><label>Default capacity</label><input id="classTypeCapacity" type="number" min="1" value="20"></div>
        <div class="full"><label>Description</label><textarea id="classTypeDescription" placeholder="What should a member expect from this class?"></textarea></div>
      </div>
      <div class="actions" style="margin-top:12px"><button id="classTypeSave" class="btn primary">Save class type</button><button id="classTypeReset" class="btn secondary">Clear</button></div><div id="classTypeMsg" class="msg"></div>
    </div>
  </div>`;
  document.body.appendChild(modal);

  async function loadTypes(){
    const {data,error}=await supabase.from('class_types').select('id,name,description,duration_minutes,default_capacity,difficulty_level,is_active').eq('gym_id',gymId).eq('is_active',true).order('name');
    if(error){$('classTypeList').innerHTML='<div class="meta">'+esc(error.message)+'</div>';return}
    types=data||[]; renderTypes(); wireSessionTemplateSelect();
  }
  function renderTypes(){
    $('classTypeList').innerHTML=types.length?types.map(t=>`<div class="class-type-item"><div style="display:flex;justify-content:space-between;gap:10px"><div><b>${esc(t.name)}</b><div style="margin-top:6px"><span class="difficulty ${esc(t.difficulty_level)}">${esc(labels[t.difficulty_level]||'All levels')}</span></div></div><button class="btn secondary small" data-edit-type="${t.id}">Edit</button></div><div class="meta" style="margin-top:8px">${esc(t.duration_minutes)} min · capacity ${esc(t.default_capacity)}</div><div style="margin-top:8px;line-height:1.45">${esc(t.description||'No description yet.')}</div></div>`).join(''):'<div class="meta">No class types yet. Add your first one below.</div>';
    document.querySelectorAll('[data-edit-type]').forEach(b=>b.onclick=()=>editType(b.dataset.editType));
  }
  function editType(id){const t=types.find(x=>x.id===id);if(!t)return;$('classTypeId').value=t.id;$('classTypeName').value=t.name;$('classTypeLevel').value=t.difficulty_level||'all_levels';$('classTypeDuration').value=t.duration_minutes;$('classTypeCapacity').value=t.default_capacity;$('classTypeDescription').value=t.description||'';$('classTypeFormTitle').textContent='Edit class type';$('classTypeName').focus()}
  function resetForm(){$('classTypeId').value='';$('classTypeName').value='';$('classTypeLevel').value='all_levels';$('classTypeDuration').value='60';$('classTypeCapacity').value='20';$('classTypeDescription').value='';$('classTypeFormTitle').textContent='Add class type';$('classTypeMsg').textContent=''}
  $('classTypeSave').onclick=async()=>{const btn=$('classTypeSave');const row={gym_id:gymId,name:$('classTypeName').value.trim(),description:$('classTypeDescription').value.trim()||null,duration_minutes:Number($('classTypeDuration').value)||60,default_capacity:Number($('classTypeCapacity').value)||20,difficulty_level:$('classTypeLevel').value,is_active:true};if(!row.name){$('classTypeMsg').textContent='Enter a class name.';return}btn.disabled=true;btn.textContent='Saving…';const id=$('classTypeId').value;const q=id?supabase.from('class_types').update(row).eq('id',id):supabase.from('class_types').insert(row);const {error}=await q;btn.disabled=false;btn.textContent='Save class type';if(error){$('classTypeMsg').textContent=error.message;return}$('classTypeMsg').textContent='Saved ✓';resetForm();await loadTypes()};
  $('classTypeReset').onclick=resetForm;
  $('classSetupClose').onclick=()=>modal.classList.add('hidden');
  setupBtn.onclick=async()=>{modal.classList.remove('hidden');await loadTypes()};
  modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden')});

  function wireSessionTemplateSelect(){
    const nameInput=$('name'); if(!nameInput || $('classTypeTemplate')) return;
    const wrap=document.createElement('div'); wrap.className='field';
    wrap.innerHTML='<label>Class type</label><select id="classTypeTemplate"><option value="">Custom / one-off class</option>'+types.map(t=>`<option value="${t.id}">${esc(t.name)} · ${esc(labels[t.difficulty_level]||'All levels')}</option>`).join('')+'</select><div class="meta" style="margin-top:5px">Selecting a class type fills the saved description, duration and capacity.</div>';
    nameInput.closest('.field').before(wrap);
    $('classTypeTemplate').onchange=()=>{const t=types.find(x=>x.id===$('classTypeTemplate').value);if(!t)return;$('name').value=t.name;$('desc').value=t.description||'';$('duration').value=t.duration_minutes;$('capacity').value=t.default_capacity;};
  }

  await loadTypes();
})();