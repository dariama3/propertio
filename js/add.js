const F = id => $('#'+id);
const setMsg=(el,text,c)=>{el.textContent=text||'';el.className='msg '+(c||'')};
async function fetchOtodom(){
  const url=F('f_url').value.trim();
  if(!url){setMsg(F('fmsg'),t('f.err.url'),'err');return}
  setMsg(F('fmsg'),t('f.loading'));
  try{
    const tok=await Cloud.token(), ws=Cloud.wsId();
    const r=await fetch('api/fetch?url='+encodeURIComponent(url)+(ws?'&ws='+ws:''),{headers:tok?{Authorization:'Bearer '+tok}:{}});
    let d; try{d=await r.json()}catch(_){throw new Error(t('err.noapi'))}
    if(d.code==='pro_required'||d.code==='auth_required')Account.upsell(d.code);
    if(!r.ok||d.error)throw new Error(d.code?t('err.'+d.code,{s:d.status}):(d.error||t('f.err.generic')));
    const dup=findDup(d.url||url); if(dup){setMsg(F('fmsg'),dupMsg(dup),'err');return}
    const set=(id,v)=>{if(v!=null&&v!=='')F(id).value=v};
    const name=d.loc&&d.rooms?`${d.name} (${d.rooms}${t('rooms.sfx')})`:d.name;
    set('f_url',d.url||url); set('f_name',name); set('f_price',d.price); set('f_area',d.area);
    set('f_rooms',d.rooms); set('f_floor',d.floor); set('f_year',d.year); set('f_dist',d.dist);
    set('f_czynsz',d.czynsz); set('f_feat',(d.extras||[]).map(k=>t('x.'+k)).join(', '));
    if(d.own)F('f_own').value=d.own;
    F('f_ready').value=d.ready?'1':'0'; F('f_agency').value=d.dev?'dev':d.agency?'1':'0';
    setMsg(F('fmsg'),t('f.ok.fetch'),'ok');
  }catch(e){
    setMsg(F('fmsg'),(location.protocol==='file:'?t('f.err.file'):'')+t('f.err.fail',{e:e.message}),'err');
  }
}
function addFlat(){
  const price=parseFloat(F('f_price').value), area=parseFloat(F('f_area').value);
  if(!(price>0)||!(area>0)){setMsg(F('amsg'),t('f.err.need'),'err');return}
  const n=v=>{const x=parseFloat(F(v).value);return isNaN(x)?null:x};
  const sellerType=F('f_agency').value, agency=sellerType==='1', dev=sellerType==='dev', url=F('f_url').value.trim();
  const dup=url&&findDup(url); if(dup){setMsg(F('amsg'),dupMsg(dup),'err');return}
  const can=Cloud.canAddFlat(); if(!can.ok){setMsg(F('amsg'),t(can.err,{n:can.limit}),'err');return}
  const rmin=n('f_rmin')||0, rmax=n('f_rmax')||rmin;
  const u={
    id:'u'+Date.now().toString(36), user:true, own:F('f_own').value,
    name:F('f_name').value.trim()||t('f.defname',{p:fmt(price)}),
    loc:F('f_name').value.trim(), dist:F('f_dist').value.trim()||'—',
    price, area, rooms:F('f_rooms').value.trim()||'—', floor:F('f_floor').value.trim()||'—',
    year:F('f_year').value.trim()||'—', ready:F('f_ready').value==='1',
    cond:t(F('f_ready').value==='1'?'cond.ready':'cond.reno'),
    seller:t(dev?'seller.dev':agency?'seller.agency':'seller.owner'), agency, dev, czynsz:n('f_czynsz'),
    reno:[rmin,rmax], rent:[n('f_ormin'),n('f_ormax')||n('f_ormin')],
    metro:'—', feat:F('f_feat').value.trim()||'—', url
  };
  USER.push(u); store.set('user',USER); P.push(prep(u)); ALL.push(u);
  Cloud.upsertFlat(u).then(r=>{ if(!r.ok){ dropLocalFlat(u.id); setMsg(F('amsg'),t(r.err,{n:r.limit}),'err'); } });
  S.B=S.A; S.A=u.id; nextSlot='B';
  renderPickers(); renderKpis();
  F('f_own').value='unknown'; ['f_url','f_name','f_price','f_area','f_rooms','f_floor','f_year','f_dist','f_czynsz','f_feat','f_ormin','f_ormax'].forEach(i=>F(i).value='');
  F('f_rmin').value=0;F('f_rmax').value=0; setMsg(F('fmsg'),'');
  setMsg(F('amsg'),t('f.ok.added'),'ok');
  update(); $('#cmp').scrollIntoView({behavior:'smooth'});
}
$('#btnFetch').onclick=fetchOtodom; $('#btnAdd').onclick=addFlat;
F('f_url').addEventListener('keydown',e=>{if(e.key==='Enter')fetchOtodom()});
