/* Manual workout logger (member portal). Opened by member.html via window.HybridWorkoutLogger.open().
   Runs / timed efforts use minutes + seconds; the first time an exercise is logged it registers a PB. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TYPES=[['strength','Reps & weight'],['cardio','Distance & time'],['time','Time'],['calories','Calories'],['custom','Custom']];
const CARDIO=/\b(run|running|jog|row|rowing|ski|skierg|bike|biking|cycle|cycling|swim|swimming|walk|walking|hike|sprint|erg|assault|treadmill|mile|5k|10k|parkrun|half marathon|marathon)\b/i;
const HOLD=/\b(plank|hold|hang|wall sit|l-sit|farmer|carry|dead hang|bridge)\b/i;
const TIMEONLY=/\b(hold|plank|hang|wall sit|l-sit|amrap|emom|rest|stretch|yoga)\b/i;
const HIGHER_TIME=HOLD;
const KEYSTYLE=s=>String(s||'').trim().toLowerCase();
let ctx=null,built=false,cardSeq=0;

function css(){
  if($('wlStyles'))return;
  const s=document.createElement('style');s.id='wlStyles';
  s.textContent=`
#workoutModal.wl-modal{padding:16px}
#workoutModal .wl-sheet{display:flex;flex-direction:column;max-width:640px;width:100%;max-height:92dvh;padding:0;overflow:hidden}
.wl-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 18px 10px}
.wl-top h3{margin:0;font-size:20px}
.wl-body{overflow-y:auto;padding:0 18px 12px;flex:1;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.wl-foot{padding:12px 18px calc(12px + env(safe-area-inset-bottom));border-top:1px solid #e7ebf2;background:#fff;display:flex;gap:10px;align-items:center}
.wl-foot .btn{flex:1}.wl-foot .msg{margin:0}
.wl-meta{display:grid;grid-template-columns:1fr 150px;gap:10px;margin-bottom:8px}
.wl-meta input,.wl-card input,.wl-card select,.wl-notes textarea{font-size:16px}
.wl-notes{margin:0 0 12px}.wl-notes summary{cursor:pointer;color:#667085;font-size:14px;padding:4px 0}
.wl-card{border:1px solid #e7ebf2;border-radius:16px;padding:12px;margin:10px 0;background:#fbfcfe}
.wl-head{display:flex;gap:8px;align-items:center}
.wl-namewrap{flex:1;min-width:0}.wl-namewrap .hybrid-activity-hint{display:none}.wl-namewrap .hybrid-activity-menu{max-height:220px}.wl-head .exerciseName{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #d0d5dd;border-radius:10px;min-height:44px;font-weight:600;background:#fff}
.wl-x{border:0;background:#f2f4f7;border-radius:10px;width:40px;height:40px;font-size:20px;color:#667085;cursor:pointer;flex:none}
.wl-types{display:flex;gap:6px;overflow-x:auto;padding:10px 0 4px;scrollbar-width:none}
.wl-types::-webkit-scrollbar{display:none}
.wl-chip{border:1px solid #d0d5dd;background:#fff;border-radius:999px;padding:7px 12px;font-size:13px;white-space:nowrap;cursor:pointer;color:#344054;flex:none}
.wl-chip[aria-pressed=true]{background:#0b1020;border-color:#0b1020;color:#fff}
.wl-set{display:grid;grid-template-columns:26px 1fr 40px;gap:8px;align-items:center;margin-top:8px}
.wl-n{font-weight:700;color:#98a2b3;text-align:center;font-size:14px}
.wl-fields{display:flex;gap:8px;flex-wrap:wrap}
.wl-f{flex:1 1 84px;min-width:0;display:flex;flex-direction:column}
.wl-f small{font-size:11px;color:#667085;margin:0 0 2px 2px}
.wl-f input,.wl-f select{width:100%;box-sizing:border-box;padding:10px;border:1px solid #d0d5dd;border-radius:10px;background:#fff;min-height:44px}
.wl-wide{flex:1 1 140px}.wl-time{display:flex;gap:6px;align-items:center}.wl-time span{color:#667085;font-size:13px}
.wl-dist{display:flex;gap:6px}.wl-dist select{flex:0 0 66px;padding:10px 4px}
.wl-pace{flex:1 1 100%;font-size:12px;color:#667085;margin:-2px 0 0 2px;min-height:0}
.wl-addset{margin-top:10px;border:1px dashed #98a2b3;background:transparent;border-radius:10px;padding:10px;width:100%;cursor:pointer;color:#344054;font-size:14px}
.wl-label{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#7a8494;margin:14px 0 2px}.wl-cardact{display:flex;gap:10px;margin-top:12px}.wl-cardact .btn{flex:1;padding:13px}.wl-cardact .wl-clear{flex:0 0 90px}.wl-done{display:flex;align-items:center;gap:10px;border:1px solid #abefc6;background:#f6fef9;border-radius:14px;padding:10px 12px;margin:8px 0}.wl-done b{color:#067647}.wl-done .t{flex:1;min-width:0}.wl-done .t strong{display:block;font-size:15px}.wl-done .t span{font-size:13px;color:#667085}.wl-link{border:0;background:none;color:#344054;text-decoration:underline;font-size:13px;cursor:pointer;padding:6px}
.wl-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:#0b1020;color:#fff;padding:12px 16px;border-radius:14px;z-index:10050;max-width:90vw;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);line-height:1.4}
@media(max-width:640px){
#workoutModal.wl-modal{padding:0;align-items:end}
#workoutModal .wl-sheet{max-width:none;max-height:100dvh;height:100dvh;border-radius:0}
.wl-meta{grid-template-columns:1fr}
}`;
  document.head.appendChild(s);
}

function shell(){
  const m=$('workoutModal');if(!m)return null;
  if(built)return m;
  m.classList.add('wl-modal');
  m.innerHTML=`<div class="modal-card wl-sheet" role="dialog" aria-modal="true" aria-label="Log workout">
<div class="wl-top"><h3>Log workout</h3><button id="closeWorkout" class="btn secondary" type="button">Done</button></div>
<div class="wl-body">
<div class="wl-meta"><div class="field"><label>Workout name</label><input id="workoutTitle" placeholder="e.g. Upper body, Easy run" autocomplete="off"></div><div class="field"><label>Date</label><input id="workoutDate" type="date"></div></div>
<details class="wl-notes"><summary>+ Add notes</summary><div class="field"><textarea id="workoutNotes" placeholder="How did it feel?" rows="2"></textarea></div></details>
<div id="wlLogged"></div>
<div class="wl-label" id="wlLabel">Add an exercise</div>
<div id="exerciseBuilder"></div>
</div>
<div class="wl-foot"><div id="workoutMsg" class="msg" role="status"></div><button id="saveWorkout" class="btn primary" type="button">Finish workout</button></div>
</div>`;
  $('closeWorkout').onclick=finish;
  $('saveWorkout').onclick=finish;
  m.addEventListener('mousedown',e=>{if(e.target===m)finish()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!m.classList.contains('hidden'))finish()});
  built=true;return m;
}

function guessType(name){const n=String(name||'');if(HOLD.test(n)&&!CARDIO.test(n))return 'time';if(CARDIO.test(n))return 'cardio';return 'strength'}

function field(label,inner,cls){return `<label class="wl-f ${cls||''}"><small>${label}</small>${inner}</label>`}
function setHTML(type,n){
  let f='';
  if(type==='strength')f=field('Reps',`<input class="v-reps" inputmode="numeric" placeholder="0" autocomplete="off">`)+field('Weight (kg)',`<input class="v-kg" inputmode="decimal" placeholder="0" autocomplete="off">`);
  else if(type==='cardio')f=field('Distance',`<div class="wl-dist"><input class="v-dist" inputmode="decimal" placeholder="0" autocomplete="off"><select class="v-unit" aria-label="Distance unit"><option value="km">km</option><option value="m">m</option><option value="mi">mi</option></select></div>`,'wl-wide')
    +field('Time (min : sec)',`<div class="wl-time"><input class="v-min" inputmode="numeric" placeholder="min" aria-label="Minutes" autocomplete="off"><span>:</span><input class="v-sec" inputmode="numeric" placeholder="sec" aria-label="Seconds" autocomplete="off"></div>`,'wl-wide')+`<div class="wl-pace"></div>`;
  else if(type==='time')f=field('Time (min : sec)',`<div class="wl-time"><input class="v-min" inputmode="numeric" placeholder="min" aria-label="Minutes" autocomplete="off"><span>:</span><input class="v-sec" inputmode="numeric" placeholder="sec" aria-label="Seconds" autocomplete="off"></div>`);
  else if(type==='calories')f=field('Calories (kcal)',`<input class="v-cal" inputmode="decimal" placeholder="0" autocomplete="off">`);
  else f=field('Value',`<input class="v-cv" inputmode="decimal" placeholder="0" autocomplete="off">`)+field('Unit',`<input class="v-cu" placeholder="e.g. laps" autocomplete="off">`);
  return `<div class="wl-n">${n}</div><div class="wl-fields">${f}</div><button class="wl-x remove-set" type="button" aria-label="Remove set">×</button>`;
}
function renumber(card){[...card.querySelectorAll('.wl-set')].forEach((r,i)=>r.querySelector('.wl-n').textContent=i+1)}
function addSet(card,copyFrom){
  const type=card.dataset.type,wrap=card.querySelector('.wl-sets'),row=document.createElement('div');
  row.className='wl-set';row.innerHTML=setHTML(type,wrap.children.length+1);
  if(copyFrom){row.querySelectorAll('input,select').forEach(el=>{const k=[...el.classList].find(c=>c.startsWith('v-'));const s=k&&copyFrom.querySelector('.'+k);if(s)el.value=s.value})}
  row.querySelector('.remove-set').onclick=()=>{if(wrap.children.length>1){row.remove();renumber(card)}else row.querySelectorAll('input').forEach(i=>i.value='')};
  wrap.appendChild(row);updatePace(row);return row;
}
function setType(card,type,manual){
  if(manual)card.dataset.manual='1';
  card.dataset.type=type;
  card.querySelectorAll('.wl-chip').forEach(c=>c.setAttribute('aria-pressed',String(c.dataset.t===type)));
  card.querySelector('.wl-sets').innerHTML='';addSet(card);
}
function hasValues(card){return [...card.querySelectorAll('.wl-sets input')].some(i=>i.value.trim()!=='')}
function addExercise(){
  const card=document.createElement('div');card.className='wl-card';card.dataset.type='strength';card.dataset.id=String(++cardSeq);
  card.innerHTML=`<div class="wl-head"><div class="wl-namewrap"><input class="exerciseName" placeholder="Search exercise or activity" autocomplete="off" aria-label="Exercise"></div></div>
<div class="wl-types">${TYPES.map(t=>`<button type="button" class="wl-chip" data-t="${t[0]}" aria-pressed="${t[0]==='strength'}">${t[1]}</button>`).join('')}</div>
<div class="wl-sets"></div><button class="wl-addset" type="button">+ Add set</button><div class="wl-cardact"><button class="btn secondary wl-clear" type="button">Clear</button><button class="btn primary wl-saveex" type="button">Save exercise</button></div>`;
  const name=card.querySelector('.exerciseName');
  const detect=()=>{if(card.dataset.manual||hasValues(card))return;const g=guessType(name.value);if(g!==card.dataset.type)setType(card,g,false)};
  name.addEventListener('change',detect);name.addEventListener('blur',()=>setTimeout(detect,200));
  card.querySelector('.wl-types').addEventListener('click',e=>{const b=e.target.closest('.wl-chip');if(b&&b.dataset.t!==card.dataset.type)setType(card,b.dataset.t,true)});
  card.querySelector('.wl-addset').onclick=()=>{const rows=card.querySelectorAll('.wl-set');const r=addSet(card,rows[rows.length-1]);const f=r.querySelector('input');f&&f.focus()};
  card.querySelector('.wl-clear').onclick=()=>{card.querySelector('.exerciseName').value='';delete card.dataset.manual;setType(card,'strength',false);setMsg('')};
  card.querySelector('.wl-saveex').onclick=saveExercise;
  card.addEventListener('input',e=>{const r=e.target.closest('.wl-set');if(r&&card.dataset.type==='cardio')updatePace(r)});
  card.addEventListener('change',e=>{const r=e.target.closest('.wl-set');if(r&&card.dataset.type==='cardio')updatePace(r)});
  $('exerciseBuilder').appendChild(card);addSet(card);return card;
}

const num=v=>{const n=parseFloat(String(v).replace(',','.'));return Number.isFinite(n)&&n>=0?n:null};
function seconds(row){const m=num(row.querySelector('.v-min')?.value),s=num(row.querySelector('.v-sec')?.value);if(m==null&&s==null)return null;return Math.round((m||0)*60+(s||0))}
function metres(row){const d=num(row.querySelector('.v-dist')?.value);if(d==null)return null;const u=row.querySelector('.v-unit')?.value;return Math.round((u==='km'?d*1000:u==='mi'?d*1609.344:d)*10)/10}
function fmtTime(t){t=Math.round(t);const h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=t%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`}
function fmtDist(m){return m>=1000?`${Math.round(m/10)/100} km`:`${Math.round(m*10)/10} m`}
function updatePace(row){const el=row.querySelector('.wl-pace');if(!el)return;const d=metres(row),t=seconds(row);el.textContent=d&&t?`Pace ${fmtTime(t/(d/1000))} /km`:''}

function collect(){
  const out=[];
  for(const card of document.querySelectorAll('#exerciseBuilder .wl-card')){
    const name=card.querySelector('.exerciseName').value.trim(),type=card.dataset.type,sets=[];
    for(const r of card.querySelectorAll('.wl-set')){
      let s=null;
      if(type==='strength'){const reps=num(r.querySelector('.v-reps').value),kg=num(r.querySelector('.v-kg').value);if(reps!=null||kg!=null)s={reps:reps==null?null:Math.round(reps),weight_kg:kg}}
      else if(type==='cardio'){const d=metres(r),t=seconds(r);if(d!=null||t!=null)s={distance_m:d,duration_seconds:t}}
      else if(type==='time'){const t=seconds(r);if(t!=null)s={duration_seconds:t}}
      else if(type==='calories'){const c=num(r.querySelector('.v-cal').value);if(c!=null)s={calories:c}}
      else{const v=num(r.querySelector('.v-cv').value),u=r.querySelector('.v-cu').value.trim();if(v!=null)s={custom_value:v,custom_unit:u||null}}
      if(s)sets.push(s);
    }
    if(name||sets.length)out.push({name,type,sets});
  }
  return out;
}

/* PB candidates for one exercise. First ever log creates the PB; later logs only replace it when better. */
function candidates(ex){
  const c=[],{name,type,sets}=ex;
  if(type==='strength'){
    const w=sets.map(s=>s.weight_kg).filter(v=>v>0),r=sets.map(s=>s.reps).filter(v=>v>0);
    if(w.length)c.push({name,metric:'weight',dir:'higher',value:Math.max(...w),unit:'kg'});
    else if(r.length)c.push({name,metric:'reps',dir:'higher',value:Math.max(...r),unit:'reps'});
  }else if(type==='cardio'){
    const d=sets.map(s=>s.distance_m).filter(v=>v>0);
    if(d.length)c.push({name,metric:'distance',dir:'higher',value:Math.max(...d),unit:'m'});
    const best={};
    for(const s of sets)if(s.distance_m>0&&s.duration_seconds>0){const k=Math.round(s.distance_m);if(!best[k]||s.duration_seconds<best[k])best[k]=s.duration_seconds}
    for(const k of Object.keys(best))c.push({name:`${name} · ${fmtDist(Number(k))}`,metric:'time',dir:'lower',value:best[k],unit:'sec'});
  }else if(type==='time'){
    const t=sets.map(s=>s.duration_seconds).filter(v=>v>0);
    if(t.length){const hi=HIGHER_TIME.test(name);c.push({name,metric:'time',dir:hi?'higher':'lower',value:hi?Math.max(...t):Math.min(...t),unit:'sec'})}
  }else if(type==='calories'){
    const v=sets.map(s=>s.calories).filter(x=>x>0);if(v.length)c.push({name,metric:'calories',dir:'higher',value:Math.max(...v),unit:'kcal'});
  }else{
    const v=sets.map(s=>s.custom_value).filter(x=>x>0);if(v.length)c.push({name,metric:'custom',dir:'higher',value:Math.max(...v),unit:sets.find(s=>s.custom_unit)?.custom_unit||''});
  }
  return c;
}
function legacySeconds(row){const u=String(row.unit||'').toLowerCase();let v=Number(row.value_numeric);if(row.metric_type==='time'&&/^min/.test(u))v*=60;return v}

