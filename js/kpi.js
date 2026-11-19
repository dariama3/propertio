// ---------- KPI ----------
function renderKpis(){
  const min=(k)=>P.reduce((a,b)=>a[k]<b[k]?a:b), max=(k)=>P.reduce((a,b)=>a[k]>b[k]?a:b);
  const cheap=min('price'), ppm=min('ppm'), big=max('area');
  const avg=P.reduce((s,p)=>s+p.ppm,0)/P.length;
  const ready=P.filter(p=>p.ready).length;
  $('#kpis').innerHTML = [
   [t('kpi.cheap'), zl(cheap.price), nm(cheap)],
   [t('kpi.ppm'), zl(ppm.ppm)+'/'+t('m2'), nm(ppm)],
   [t('kpi.big'), dec(big.area,0,2)+' '+t('m2'), nm(big)],
   [t('kpi.avg'), zl(avg)+'/'+t('m2'), t('kpi.state',{r:ready,n:P.length-ready})],
  ].map(([l,v,s])=>`<div class="card kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${esc(s)}</div></div>`).join('');
}
