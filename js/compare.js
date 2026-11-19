// ---------- ПОРІВНЯННЯ ----------
function renderPickers(){
  const opts=P.map(p=>`<option value="${p.id}">${FAV.has(p.id)?'★ ':''}${esc(nm(p))} — ${zl(p.price)}</option>`).join('');
  $('#selA').innerHTML=opts; $('#selB').innerHTML=opts;
  $('#selA').value=S.A; $('#selB').value=S.B;
  $('#selA').onchange=e=>{S.A=e.target.value;update()};
  $('#selB').onchange=e=>{S.B=e.target.value;update()};
  $('#delA').onclick=()=>removeFlat(S.A); $('#delB').onclick=()=>removeFlat(S.B);
}
const rentTxt = p => p.rentMid==null ? '—' : `${zl(p.rent[0])} – ${zl(p.rent[1])}`;
function linkCell(p){
  const u=urlOf(p);
  return (u?`<a href="${esc(u)}" target="_blank" rel="noopener">${t('link.open')}</a> `:'— ')+`<button class="btn" data-link="${p.id}">${u?'✎':t('link.add')}</button>`;
}
function czCell(p){
  const own=CZOVR[p.id], l=p.czynsz!=null, d=S.czDef;
  const opts=CZ_OPTS.map(v=>`<option value="${v}" ${own===v?'selected':''}>${v?zl(v):t('cz.zero')}</option>`).join('');
  const dflt=l?t('cz.listing',{v:zl(p.czynsz)}):(d?t('cz.default',{v:zl(d)}):t('cz.none'));
  return `<select class="ownsel" data-cz="${p.id}"><option value="" ${own==null?'selected':''}>${dflt}</option>${opts}</select>`
    +`<div class="feat" style="margin-top:4px">${t(l?'cz.in':'cz.notin')}</div>`;
}
function bindCz(root){
  root.querySelectorAll('[data-cz]').forEach(el=>el.onchange=()=>{
    if(el.value==='')delete CZOVR[el.dataset.cz];else CZOVR[el.dataset.cz]=+el.value;
    store.set('czovr',CZOVR); update();
  });
}
function ownCell(p){
  const cur=ownOf(p), note=fld(p,'own_note');
  return `<select class="ownsel" data-own="${p.id}">${OWN_KEYS.map(k=>`<option value="${k}" ${k===cur?'selected':''}>${ownTxt(k,'l')}</option>`).join('')}</select>`
   +(note?`<div class="feat" style="margin-top:4px">${esc(note)}</div>`:'');
}
function bindOwnSel(root){
  root.querySelectorAll('[data-own]').forEach(el=>el.onchange=()=>{
    OWNSEL[el.dataset.own]=el.value; store.set('ownsel',OWNSEL); update();
  });
}
function renderCompare(){
  const a=byId(S.A), b=byId(S.B), ca=calc(a), cb=calc(b);
  // row: [label, valA, valB, compareA, compareB, better('low'|'high'|null), html fn]
  const num=(label,va,vb,f,better,big)=>({label,va,vb,f,better,big});
  const rows=[
   {sec:t('c.basic'),key:'basic'},
   num(t('c.price'),a.price,b.price,zl,'low',1),
   num(t('c.area'),a.area,b.area,m2,'high'),
   num(t('c.ppm'),a.ppm,b.ppm,v=>zl(v)+'/'+t('m2'),'low'),
   {label:t('c.dist'),va:esc(a.dist),vb:esc(b.dist)},
   {label:t('c.rooms'),va:esc(fld(a,'rooms')),vb:esc(fld(b,'rooms'))},
   {label:t('c.floor'),va:esc(fld(a,'floor')),vb:esc(fld(b,'floor'))},
   {label:t('c.year'),va:esc(fld(a,'year')),vb:esc(fld(b,'year'))},
   {label:t('c.cond'),va:`<span class="tag ${a.ready?'ok':'warn'}">${esc(fld(a,'cond'))}</span>`,vb:`<span class="tag ${b.ready?'ok':'warn'}">${esc(fld(b,'cond'))}</span>`},
   {label:t('c.metro'),va:esc(fld(a,'metro')),vb:esc(fld(b,'metro'))},
   {label:t('c.seller'),va:esc(fld(a,'seller')),vb:esc(fld(b,'seller'))},
   {label:t('c.feat'),va:`<span class="feat">${esc(fld(a,'feat'))}</span>`,vb:`<span class="feat">${esc(fld(b,'feat'))}</span>`},
   {sec:t('c.ownsec'),key:'own'},
   {label:t('c.own'),va:ownCell(a),vb:ownCell(b)},
   num(t('c.risk'),OWN[ownOf(a)].risk,OWN[ownOf(b)].risk,v=>v==null?t('risk.na'):t('risk.'+v),'low'),
   num(t('c.owncost'),ca.ownCost,cb.ownCost,v=>v?zl(v):'0 zł','low'),
   {sec:S.mort?t('c.mort',{dp:S.dp,r:dec(S.rate,0,2),t:S.term}):t('c.monthly'),key:'mort'},
   ...(S.mort?[
   num(t('c.down'),ca.down,cb.down,zl,'low'),
   num(t('c.loan'),ca.loan,cb.loan,zl,'low'),
   num(t('c.effrate'),ca.effRate,cb.effRate,v=>dec(v,2)+'%','low'),
   num(t('c.pay'),ca.pay,cb.pay,zl,'low',1),
   {label:t('c.how'),va:`<span class="feat">${howMort(a,ca)}</span>`,vb:`<span class="feat">${howMort(b,cb)}</span>`},
   ]:[]),
   num(t('c.cz'),ca.cz,cb.cz,zl,'low'),
   {label:t('c.owncz'),va:czCell(a),vb:czCell(b)},
   num(t('c.monthall'),ca.monthAll,cb.monthAll,zl,'low',1),
   ...(S.mort?[
   num(t('c.interest'),ca.interest,cb.interest,zl,'low'),
   num(t('c.total'),ca.total,cb.total,zl,'low'),
   ]:[]),
   ...(!S.mort?[]:exActive()?[
   {key:'ex',sec:t('c.ex')+(S.ex.extra>0?t('c.ex.extra',{x:fmt(S.ex.extra)}):'')+(S.ex.lump>0?t('c.ex.lump',{x:fmt(S.ex.lump),m:S.ex.lumpM}):'')},
   {label:t('c.how'),va:`<span class="feat">${howEx(ca)}</span>`,vb:`<span class="feat">${howEx(cb)}</span>`},
   num(t('c.ex.term'),ca.ea.months,cb.ea.months,fmtTerm,'low'),
   num(t('c.ex.cut'),ca.ea.monthsSaved,cb.ea.monthsSaved,fmtTerm,'high'),
   num(t(S.ex.mode==='pay'?'c.ex.after':'c.ex.base'),ca.ea.payAfter,cb.ea.payAfter,zl,'low'),
   num(t('c.ex.int'),ca.ea.interest,cb.ea.interest,zl,'low'),
   num(t('c.ex.save'),ca.ea.saved,cb.ea.saved,zl,'high'),
   num(t('c.ex.fee'),ca.ea.fee,cb.ea.fee,zl,'low'),
   num(t('c.ex.net'),ca.ea.netSaved,cb.ea.netSaved,zl,'high',1),
   ]:[{sec:t('c.ex'),key:'ex'},{label:'',va:`<span class="feat">${t('c.ex.hint')}</span>`,vb:''}]),
   {sec:t('c.start'),key:'start'},
   num(t('c.comm',{x:dec(S.comm,0,2)}),ca.comm,cb.comm,zl,'low'),
   num(t('c.reno'),ca.reno,cb.reno,v=>v?zl(v):t('c.noreno'),'low'),
   num(t('c.cash'),ca.cash,cb.cash,zl,'low',1),
   {sec:t('c.rentsec'),key:'rent'},
   {label:t('c.rent'),va:rentTxt(a),vb:rentTxt(b)},
   num(t('c.rentnet'),ca.net,cb.net,v=>v==null?'—':`<span class="${v>=0?'pos':'neg'}">${v>=0?'+':'−'}${zl(Math.abs(v))}</span>`,'high'),
   num(t('c.yield'),a.rentMid==null?null:a.rentMid*12/a.price*100,b.rentMid==null?null:b.rentMid*12/b.price*100,v=>v==null?'—':dec(v,2)+'%','high'),
  ];
  let html=`<tr><th class="k"></th><th style="color:var(--a)">A · ${esc(nm(a))} ${favBtn(a)}</th><th style="color:var(--b)">B · ${esc(nm(b))} ${favBtn(b)}</th></tr>`;
  let gk='',shut=false;
  for(const r of rows){
    if(r.sec){gk=r.key;shut=CMPCOL.includes(gk);html+=`<tr class="sec ${shut?'shut':''}" data-sec="${gk}"><th colspan="3"><span class="chev">▾</span>${r.sec}</th></tr>`;continue}
    let ca_='',cb_='',ta,tb;
    if(r.f){
      let wa=false,wb=false;
      if(r.va!=null&&r.vb!=null&&r.va!==r.vb){
        const aBetter = r.better==='low' ? r.va<r.vb : r.va>r.vb;
        wa=aBetter; wb=!aBetter;
      }
      ca_=wa?'win':''; cb_=wb?'win':'';
      ta=r.f(r.va); tb=r.f(r.vb);
      if(r.big){ta=`<span class="big">${ta}</span>`;tb=`<span class="big">${tb}</span>`}
      ta=`<b style="font-weight:inherit">${ta}</b>`; tb=`<b style="font-weight:inherit">${tb}</b>`;
    } else {ta=r.va;tb=r.vb}
    html+=`<tr${shut?' hidden':''}><th class="k">${r.label}</th><td class="${ca_}">${ta}</td><td class="${cb_}">${tb}</td></tr>`;
  }
  html+=`<tr><th class="k">${t('c.listing')}</th><td>${linkCell(a)}</td><td>${linkCell(b)}</td></tr>`;
  $('#cmp').innerHTML=html;
  bindLinkBtns($('#cmp')); bindOwnSel($('#cmp')); bindCz($('#cmp'));
  $('#cmp').querySelectorAll('tr.sec').forEach(tr=>tr.onclick=()=>{
    const k=tr.dataset.sec; CMPCOL=CMPCOL.includes(k)?CMPCOL.filter(x=>x!==k):[...CMPCOL,k];
    store.set('cmpcol',CMPCOL); renderCompare();
  });
}
