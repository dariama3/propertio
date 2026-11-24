// ---------- КАБІНЕТ КОРИСТУВАЧА (account.html) ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sb, cfg, user, profile, lists = [], members = {}, msg = '';

const errKey = e => { const k = String(e?.message || e || '').match(/err\.[a-z_]+/); return k ? k[0] : (navigator.onLine ? 'err.sync' : 'err.offline'); };
const rpc = async (name, args) => { const {data, error} = await sb.rpc(name, args); if(error)throw error; return data; };
const inviteLink = code => location.origin + location.pathname.replace(/[^/]*$/, '') + '?invite=' + code;

async function load(){
  const [{data: p}, {data: m, error}] = await Promise.all([
    sb.from('profiles').select('email,is_pro,subscription_status').eq('id', user.id).maybeSingle(),
    sb.from('workspace_members').select('role, workspaces(id,name,owner_id,invite_code,flats)').eq('user_id', user.id),
  ]);
  if(error)throw error;
  profile = p;
  lists = (m || []).filter(r => r.workspaces).map(r => ({...r.workspaces, role: r.role, n: (r.workspaces.flats || []).length}))
    .sort((a, b) => (b.owner_id === user.id) - (a.owner_id === user.id));
  members = {};
  if(lists.length){
    const {data} = await sb.from('workspace_members').select('workspace_id, user_id, role, profiles(email)').in('workspace_id', lists.map(l => l.id)).order('joined_at');
    (data || []).forEach(r => (members[r.workspace_id] ||= []).push({id: r.user_id, role: r.role, email: r.profiles?.email || ''}));
  }
}

function checkoutHref(){
  if(!cfg.checkoutUrl)return null;
  const u = new URL(cfg.checkoutUrl);
  u.searchParams.set('checkout[custom][user_id]', user.id);
  if(user.email)u.searchParams.set('checkout[email]', user.email);
  return u.toString();
}

function viewGuest(){
  $('#cab').innerHTML = `<section class="card" style="max-width:440px;margin:24px auto">
    <h2 style="margin-top:0">${t('acc.login.title')}</h2>
    <button class="abtn big" id="gG">${t('acc.google')}</button>
    <div class="dsep"><span>${t('acc.or')}</span></div>
    <form id="gF" class="dform"><input type="email" id="gE" required autocomplete="email" placeholder="email@example.com"><button class="abtn big primary">${t('acc.magic')}</button></form>
    <p class="msg" id="gM"></p></section>`;
  const back = location.origin + location.pathname;
  $('#gG').onclick = () => sb.auth.signInWithOAuth({provider: 'google', options: {redirectTo: back}});
  $('#gF').onsubmit = async e => {
    e.preventDefault();
    const {error} = await sb.auth.signInWithOtp({email: $('#gE').value.trim(), options: {emailRedirectTo: back}});
    $('#gM').className = 'msg ' + (error ? 'err' : 'ok'); $('#gM').textContent = error ? t('err.sync') : t('acc.magic.sent');
  };
}

function listCard(l){
  const own = l.owner_id === user.id, mem = members[l.id] || [], canShare = own && profile?.is_pro;
  const ownedCount = lists.filter(x => x.owner_id === user.id).length;
  return `<div class="card lst" data-id="${esc(l.id)}">
    <div class="lhead"><div><b>${esc(l.name)}</b> <small class="muted">· ${t('role.' + l.role)} · ${t('cab.flats', {n: l.n})}</small></div>
      <button class="abtn primary" data-a="open">${t('cab.open')}</button></div>
    ${canShare ? `<div class="shrow"><input readonly value="${esc(inviteLink(l.invite_code))}"><button class="abtn" data-a="copy">${t('acc.share.copy')}</button></div>` : ''}
    <h4>${t('acc.share.members')}</h4>
    ${mem.map(m => `<div class="mem"><span>${esc(m.email)}${m.id === user.id ? ` <small>(${t('acc.share.you')})</small>` : ''} <small>· ${t('role.' + m.role)}</small></span>${own && m.role !== 'owner' ? `<button class="abtn danger" data-a="rm" data-u="${esc(m.id)}" data-e="${esc(m.email)}">${t('acc.share.remove')}</button>` : ''}</div>`).join('')}
    <div class="dacts">
      ${own ? `<button class="abtn" data-a="rename">${t('cab.rename')}</button>` : ''}
      ${canShare ? `<button class="abtn" data-a="renew">${t('acc.share.renew')}</button>` : ''}
      ${own && ownedCount > 1 ? `<button class="abtn danger" data-a="del">${t('acc.share.del')}</button>` : ''}
      ${!own ? `<button class="abtn danger" data-a="leave">${t('acc.share.leave')}</button>` : ''}
    </div></div>`;
}