async function registerPBs(exercises,performed,gym,uid){
  const sb=ctx.supabase,list=[];
  for(const ex of exercises)for(const c of candidates(ex))list.push({...c,key:KEYSTYLE(c.name)});
  if(!list.length)return [];
  const keys=[...new Set(list.map(c=>c.key))];
  const q=await sb.from('personal_bests').select('id,exercise_key,metric_type,comparison_direction,value_numeric,unit').eq('gym_id',gym).eq('user_id',uid).in('exercise_key',keys);
  const have={};for(const r of q.data||[])have[r.exercise_key+'|'+r.metric_type]=r;
  const won=[];
  for(const c of list){
    const old=have[c.key+'|'+c.metric];
    const oldV=old?(c.metric==='time'?legacySeconds(old):Number(old.value_numeric)):null;
    const better=!old||(c.dir==='lower'?c.value<oldV:c.value>oldV);
    if(!better)continue;
    const row={gym_id:gym,user_id:uid,exercise_name:c.name,metric_type:c.metric,comparison_direction:c.dir,value_numeric:c.value,unit:c.unit,achieved_at:performed,notes:c.metric==='time'?fmtTime(c.value):null};
    const r=await sb.from('personal_bests').upsert(row,{onConflict:'gym_id,user_id,exercise_key,metric_type'});
    if(r.error)throw r.error;
    won.push({...c,first:!old});
  }
  return won;
}
function pbText(w){return w.metric==='time'?`${w.name} ${fmtTime(w.value)}`:w.metric==='distance'?`${w.name} ${fmtDist(w.value)}`:`${w.name} ${w.value} ${w.unit}`}
function toast(html){const t=document.createElement('div');t.className='wl-toast';t.innerHTML=html;document.body.appendChild(t);setTimeout(()=>t.remove(),5200)}

