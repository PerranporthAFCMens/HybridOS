
import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const sb=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
let user=null,gymId=null,groups=[],activeGroup=null;
function closeMemberMenu(){document.body.classList.remove('mobile-nav-open');$('mobileMenuBtn')?.setAttribute('aria-expanded','false')}
function initMemberMenu(){const open=$('mobileMenuBtn'),close=$('mobileMenuClose'),backdrop=$('mobileNavBackdrop');if(!open||open.dataset.ready==='1')return;open.dataset.ready='1';open.onclick=()=>{const on=!document.body.classList.contains('mobile-nav-open');document.body.classList.toggle('mobile-nav-open',on);open.setAttribute('aria-expanded',on?'true':'false')};if(close)close.onclick=closeMemberMenu;if(backdrop)backdrop.onclick=closeMemberMenu;document.querySelectorAll('.side a,.side button').forEach(el=>{if(el!==close)el.addEventListener('click',()=>setTimeout(closeMemberMenu,0))});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMemberMenu()})}
const fmt=d=>d?new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'';
function inviteUrl(code){return location.origin+location.pathname.replace(/groups\.html$/,'group-join.html')+'?code='+encodeURIComponent(code)}
function metricUnit(c){return c.unit||({weight:'kg',reps:'reps',time:'sec',distance:'m',calories:'kcal'}[c.metric_type]||'')}
async function copy(text,btn){try{await navigator.clipboard.writeText(text);const o=btn.textContent;btn.textContent='Copied';setTimeout(()=>btn.textContent=o,1200)}catch{prompt('Copy this link',text)}}
function renderGroups(){
 const box=$('groupCards');
 box.innerHTML=groups.length?groups.map(g=>`<article class="group-card" data-id="${g.id}"><div class="eyebrow">Private training group</div><h3>${esc(g.name)}</h3><p class="muted">${esc(g.description||'Share training, PBs and challenges.')}</p><div class="group-meta"><span class="tag">${g.member_count} members</span><span class="tag good">${g.challenge_count} active challenges</span></div><div class="group-actions"><button class="btn secondary open-group" data-id="${g.id}">Open group</button><button class="btn secondary copy-invite" data-link="${esc(inviteUrl(g.invite_code))}">Copy invite link</button></div></article>`).join(''):'<div class="empty" style="grid-column:1/-1">You are not in any groups yet. Create one to get started.</div>';
 box.querySelectorAll('.open-group').forEach(b=>b.onclick=e=>{e.stopPropagation();openGroup(b.dataset.id)});
 box.querySelectorAll('.copy-invite').forEach(b=>b.onclick=e=>{e.stopPropagation();copy(b.dataset.link,b)});
 box.querySelectorAll('.group-card').forEach(c=>c.onclick=()=>openGroup(c.dataset.id));
}
function memberCard(m){
 const workouts=(m.recent_workouts||[]).map(w=>`<div class="mini"><b>${esc(w.title)}</b><small>${fmt(w.performed_at)}</small></div>`).join('')||'<div class="mini"><small>No workouts shared yet</small></div>';
 const pbs=(m.recent_pbs||[]).map(p=>`<div class="mini"><b>${esc(p.exercise_name)}</b><small>${esc(p.value)} ${esc(p.unit||'')} · ${fmt(p.achieved_at)}</small></div>`).join('')||'<div class="mini"><small>No PBs shared yet</small></div>';
 return `<div class="member-card"><div class="member-head"><div class="member-name">${esc(m.name)}</div><span class="tag">Member</span></div><div class="training-columns"><div><div class="eyebrow">Recent workouts</div><div class="mini-list">${workouts}</div></div><div><div class="eyebrow">Recent PBs</div><div class="mini-list">${pbs}</div></div></div></div>`;
}
function challengeCard(c){
 const entries=c.entries||[];
 const rows=entries.length?entries.map((e,i)=>`<div class="leader-row"><span class="rank">${i+1}</span><span>${esc(e.name)}</span><b>${esc(e.value)} ${esc(metricUnit(c))}</b></div>`).join(''):'<div class="empty">No results yet. Be the first to post one.</div>';
 return `<div class="challenge-card"><div class="challenge-head"><div><div class="eyebrow">${esc(c.activity_name)}</div><h3>${esc(c.name)}</h3><div class="muted" style="margin-top:4px">${c.comparison_direction==='lower'?'Lowest':'Highest'} ${esc(c.metric_type)} wins${c.ends_at?' · ends '+fmt(c.ends_at):''}</div></div><span class="tag good">Challenge</span></div><div class="leaderboard">${rows}</div><div class="submit-row"><input type="number" step="any" placeholder="Your result" data-result="${c.id}"><button class="btn primary submit-result" data-id="${c.id}">Submit result</button></div></div>`;
}
async function openGroup(id){
 $('detail').classList.remove('hidden');$('detailName').textContent='Loading…';$('members').innerHTML='';$('challenges').innerHTML='';
 const {data,error}=await sb.rpc('get_training_group_dashboard',{p_group_id:id});if(error){$('detailName').textContent='Could not load group';return}
 activeGroup=data;$('detailName').textContent=data.group.name;$('detailDesc').textContent=data.group.description||'Private training group';
 const link=inviteUrl(data.group.invite_code);$('inviteLink').value=link;$('copyInvite').onclick=()=>copy(link,$('copyInvite'));
 $('members').innerHTML=(data.members||[]).map(memberCard).join('')||'<div class="empty">No members yet.</div>';
 $('challenges').innerHTML=(data.challenges||[]).map(challengeCard).join('')||'<div class="empty">No challenges yet.</div>';
 $('challenges').querySelectorAll('.submit-result').forEach(btn=>btn.onclick=async()=>{const inp=$('challenges').querySelector('[data-result="'+btn.dataset.id+'"]');const v=Number(inp.value);if(!Number.isFinite(v)){alert('Enter a result first');return}btn.disabled=true;btn.textContent='Saving…';const {error}=await sb.rpc('submit_training_group_challenge_result',{p_challenge_id:btn.dataset.id,p_value:v,p_note:null});if(error)alert(error.message);else await openGroup(id);btn.disabled=false;btn.textContent='Submit result'});
 $('newChallengeBtn').onclick=()=>openChallengeModal();
 history.replaceState(null,'','?group='+encodeURIComponent(id));
}
function openChallengeModal(){
 if(!activeGroup)return;$('challengeName').value='';$('challengeActivity').value='';$('challengeMetric').value='weight';$('challengeUnit').value='kg';$('challengeDirection').value='higher';$('challengeEnd').value='';$('challengeMsg').textContent='';$('challengeModal').classList.remove('hidden');window.HybridGymActivities?.attach($('challengeActivity'));
}
$('newGroupBtn').onclick=()=>{$('groupName').value='';$('groupDesc').value='';$('groupMsg').textContent='';$('groupModal').classList.remove('hidden')};
$('groupCancel').onclick=()=>$('groupModal').classList.add('hidden');$('challengeCancel').onclick=()=>$('challengeModal').classList.add('hidden');
$('createGroup').onclick=async()=>{const name=$('groupName').value.trim();if(!name){$('groupMsg').textContent='Add a group name';return}const btn=$('createGroup');btn.disabled=true;btn.textContent='Creating…';const {data,error}=await sb.rpc('create_training_group',{p_gym_id:gymId,p_name:name,p_description:$('groupDesc').value.trim()||null});btn.disabled=false;btn.textContent='Create group';if(error){$('groupMsg').textContent=error.message;return}$('groupModal').classList.add('hidden');await loadGroups();await openGroup(data.id)};
$('challengeMetric').onchange=()=>{const m=$('challengeMetric').value;$('challengeUnit').value={weight:'kg',reps:'reps',time:'sec',distance:'m',calories:'kcal',custom:''}[m]||'';$('challengeDirection').value=m==='time'?'lower':'higher'};
$('createChallenge').onclick=async()=>{const btn=$('createChallenge'),name=$('challengeName').value.trim(),activity=$('challengeActivity').value.trim();if(!name||!activity){$('challengeMsg').textContent='Add a challenge name and activity';return}btn.disabled=true;btn.textContent='Creating…';const end=$('challengeEnd').value?new Date($('challengeEnd').value+'T23:59:59').toISOString():null;const {error}=await sb.rpc('create_training_group_challenge',{p_group_id:activeGroup.group.id,p_name:name,p_activity_name:activity,p_metric_type:$('challengeMetric').value,p_unit:$('challengeUnit').value.trim()||null,p_comparison_direction:$('challengeDirection').value,p_ends_at:end});btn.disabled=false;btn.textContent='Create challenge';if(error){$('challengeMsg').textContent=error.message;return}$('challengeModal').classList.add('hidden');await openGroup(activeGroup.group.id)};
async function loadGroups(){const {data,error}=await sb.rpc('get_my_training_groups',{p_gym_id:gymId});groups=error?[]:(data||[]);renderGroups()}
async function init(){
 const {data:{session}}=await sb.auth.getSession();if(!session?.user){location.href='./index.html';return}user=session.user;
 const params=new URLSearchParams(location.search),explicitGymId=params.get('gym_id')||'',storedGymId=sessionStorage.getItem('hybrid-gym-id')||'',requestedGymId=explicitGymId||storedGymId;let membership=null;
 if(requestedGymId){const {data,error}=await sb.from('gym_members').select('gym_id,gyms(name)').eq('user_id',user.id).eq('gym_id',requestedGymId).eq('is_active',true).maybeSingle();if(error||!data){location.href='./member.html';return}membership=data}
 else{const {data,error}=await sb.from('gym_members').select('gym_id,gyms(name)').eq('user_id',user.id).eq('is_active',true);if(error||!data||data.length!==1){location.href='./member.html';return}membership=data[0]}
 gymId=membership.gym_id;sessionStorage.setItem('hybrid-gym-id',gymId);$('gymName').textContent=membership.gyms?.name||'My gym';initMemberMenu();
 $('loading').classList.add('hidden');$('app').classList.remove('hidden');window.__hybridAppReady=true;await loadGroups();const wanted=params.get('group');if(wanted&&groups.some(g=>g.id===wanted))await openGroup(wanted);
}
init();
