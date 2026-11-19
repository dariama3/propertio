// ---------- УТИЛІТИ ----------
const $ = s => document.querySelector(s);
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Math.round(n).toLocaleString(LOCALES[LANG],{useGrouping:'always'}).replace(/[  ]/g,' ');
const dec = (n,mn=1,mx=mn) => n.toLocaleString(LOCALES[LANG],{minimumFractionDigits:mn,maximumFractionDigits:mx});
const zl = n => fmt(n)+' zł';
const m2 = n => dec(n,1)+' '+t('m2');