function setMsg(text,bad){const el=$('workoutMsg');el.textContent=text||'';el.className='msg'+(bad?' bad':'')}
const S={sessionId:null,entries:[],busy:false};
function activeCard(){return $('exerciseBuilder').querySelector('.wl-card')}
function freshCard(){$('exerciseBuilder').innerHTML='';cardSeq=0;return addExercise()}
function setSummary(e){
  const sets=e.sets,n=sets.length,t=e.type,mx=k=>Math.max(...sets.map(x=>Number(x[k])||0));
  if(t==='strength'){const w=mx('weight_kg'),r=sets.map(x=>x.reps).filter(v=>v!=null);return `${n} set${n>1?'s':''} · ${r.length?r.join('/')+' reps':''}${w?` @ ${w} kg`:''}`}
  if(t==='cardio'){const d=sets.reduce((a,x)=>a+(x.distance_m||0),0),tm=sets.reduce((a,x)=>a+(x.duration_seconds||0),0);return [d?fmtDist(d):'',tm?fmtTime(tm):''].filter(Boolean).join(' in ')}
  if(t==='time')return fmtTime(sets.reduce((a,x)=>a+(x.duration_seconds||0),0));
  if(t==='calories')return `${mx('calories')} kcal`;
  return `${mx('custom_value')} ${sets[0].custom_unit||''}`.trim();
}
function renderLogged(){
  const box=$('wlLogged');
  box.innerHTML=S.entries.map((e,i)=>`<div class="wl-done"><b>✓</b><div class="t"><strong>${esc(e.name)}</strong><span>${esc(setSummary(e))}</span></div><button class="wl-link" data-edit="${i}" type="button">Edit</button><button class="wl-link" data-del="${i}" type="button">Remove</button></div>`).join('');
  box.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editEntry(Number(b.dataset.edit)));
  box.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>removeEntry(Number(b.dataset.del)));
  $('wlLabel').textContent=S.entries.length?'Add another exercise':'Add an exercise';
  $('saveWorkout').textContent=S.entries.length?`Finish workout (${S.entries.length})`:'Finish workout';
}
async function ensureSession(){
  if(S.sessionId)return;
  const sb=ctx.supabase,gym=ctx.gym(),uid=ctx.session().user.id,first=activeCard().querySelector('.exerciseName').value.trim();
  const performed=new Date(($('workoutDate').value||new Date().toISOString().slice(0,10))+'T12:00:00').toISOString();
  const r=await sb.from('workout_sessions').insert({gym_id:gym.id,user_id:uid,title:$('workoutTitle').value.trim()||first||'Workout',performed_at:performed,notes:$('workoutNotes').value.trim()||null}).select('id').single();
  if(r.error)throw r.error;S.sessionId=r.data.id;S.performed=performed;
}
async function saveExercise(){
  if(S.busy)return;ctx=ctx||window.HybridWorkoutLoggerCtx;
  const card=activeCard(),ex=collect()[0];
  if(!ex||(!ex.name&&!ex.sets.length)){setMsg('Add an exercise first.',true);return false}
  if(!ex.name){setMsg('Give the exercise a name.',true);return false}
  if(!ex.sets.length){setMsg(`Add some numbers for ${ex.name}.`,true);return false}
  S.busy=true;const btn=card.querySelector('.wl-saveex');btn.disabled=true;btn.textContent='Saving…';setMsg('');
  try{
    const sb=ctx.supabase,gym=ctx.gym(),uid=ctx.session().user.id;
    await ensureSession();
    const e=await sb.from('workout_entries').insert({session_id:S.sessionId,gym_id:gym.id,user_id:uid,exercise_name:ex.name,tracking_type:ex.type==='cardio'?'distance':ex.type,position:S.entries.length}).select('id').single();
    if(e.error)throw e.error;
    const ins=await sb.from('workout_sets').insert(ex.sets.map((st,j)=>({entry_id:e.data.id,set_number:j+1,...st})));
    if(ins.error){await sb.from('workout_entries').delete().eq('id',e.data.id);throw ins.error}
    S.entries.push({id:e.data.id,...ex});
    let won=[];try{won=await registerPBs([ex],S.performed,gym.id,uid)}catch(err){console.warn('PB check failed',err);toast('Exercise saved, but the personal best could not be saved: '+esc(err.message||'unknown error'))}
    renderLogged();const c=freshCard();
    if(won.length)toast(`🏆 ${won.every(w=>w.first)?(won.length>1?'First PBs logged':'First PB logged'):(won.length>1?'New PBs':'New PB')}: ${won.slice(0,3).map(pbText).map(esc).join(', ')}${won.length>3?` +${won.length-3} more`:''}`);
    const body=$('workoutModal').querySelector('.wl-body');if(body)body.scrollTop=body.scrollHeight;
    return true;
  }catch(err){setMsg(err.message||'Could not save exercise',true);return false}
  finally{S.busy=false;const b=card.querySelector('.wl-saveex');if(b){b.disabled=false;b.textContent='Save exercise'}}
}
async function dropEntry(i){
  const sb=ctx.supabase,e=S.entries[i];
  const a=await sb.from('workout_sets').delete().eq('entry_id',e.id);if(a.error)throw a.error;
  const b=await sb.from('workout_entries').delete().eq('id',e.id);if(b.error)throw b.error;
  S.entries.splice(i,1);
  // keep positions tidy
  for(let k=i;k<S.entries.length;k++)await sb.from('workout_entries').update({position:k}).eq('id',S.entries[k].id);
}
async function removeEntry(i){
  if(S.busy)return;S.busy=true;
  try{await dropEntry(i);renderLogged();setMsg('')}catch(err){setMsg(err.message||'Could not remove',true)}finally{S.busy=false}
}
function fillCard(card,e){
  card.querySelector('.exerciseName').value=e.name;setType(card,e.type,true);card.querySelector('.wl-sets').innerHTML='';
  e.sets.forEach(st=>{
    const r=addSet(card),set=(k,v)=>{const el=r.querySelector('.'+k);if(el&&v!=null)el.value=v};
    if(e.type==='strength'){set('v-reps',st.reps);set('v-kg',st.weight_kg)}
    else if(e.type==='cardio'||e.type==='time'){
      if(st.distance_m!=null){if(st.distance_m>=1000&&st.distance_m%100===0){set('v-dist',st.distance_m/1000);set('v-unit','km')}else{set('v-dist',st.distance_m);set('v-unit','m')}}
      if(st.duration_seconds!=null){set('v-min',Math.floor(st.duration_seconds/60));set('v-sec',st.duration_seconds%60)}
      updatePace(r)}
    else if(e.type==='calories')set('v-cal',st.calories);
    else{set('v-cv',st.custom_value);set('v-cu',st.custom_unit)}
  });
}
async function editEntry(i){
  if(S.busy)return;
  if(hasValues(activeCard())){setMsg('Save or clear the exercise you are adding first.',true);return}
  S.busy=true;
  try{const e=S.entries[i];await dropEntry(i);renderLogged();fillCard(activeCard(),e);setMsg('Editing — save the exercise again when done.')}
  catch(err){setMsg(err.message||'Could not edit',true)}finally{S.busy=false}
}
function close(){$('workoutModal').classList.add('hidden');document.documentElement.style.overflow=''}
function open(){
  if(!ctx)ctx=window.HybridWorkoutLoggerCtx;
  css();const m=shell();if(!m)return;
  S.sessionId=null;S.entries=[];S.busy=false;
  $('workoutTitle').value='';$('workoutNotes').value='';$('workoutDate').value=new Date().toISOString().slice(0,10);
  freshCard();renderLogged();setMsg('');
  m.querySelector('.wl-notes').open=false;
  m.classList.remove('hidden');document.documentElement.style.overflow='hidden';
  const sheetBody=m.querySelector('.wl-body');if(sheetBody)sheetBody.scrollTop=0;
}
async function finish(){
  if(S.busy)return;ctx=ctx||window.HybridWorkoutLoggerCtx;
  const card=activeCard();
  if(card&&(card.querySelector('.exerciseName').value.trim()||hasValues(card))){
    const ok=await saveExercise();if(!ok)return;
  }
  if(!S.sessionId||!S.entries.length){
    if(S.sessionId){try{await ctx.supabase.from('workout_sessions').delete().eq('id',S.sessionId)}catch(_){}S.sessionId=null}
    close();return;
  }
  const btn=$('saveWorkout');btn.disabled=true;
  try{
    const gym=ctx.gym(),uid=ctx.session().user.id;
    const performed=new Date(($('workoutDate').value||new Date().toISOString().slice(0,10))+'T12:00:00').toISOString();
    const u=await ctx.supabase.from('workout_sessions').update({title:$('workoutTitle').value.trim()||S.entries[0].name||'Workout',performed_at:performed,notes:$('workoutNotes').value.trim()||null}).eq('id',S.sessionId);
    if(u.error)throw u.error;
    const detail={gymId:gym.id,userId:uid,sessionId:S.sessionId};
    close();
    try{await ctx.afterSave(detail)}catch(err){console.warn(err)}
  }catch(err){setMsg(err.message||'Could not finish workout',true)}
  finally{btn.disabled=false}
}

