// ---------- ПЕРЕМИКАЧ МОВИ: випадаюче меню замість <select> ----------
// Нативний #langSel лишається прихованим джерелом істини (його читають app.js і cabinet.js).
(() => {
  const sel = document.getElementById('langSel');
  if(!sel)return;
  const NAMES = {uk: ['UA', 'Українська'], pl: ['PL', 'Polski'], en: ['EN', 'English']};
  const menu = document.createElement('div'); menu.className = 'umenu';
  menu.innerHTML = `<button type="button" class="abtn icon" id="langBtn" aria-haspopup="menu" aria-expanded="false" aria-label="Language"><span id="langCur"></span><i data-lucide="chevron-down" class="chev"></i></button>
    <div class="upop" id="langPop" role="menu" hidden>${Object.entries(NAMES).map(([k, [c, n]]) => `<button type="button" role="menuitemradio" data-l="${k}">${c} · ${n}</button>`).join('')}</div>`;
  sel.hidden = true; sel.after(menu);
  const btn = menu.querySelector('#langBtn'), pop = menu.querySelector('#langPop');
  const sync = () => {
    menu.querySelector('#langCur').textContent = NAMES[LANG][0];
    pop.querySelectorAll('[data-l]').forEach(b => b.setAttribute('aria-checked', b.dataset.l === LANG));
  };
  const open = v => { pop.hidden = !v; btn.setAttribute('aria-expanded', v); if(v)sync(); };
  btn.onclick = () => open(pop.hidden);
  pop.onclick = e => {
    const b = e.target.closest('[data-l]'); if(!b)return;
    open(false); sel.value = b.dataset.l; sel.dispatchEvent(new Event('change')); sync();
  };
  document.addEventListener('click', e => { if(!menu.contains(e.target))open(false); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape')open(false); });
  sync(); window.lucide?.createIcons();
})();
