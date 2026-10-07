(()=>{'use strict';

const ACTIVITIES=[
'Ab Wheel Rollout','Air Bike','Air Squat','Arnold Press','Assault Bike','Back Extension','Back Squat','Band Pull Apart','Band Row','Barbell Bench Press','Barbell Bulgarian Split Squat','Barbell Clean','Barbell Curl','Barbell Front Raise','Barbell Glute Bridge','Barbell Good Morning','Barbell Hack Squat','Barbell Hip Thrust','Barbell Lunge','Barbell Overhead Press','Barbell Row','Barbell Shrug','Barbell Split Squat','Barbell Step Up','Barbell Thruster','Bear Crawl','Bench Dip','Bench Press','Bent Over Row','Bicep Curl','Bird Dog','Box Jump','Box Step Over','Box Step Up','Broad Jump','Bulgarian Split Squat','Burpee','Burpee Broad Jump','Burpee Box Jump Over','Butterfly Pull-Up',
'Cable Chest Fly','Cable Crossover','Cable Curl','Cable Face Pull','Cable Fly','Cable Front Raise','Cable Kickback','Cable Lateral Raise','Cable Pullover','Cable Row','Cable Tricep Extension','Calf Raise','Chest Press','Chest Supported Row','Chin-Up','Clean','Clean and Jerk','Clean Pull','Close Grip Bench Press','Concept2 BikeErg','Concept2 RowErg','Concept2 SkiErg','Cossack Squat','Crunch','Cycling',
'Dead Bug','Dead Hang','Deadlift','Decline Bench Press','Decline Push-Up','Deficit Deadlift','Diamond Push-Up','Dip','Double Under','Dumbbell Bench Press','Dumbbell Bulgarian Split Squat','Dumbbell Clean','Dumbbell Curl','Dumbbell Deadlift','Dumbbell Floor Press','Dumbbell Front Raise','Dumbbell Goblet Squat','Dumbbell Hammer Curl','Dumbbell Hip Thrust','Dumbbell Incline Bench Press','Dumbbell Lateral Raise','Dumbbell Lunge','Dumbbell Overhead Press','Dumbbell Pullover','Dumbbell Rear Delt Fly','Dumbbell Romanian Deadlift','Dumbbell Row','Dumbbell Shoulder Press','Dumbbell Shrug','Dumbbell Snatch','Dumbbell Split Squat','Dumbbell Step Up','Dumbbell Thruster','Dumbbell Tricep Extension',
'Elliptical','EZ Bar Curl','Face Pull','Farmers Carry','Farmers Walk','Floor Press','Flutter Kick','Front Squat','Front Rack Lunge','Front Raise',
'Glute Bridge','Goblet Squat','Good Morning','GHD Sit-Up','Hack Squat','Hammer Curl','Handstand Hold','Handstand Push-Up','Hang Clean','Hang Power Clean','Hang Power Snatch','Hang Snatch','Hanging Knee Raise','Hanging Leg Raise','High Pull','Hip Abduction','Hip Adduction','Hip Thrust','Hollow Hold','Hollow Rock','HYROX Burpee Broad Jump','HYROX Farmers Carry','HYROX Row','HYROX Sandbag Lunges','HYROX SkiErg','HYROX Sled Pull','HYROX Sled Push','HYROX Wall Balls',
'Incline Barbell Bench Press','Incline Dumbbell Bench Press','Incline Push-Up','Inverted Row','Jefferson Curl','Jump Rope','Jump Squat','Kettlebell Clean','Kettlebell Deadlift','Kettlebell Goblet Squat','Kettlebell Press','Kettlebell Row','Kettlebell Snatch','Kettlebell Swing','Kettlebell Turkish Get-Up','Kipping Pull-Up','Knee Raise',
'Lat Pulldown','Lateral Lunge','Lateral Raise','Leg Curl','Leg Extension','Leg Press','Leg Raise','Lunge','Machine Chest Press','Machine Row','Man Maker','Medicine Ball Clean','Medicine Ball Slam','Mountain Climber','Muscle-Up',
'Nordic Hamstring Curl','Overhead Carry','Overhead Press','Overhead Squat','Pallof Press','Pendlay Row','Pistol Squat','Plank','Power Clean','Power Snatch','Preacher Curl','Pull-Up','Push Jerk','Push Press','Push-Up',
'Rack Pull','Rear Delt Fly','Renegade Row','Reverse Crunch','Reverse Fly','Reverse Lunge','Romanian Deadlift','Rope Climb','Rope Pull','Rowing','Run 100 m','Run 200 m','Run 400 m','Run 800 m','Run 1 km','Run 1 Mile','Run 5K','Run 10K','Running',
'Sandbag Carry','Sandbag Clean','Sandbag Front Squat','Sandbag Lunge','Sandbag Over Shoulder','Sandbag Shoulder Carry','Seated Cable Row','Seated Leg Curl','Seated Row','Shoulder Press','Side Plank','Single Arm Dumbbell Row','Single Arm Kettlebell Press','Single Leg Deadlift','Single Leg Romanian Deadlift','Single Under','Sissy Squat','SkiErg','Sled Drag','Sled Pull','Sled Push','Smith Machine Bench Press','Smith Machine Squat','Snatch','Snatch Pull','Split Jerk','Split Squat','Sprint','Stair Climber','Step Up','Strict Press','Strict Pull-Up','Sumo Deadlift','Sumo Squat','Swimming',
'T Bar Row','Tempo Run','Thruster','Toes to Bar','Trap Bar Deadlift','Tricep Dip','Tricep Extension','Turkish Get-Up','Upright Row','V-Up','Walking Lunge','Wall Ball','Wall Sit','Weighted Dip','Weighted Pull-Up','Windmill','Yoke Carry',
'Yoga','Pilates','Mobility Session','Stretching','Foam Rolling','Zone 2 Bike','Zone 2 Row','Zone 2 Run','Zone 2 SkiErg'
];

const unique=[...new Set(ACTIVITIES)].sort((a,b)=>a.localeCompare(b));
const normalise=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

function rank(query,item){
  const q=normalise(query),n=normalise(item);
  if(!q)return 2;
  if(n===q)return 0;
  if(n.startsWith(q))return 1;
  const words=n.split(' ');
  if(words.some(w=>w.startsWith(q)))return 2;
  if(n.includes(q))return 3;
  return 99;
}
function matches(query){
  return unique.map(name=>({name,rank:rank(query,name)})).filter(x=>x.rank<99).sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name)).slice(0,40).map(x=>x.name);
}
function injectStyles(){
  if(document.getElementById('hybridActivityPickerStyles'))return;
  const style=document.createElement('style');style.id='hybridActivityPickerStyles';style.textContent=`
  .hybrid-activity-wrap{position:relative}
  .hybrid-activity-menu{position:absolute;z-index:10020;left:0;right:0;top:calc(100% + 5px);max-height:280px;overflow:auto;background:#fff;border:1px solid #d0d5dd;border-radius:12px;box-shadow:0 16px 36px rgba(16,24,40,.16);padding:5px}
  .hybrid-activity-menu[hidden]{display:none}
  .hybrid-activity-option{display:block;width:100%;border:0;background:#fff;color:#101828;text-align:left;padding:10px 11px;border-radius:9px;cursor:pointer;font:inherit}
  .hybrid-activity-option:hover,.hybrid-activity-option.active{background:#f2f4f7}
  .hybrid-activity-empty{padding:11px;color:#667085;font-size:13px}
  .hybrid-activity-hint{font-size:11px;color:#667085;margin-top:4px}
  `;document.head.appendChild(style);
}
function attach(input){
  if(!input||input.dataset.activityPicker==='1')return;
  input.dataset.activityPicker='1';input.setAttribute('autocomplete','off');input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
  const parent=input.parentElement;if(!parent)return;parent.classList.add('hybrid-activity-wrap');
  const menu=document.createElement('div');menu.className='hybrid-activity-menu';menu.hidden=true;menu.setAttribute('role','listbox');parent.appendChild(menu);
  const hint=document.createElement('div');hint.className='hybrid-activity-hint';hint.textContent='Start typing to search exercises and activities';parent.appendChild(hint);
  let active=-1,current=[];
  function close(){menu.hidden=true;active=-1;input.setAttribute('aria-expanded','false')}
  function choose(name){input.value=name;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));close();input.focus()}
  function render(){
    current=matches(input.value);active=-1;
    menu.innerHTML=current.length?current.map((name,i)=>'<button type="button" class="hybrid-activity-option" role="option" data-i="'+i+'">'+name.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</button>').join(''):'<div class="hybrid-activity-empty">No matches. You can still use your own activity name.</div>';
    menu.hidden=false;input.setAttribute('aria-expanded','true');
    menu.querySelectorAll('[data-i]').forEach(btn=>btn.addEventListener('mousedown',e=>{e.preventDefault();choose(current[Number(btn.dataset.i)])}));
  }
  input.addEventListener('focus',render);
  input.addEventListener('input',render);
  input.addEventListener('keydown',e=>{
    if(menu.hidden&&(e.key==='ArrowDown'||e.key==='ArrowUp'))render();
    const opts=[...menu.querySelectorAll('.hybrid-activity-option')];
    if(e.key==='ArrowDown'&&opts.length){e.preventDefault();active=Math.min(active+1,opts.length-1)}
    else if(e.key==='ArrowUp'&&opts.length){e.preventDefault();active=Math.max(active-1,0)}
    else if(e.key==='Enter'&&!menu.hidden&&active>=0&&current[active]){e.preventDefault();choose(current[active]);return}
    else if(e.key==='Escape'){close();return}
    opts.forEach((o,i)=>o.classList.toggle('active',i===active));if(active>=0)opts[active]?.scrollIntoView({block:'nearest'});
  });
  input.addEventListener('blur',()=>setTimeout(close,120));
}
function attachAll(root=document){
  root.querySelectorAll?.('#pbExercise,.exerciseName').forEach(attach);
}
injectStyles();attachAll();
const observer=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.matches?.('#pbExercise,.exerciseName'))attach(n);attachAll(n)}})));
observer.observe(document.documentElement,{childList:true,subtree:true});
window.HybridGymActivities={activities:unique,matches,attach,attachAll};
})();