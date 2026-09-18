(function(){
  if(!location.pathname.endsWith('/social.html')) return;
  const REACTIONS=['❤️','🔥','👏','💪','😂'];
  function enhance(){
    document.querySelectorAll('.post').forEach(post=>{
      const actions=post.querySelector('.post-actions');
      if(!actions||actions.querySelector('.reaction-picker')) return;
      const like=actions.querySelector('.react');
      if(like){
        const picker=document.createElement('div');picker.className='reaction-picker';
        REACTIONS.forEach(icon=>{const b=document.createElement('button');b.type='button';b.className='reaction-choice';b.textContent=icon;b.title='React '+icon;b.onclick=()=>{like.click();picker.classList.remove('open')};picker.appendChild(b)});
        const trigger=document.createElement('button');trigger.type='button';trigger.className='action reaction-trigger';trigger.textContent='☺ React';trigger.onclick=()=>picker.classList.toggle('open');
        actions.insertBefore(trigger,like);actions.appendChild(picker);
      }
      const author=post.querySelector('.post-author')?.textContent?.trim();
      const me=document.getElementById('topName')?.textContent?.trim();
      if(author&&me&&author===me&&!actions.querySelector('.owner-menu')){
        const owner=document.createElement('div');owner.className='owner-menu';owner.innerHTML='<button type="button" class="action owner-more">•••</button><div class="owner-pop"><button type="button" data-owner-action="edit">Edit post</button><button type="button" data-owner-action="delete">Delete post</button></div>';
        owner.querySelector('.owner-more').onclick=()=>owner.classList.toggle('open');
        owner.querySelector('[data-owner-action="edit"]').onclick=()=>editPost(post);
        owner.querySelector('[data-owner-action="delete"]').onclick=()=>deletePost(post);
        actions.appendChild(owner);
      }
    });
    document.querySelectorAll('.comment').forEach(comment=>{
      const name=comment.querySelector('.comment-name')?.textContent?.trim();const me=document.getElementById('topName')?.textContent?.trim();const tools=comment.querySelector('.comment-tools');
      if(name&&me&&name===me&&tools&&!tools.querySelector('.comment-owner')){const b=document.createElement('button');b.type='button';b.className='comment-owner';b.textContent='Edit';b.onclick=()=>editComment(comment);tools.appendChild(b)}
    });
  }
  function editPost(post){const body=post.querySelector('.post-body');if(!body)return;const current=body.textContent.trim();const value=prompt('Edit your post',current);if(value===null||!value.trim())return;body.textContent=value.trim();toast('Post updated in this preview. Live persistence will follow the page’s existing social save flow.')}
  function deletePost(post){if(!confirm('Delete this post?'))return;post.remove();toast('Post removed from this view.')}
  function editComment(comment){const text=comment.querySelector('.comment-text');if(!text)return;const value=prompt('Edit your comment',text.textContent.trim());if(value===null||!value.trim())return;text.textContent=value.trim();toast('Comment updated in this view.')}
  function toast(msg){let el=document.getElementById('socialEnhancementToast');if(!el){el=document.createElement('div');el.id='socialEnhancementToast';el.className='social-enhancement-toast';document.body.appendChild(el)}el.textContent=msg;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2600)}
  const style=document.createElement('style');style.textContent='.post-actions{position:relative;flex-wrap:wrap}.reaction-picker{display:none;position:absolute;left:0;bottom:48px;background:#fff;border:1px solid #e7ebf2;border-radius:999px;padding:6px;box-shadow:0 12px 28px rgba(16,24,40,.16);gap:2px;z-index:4}.reaction-picker.open{display:flex}.reaction-choice{border:0;background:transparent;font-size:20px;padding:5px 7px;border-radius:999px;cursor:pointer}.reaction-choice:hover{background:#f2f4f7}.owner-menu{margin-left:auto;position:relative}.owner-pop{display:none;position:absolute;right:0;top:32px;background:#fff;border:1px solid #e7ebf2;border-radius:12px;box-shadow:0 12px 28px rgba(16,24,40,.14);padding:6px;min-width:130px;z-index:5}.owner-menu.open .owner-pop{display:grid}.owner-pop button{border:0;background:transparent;text-align:left;padding:9px 10px;border-radius:8px;cursor:pointer}.owner-pop button:hover{background:#f2f4f7}.social-enhancement-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,20px);opacity:0;background:#0b1020;color:#fff;padding:11px 15px;border-radius:12px;z-index:100;transition:.2s;max-width:min(90vw,520px);text-align:center}.social-enhancement-toast.show{opacity:1;transform:translate(-50%,0)}';document.head.appendChild(style);
  const observer=new MutationObserver(enhance);observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
})();