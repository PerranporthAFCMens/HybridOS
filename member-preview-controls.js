(function(){
  if(!location.pathname.endsWith('/member-preview.html')) return;

  function renderTrackingFields(select){
    const card=select.closest('.exercise-card');
    if(!card) return;
    const type=select.value;
    card.querySelectorAll('.set-row').forEach(function(row){
      const a=row.querySelector('.metricA');
      const b=row.querySelector('.metricB');
      if(!a||!b) return;
      if(type==='strength'){
        a.innerHTML='<label>Reps</label><input type="number" value="10" inputmode="numeric">';
        b.innerHTML='<label>Weight (kg)</label><input type="number" step="0.5" value="10" inputmode="decimal">';
      }else if(type==='time'){
        a.innerHTML='<label>Time</label><input type="number" placeholder="Seconds" inputmode="decimal">';
        b.innerHTML='<label>Note</label><input type="text" placeholder="Optional">';
      }else if(type==='distance'){
        a.innerHTML='<label>Distance</label><input type="number" step="0.01" placeholder="Metres" inputmode="decimal">';
        b.innerHTML='<label>Time (sec)</label><input type="number" placeholder="Optional" inputmode="decimal">';
      }else if(type==='calories'){
        a.innerHTML='<label>Calories</label><input type="number" placeholder="kcal" inputmode="numeric">';
        b.innerHTML='<label>Time (min)</label><input type="number" placeholder="Optional" inputmode="decimal">';
      }else{
        a.innerHTML='<label>Value</label><input type="number" step="0.01" inputmode="decimal">';
        b.innerHTML='<label>Unit</label><input type="text" placeholder="e.g. lengths">';
      }
    });
  }

  function syncPbUnit(select){
    const unit=document.getElementById('pbUnit');
    if(!unit) return;
    const units={weight:'kg',reps:'reps',time:'sec',distance:'m',calories:'kcal'};
    if(select.value!=='custom') unit.value=units[select.value]||'';
  }

  document.addEventListener('change',function(event){
    const target=event.target;
    if(!(target instanceof HTMLSelectElement)) return;
    if(target.matches('.trackingType')) renderTrackingFields(target);
    if(target.id==='pbMetric') syncPbUnit(target);
  });

  function init(){
    document.querySelectorAll('.trackingType').forEach(renderTrackingFields);
    const style=document.createElement('style');
    style.id='member-preview-select-fix';
    style.textContent='.field select,.pb-field select{pointer-events:auto!important;touch-action:manipulation;position:relative;z-index:1;-webkit-appearance:auto;appearance:auto}';
    if(!document.getElementById(style.id)) document.head.appendChild(style);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();