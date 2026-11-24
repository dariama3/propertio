function syncMort(){
  $('#mortBox').classList.toggle('off',!S.mort); $('#mortOn').checked=S.mort;
  if(!S.mort&&S.metric==='pay')S.metric='price';
}
$('#mortBox>summary').addEventListener('click',e=>{
  if(!e.target.closest('.mort-toggle'))return;
  e.preventDefault(); S.mort=!S.mort; store.set('mort',S.mort);
  syncMort(); renderTabs(); update();
});
$('#mortBox').addEventListener('toggle',()=>store.set('mortopen',$('#mortBox').open));
function update(){saveS();syncMort();renderBars();renderCompare();renderAll();renderOwnAnalysis()}

// ---------- МОВА ----------
function applyStatic(){
  document.documentElement.lang=LANG; document.title=t('page.title');
  document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));
  document.querySelectorAll('[data-i18n-ph]').forEach(e=>e.placeholder=t(e.dataset.i18nPh));
  document.querySelectorAll('[data-i18n-html]').forEach(e=>e.innerHTML=t(e.dataset.i18nHtml));
  $('#langSel').value=LANG;
}
function renderLang(){
  const own=F('f_own').value||'unknown';
  applyStatic();
  $('#f_own').innerHTML=OWN_KEYS.map(k=>`<option value="${k}">${ownTxt(k,'l')}</option>`).join(''); $('#f_own').value=own;
  renderOwnSettings(); renderKpis(); initSettings(); renderTabs(); renderPickers(); renderVerdicts(); update();
}
function setLang(l){
  if(!LOCALES[l])return;
  LANG=l; try{localStorage.setItem('propertio.lang',l)}catch(e){}
  renderLang();
}
$('#langSel').onchange=e=>setLang(e.target.value);
// значення блоку дострокового погашення беруться зі стану S
function syncExInputs(){
  $('#ex_extra').value=S.ex.extra||''; $('#ex_lump').value=S.ex.lump||'';
  $('#ex_month').value=S.ex.lumpM; $('#ex_mode').value=S.ex.mode; $('#ex_fee').value=String(S.ex.fee||0);
}
// повне перемалювання після зміни стану ззовні (хмара)
function refreshUI(){ syncExInputs(); renderLang(); }

loadS();
if(!byId(S.A))S.A=(P.find(x=>x.id!==S.B)||P[0]).id;
if(!byId(S.B))S.B=(P.find(x=>x.id!==S.A)||P[0]).id;
S.mort=store.get('mort',true); $('#mortBox').open=store.get('mortopen',true);
initExPanel(); syncExInputs(); renderLang();
