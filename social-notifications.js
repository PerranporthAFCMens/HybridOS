import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const sb=createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co','sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
let userId=null,gymId=null,poll=null;
const TYPES=['social_comment','social_reply','social_reaction'];

function style(){
 if(document.getElementById('hybridSocialNoticeStyle'))return;
 const s=document.createElement('style');s.id='hybridSocialNoticeStyle';s.textContent=`
 .hybrid-social-badge{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#ff3b30;color:#fff;font-size:10px;font-weight:900;line-height:1;margin-left:auto}
 .hybrid-social-badge.hidden{display:none!important}
 .hybrid-social-toast{position:fixed;right:18px;top:18px;z-index:10050;width:min(360px,calc(100vw - 36px));background:#fff;color:#101828;border:1px solid #e7ebf2;border-radius:16px;padding:14px 15px;box-shadow:0 18px 45px rgba(16,24,40,.18);display:flex;gap:12px;align-items:flex-start}
 .hybrid-social-toast.hidden{display:none!important}.hybrid-social-toast b{display:block;margin-bottom:3px}.hybrid-social-toast small{color:#667085}.hybrid-social-toast button{border:0;background:#0b1020;color:#fff;border-radius:10px;padding:8px 10px;font-weight:800;cursor:pointer;margin-left:auto;white-space:nowrap}
 `;document.head.appendChild(s);
}
function targets(){return [...document.querySelectorAll('[data-social-link],a[href="./social.html"],a[href$="/social.html"],a[data-admin-key="community-group"]')]}
function renderBadge(count){
 targets().forEach(el=>{
   let b=el.querySelector('.hybrid-social-badge');
   if(!b){b=document.createElement('span');b.className='hybrid-social-badge';el.appendChild(b)}
   b.textContent=count>99?'99+':String(count);b.classList.toggle('hidden',count<1);
 });
}
function toast(count){
 if(count<1||location.pathname.endsWith('/social.html')||location.pathname.endsWith('/community.html')){document.getElementById('hybridSocialToast')?.remove();return}
 let t=document.getElementById('hybridSocialToast');
 if(!t){t=document.createElement('div');t.id='hybridSocialToast';t.className='hybrid-social-toast';document.body.appendChild(t)}
 t.innerHTML='<div><b>New social activity</b><small>'+count+' unread '+(count===1?'notification':'notifications')+'</small></div><button type="button">View Social</button>';
 t.querySelector('button').onclick=()=>location.href='./social.html';
}
async function unread(){
 if(!userId||!gymId)return 0;
 const {count,error}=await sb.from('member_notifications').select('id',{count:'exact',head:true}).eq('gym_id',gymId).eq('user_id',userId).in('notification_type',TYPES).is('read_at',null).lte('scheduled_for',new Date().toISOString());
 if(error)return 0;return count||0;
}
async function refresh(){const n=await unread();renderBadge(n);toast(n)}
async function markRead(){
 if(!userId||!gymId)return;
 await sb.from('member_notifications').update({read_at:new Date().toISOString()}).eq('gym_id',gymId).eq('user_id',userId).in('notification_type',TYPES).is('read_at',null);
 renderBadge(0);document.getElementById('hybridSocialToast')?.remove();
}
async function init(){
 style();
 const {data:{session}}=await sb.auth.getSession();if(!session?.user)return;userId=session.user.id;
 const {data:gm}=await sb.from('gym_members').select('gym_id').eq('user_id',userId).eq('is_active',true).limit(1);
 gymId=gm?.[0]?.gym_id;if(!gymId)return;
 const here=location.pathname.endsWith('/social.html')||location.pathname.endsWith('/community.html');
 if(here)await markRead();else await refresh();
 const mo=new MutationObserver(()=>refresh());mo.observe(document.body,{childList:true,subtree:true});
 poll=setInterval(refresh,30000);
}
window.addEventListener('beforeunload',()=>{if(poll)clearInterval(poll)});
init();