function viewUser(){
  const pro = !!profile?.is_pro, st = profile?.subscription_status || 'free', href = pro ? null : checkoutHref();
  $('#cab').innerHTML = `
  <p><a href="./" class="muted">${t('cab.back')}</a></p>
  <h1 style="margin:0 0 14px">${t('cab.title')}</h1>
  <section class="card"><h4 style="margin-top:0">${t('cab.profile')}</h4>
    <div class="mem"><span class="muted">${t('cab.email')}</span><span>${esc(user.email)}</span></div>
    <div class="mem"><span class="muted">${t('cab.plan')}</span><span class="plan${pro ? ' pro' : ''}">${pro ? 'PRO' : 'FREE'}</span></div>
    <div class="mem"><span class="muted">${t('cab.status')}</span><span>${t('cab.st.' + st)}</span></div>
    <div class="dacts">${pro ? '' : href ? `<a class="abtn primary" style="text-decoration:none" href="${esc(href)}">${t('acc.plan.buy')}</a>` : `<span class="muted">${t('acc.plan.nocheckout')}</span>`}
      <button class="abtn" id="cOut">${t('acc.logout')}</button></div></section>
  <h2>${t('cab.lists')}</h2>
  ${lists.map(listCard).join('')}
  ${pro ? `<button class="abtn" id="cNew">${t('acc.share.new')}</button>` : ''}
  <p class="msg err" id="cMsg" role="status">${esc(msg)}</p>`;
  $('#cOut').onclick = async () => { await sb.auth.signOut(); location.href = './'; };
  const nw = $('#cNew'); if(nw)nw.onclick = () => act(async () => { const n = prompt(t('acc.share.newname')); if(n)await rpc('create_workspace', {p_name: n}); });
  document.querySelectorAll('.lst [data-a]').forEach(b => b.onclick = () => onAction(b, lists.find(x => x.id === b.closest('.lst').dataset.id)));
}

async function act(fn){
  msg = '';
  try{ await fn(); await load(); }catch(e){ console.warn(e); msg = t(errKey(e)); }
  viewUser();
}
function onAction(b, l){
  const a = b.dataset.a;
  if(a === 'open'){ try{ localStorage.setItem('propertio.ws', l.id); }catch(e){} location.href = './'; }
  else if(a === 'copy'){ navigator.clipboard?.writeText(b.previousElementSibling.value); b.textContent = t('acc.share.copied'); setTimeout(() => b.textContent = t('acc.share.copy'), 1500); }
  else if(a === 'rename'){ const n = prompt(t('cab.rename'), l.name); if(n && n.trim())act(async () => { const {error} = await sb.from('workspaces').update({name: n.trim().slice(0, 80)}).eq('id', l.id); if(error)throw error; }); }
  else if(a === 'renew')act(() => rpc('regenerate_invite_code', {p_workspace_id: l.id}));
  else if(a === 'rm'){ if(confirm(t('acc.share.rmq', {n: b.dataset.e})))act(async () => { const {error} = await sb.from('workspace_members').delete().eq('workspace_id', l.id).eq('user_id', b.dataset.u); if(error)throw error; }); }
  else if(a === 'leave'){ if(confirm(t('acc.share.leaveq', {n: l.name})))act(async () => { const {error} = await sb.from('workspace_members').delete().eq('workspace_id', l.id).eq('user_id', user.id); if(error)throw error; }); }
  else if(a === 'del'){ if(confirm(t('acc.share.delq', {n: l.name})))act(() => rpc('delete_workspace', {p_workspace_id: l.id})); }
}

function render(){
  document.documentElement.lang = LANG; document.title = 'Propertio · ' + t('cab.title'); $('#langSel').value = LANG;
  if(!sb)$('#cab').innerHTML = `<p class="msg err">${t('err.server_config')}</p>`;
  else user ? viewUser() : viewGuest();
}
$('#langSel').onchange = e => { LANG = e.target.value; try{ localStorage.setItem('propertio.lang', LANG); }catch(_){} render(); };

(async () => {
  try{
    const r = await fetch('api/config'); if(!r.ok)throw 0;
    cfg = await r.json(); sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const {data} = await sb.auth.getSession(); user = data.session?.user || null;
    if(user)await load();
    sb.auth.onAuthStateChange((ev, s) => { if(ev === 'SIGNED_OUT' && user){ user = null; render(); } });
  }catch(e){ console.warn(e); if(!cfg)sb = null; else msg = t(errKey(e)); }
  render();
})();
