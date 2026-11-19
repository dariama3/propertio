// ---------- ПАРАМЕТРИ ----------
function initSettings(){
  $('#dp').innerHTML=[10,15,20,25,30,40,50].map(v=>`<option value="${v}" ${v===S.dp?'selected':''}>${v}%</option>`).join('');
  $('#term').innerHTML=[10,15,20,25,30,35].map(v=>`<option value="${v}" ${v===S.term?'selected':''}>${v}</option>`).join('');
  $('#czdef').innerHTML=CZ_OPTS.map(v=>`<option value="${v}" ${v===S.czDef?'selected':''}>${v?v+' zł':t('czdef.off')}</option>`).join('');
  $('#czdef').onchange=e=>{S.czDef=+e.target.value;update()};
  $('#comm').innerHTML=[0,1,2,2.5,3].map(v=>`<option value="${v}" ${v===S.comm?'selected':''}>${dec(v,0,2)}%</option>`).join('');
  $('#rateR').value=S.rate; $('#rateN').value=S.rate;
  $('#dp').onchange=e=>{S.dp=+e.target.value;update()};
  $('#term').onchange=e=>{S.term=+e.target.value;update()};
  $('#comm').onchange=e=>{S.comm=+e.target.value;update()};
  $('#rateR').oninput=e=>{S.rate=+e.target.value;$('#rateN').value=S.rate;update()};
  $('#rateN').oninput=e=>{const v=parseFloat(e.target.value);if(!isNaN(v)){S.rate=v;$('#rateR').value=v;update()}};
}
