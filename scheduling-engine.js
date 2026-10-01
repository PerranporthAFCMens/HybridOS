(async function(){
  if(!location.pathname.endsWith('/classes.html')) return;
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let gymId=null,requirements=[],staffCaps=[],staffHours=[],profiles=[];

  const {data:{session}}=await sb.auth.getSession();
  if(!session)return;
  const {data:gm}=await sb.from('gym_members').select('gym_id,role').eq('user_id',session.user.id).eq('is_active',true).limit(1);
  if(!gm?.length||!['owner','admin'].includes(gm[0].role))return;
  gymId=gm[0].gym_id;

  const style=document.createElement('style');
  style.textContent=`
    #scheduleCheck{margin:12px 0;padding:12px 13px;border-radius:12px;background:#f8fafc;border:1px solid #e7ebf2;font-size:13px}
    #scheduleCheck.good{background:#ecfdf3;border-color:#abefc6;color:#067647}
    #scheduleCheck.bad{background:#fef3f2;border-color:#fecdca;color:#b42318}
    #scheduleCheck ul{margin:7px 0 0;padding-left:18px}
    .check.schedule-unavailable{opacity:.48}.check.schedule-unavailable span{font-size:11px;color:#b42318;margin-left:auto}
  `;
  document.head.appendChild(style);

  async function loadRules(){
    const [rq,sc,wh,pf]=await Promise.all([
      sb.from('service_requirements').select('class_type_id,capability_id,resource_id,quantity').eq('gym_id',gymId),
      sb.from('staff_capabilities').select('user_id,capability_id,qualified,expires_on').eq('gym_id',gymId),
      sb.from('staff_working_hours').select('user_id,weekday,start_time,end_time,is_working').eq('gym_id',gymId),
      sb.from('profiles').select('id,display_name,first_name,last_name')
    ]);
    requirements=rq.data||[];staffCaps=sc.data||[];staffHours=wh.data||[];profiles=pf.data||[];
  }

  function selectedType(){return $('classTypeTemplate')?.value||''}
  function selectedStaff(){return [...document.querySelectorAll('#staffChecks input[type=checkbox]:checked')].map(x=>x.value)}
  function selectedPlans(){return [...document.querySelectorAll('#planChecks input[type=checkbox]:checked')].map(x=>x.value)}
  function localRange(){
    const d=$('date')?.value,t=$('start')?.value,mins=Number($('duration')?.value||0);
    if(!d||!t||!Number.isFinite(mins)||mins<5)return null;
    const start=new Date(`${d}T${t}:00`),end=new Date(start.getTime()+mins*60000);
    return{start,end};
  }
  function requiredCaps(typeId){return requirements.filter(r=>r.class_type_id===typeId&&r.capability_id).map(r=>r.capability_id)}
  function staffQualified(uid,typeId,date){
    const req=requiredCaps(typeId);if(!req.length)return true;
    return req.every(cid=>staffCaps.some(s=>s.user_id===uid&&s.capability_id===cid&&s.qualified&&(!s.expires_on||s.expires_on>=date)));
  }
  function staffWorking(uid,start,end){
    const wd=start.getDay(),st=start.toTimeString().slice(0,8),et=end.toTimeString().slice(0,8);
    return staffHours.some(h=>h.user_id===uid&&Number(h.weekday)===wd&&h.is_working&&h.start_time<=st&&h.end_time>=et);
  }
  function updateStaffHints(){
    const typeId=selectedType(),range=localRange();
    document.querySelectorAll('#staffChecks input[type=checkbox]').forEach(input=>{
      const label=input.closest('.check');label?.querySelector('.sched-reason')?.remove();
      if(!typeId||!range){label?.classList.remove('schedule-unavailable');return}
      const qualified=staffQualified(input.value,typeId,$('date').value),working=staffWorking(input.value,range.start,range.end),ok=qualified&&working;
      label?.classList.toggle('schedule-unavailable',!ok);
      if(!ok&&label){
        const s=document.createElement('span');s.className='sched-reason';s.textContent=!qualified?'Not qualified':'Outside hours';label.appendChild(s);
        if(input.checked)input.checked=false;
      }
    });
  }
  function ensurePanel(){
    let el=$('scheduleCheck');if(el)return el;
    el=document.createElement('div');el.id='scheduleCheck';el.textContent='Choose a saved class, time and staff to check availability.';
    $('saveBtn')?.before(el);return el;
  }
  async function validate(){
    const typeId=selectedType(),range=localRange(),panel=ensurePanel();
    if(!range){panel.className='bad';panel.textContent='Choose a valid date, start time and duration.';return{ok:false}}
    if(!typeId){panel.className='';panel.textContent='Custom class: staff/resource dependency validation is not applied.';return{ok:true,custom:true,range}}
    const staff=selectedStaff(),capacity=Number($('capacity')?.value||0);
    panel.className='';panel.textContent='Checking staff, resources and clashes…';
    const {data,error}=await sb.rpc('validate_class_schedule',{p_gym_id:gymId,p_class_type_id:typeId,p_starts_at:range.start.toISOString(),p_ends_at:range.end.toISOString(),p_capacity:capacity,p_staff_ids:staff,p_exclude_session_id:null});
    if(error){panel.className='bad';panel.textContent=error.message;return{ok:false}}
    if(!data?.ok){panel.className='bad';panel.innerHTML='<b>Cannot schedule this class yet:</b><ul>'+(data?.errors||[]).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';return{ok:false}}
    panel.className='good';panel.textContent='✓ Staff, working hours, resources, capacity and clashes all check out.';
    return{ok:true,typeId,range,staff};
  }

  async function saveValidated(e){
    const btn=$('saveBtn');if(!btn||btn.disabled)return;
    e.preventDefault();e.stopImmediatePropagation();
    const name=$('name')?.value.trim()||'',range=localRange(),capacity=Number($('capacity')?.value),reserved=Number($('reserved')?.value||0);
    const msg=$('modalMsg');
    if(!name||!range||!Number.isInteger(capacity)||capacity<1||!Number.isInteger(reserved)||reserved<0||reserved>capacity){
      if(msg){msg.textContent='Check the class name, date, duration and capacity values.';msg.className='msg error'}
      return;
    }
    const check=await validate();if(!check.ok)return;
    const typeId=selectedType()||null,staff=selectedStaff(),plans=selectedPlans();
    btn.disabled=true;btn.textContent='Saving…';
    try{
      const {data,error}=await sb.rpc('create_validated_class_session',{
        p_gym_id:gymId,
        p_class_type_id:typeId,
        p_name:name,
        p_description:$('desc')?.value.trim()||null,
        p_starts_at:range.start.toISOString(),
        p_ends_at:range.end.toISOString(),
        p_capacity:capacity,
        p_reserved_capacity:reserved,
        p_reserved_release_minutes_before:$('release')?.value===''?null:Number($('release')?.value),
        p_staff_ids:staff,
        p_plan_ids:plans
      });
      if(error)throw error;
      if(!data?.ok){
        const errs=data?.errors||['The class could not be scheduled.'];
        const panel=ensurePanel();panel.className='bad';panel.innerHTML='<b>Cannot schedule this class yet:</b><ul>'+errs.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
        return;
      }
      if(msg){msg.textContent='Class scheduled.';msg.className='msg goodtxt'}
      $('modal')?.classList.add('hidden');
      if($('name'))$('name').value='';if($('desc'))$('desc').value='';
      document.querySelectorAll('#planChecks input,#staffChecks input').forEach(x=>x.checked=false);
      location.reload();
    }catch(err){
      if(msg){msg.textContent=err?.message||'Could not save the class.';msg.className='msg error'}
    }finally{btn.disabled=false;btn.textContent='Save class'}
  }

  await loadRules();ensurePanel();
  const refresh=()=>{updateStaffHints();validate().catch(()=>{})};
  document.addEventListener('change',e=>{
    if(['date','start','duration','capacity','classTypeTemplate'].includes(e.target?.id))refresh();
    if(e.target?.matches('#staffChecks input[type=checkbox]'))validate().catch(()=>{});
  });

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const btn=$('saveBtn');
    if(btn&&!btn.dataset.atomicScheduleSave){
      btn.dataset.atomicScheduleSave='1';
      btn.addEventListener('click',saveValidated,true);
      clearInterval(timer);
    }else if(tries>40)clearInterval(timer);
    updateStaffHints();
  },125);
})();