// ---------- ТАБЛИЦЯ ----------
let sortK='price', sortDir=1;
const COLS_ALL=[
 ['name','col.name',p=>nm(p),p=>favBtn(p)+esc(nm(p))+(p.fresh?` <span class="tag ok">${t('tag.new')}</span>`:'')],
 ['dist','col.dist',p=>p.dist,p=>esc(p.dist)],
 ['price','col.price',p=>p.price,p=>zl(p.price)],
 ['area','m2',p=>p.area,p=>dec(p.area,1)],
 ['ppm','col.ppm',p=>p.ppm,p=>fmt(p.ppm)],
 ['year','col.year',p=>parseInt(p.year),p=>esc(fld(p,'year'))],
 ['ready','col.state',p=>p.ready?1:0,p=>t(p.ready?'tag.ready':'tag.reno')],
 ['czynsz','col.cz',p=>czEff(p).v,p=>czLabel(p)],
 ['pay','col.pay',p=>calc(p).pay,p=>zl(calc(p).pay)],
 ['monthAll','col.monthall',p=>calc(p).monthAll,p=>zl(calc(p).monthAll)],
 ['cash','col.cash',p=>calc(p).cash,p=>zl(calc(p).cash)],
 ['own','col.own',p=>OWN[ownOf(p)].risk??9,p=>{const o=ownCfg(ownOf(p));return `<span class="tag ${o.cls}">${o.short}</span>`}],
 ['saved','col.saved',p=>exActive()?calc(p).ea.netSaved:0,p=>exActive()?zl(calc(p).ea.netSaved)+' · '+fmtTerm(calc(p).ea.months):'—'],
 ['link','col.link',null,p=>linkCell(p)],
 ['pick','col.pick',null,p=>`<button class="btn a" data-a="${p.id}">A</button> <button class="btn b" data-b="${p.id}">B</button> <button class="btn x" data-del="${p.id}" title="${t('del.title')}">✕</button>`],
];
function renderAll(){
  const COLS=COLS_ALL.filter(c=>S.mort||!['pay','saved'].includes(c[0]));
  const col=COLS.find(c=>c[0]===sortK)||COLS.find(c=>c[0]==='price');
  const rows=P.filter(p=>!S.favOnly||FAV.has(p.id)).sort((x,y)=>{const a=col[2]?col[2](x):0,b=col[2]?col[2](y):0;return (a>b?1:a<b?-1:0)*sortDir});
  $('#all').innerHTML=`<thead><tr>${COLS.map(c=>`<th data-k="${c[0]}">${t(c[1])}${c[0]===sortK?(sortDir>0?' ▲':' ▼'):''}</th>`).join('')}</tr></thead>
   <tbody>${rows.map(p=>`<tr>${COLS.map((c,i)=>`<td class="${i===0?'n':''}">${c[3](p)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  document.querySelectorAll('#all th').forEach(th=>th.onclick=()=>{
    const k=th.dataset.k; if(k==='pick'||k==='link')return;
    if(sortK===k)sortDir*=-1;else{sortK=k;sortDir=1}
    renderAll();
  });
  $('#hiddenBar').innerHTML=`<label><input type="checkbox" id="favOnly" ${S.favOnly?'checked':''}> ${t('fav.only',{n:FAV.size})}</label>`
    +(HIDDEN.length?` &nbsp; ${t('hid.count',{n:HIDDEN.length})} <button class="btn" id="btnRestore">${t('hid.restore')}</button>`:'');
  $('#favOnly').onchange=e=>{S.favOnly=e.target.checked;renderAll()};
  if(HIDDEN.length)$('#btnRestore').onclick=restoreHidden;
  bindLinkBtns($('#all'));
  document.querySelectorAll('#all [data-del]').forEach(b=>b.onclick=()=>removeFlat(b.dataset.del));
  document.querySelectorAll('#all [data-a]').forEach(b=>b.onclick=()=>{S.A=b.dataset.a;$('#selA').value=S.A;update();$('#cmp').scrollIntoView({behavior:'smooth'})});
  document.querySelectorAll('#all [data-b]').forEach(b=>b.onclick=()=>{S.B=b.dataset.b;$('#selB').value=S.B;update();$('#cmp').scrollIntoView({behavior:'smooth'})});
}

function renderVerdicts(){
  $('#verdicts').innerHTML=VERDICTS.map(([n,id])=>`<div class="card"><h3>${t('v.'+n+'.t')}</h3><b>${esc(nm(ALL.find(p=>p.id===id)))}</b><p>${t('v.'+n+'.d')}</p></div>`).join('');
}

function bindLinkBtns(root){
  root.querySelectorAll('[data-link]').forEach(b=>b.onclick=()=>{
    const p=byId(b.dataset.link);
    const v=prompt(t('link.prompt'),urlOf(p));
    if(v===null)return;
    const val=v.trim();
    if(val&&!/^https?:\/\//i.test(val)){alert(t('link.bad'));return}
    const dup=val&&findDup(val,p.id); if(dup){alert(dupMsg(dup));return}
    if(val)LINKS[p.id]=val;else delete LINKS[p.id];
    store.set('links',LINKS); update();
  });
}
function removeFlat(id){
  const p=byId(id); if(!p)return;
  if(P.length<=2){alert(t('del.min'));return}
  const isUser=USER.some(u=>u.id===id);
  if(!confirm(t(isUser?'del.user':'del.hide',{n:nm(p)})))return;
  if(isUser){
    USER=USER.filter(u=>u.id!==id); store.set('user',USER);
    ALL.splice(ALL.findIndex(x=>x.id===id),1); delete LINKS[id]; store.set('links',LINKS);
  } else { HIDDEN.push(id); store.set('hidden',HIDDEN); }
  P.splice(P.findIndex(x=>x.id===id),1);
  if(!byId(S.A))S.A=(P.find(x=>x.id!==S.B)||P[0]).id;
  if(!byId(S.B))S.B=(P.find(x=>x.id!==S.A)||P[0]).id;
  renderPickers(); renderKpis(); update();
  isUser?Cloud.removeFlat(id):Cloud.setHidden(id,true);
}
function restoreHidden(){
  HIDDEN=[]; store.set('hidden',HIDDEN);
  P.length=0; ALL.forEach(p=>P.push(p));
  renderPickers(); renderKpis(); update();
  Cloud.clearHidden();
}
