// значення поля квартири у поточній мові (для доданих вручну — те, що ввів користувач)
function fld(p,k){
  if(p.user){
    if(k==='cond')return t(p.ready?'cond.ready':'cond.reno');
    if(k==='seller')return t(p.dev?'seller.dev':p.agency?'seller.agency':'seller.owner');
    return p[k];
  }
  return LANG==='uk' ? p[k] : (D[p.id]?.[LANG]?.[k] ?? p[k]);
}
const nm = p => fld(p,'name');
const store = {
  get(k,d){try{return JSON.parse(localStorage.getItem('propertio.'+k))??d}catch(e){return d}},
  set(k,v){try{localStorage.setItem('propertio.'+k,JSON.stringify(v))}catch(e){} if(store.onSet)store.onSet(k)},
  del(k){try{localStorage.removeItem('propertio.'+k)}catch(e){}},
  onSet:null   // хук для хмарної синхронізації (cloud.js)
};
let LINKS = store.get('links',{});
let USER = store.get('user',[]);
let CZOVR = store.get('czovr',{});
let CMPCOL = store.get('cmpcol',[]);
function prep(p){p.ppm=p.price/p.area; p.rentMid=(p.rent&&p.rent[0]!=null&&p.rent[1]!=null)?(p.rent[0]+p.rent[1])/2:null; return p}
P.forEach(prep);
const BASE = [...P];   // типові квартири (без доданих користувачем)
USER.forEach(u=>P.push(prep(u)));
const ALL = [...P];
let HIDDEN = store.get('hidden',[]);
const FAV = new Set(store.get('fav',[]));
function favBtn(p){
  const on=FAV.has(p.id);
  return `<button class="fav ${on?'on':''}" data-fav="${p.id}" title="${t(on?'fav.remove':'fav.add')}" aria-pressed="${on}">${on?'★':'☆'}</button>`;
}
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-fav]'); if(!b)return;
  e.stopPropagation();
  const id=b.dataset.fav;
  FAV.has(id)?FAV.delete(id):FAV.add(id);
  store.set('fav',[...FAV]);
  renderPickers(); update();
});
for(let i=P.length-1;i>=0;i--) if(HIDDEN.includes(P[i].id)) P.splice(i,1);
const byId = id => P.find(p=>p.id===id);
const urlOf = p => LINKS[p.id]||p.url||'';
// Ключ оголошення: ID з посилання (Otodom …-ID4DP5H, Morizon …-mzn2048168273), інакше нормалізований URL без query/hash.
function urlKey(raw){
  let u; try{u=new URL(String(raw||'').trim())}catch(e){return ''}
  const host=u.hostname.toLowerCase().replace(/^www\./,'');
  const m=u.pathname.match(/-(ID[0-9A-Za-z]+|mzn\d+)\/?$/);
  return m?host+'#'+m[1].toLowerCase():host+u.pathname.replace(/\/+$/,'').toLowerCase();
}
function findDup(url,exceptId){
  const k=urlKey(url); if(!k)return null;
  return ALL.find(p=>p.id!==exceptId&&urlKey(urlOf(p))===k)||null;
}
function dupMsg(p){return t(P.includes(p)?'dup.found':'dup.hidden',{n:nm(p)})}

// ---------- СТАН ДЛЯ СИНХРОНІЗАЦІЇ ----------
// Налаштування іпотеки (S) зберігаємо локально й у хмарі; решта S (mort, favOnly, metric) — лише UI
const S_KEYS = ['dp','rate','term','comm','czDef','ex','A','B'];
let S_DEF = null;   // типові значення S (до завантаження збереженого)
const sSnap = () => { const o={}; S_KEYS.forEach(k=>o[k]=S[k]); return o; };
function saveS(){
  const j=JSON.stringify(sSnap());
  if(j!==saveS.last){ saveS.last=j; store.set('s',sSnap()); }
}
function cleanS(s){
  const o={}, num=v=>typeof v==='number'&&isFinite(v);
  if(!s||typeof s!=='object')return o;
  ['dp','rate','term','comm','czDef'].forEach(k=>{ if(num(s[k]))o[k]=s[k]; });
  ['A','B'].forEach(k=>{ if(typeof s[k]==='string')o[k]=s[k]; });
  if(s.ex&&typeof s.ex==='object'){
    const e={}; ['extra','lump','lumpM','fee'].forEach(k=>{ if(num(s.ex[k]))e[k]=s.ex[k]; });
    if(s.ex.mode==='term'||s.ex.mode==='pay')e.mode=s.ex.mode;
    o.ex={...(S_DEF||S).ex,...e};
  }
  return o;
}
function loadS(){ S_DEF=JSON.parse(JSON.stringify(sSnap())); Object.assign(S,cleanS(store.get('s',{}))); saveS.last=JSON.stringify(sSnap()); }

