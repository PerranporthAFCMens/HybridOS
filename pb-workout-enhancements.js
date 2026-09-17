import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const isPreview = location.pathname.endsWith('/member-preview.html');
const supabase = isPreview ? null : createClient(
  'https://mzgnhmeydhhpzgxlgudh.supabase.co',
  'sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD'
);

const iconFor = type => ({
  weight:'🏋️', reps:'🔁', time:'⏱️', distance:'📏', calories:'🔥', custom:'⭐'
}[type] || '🏆');

const unitFor = type => ({
  weight:'kg', reps:'reps', time:'sec', distance:'m', calories:'kcal'
}[type] || '');

const normalise = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

let authUser = null;
let gymId = null;
let previewPBs = [];

function injectStyles(){
  const style=document.createElement('style');
  style.textContent=`
  .pb-modal{position:fixed;inset:0;background:rgba(11,16,32,.66);display:grid;place-items:center;padding:18px;z-index:9999}
  .pb-modal.hidden{display:none}.pb-modal-card{width:min(560px,100%);background:#fff;border-radius:20px;padding:20px;box-shadow:0 28px 80px rgba(0,0,0,.28)}
  .pb-modal-card h3{margin:0 0 4px}.pb-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pb-field{margin-top:12px}.pb-field label{display:block;font-size:12px;font-weight:800;margin-bottom:5px}.pb-field input,.pb-field select,.pb-field textarea{width:100%;padding:11px;border:1px solid #e7ebf2;border-radius:12px;background:#fff;font:inherit}.pb-field textarea{min-height:72px;resize:vertical}.pb-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.pb-toast{position:fixed;right:16px;bottom:18px;background:#0b1020;color:#fff;padding:11px 14px;border-radius:12px;z-index:10000;font-weight:800;box-shadow:0 14px 36px rgba(0,0,0,.2)}
  @media(max-width:640px){.pb-form-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function toast(msg){
  const el=document.createElement('div'); el.className='pb-toast'; el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.remove(),2400);
}

function ensureModal(){
  if(document.getElementById('pbModal')) return;
  const wrap=document.createElement('div'); wrap.id='pbModal'; wrap.className='pb-modal hidden';
  wrap.innerHTML=`<div class="pb-modal-card"><h3>Add a PB</h3><div style="color:#667085">Record a personal best manually.</div>
    <div class="pb-form-grid"><div class="pb-field"><label>Exercise / event</label><input id="pbExercise" placeholder="e.g. Deadlift or 5K"></div><div class="pb-field"><label>PB type</label><select id="pbMetric"><option value="weight">Weight</option><option value="reps">Reps</option><option value="time">Time</option><option value="distance">Distance</option><option value="calories">Calories</option><option value="custom">Custom</option></select></div></div>
    <div class="pb-form-grid"><div class="pb-field"><label>Value</label><input id="pbValue" type="number" step="any" placeholder="0"></div><div class="pb-field"><label>Unit</label><input id="pbUnit" placeholder="kg"></div></div>
    <div class="pb-form-grid"><div class="pb-field"><label>Better result</label><select id="pbDirection"><option value="higher">Higher is better</option><option value="lower">Lower is better</option></select></div><div class="pb-field"><label>Date</label><input id="pbDate" type="date"></div></div>
    <div class="pb-field"><label>Notes</label><textarea id="pbNotes" placeholder="Optional"></textarea></div>
    <div class="pb-actions"><button class="btn secondary" id="pbCancel">Cancel</button><button class="btn dark" id="pbSave">Save PB</button></div></div>`;
  document.body.appendChild(wrap);
  const metric=wrap.querySelector('#pbMetric'), unit=wrap.querySelector('#pbUnit');
  metric.addEventListener('change',()=>{ if(metric.value!=='custom') unit.value=unitFor(metric.value); });
  wrap.querySelector('#pbCancel').onclick=()=>wrap.classList.add('hidden');
  wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.classList.add('hidden')});
  wrap.querySelector('#pbSave').onclick=saveManualPB;
}

function openPBModal(){
  ensureModal(); const m=document.getElementById('pbModal');
  m.querySelector('#pbExercise').value=''; m.querySelector('#pbMetric').value='weight'; m.querySelector('#pbValue').value=''; m.querySelector('#pbUnit').value='kg'; m.querySelector('#pbDirection').value='higher'; m.querySelector('#pbDate').value=new Date().toISOString().slice(0,10); m.querySelector('#pbNotes').value=''; m.classList.remove('hidden');
}

function getPBGrid(){ return document.querySelector('.pb-grid') || document.getElementById('pbGrid'); }

function cardHTML(pb){
  const date=pb.achieved_at ? new Date(pb.achieved_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '';
  return `<div class="pb-card" data-key="${esc(pb.exercise_key || normalise(pb.exercise_name))}" data-metric="${esc(pb.metric_type)}"><div class="pb-icon">${iconFor(pb.metric_type)}</div><div class="eyebrow" style="margin-top:8px">${esc(pb.metric_type)}</div><h3 style="margin:5px 0 0">${esc(pb.exercise_name)}</h3><div class="pb-value">${esc(pb.value_numeric)}${pb.unit?' <span style="font-size:14px;color:#667085">'+esc(pb.unit)+'</span>':''}</div><div class="muted" style="margin-top:6px">${date}${pb.notes?' · '+esc(pb.notes):''}</div></div>`;
}

function renderPreviewPBs(){
  const grid=getPBGrid(); if(!grid) return;
  grid.innerHTML=previewPBs.length ? previewPBs.map(cardHTML).join('') : '<div class="empty">No PBs yet.</div>';
  localStorage.setItem('hybridOS_previewPBs',JSON.stringify(previewPBs));
}

async function loadRealPBs(){
  if(!supabase||!authUser) return;
  const {data}=await supabase.from('personal_bests').select('*').eq('user_id',authUser.id).order('achieved_at',{ascending:false});
  const grid=getPBGrid(); if(grid && data) grid.innerHTML=data.length?data.map(cardHTML).join(''):'<div class="empty">No PBs yet. Add one or save a workout to create your first PB.</div>';
}

async function upsertPB(pb){
  if(isPreview){
    const key=pb.exercise_key+'|'+pb.metric_type; const idx=previewPBs.findIndex(x=>(x.exercise_key+'|'+x.metric_type)===key);
    const old=idx>=0?previewPBs[idx]:null; const better=!old || (pb.comparison_direction==='lower'?Number(pb.value_numeric)<Number(old.value_numeric):Number(pb.value_numeric)>Number(old.value_numeric));
    if(!better) return false; if(idx>=0) previewPBs[idx]=pb; else previewPBs.unshift(pb); renderPreviewPBs(); return true;
  }
  if(!authUser||!gymId) return false;
  const {data:existing}=await supabase.from('personal_bests').select('id,value_numeric,comparison_direction').eq('user_id',authUser.id).eq('gym_id',gymId).eq('exercise_key',pb.exercise_key).eq('metric_type',pb.metric_type).maybeSingle();
  const better=!existing || (pb.comparison_direction==='lower'?Number(pb.value_numeric)<Number(existing.value_numeric):Number(pb.value_numeric)>Number(existing.value_numeric));
  if(!better) return false;
  const payload={...pb,gym_id:gymId,user_id:authUser.id};
  let error;
  if(existing?.id) ({error}=await supabase.from('personal_bests').update(payload).eq('id',existing.id));
  else ({error}=await supabase.from('personal_bests').insert(payload));
  if(error){console.error(error);return false} await loadRealPBs(); return true;
}

async function saveManualPB(){
  const m=document.getElementById('pbModal'), exercise=m.querySelector('#pbExercise').value.trim(), value=Number(m.querySelector('#pbValue').value);
  if(!exercise||!Number.isFinite(value)){toast('Add an exercise and value');return}
  const metric=m.querySelector('#pbMetric').value, unit=m.querySelector('#pbUnit').value.trim()||unitFor(metric), direction=m.querySelector('#pbDirection').value;
  const pb={exercise_name:exercise,exercise_key:normalise(exercise),metric_type:metric,comparison_direction:direction,value_numeric:value,unit,achieved_at:new Date((m.querySelector('#pbDate').value||new Date().toISOString().slice(0,10))+'T12:00:00').toISOString(),notes:m.querySelector('#pbNotes').value.trim()||null,workout_set_id:null};
  const saved=await upsertPB(pb); m.classList.add('hidden'); toast(saved?'PB saved 🏆':'That did not beat your current PB');
}

function readNumber(input){const n=Number(input?.value);return Number.isFinite(n)?n:null}

async function capturePBsFromWorkout(){
  const cards=[...document.querySelectorAll('.exercise-card')]; if(!cards.length) return;
  let improved=0;
  for(const card of cards){
    const name=card.querySelector('.exerciseName')?.value?.trim(); if(!name) continue;
    const type=card.querySelector('.trackingType')?.value||'strength'; const rows=[...card.querySelectorAll('.set-row')];
    const key=normalise(name); const date=(document.getElementById('workoutDate')?.value||new Date().toISOString().slice(0,10))+'T12:00:00';
    const candidates=[];
    if(type==='strength'){
      const weights=rows.map(r=>readNumber(r.querySelector('.metricB input'))).filter(v=>v!=null); const reps=rows.map(r=>readNumber(r.querySelector('.metricA input'))).filter(v=>v!=null);
      if(weights.length)candidates.push({metric_type:'weight',value_numeric:Math.max(...weights),unit:'kg'});
      if(reps.length)candidates.push({metric_type:'reps',value_numeric:Math.max(...reps),unit:'reps'});
    } else if(type==='time'){
      const vals=rows.map(r=>readNumber(r.querySelector('.metricA input'))).filter(v=>v!=null); if(vals.length)candidates.push({metric_type:'time',value_numeric:Math.max(...vals),unit:'sec'});
    } else if(type==='distance'){
      const vals=rows.map(r=>readNumber(r.querySelector('.metricA input'))).filter(v=>v!=null); if(vals.length)candidates.push({metric_type:'distance',value_numeric:Math.max(...vals),unit:'m'});
    } else if(type==='calories'){
      const vals=rows.map(r=>readNumber(r.querySelector('.metricA input'))).filter(v=>v!=null); if(vals.length)candidates.push({metric_type:'calories',value_numeric:Math.max(...vals),unit:'kcal'});
    } else if(type==='custom'){
      const vals=rows.map(r=>readNumber(r.querySelector('.metricA input'))).filter(v=>v!=null); const unit=card.querySelector('.metricB input')?.value?.trim()||'units'; if(vals.length)candidates.push({metric_type:'custom',value_numeric:Math.max(...vals),unit});
    }
    for(const c of candidates){
      const did=await upsertPB({exercise_name:name,exercise_key:key,metric_type:c.metric_type,comparison_direction:'higher',value_numeric:c.value_numeric,unit:c.unit,achieved_at:new Date(date).toISOString(),notes:'From workout',workout_set_id:null}); if(did) improved++;
    }
  }
  if(improved) toast(`${improved} new PB${improved===1?'':'s'} from this workout 🏆`);
}

async function init(){
  injectStyles(); ensureModal();
  const addBtn=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='+ Add PB'); if(addBtn) addBtn.onclick=openPBModal;
  if(isPreview){
    try{previewPBs=JSON.parse(localStorage.getItem('hybridOS_previewPBs')||'[]')}catch{}
    if(!previewPBs.length){
      previewPBs=[
        {exercise_name:'Deadlift',exercise_key:'deadlift',metric_type:'weight',comparison_direction:'higher',value_numeric:145,unit:'kg',achieved_at:'2026-09-12T12:00:00Z',notes:null},
        {exercise_name:'Pull-ups',exercise_key:'pull-ups',metric_type:'reps',comparison_direction:'higher',value_numeric:14,unit:'reps',achieved_at:'2026-09-10T12:00:00Z',notes:null},
        {exercise_name:'5K',exercise_key:'5k',metric_type:'time',comparison_direction:'lower',value_numeric:1458,unit:'sec',achieved_at:'2026-09-05T12:00:00Z',notes:'24:18'}
      ];
    }
    renderPreviewPBs();
  } else {
    const {data:{session}}=await supabase.auth.getSession(); authUser=session?.user||null;
    if(authUser){const {data}=await supabase.from('gym_members').select('gym_id').eq('user_id',authUser.id).eq('is_active',true).limit(1); gymId=data?.[0]?.gym_id||null; await loadRealPBs();}
  }
  const save=document.getElementById('saveWorkout'); if(save) save.addEventListener('click',()=>setTimeout(capturePBsFromWorkout,350));
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
