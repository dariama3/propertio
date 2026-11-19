// ---------- СТОВПЧИКИ ----------
const METRICS = {
  price:{l:'m.price', f:p=>p.price, fmt:v=>zl(v)},
  ppm:{l:'m.ppm', f:p=>p.ppm, fmt:v=>zl(v)+'/'+t('m2')},
  area:{l:'m.area', f:p=>p.area, fmt:v=>m2(v)},
  pay:{l:'m.pay', f:p=>calc(p).pay, fmt:v=>zl(v)},
  cash:{l:'m.cash', f:p=>calc(p).cash, fmt:v=>zl(v)},
  rent:{l:'m.rent', f:p=>p.rentMid, fmt:v=>zl(v)},
};
function renderTabs(){
  $('#metricTabs').innerHTML=Object.entries(METRICS).filter(([k])=>S.mort||k!=='pay').map(([k,m])=>`<button class="tab" data-k="${k}" aria-pressed="${k===S.metric}">${t(m.l)}</button>`).join('');
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{S.metric=b.dataset.k;renderTabs();renderBars()});
}
function renderBars(){
  const m=METRICS[S.metric];
  const rows=P.map(p=>({p,v:m.f(p)})).filter(r=>r.v!=null).sort((a,b)=>a.v-b.v);
  const mx=Math.max(1,...rows.map(r=>r.v));
  $('#bars').innerHTML=rows.map(({p,v})=>`
    <div class="bar-row ${p.id===S.A?'selA':''} ${p.id===S.B?'selB':''}" data-id="${p.id}">
      <div class="name" title="${esc(nm(p))}">${FAV.has(p.id)?'<span class="favstar">★</span> ':''}${esc(nm(p))}</div>
      <div class="track"><div class="fill" style="width:${v/mx*100}%"></div></div>
      <div class="val">${m.fmt(v)}</div></div>`).join('');
  document.querySelectorAll('.bar-row').forEach(r=>r.onclick=()=>pick(r.dataset.id));
}
let nextSlot='A';
function pick(id){
  if(nextSlot==='A'){S.A=id}else{S.B=id}
  nextSlot = nextSlot==='A'?'B':'A';
  $('#selA').value=S.A; $('#selB').value=S.B;
  update();
  $('#cmp').scrollIntoView({behavior:'smooth',block:'nearest'});
}
