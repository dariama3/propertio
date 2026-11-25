// ---------- КОМПОНЕНТ ШАПКИ ----------
// Лише розмітка. Поведінка підключається окремими модулями за id елементів:
//   js/lang-menu.js  → #langSel (меню мови)
//   js/account.js    → #acct (вхід, список, шеринг, тариф, меню користувача, індикатор синхронізації)
// Використання: <div id="topbar" data-account></div> (data-account — показати блок акаунта)
const Header = (() => {
  const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 830" aria-hidden="true"><g class="ln" stroke-width="40" stroke-linejoin="miter"><polygon fill="#E09132" points="55,805 48,290 640,38 640,125 345,295 347,802"/><polygon fill="#375EEB" points="432,35 1027,290 1020,805 730,800 735,295 432,165"/></g></svg>`;

  const brand = () => `
    <a class="brand" href="./" aria-label="Propertio">
      <span class="brand-logo">${LOGO}</span>
      <span class="brand-name">Propertio</span>
    </a>`;

  const userMenu = () => `
    <div class="umenu" id="acMenu" hidden>
      <button type="button" class="abtn icon" id="acUser" aria-haspopup="menu" aria-expanded="false"><i data-lucide="user"></i><i data-lucide="chevron-down" class="chev"></i></button>
      <div class="upop" id="acPop" role="menu" hidden>
        <div class="uhead"><span class="uemail" id="acEmail"></span><span class="plan" id="acPlan"></span></div>
        <a role="menuitem" href="account.html" data-i18n="cab.title"></a>
        <button type="button" role="menuitem" id="acOut" data-i18n="acc.logout"></button>
      </div>
    </div>`;

  const account = () => `
    <div class="acct" id="acct">
      <span class="sync" id="acSync" hidden></span>
      <button type="button" class="abtn primary" id="acLogin" hidden data-i18n="acc.login"></button>
      <select id="wsSel" aria-label="List" hidden></select>
      ${userMenu()}
      <button type="button" class="abtn icon" id="acShare" hidden><i data-lucide="share-2"></i></button>
      <button type="button" class="abtn primary" id="acUpgrade" hidden data-i18n="acc.upgrade"></button>
    </div>`;

  const langSelect = () => `
    <select id="langSel" aria-label="Language">
      <option value="uk">UA</option><option value="pl">PL</option><option value="en">EN</option>
    </select>`;

  const template = ({account: withAccount}) => `
    <div class="topbar">${brand()}
      <div class="langbar">${withAccount ? account() : ''}${langSelect()}</div>
    </div>`;

  function mount(el){ el.innerHTML = template({account: el.hasAttribute('data-account')}); }

  const host = document.getElementById('topbar');
  if(host)mount(host);
  return {mount};
})();