/* One-line summary of a logged exercise for the history list. */
function summary(entry){
  const sets=entry.workout_sets||[],t=entry.tracking_type,n=entry.exercise_name;
  if(!sets.length)return n;
  const max=k=>Math.max(...sets.map(s=>Number(s[k])||0));
  if(t==='strength'){const w=max('weight_kg'),r=max('reps');return `${n}: ${sets.length}×${w?` up to ${w} kg`:` ${r} reps`}`}
  if(t==='distance'){const d=sets.reduce((a,s)=>a+(Number(s.distance_m)||0),0),tm=sets.reduce((a,s)=>a+(Number(s.duration_seconds)||0),0);return `${n}: ${d?fmtDist(d):''}${d&&tm?' in ':''}${tm?fmtTime(tm):''}`}
  if(t==='time')return `${n}: ${fmtTime(sets.reduce((a,s)=>a+(Number(s.duration_seconds)||0),0))}`;
  if(t==='calories')return `${n}: ${max('calories')} kcal`;
  return `${n}: ${max('custom_value')} ${sets[0].custom_unit||''}`.trim();
}
function pbValue(p){
  const v=Number(p.value_numeric),u=String(p.unit||'').toLowerCase();
  if(p.metric_type==='time'&&(u===''||/^(s|sec|secs|seconds)$/.test(u)))return fmtTime(v);
  if(p.metric_type==='time'&&/^min/.test(u))return fmtTime(v*60);
  if(p.metric_type==='distance'&&u==='m')return fmtDist(v);
  return `${p.value_numeric}${p.unit?' '+p.unit:''}`;
}
window.HybridWorkoutLogger={open,close,summary,pbValue,fmtTime};
})();
