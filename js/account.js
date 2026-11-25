// ---------- АКАУНТ: вхід, списки, спільний доступ, тариф ----------
const Account = (() => {
  const $id = id => document.getElementById(id);
  const SYNC_ICONS = {synced: 'cloud-check', error: 'cloud-exclamation-point', syncing: 'cloud-sync'};
  const icons = () => window.lucide?.createIcons();
  let st = Cloud.state(), prevSync, syncTimer;
  const showM = d => { if(!d.open)d.showModal(); };

  function render(){
    st = Cloud.state();
    const on = !!st.user;
    $id('acLogin').hidden = on;
    $id('wsSel').hidden = !on || st.workspaces.length < 2;
    $id('acMenu').hidden = !on;
    if(!on)setMenu(false);
    $id('acEmail').textContent = st.user?.email || '';
    $id('acUser').title = $id('acUser').ariaLabel = st.user?.email || '';
    $id('acShare').hidden = !on;
    $id('acShare').title = $id('acShare').ariaLabel = t('acc.share');
    $id('acPlan').hidden = !on;
    $id('acUpgrade').hidden = !on || st.isPro;
    if(!on){ if(st.pendingInvite && !$id('dlgLogin').open && !sessionStorage.getItem('propertio.invShown')){ sessionStorage.setItem('propertio.invShown','1'); openLogin('acc.login.invite'); } return; }
    $id('wsSel').innerHTML = st.workspaces.map(w=>`<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('');
    if(st.ws)$id('wsSel').value = st.ws.id;
    const pro = st.isPro;
    $id('acPlan').textContent = pro ? 'PRO' : 'FREE'; $id('acPlan').className = 'plan' + (pro ? ' pro' : '');
    // індикатор лише під час збереження: «синхронізація» → «збережено» ще на 2,5 с; помилка лишається
    const el = $id('acSync'), s = st.status;
    const k = s === 'guest' ? null : s === 'synced' ? 'synced' : s === 'error' ? 'error' : 'syncing';
    if(k !== prevSync){
      prevSync = k; clearTimeout(syncTimer);
      el.hidden = !k;
      if(k){
        el.innerHTML = `<i data-lucide="${SYNC_ICONS[k]}"></i>`; icons();
        el.title = el.ariaLabel = t('sync.' + k); el.className = 'sync ' + k;
        if(k === 'synced')syncTimer = setTimeout(() => { el.hidden = true; }, 2500);
      }
    }
    if(st.user && $id('dlgLogin').open)$id('dlgLogin').close();
    if($id('dlgShare').open)renderShare();
    if($id('dlgPlan').open)renderPlan();
  }

  // ----- меню користувача -----
  function setMenu(open){ $id('acPop').hidden = !open; $id('acUser').setAttribute('aria-expanded', open); }
  $id('acUser').onclick = e => { e.stopPropagation(); setMenu($id('acPop').hidden); };
  document.addEventListener('click', e => { if(!$id('acPop').contains(e.target))setMenu(false); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape')setMenu(false); });

  // ----- вхід -----
  function openLogin(noteKey){
    const n = $id('dlgLoginNote'); n.hidden = !noteKey; n.textContent = noteKey ? t(noteKey) : '';
    $id('lgMsg').textContent = ''; showM($id('dlgLogin'));
  }
  $id('acLogin').onclick = () => openLogin();
  $id('lgGoogle').onclick = () => Cloud.signInGoogle();
  $id('lgForm').onsubmit = async e => {
    e.preventDefault();
    const msg = $id('lgMsg'); msg.className = 'msg'; msg.textContent = t('f.loading');
    const {error} = await Cloud.signInEmail($id('lgEmail').value.trim());
    msg.className = 'msg ' + (error ? 'err' : 'ok'); msg.textContent = error ? t('err.sync') : t('acc.magic.sent');
  };
  $id('acOut').onclick = () => Cloud.signOut();
  $id('wsSel').onchange = e => Cloud.switchWorkspace(e.target.value);

  // ----- спільний доступ -----
  const inviteLink = () => location.origin + location.pathname + '?invite=' + st.ws.invite_code;
  async function renderShare(){
    st = Cloud.state(); if(!st.ws)return;
    const body = $id('shBody'), isOwner = st.ws.owner_id === st.user.id;
    let mem = []; try{ mem = await Cloud.members(); }catch(e){}
    let h = '';
    if(st.ownerPro){
      h += `<h4>${t('acc.share.link')}</h4><div class="shrow"><input id="shLink" readonly value="${esc(inviteLink())}"><button class="abtn" id="shCopy">${t('acc.share.copy')}</button></div>`;
    } else {
      h += `<p class="dnote">${t('acc.share.pro')}</p>`;
    }
    h += `<h4>${t('acc.share.members')}</h4>` + mem.map(m => {
      const me = m.id === st.user.id;
      return `<div class="mem"><span>${esc(m.email)}${me ? ` <small>(${t('acc.share.you')})</small>` : ''} <small>· ${t('role.' + m.role)}</small></span>` +
        (isOwner && m.role !== 'owner' ? `<button class="abtn danger" data-rm="${esc(m.id)}" data-em="${esc(m.email)}">${t('acc.share.remove')}</button>` : '') + '</div>';
    }).join('');
    h += '<div class="dacts">';
    if(isOwner && st.ownerPro)h += `<button class="abtn" id="shRenew">${t('acc.share.renew')}</button>`;
    if(isOwner && st.isPro)h += `<button class="abtn" id="shNew">${t('acc.share.new')}</button>`;
    if(isOwner && st.workspaces.filter(w => w.owner_id === st.user.id).length > 1)h += `<button class="abtn danger" id="shDel">${t('acc.share.del')}</button>`;
    if(!isOwner)h += `<button class="abtn danger" id="shLeave">${t('acc.share.leave')}</button>`;
    h += '</div><p class="msg" id="shMsg" role="status"></p>';
    body.innerHTML = h;
    const err = r => { if(!r.ok)$id('shMsg').textContent = t(r.err, {n: r.limit}); };
    const copy = $id('shCopy');
    if(copy)copy.onclick = async () => {
      $id('shLink').select();
      try{ await navigator.clipboard.writeText(inviteLink()); }catch(e){ document.execCommand('copy'); }
      copy.textContent = t('acc.share.copied'); setTimeout(() => copy.textContent = t('acc.share.copy'), 1500);
    };
    body.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => {
      if(!confirm(t('acc.share.rmq', {n: b.dataset.em})))return;
      const r = await Cloud.removeMember(b.dataset.rm); r.ok ? renderShare() : err(r);
    });
    const on = (id, f) => { const e = $id(id); if(e)e.onclick = f; };
    on('shRenew', async () => { const r = await Cloud.renewInvite(); r.ok ? renderShare() : err(r); });
    on('shNew', async () => {
      const n = prompt(t('acc.share.newname')); if(!n)return;
      const r = await Cloud.createWorkspace(n); r.ok ? renderShare() : err(r);
    });
    on('shDel', async () => {
      if(!confirm(t('acc.share.delq', {n: st.ws.name})))return;
      const r = await Cloud.deleteWorkspace(); r.ok ? renderShare() : err(r);
    });
    on('shLeave', async () => {
      if(!confirm(t('acc.share.leaveq', {n: st.ws.name})))return;
      const r = await Cloud.leave(); r.ok ? $id('dlgShare').close() : err(r);
    });
  }
  $id('acShare').onclick = () => { showM($id('dlgShare')); renderShare(); };

  // ----- тариф та оплата -----
  function checkout(){
    if(!st.checkoutUrl)return null;
    const u = new URL(st.checkoutUrl);
    u.searchParams.set('checkout[custom][user_id]', st.user.id);
    if(st.user.email)u.searchParams.set('checkout[email]', st.user.email);
    return u.toString();
  }
  function renderPlan(note){
    st = Cloud.state();
    const n = $id('plNote'); if(note !== undefined){ n.hidden = !note; n.textContent = note || ''; }
    document.querySelectorAll('#dlgPlan [data-i18n="acc.plan.f2"]').forEach(e => e.textContent = t('acc.plan.f2', {n: st.freeLimit}));
    const act = $id('plAct'), url = st.user && !st.isPro ? checkout() : null;
    act.innerHTML = !st.user ? `<button class="abtn big primary" id="plLogin">${t('acc.login')}</button>`
      : st.isPro ? `<p class="dnote">${t('acc.plan.cur')}: PRO</p>`
      : url ? `<a class="abtn big primary" style="display:block;text-align:center;text-decoration:none" href="${esc(url)}">${t('acc.plan.buy')}</a>`
      : `<p class="dnote">${t('acc.plan.nocheckout')}</p>`;
    const l = $id('plLogin'); if(l)l.onclick = () => { $id('dlgPlan').close(); openLogin(); };
  }
  $id('acUpgrade').onclick = () => { showM($id('dlgPlan')); renderPlan(''); };

  // викликається з автозаповнення, коли сервер відмовив
  function upsell(code){
    if(code === 'auth_required' || !st.user)return openLogin('acc.login.need');
    showM($id('dlgPlan')); renderPlan(t('err.pro_required'));
  }

  // закриття модалки кліком по фону
  document.querySelectorAll('.dlg').forEach(d => d.addEventListener('click', e => { if(e.target === d)d.close(); }));
  Cloud.onChange(render); render(); icons();
  return {upsell, render};
})();
