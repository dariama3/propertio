// ---------- навігація по секціях ----------
(function(){
  const nav=$('#secnav'), links=[...nav.querySelectorAll('a')];
  const target=h=>{try{return document.querySelector(h)}catch(e){return null}};
  function go(h,push){
    const el=target(h); if(!el)return;
    if(el.id==='mortBox')el.open=true;
    el.scrollIntoView({behavior:'smooth',block:'start'});
    if(push)try{history.replaceState(null,'',h)}catch(e){}
    setTimeout(spy,120);
  }
  links.forEach(a=>a.onclick=e=>{e.preventDefault();go(a.getAttribute('href'),true)});
  const els=links.map(a=>target(a.getAttribute('href')));
  function spy(){
    let cur=0; els.forEach((el,i)=>{if(el&&el.getBoundingClientRect().top<=120)cur=i});
    links.forEach((a,i)=>a.classList.toggle('on',i===cur));
    const on=links[cur]; if(on&&nav.scrollWidth>nav.clientWidth)nav.scrollTo({left:on.offsetLeft-16,behavior:'smooth'});
  }
  addEventListener('scroll',spy,{passive:true}); spy();
  if(location.hash)setTimeout(()=>go(location.hash,false),50);
})();
