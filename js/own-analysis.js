function renderOwnSettings(){
  $('#ownTbl').innerHTML=`<tr><th>${t('own.th.type')}</th><th>${t('own.th.cost')}</th><th>${t('own.th.prem')}</th></tr>`+
   OWN_KEYS.map(k=>{const o=ownCfg(k);return `<tr><td>${o.l}</td>
    <td><input type="number" min="0" step="100" data-t="${k}" data-f="cost" value="${o.cost||0}"></td>
    <td><input type="number" min="0" max="5" step="0.05" data-t="${k}" data-f="prem" value="${o.prem||0}"></td></tr>`}).join('');
  $('#ownTbl').querySelectorAll('input').forEach(i=>i.oninput=()=>{
    const v=parseFloat(i.value)||0;
    (OWNCFG[i.dataset.t]=OWNCFG[i.dataset.t]||{})[i.dataset.f]=v;
    store.set('owncfg',OWNCFG); update();
  });
}
function renderOwnAnalysis(){
  const cards=OWN_KEYS.map(k=>{
    const o=ownCfg(k), list=P.filter(p=>ownOf(p)===k);
    if(!list.length&&k!=='unknown')return '';
    const prem=(o.prem||0)>0?t('own.calc.pp',{x:dec(o.prem,0,2)}):t('own.calc.none');
    return `<div class="card"><h3><span class="tag ${o.cls}">${o.l}</span></h3>
     <div class="flats"><b>${list.length?list.map(p=>esc(nm(p))).join(', '):'—'}</b></div>
     <div class="feat">${o.d}</div>
     <ul>${o.li.map(x=>`<li>${x}</li>`).join('')}</ul>
     <div class="feat" style="margin-top:8px">${t('own.calc',{c:zl(o.cost||0),p:prem})}</div></div>`;
  }).join('');
  $('#ownAnalysis').innerHTML=cards;
}
function initExPanel(){
  const read=()=>{
    S.ex.extra=Math.max(0,parseFloat($('#ex_extra').value)||0);
    S.ex.lump=Math.max(0,parseFloat($('#ex_lump').value)||0);
    S.ex.lumpM=Math.min(360,Math.max(1,parseInt($('#ex_month').value)||1));
    S.ex.mode=$('#ex_mode').value; S.ex.fee=parseFloat($('#ex_fee').value)||0;
    update();
  };
  ['ex_extra','ex_lump','ex_month'].forEach(id=>$('#'+id).oninput=read);
  ['ex_mode','ex_fee'].forEach(id=>$('#'+id).onchange=read);
}
