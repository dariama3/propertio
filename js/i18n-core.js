// ---------- ПЕРЕКЛАД (uk · pl · en) ----------
const LOCALES = {uk:'uk-UA', pl:'pl-PL', en:'en-US'};
let LANG = (()=>{
  try{const s=localStorage.getItem('propertio.lang'); if(LOCALES[s])return s}catch(e){}
  return 'uk';
})();
const t = (k,v)=>{
  let s = I18N[LANG][k] ?? I18N.uk[k] ?? k;
  if(v) for(const x in v) s = s.split('{'+x+'}').join(v[x]);
  return s;
};
