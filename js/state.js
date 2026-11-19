// значення поля квартири у поточній мові (для доданих вручну — те, що ввів користувач)
function fld(p,k){
  if(p.user){
    if(k==='cond')return t(p.ready?'cond.ready':'cond.reno');
    if(k==='seller')return t(p.agency?'seller.agency':'seller.owner');
    return p[k];
  }
  return LANG==='uk' ? p[k] : (D[p.id]?.[LANG]?.[k] ?? p[k]);
}
const nm = p => fld(p,'name');
const store = {
  get(k,d){try{return JSON.parse(localStorage.getItem('propertio.'+k))??d}catch(e){return d}},
  set(k,v){try{localStorage.setItem('propertio.'+k,JSON.stringify(v))}catch(e){}}
};
let LINKS = store.get('links',{});
let USER = store.get('user',[]);
let CZOVR = store.get('czovr',{});
let CMPCOL = store.get('cmpcol',[]);
function prep(p){p.ppm=p.price/p.area; p.rentMid=(p.rent&&p.rent[0]!=null&&p.rent[1]!=null)?(p.rent[0]+p.rent[1])/2:null; return p}
P.forEach(prep);
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