// Квартира з хмари: лише очікувані поля й типи (дані можуть прийти від іншого учасника)
function sanitizeFlat(f){
  if(!f||typeof f!=='object'||typeof f.id!=='string'||!/^[\w-]{1,40}$/.test(f.id))return null;
  const price=+f.price, area=+f.area;
  if(!(price>0)||!(area>0))return null;
  const str=(v,d='—')=>v==null||v===''?d:String(v).slice(0,300);
  const numOrNull=v=>v==null||v===''||!isFinite(+v)?null:+v;
  const pair=v=>Array.isArray(v)?[numOrNull(v[0]),numOrNull(v[1])]:[null,null];
  const url=/^https?:\/\//i.test(f.url||'')?String(f.url).slice(0,500):'';
  const dev=f.dev===true, agency=f.agency===true;
  return {
    id:f.id, user:true, own:OWN_KEYS.includes(f.own)?f.own:'unknown',
    name:str(f.name,f.id), loc:str(f.loc,''), dist:str(f.dist), price, area,
    rooms:str(f.rooms), floor:str(f.floor), year:str(f.year), ready:f.ready===true,
    cond:str(f.cond,''), seller:str(f.seller,''), agency, dev, czynsz:numOrNull(f.czynsz),
    reno:pair(f.reno).map(v=>v||0), rent:pair(f.rent), metro:'—', feat:str(f.feat), url
  };
}
const stripFlat = u => { const c={...u}; delete c.ppm; delete c.rentMid; return c; };

function rebuildFlats(){
  ALL.length=0; BASE.forEach(p=>ALL.push(p)); USER.forEach(u=>ALL.push(prep(u)));
  P.length=0; ALL.forEach(p=>{ if(!HIDDEN.includes(p.id))P.push(p); });
  fixAB();
}
function fixAB(){
  if(!byId(S.A))S.A=(P.find(x=>x.id!==S.B)||P[0]).id;
  if(!byId(S.B))S.B=(P.find(x=>x.id!==S.A)||P[0]).id;
}

// Знімок усього, що синхронізується (формат збігається з рядком workspaces)
function localSnapshot(){
  return {user:USER.map(stripFlat), hidden:[...HIDDEN], fav:[...FAV], czovr:CZOVR, ownsel:OWNSEL, owncfg:OWNCFG, links:LINKS, s:sSnap()};
}
const hasLocalData = () => USER.length||HIDDEN.length||FAV.size||Object.keys(CZOVR).length||Object.keys(OWNSEL).length||Object.keys(OWNCFG).length||Object.keys(LINKS).length||store.get('s',null)!==null;

// Застосовує знімок (з хмари чи з резервної копії) до глобального стану й локального сховища.
// skip — ключі, які не чіпаємо (там є ще не відправлені локальні зміни).
function applySnapshot(sn,skip=new Set()){
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  const strs=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'):[];
  if(!skip.has('user')){ USER=(Array.isArray(sn.user)?sn.user:[]).map(sanitizeFlat).filter(Boolean); store.set('user',USER); }
  if(!skip.has('hidden')){ HIDDEN=strs(sn.hidden); store.set('hidden',HIDDEN); }
  if(!skip.has('fav')){ FAV.clear(); strs(sn.fav).forEach(x=>FAV.add(x)); store.set('fav',[...FAV]); }
  if(!skip.has('czovr')){ CZOVR={}; Object.entries(obj(sn.czovr)).forEach(([k,v])=>{ if(typeof v==='number'&&isFinite(v))CZOVR[k]=v; }); store.set('czovr',CZOVR); }
  if(!skip.has('ownsel')){ OWNSEL={}; Object.entries(obj(sn.ownsel)).forEach(([k,v])=>{ if(OWN_KEYS.includes(v))OWNSEL[k]=v; }); store.set('ownsel',OWNSEL); }
  if(!skip.has('owncfg')){ OWNCFG={}; Object.entries(obj(sn.owncfg)).forEach(([k,v])=>{ if(OWN_KEYS.includes(k)){ const o=obj(v), c={}; ['cost','prem'].forEach(f=>{ if(typeof o[f]==='number'&&isFinite(o[f]))c[f]=o[f]; }); OWNCFG[k]=c; } }); store.set('owncfg',OWNCFG); }
  if(!skip.has('links')){ LINKS={}; Object.entries(obj(sn.links)).forEach(([k,v])=>{ if(typeof v==='string'&&/^https?:\/\//i.test(v))LINKS[k]=v.slice(0,500); }); store.set('links',LINKS); }
  rebuildFlats();
  if(!skip.has('s')){
    Object.assign(S,JSON.parse(JSON.stringify(S_DEF)),cleanS(sn.s));   // немає в хмарі → типові значення
    fixAB(); saveS.last=JSON.stringify(sSnap()); store.set('s',sSnap());
  }
}
// Прибрати квартиру локально (відкат, якщо хмара відхилила додавання)
function dropLocalFlat(id){
  USER=USER.filter(u=>u.id!==id); store.set('user',USER);
  rebuildFlats(); renderPickers(); renderKpis(); update();
}
