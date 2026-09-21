(function(){
  const KEY='hybrid-active-gym-id';

  function norm(rows){
    return (rows||[]).filter(Boolean).map(r=>({
      row:r,
      gymId:r.gym_id||r.gyms?.id||null,
      gymName:r.gyms?.name||r.gym_name||'Gym',
      gymSlug:r.gyms?.slug||r.gym_slug||''
    })).filter(x=>x.gymId);
  }

  function fromUrl(items){
    try{
      const v=new URL(location.href).searchParams.get('gym');
      if(!v)return null;
      return items.find(x=>x.gymId===v||x.gymSlug===v)||null;
    }catch(_e){return null}
  }

  function fromStorage(items){
    try{
      const v=localStorage.getItem(KEY);
      return v?items.find(x=>x.gymId===v)||null:null;
    }catch(_e){return null}
  }

  function persist(item){
    try{localStorage.setItem(KEY,item.gymId)}catch(_e){}
    try{
      const u=new URL(location.href);
      u.searchParams.set('gym',item.gymSlug||item.gymId);
      history.replaceState(null,'',u);
    }catch(_e){}
  }

  function choose(items){
    return new Promise(resolve=>{
      const overlay=document.createElement('div');
      overlay.id='hybridGymChooser';
      overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(11,16,32,.72);display:grid;place-items:center;padding:20px;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif';
      const card=document.createElement('div');
      card.style.cssText='width:min(460px,100%);background:#fff;border-radius:22px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.28);color:#101828';
      card.innerHTML='<div style="font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#667085">Workspace</div><h2 style="margin:5px 0 7px;font-size:26px">Which gym are you managing?</h2><p style="margin:0 0 16px;color:#667085;line-height:1.45">Your account has access to more than one gym. Choose one before continuing.</p>';
      const list=document.createElement('div');
      list.style.cssText='display:grid;gap:9px';
      items.forEach(item=>{
        const b=document.createElement('button');
        b.type='button';
        b.textContent=item.gymName;
        b.style.cssText='width:100%;border:1px solid #e4e7ec;border-radius:14px;padding:13px 14px;background:#fff;color:#101828;font:800 16px/1.2 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;text-align:left;cursor:pointer';
        b.onclick=()=>{persist(item);overlay.remove();resolve(item.row)};
        list.appendChild(b);
      });
      card.appendChild(list);overlay.appendChild(card);document.body.appendChild(overlay);
    });
  }

  async function pick(rows){
    const items=norm(rows);
    if(!items.length)return null;
    const selected=fromUrl(items)||fromStorage(items)||(items.length===1?items[0]:null);
    if(selected){persist(selected);return selected.row}
    return await choose(items);
  }

  function clear(){
    try{localStorage.removeItem(KEY)}catch(_e){}
  }

  function currentId(){
    try{return localStorage.getItem(KEY)||''}catch(_e){return''}
  }

  function attachSwitcher(element,rows,currentRow){
    if(!element)return;
    const items=norm(rows);
    if(items.length<2)return;
    const current=norm([currentRow])[0];
    if(current)element.textContent=current.gymName;
    element.title='Switch gym';
    element.style.cursor='pointer';
    element.setAttribute('role','button');
    element.setAttribute('tabindex','0');
    const activate=()=>{
      clear();
      try{
        const u=new URL(location.href);u.searchParams.delete('gym');location.href=u.toString();
      }catch(_e){location.reload()}
    };
    element.addEventListener('click',activate);
    element.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}});
  }

  window.HybridGymContext={pick,clear,currentId,attachSwitcher,key:KEY};
})();