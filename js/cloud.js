// ---------- ХМАРНА СИНХРОНІЗАЦІЯ (Supabase) ----------
// Local-first: сторінка одразу малюється з localStorage; хмара підтягується після входу.
// localStorage віддзеркалює активний список (workspace), тому офлайн-старт показує останній стан.
const Cloud = (() => {
  const FREE_LIMIT = 10;
  const SETTING_KEYS = ['s','fav','czovr','ownsel','owncfg','links'];   // ключі store → settings у хмарі
  const LS = {
    get:k=>{ try{return localStorage.getItem('propertio.'+k)}catch(e){return null} },
    set:(k,v)=>{ try{localStorage.setItem('propertio.'+k,v)}catch(e){} },
    del:k=>{ try{localStorage.removeItem('propertio.'+k)}catch(e){} },
  };

  let sb=null, user=null, profile=null, ownerPro=false, workspaces=[], ws=null;
  let status='guest', lastError=null;          // guest | syncing | synced | error
  let channel=null, profChannel=null, channelDown=false;
  let applying=false;                          // true, поки застосовуємо дані з хмари (не відправляти їх назад)
  let queue=Promise.resolve(), inflight=0, writeSeq=0, buffered=false, fetchTimer=null;
  const pendingKeys=new Set(); let settingsTimer=null, retryTimer=null;
  const listeners=new Set();

  const canon = v => JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(y=>[y,x[y]])):x);
  const active = () => !!(sb&&user&&ws);
  const state = () => ({status, error:lastError, user:user&&{id:user.id,email:user.email}, profile, ws, workspaces, ownerPro,
    isPro:!!profile?.is_pro, pendingInvite:!!sessionStorage.getItem('propertio.invite'), freeLimit:FREE_LIMIT});
  const emit = () => listeners.forEach(f=>{ try{f(state())}catch(e){console.error(e)} });
  const setStatus = (s,err=null) => { status=s; lastError=err; emit(); };
  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  function errKey(e){
    const m=String(e?.message||e||'');
    const k=m.match(/err\.[a-z_]+/); if(k)return k[0];
    if(e?.code==='PGRST301'||/JWT/i.test(m))return 'err.auth_required';
    if(!navigator.onLine||/fetch|network|load failed/i.test(m))return 'err.offline';
    return 'err.sync';
  }
  const fail = e => ({ok:false, err:errKey(e), limit:FREE_LIMIT});

  // ───────── знімок ↔ рядок workspaces ─────────
  const rowToSnap = r => { const st=r.settings||{}; return {user:r.flats,hidden:r.hidden_ids,s:st.s,fav:st.fav,czovr:st.czovr,ownsel:st.ownsel,owncfg:st.owncfg,links:st.links}; };

  function applyRow(row){
    const before=canon(localSnapshot());
    applying=true;
    try{ applySnapshot(rowToSnap(row), new Set(pendingKeys)); }finally{ applying=false; }
    if(canon(localSnapshot())!==before) refreshUI();     // «ехо» власних змін нічого не перемальовує
  }

  // ───────── читання з хмари ─────────
  async function refresh(){
    if(!active())return {ok:false};
    if(inflight){ buffered=true; return {ok:true}; }
    const seq=writeSeq, wid=ws.id;
    const {data,error}=await sb.from('workspaces').select('*').eq('id',wid).maybeSingle();
    if(!active()||ws.id!==wid)return {ok:false};
    if(inflight||seq!==writeSeq){ buffered=true; return {ok:true}; }   // під час читання стартував запис — перечитаємо після нього
    if(error){ setStatus('error',errKey(error)); return {ok:false}; }
    if(!data){ await handleLost(); return {ok:false}; }
    ws={...ws,name:data.name,invite_code:data.invite_code};
    applyRow(data);
    if(status!=='synced')setStatus('synced'); else emit();
    return {ok:true};
  }
  const scheduleRefresh = () => { clearTimeout(fetchTimer); fetchTimer=setTimeout(refresh,150); };

  // ───────── запис (послідовна черга) ─────────
  function write(fn){
    writeSeq++; inflight++;
    const run=queue.then(fn).then(r=>{ buffered=true; return r; });   // після запису звіряємося з хмарою
    queue=run.then(()=>{},()=>{}).then(()=>{ inflight--; if(!inflight&&buffered){ buffered=false; refresh(); } });
    return run.then(()=>({ok:true}),e=>{
      const r=fail(e); console.warn('cloud write failed',e);
      if(r.err!=='err.offline') buffered=true;           // відхилено сервером (ліміт/права) — звіряємося з хмарою
      return r;
    });
  }
  const rpc = async (name,args) => { const {data,error}=await sb.rpc(name,args); if(error)throw error; return data; };


  function upsertFlat(u){
    if(!active())return Promise.resolve({ok:true});
    const wid=ws.id, flat=stripFlat(u);
    return (write(()=>rpc('upsert_flat_in_workspace',{p_workspace_id:wid,p_flat:flat})));
  }
  function removeFlat(id){
    if(!active())return Promise.resolve({ok:true});
    const wid=ws.id;
    return (write(()=>rpc('remove_flat_from_workspace',{p_workspace_id:wid,p_flat_id:id})));
  }
  function setHidden(id,hidden){
    if(!active())return Promise.resolve({ok:true});
    const wid=ws.id;
    return (write(()=>rpc('set_hidden_in_workspace',{p_workspace_id:wid,p_id:id,p_hidden:hidden})));
  }
  function clearHidden(){
    if(!active())return Promise.resolve({ok:true});
    const wid=ws.id;
    return (write(()=>rpc('clear_hidden_in_workspace',{p_workspace_id:wid})));
  }

  // налаштування: локально одразу, у хмару — з debounce 1500 мс (патч лише змінених ключів)
  function queueSetting(k){
    pendingKeys.add(k); clearTimeout(settingsTimer); settingsTimer=setTimeout(flushSettings,1500);
  }
  function flushSettings(){
    clearTimeout(settingsTimer);
    if(!pendingKeys.size||!active())return Promise.resolve({ok:true});
    const keys=[...pendingKeys], wid=ws.id, patch={};
    pendingKeys.clear();
    keys.forEach(k=>patch[k]=store.get(k,k==='fav'?[]:{}));
    return (write(()=>rpc('merge_workspace_settings',{p_workspace_id:wid,p_patch:patch}))).then(r=>{
      if(!r.ok&&r.err==='err.offline'){ keys.forEach(k=>pendingKeys.add(k)); clearTimeout(retryTimer); retryTimer=setTimeout(flushSettings,10000); }
      return r;
    });
  }

  function canAddFlat(){
    if(!active())return {ok:true};
    if(ws.role==='viewer')return {ok:false,err:'err.forbidden'};
    if(!ownerPro&&USER.length>=FREE_LIMIT)return {ok:false,err:'err.limit_flats',limit:FREE_LIMIT};
    return {ok:true};
  }

  // ───────── списки, профіль, Realtime ─────────
  async function loadProfile(){
    const {data}=await sb.from('profiles').select('id,email,is_pro,subscription_status').eq('id',user.id).maybeSingle();
    profile=data||null;
  }
  async function loadWorkspaces(){
    const {data,error}=await sb.from('workspace_members').select('role, workspaces(id,name,owner_id,invite_code)').eq('user_id',user.id);
    if(error)throw error;
    workspaces=(data||[]).filter(r=>r.workspaces).map(r=>({...r.workspaces,role:r.role}))
      .sort((a,b)=>(b.owner_id===user.id)-(a.owner_id===user.id));
  }
  async function loadOwnerPro(){
    if(ws.owner_id===user.id){ ownerPro=!!profile?.is_pro; return; }
    const {data}=await sb.from('profiles').select('is_pro').eq('id',ws.owner_id).maybeSingle();
    ownerPro=!!data?.is_pro;
  }
  function unsubscribe(){
    if(channel){ sb.removeChannel(channel); channel=null; }
  }
  function subscribe(){
    unsubscribe();
    const id=ws.id;
    channel=sb.channel('ws-'+id)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'workspaces',filter:'id=eq.'+id},scheduleRefresh)
      .subscribe(st=>{
        if(st==='SUBSCRIBED'){ if(channelDown){ channelDown=false; scheduleRefresh(); } }
        else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'||st==='CLOSED') channelDown=true;
      });
  }
  function subscribeProfile(){
    if(profChannel)sb.removeChannel(profChannel);
    profChannel=sb.channel('prof-'+user.id)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles',filter:'id=eq.'+user.id},p=>{
        profile={...profile,...p.new};
        if(ws&&ws.owner_id===user.id)ownerPro=!!profile.is_pro;
        emit();
      }).subscribe();
  }
  async function handleLost(){            // список видалено або нас з нього вилучили
    try{ await loadWorkspaces(); }catch(e){ return setStatus('error',errKey(e)); }
    const next=workspaces.find(w=>w.owner_id===user.id)||workspaces[0];
    if(next)await selectWorkspace(next.id);
  }

  // ───────── перше підключення пристрою ─────────
  async function uploadLocal(){
    const wid=ws.id; let limited=false;
    for(const u of USER){
      try{ await rpc('upsert_flat_in_workspace',{p_workspace_id:wid,p_flat:stripFlat(u)}); }
      catch(e){ if(errKey(e)==='err.limit_flats'){ limited=true; break; } throw e; }
    }
    for(const id of HIDDEN)await rpc('set_hidden_in_workspace',{p_workspace_id:wid,p_id:id,p_hidden:true});
    const patch={}; SETTING_KEYS.forEach(k=>patch[k]=store.get(k,k==='fav'?[]:{}));
    await rpc('merge_workspace_settings',{p_workspace_id:wid,p_patch:patch});
    if(limited)alert(t('sync.migrate.limit',{n:FREE_LIMIT}));
  }
  function backupGuest(){ if(hasLocalData()&&!LS.get('guest'))LS.set('guest',JSON.stringify(localSnapshot())); }

  async function selectWorkspace(id){
    const info=workspaces.find(w=>w.id===id)||workspaces[0];
    if(!info)return setStatus('error','err.sync');
    unsubscribe(); clearTimeout(fetchTimer);
    pendingKeys.clear(); clearTimeout(settingsTimer);
    ws=info; LS.set('ws',ws.id);
    setStatus('syncing');
    try{
      await loadOwnerPro();
      const {data:row,error}=await sb.from('workspaces').select('*').eq('id',ws.id).maybeSingle();
      if(error)throw error;
      if(!row)throw new Error('err.sync');
      ws={...ws,name:row.name,invite_code:row.invite_code};
      if(LS.get('mirror')!==user.id){
        // перший вхід на цьому пристрої: локальні дані — гостьові
        if(LS.get('mirror')){ applying=true; try{ applySnapshot({}); }finally{ applying=false; } LS.del('guest'); }   // залишок іншого акаунта — не переносимо
        backupGuest();
        const cloudEmpty=!(row.flats||[]).length&&!(row.hidden_ids||[]).length&&!Object.keys(row.settings||{}).length;
        if(cloudEmpty&&ws.owner_id===user.id&&hasLocalData()&&confirm(t('sync.migrate',{n:USER.length}))){
          await uploadLocal();
          const {data:fresh}=await sb.from('workspaces').select('*').eq('id',ws.id).maybeSingle();
          if(fresh)return finishLoad(fresh);
        }
      }
      finishLoad(row);
    }catch(e){ console.warn(e); setStatus('error',errKey(e)); }
  }
  function finishLoad(row){
    applyRow(row); LS.set('mirror',user.id);
    refreshUI(); subscribe(); setStatus('synced');
  }
  function switchWorkspace(id){ return flushSettings().then(()=>selectWorkspace(id)); }

  // ───────── вхід / вихід / запрошення ─────────
  async function join(code){
    try{
      const wid=await rpc('join_workspace_by_code',{p_invite_code:code});
      await loadWorkspaces(); await selectWorkspace(wid); return {ok:true};
    }catch(e){ return fail(e); }
  }
  async function onSession(session){
    if(user&&user.id===session.user.id){ user=session.user; return; }   // оновлення токена
    user=session.user; setStatus('syncing');
    try{
      await loadProfile(); subscribeProfile(); await loadWorkspaces();
      let pick=LS.get('ws');
      const code=sessionStorage.getItem('propertio.invite');
      if(code){
        sessionStorage.removeItem('propertio.invite');
        const r=await join(code);
        if(r.ok)return;
        alert(t(r.err));
      }
      if(!workspaces.some(w=>w.id===pick))pick=workspaces[0]?.id;
      await selectWorkspace(pick);
    }catch(e){ console.warn(e); setStatus('error',errKey(e)); }
  }
  function resetToGuest(){
    unsubscribe(); if(profChannel){ sb.removeChannel(profChannel); profChannel=null; }
    clearTimeout(settingsTimer); clearTimeout(retryTimer); pendingKeys.clear();
    user=null; profile=null; ws=null; workspaces=[]; ownerPro=false;
    // повертаємо гостьові дані (або чистий стан), щоб чужі дані не лишились у браузері
    let guest={}; try{ guest=JSON.parse(LS.get('guest')||'{}'); }catch(e){}
    applying=true; try{ applySnapshot(guest); }finally{ applying=false; }
    LS.del('guest'); LS.del('mirror'); LS.del('ws');
    refreshUI(); setStatus('guest');
  }
  const onSignedOut = () => { if(user||LS.get('mirror'))resetToGuest(); };
  async function signOut(){
    await flushSettings(); await queue;
    if(sb)await sb.auth.signOut();
  }
  const redirect = () => location.origin+location.pathname;
  const signInGoogle = () => sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect()}});
  const signInEmail = email => sb.auth.signInWithOtp({email,options:{emailRedirectTo:redirect()}});
  async function token(){
    if(!sb)return null;
    const {data}=await sb.auth.getSession();
    return data?.session?.access_token||null;
  }

  // ───────── запуск ─────────
  async function init(){
    // ?invite=<код>: запам'ятати до входу й прибрати з адреси
    const q=new URLSearchParams(location.search), inv=q.get('invite');
    if(inv&&/^[\w-]{4,32}$/.test(inv)){
      sessionStorage.setItem('propertio.invite',inv);
      q.delete('invite');
      history.replaceState(null,'',location.pathname+(q.toString()?'?'+q:'')+location.hash);
    }
    if(!window.supabase)return;                       // CDN недоступний → працюємо як гість
    let cfg; try{ const r=await fetch('api/config'); if(!r.ok)return; cfg=await r.json(); }catch(e){ return; }
    sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);

    store.onSet=k=>{ if(!applying&&active()&&SETTING_KEYS.includes(k))queueSetting(k); };
    sb.auth.onAuthStateChange((ev,session)=>{
      setTimeout(()=>{                                // не викликати supabase усередині колбека
        if(ev==='SIGNED_OUT'||(ev==='INITIAL_SESSION'&&!session))onSignedOut();
        else if(session&&(ev==='INITIAL_SESSION'||ev==='SIGNED_IN'))onSession(session);
      },0);
    });
    document.addEventListener('visibilitychange',()=>{ if(document.hidden)flushSettings(); else if(active())scheduleRefresh(); });
    addEventListener('online',()=>{ flushSettings(); scheduleRefresh(); });
    emit();
  }

  const api = {
    init, state, token, canAddFlat, upsertFlat, removeFlat, setHidden, clearHidden, flushSettings, refresh,
    switchWorkspace, join, signInGoogle, signInEmail, signOut,
    wsId:()=>ws?ws.id:null,
    onChange:f=>{ listeners.add(f); return ()=>listeners.delete(f); },
  };
  return api;
})();
Cloud.init();
