import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const preview=location.pathname.endsWith('/member-preview.html');
if(location.pathname.endsWith('/member.html')||preview){
 const sb=preview?null:createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 let gymId,userId,assignments=[],wods=[];
 function mount(){
  const page=document.getElementById('workouts'); if(!page||document.getElementById('v2Assigned'))return;
  const grid=page.querySelector('.grid'); const section=document.createElement('div'); section.className='v2-training';
  section.innerHTML='<div class="v2-tabs"><button class="active" data-v2-tab="assigned">Assigned</button><button data-v2-tab="wod">Gym WOD</button><button data-v2-tab="history">My history</button></div><div id="v2Assigned"></div><div id="v2Wod" class="hidden"></div>';
  page.insertBefore(section,grid);
  section.querySelectorAll('[data-v2-tab]').forEach(b=>b.onclick=()=>{section.querySelectorAll('[data-v2-tab]').forEach(x=>x.classList.toggle('active',x===b));document.getElementById('v2Assigned').classList.toggle('hidden',b.dataset.v2Tab!=='assigned');document.getElementById('v2Wod').classList.toggle('hidden',b.dataset.v2Tab!=='wod');grid.classList.toggle('hidden',b.dataset.v2Tab!=='history')});
  grid.classList.add('hidden');
 }
 const tags=a=>(a.focus_tags||[]).slice(0,3).map(x=>'<span class="tag">'+esc(x)+'</span>').join('');
 function renderAssigned(){
  const host=document.getElementById('v2Assigned'); if(!host)return;
  host.innerHTML=assignments.length?assignments.map(a=>'<article class="card v2-card"><div class="rowtop"><div><div class="eyebrow">'+(a.source==='pt'?'COACH ASSIGNED':'YOUR WORKOUT')+'</div><h3>'+esc(a.title)+'</h3></div><span class="tag '+(a.status==='completed'?'good':'')+'">'+esc(a.status.replace('_',' '))+'</span></div><div class="v2-tags">'+tags(a)+'</div>'+(a.due_at?'<div class="muted">Due '+new Date(a.due_at).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+'</div>':'')+'<div class="actions">'+(a.status==='completed'?'<button class="btn secondary" data-v2-open="'+a.id+'">View results</button>':'<button class="btn primary" data-v2-open="'+a.id+'">'+(a.status==='in_progress'?'Continue workout':'Start workout')+'</button>')+'</div></article>').join(''):'<div class="card empty">No workouts have been assigned to you yet.</div>';
  host.querySelectorAll('[data-v2-open]').forEach(b=>b.onclick=()=>openAssignment(b.dataset.v2Open));
 }
 function renderWods(){
  const host=document.getElementById('v2Wod');if(!host)return;
  host.innerHTML=wods.length?wods.map(w=>'<article class="card v2-card"><div class="eyebrow">WORKOUT OF THE DAY</div><h3>'+esc(w.workout_templates?.title||'Gym WOD')+'</h3><div class="v2-tags">'+tags(w.workout_templates||{})+'</div><p class="muted">'+esc(w.message||w.workout_templates?.description||'Optional gym workout. Pick it up if you fancy it today.')+'</p><div class="actions"><button class="btn primary" data-pick-wod="'+w.id+'">I’ll do this</button></div></article>').join(''):'<div class="card empty">There is no WOD published for today.</div>';
  host.querySelectorAll('[data-pick-wod]').forEach(b=>b.onclick=()=>pickWod(b.dataset.pickWod,b));
 }
 function workoutBody(a){
  const snap=a.workout_snapshot||{}, blocks=snap.blocks||[];
  return '<div class="v2-player-head"><div><div class="eyebrow">'+(a.source==='pt'?'COACH WORKOUT':a.source==='wod'?'GYM WOD':'WORKOUT')+'</div><h2>'+esc(a.title)+'</h2></div><button class="btn secondary" data-v2-close>Close</button></div>'+blocks.map((b,bi)=>'<section class="v2-block"><div class="eyebrow">BLOCK '+(bi+1)+' · '+esc(b.block_type||'training')+'</div><h3>'+esc(b.title||'Block')+'</h3>'+(b.instructions?'<p class="muted">'+esc(b.instructions)+'</p>':'')+(b.activities||[]).map((x,ai)=>'<label class="v2-activity"><input type="checkbox" data-v2-check="'+bi+':'+ai+'" '+(a.status==='completed'?'checked disabled':'')+'><span><b>'+esc(x.activity_name)+'</b><small>'+esc(x.prescription?.display||x.prescription||x.tracking_type||'')+(x.notes?' · '+esc(x.notes):'')+'</small></span></label>').join('')+'</section>').join('')+(a.status==='completed'?'<div class="v2-complete">Completed '+new Date(a.completed_at).toLocaleDateString('en-GB')+(a.member_rpe?' · RPE '+a.member_rpe:'')+'</div>':'<div class="field"><label>How hard was it? (RPE 1-10)</label><input id="v2Rpe" type="number" min="1" max="10" inputmode="numeric"></div><div class="field"><label>Notes for your coach</label><textarea id="v2Notes" placeholder="How did it feel? Anything your coach should know?"></textarea></div><div class="actions"><button id="v2Finish" class="btn primary">Complete workout</button></div><div id="v2Msg" class="msg"></div>');
 }
 async function openAssignment(id){
  const a=assignments.find(x=>x.id===id);if(!a)return;
  let modal=document.getElementById('v2Player');if(!modal){modal=document.createElement('div');modal.id='v2Player';modal.className='modal hidden';modal.innerHTML='<div class="modal-card v2-player"></div>';document.body.appendChild(modal)}
  modal.querySelector('.modal-card').innerHTML=workoutBody(a);modal.classList.remove('hidden');modal.querySelector('[data-v2-close]').onclick=()=>modal.classList.add('hidden');
  if(a.status==='todo'&&!preview){const {error}=await sb.from('workout_assignments').update({status:'in_progress',started_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);if(!error)a.status='in_progress'}
  const finish=modal.querySelector('#v2Finish');if(finish)finish.onclick=async()=>{const checks=[...modal.querySelectorAll('[data-v2-check]')];if(checks.length&&!checks.every(x=>x.checked)){modal.querySelector('#v2Msg').textContent='Tick each activity when you have completed it.';return}const rpe=Number(modal.querySelector('#v2Rpe').value)||null;if(rpe&&(rpe<1||rpe>10)){modal.querySelector('#v2Msg').textContent='RPE must be between 1 and 10.';return}finish.disabled=true;finish.textContent='Completing…';if(preview){a.status='completed';a.completed_at=new Date().toISOString()}else{const {error}=await sb.from('workout_assignments').update({status:'completed',completed_at:new Date().toISOString(),member_rpe:rpe,member_notes:modal.querySelector('#v2Notes').value.trim()||null,updated_at:new Date().toISOString()}).eq('id',id);if(error){modal.querySelector('#v2Msg').textContent=error.message;finish.disabled=false;finish.textContent='Complete workout';return}await load()}modal.classList.add('hidden');renderAssigned()};
 }
 async function pickWod(id,btn){
  const w=wods.find(x=>x.id===id);if(!w)return;btn.disabled=true;btn.textContent='Adding…';
  const t=w.workout_templates||{},snap=await snapshot(w.template_id,t);
  if(preview){assignments.unshift({id:'preview-wod',source:'wod',title:t.title,status:'todo',focus_tags:t.focus_tags||[],workout_snapshot:snap});renderAssigned();btn.textContent='Added to workouts';return}
  const {error}=await sb.from('workout_assignments').insert({gym_id:gymId,template_id:w.template_id,member_user_id:userId,source:'wod',title:t.title,workout_type:t.workout_type||'hybrid',focus_tags:t.focus_tags||[],workout_snapshot:snap,scheduled_for:w.wod_date,status:'todo'});
  if(error){btn.disabled=false;btn.textContent='Try again';return}btn.textContent='Added to workouts';await load();
 }
 async function snapshot(templateId,t){
  if(preview)return t.workout_snapshot||{blocks:[]};
  const [{data:bs},{data:as}]=await Promise.all([sb.from('workout_template_blocks').select('id,title,block_type,position,instructions').eq('template_id',templateId).order('position'),sb.from('workout_template_activities').select('block_id,activity_name,tracking_type,position,prescription,notes').eq('template_id',templateId).order('position')]);
  return {template_id:templateId,title:t.title,workout_type:t.workout_type,focus_tags:t.focus_tags||[],blocks:(bs||[]).map(b=>({...b,activities:(as||[]).filter(a=>a.block_id===b.id)}))};
 }
 async function load(){
  if(preview){assignments=[{id:'preview-a',source:'pt',title:'Back & Chest',status:'todo',focus_tags:['Back','Chest','Strength'],due_at:new Date(Date.now()+86400000).toISOString(),workout_snapshot:{blocks:[{title:'Strength',block_type:'strength',instructions:'Controlled reps',activities:[{activity_name:'Bench press',prescription:{display:'4 x 6'},notes:'RPE 8'},{activity_name:'Chest-supported row',prescription:{display:'4 x 8'}}]},{title:'Finisher',block_type:'finisher',activities:[{activity_name:'SkiErg',prescription:{display:'5 x 45 sec'}}]}]}}];wods=[{id:'preview-wod',template_id:'preview',wod_date:new Date().toISOString().slice(0,10),message:'Optional engine session for anyone training today.',workout_templates:{title:'Friday Engine',workout_type:'conditioning',focus_tags:['Cardio','Conditioning'],workout_snapshot:{blocks:[{title:'Engine',block_type:'intervals',activities:[{activity_name:'Bike',prescription:{display:'8 x 1 min hard / 1 min easy'}}]}]}}}];renderAssigned();renderWods();return}
  const today=new Date().toISOString().slice(0,10);
  const [a,w]=await Promise.all([sb.from('workout_assignments').select('*').eq('gym_id',gymId).eq('member_user_id',userId).order('created_at',{ascending:false}).limit(30),sb.from('workout_wods').select('id,template_id,wod_date,message,workout_templates(title,description,workout_type,focus_tags)').eq('gym_id',gymId).eq('wod_date',today).eq('is_active',true)]);
  assignments=a.data||[];wods=w.data||[];renderAssigned();renderWods();
 }
 async function init(){if(!mount())return;if(preview){await load();return}const {data:{user}}=await sb.auth.getUser();if(!user)return;userId=user.id;const {data:gm}=await sb.from('gym_members').select('gym_id').eq('user_id',userId).eq('is_active',true).limit(1).maybeSingle();if(!gm)return;gymId=gm.gym_id;await load()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
}