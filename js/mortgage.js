function monthly(loan, ratePct, years){
  const n = years*12, r = ratePct/100/12;
  if(loan<=0) return 0;
  return r===0 ? loan/n : loan*r/(1-Math.pow(1+r,-n));
}
const CZ_OPTS=[0,300,400,500,600,700,800,900,1000,1200,1500];
const S = {mort:true, favOnly:false, czDef:0, ex:{extra:0,lump:0,lumpM:12,mode:'term',fee:0}, dp:20, rate:6.5, term:30, comm:2.5, metric:'price', A:'bac', B:'g2'};

function amort(loan, ratePct, years, o){
  const N=years*12, r=ratePct/100/12, base=monthly(loan,ratePct,years);
  const baseInterest=base*N-loan;
  let bal=loan, pay=base, interest=0, fee=0, m=0, last=base;
  while(bal>0.005 && m<N){
    m++;
    const i=bal*r; interest+=i;
    const princ=Math.min(bal,pay-i); bal-=princ; last=i+princ;
    let over=0;
    if(bal>0){
      over+=Math.min(bal,o.extra||0);
      if(o.lump>0 && m===o.lumpM) over+=Math.min(bal-over,o.lump);
      bal-=over; last+=over;
      if(m<=36) fee+=over*(o.fee||0)/100;
      if(over>0 && o.mode==='pay' && bal>0.005 && N-m>0) pay=monthly(bal,ratePct,(N-m)/12);
    }
  }
  return {months:m, interest, fee, base, payAfter:(o.mode==='pay'?pay:base), baseInterest,
          saved:baseInterest-interest, netSaved:baseInterest-interest-fee, monthsSaved:N-m};
}
const exActive = () => (S.ex.extra>0||S.ex.lump>0);
const howMort=(p,c)=>t('how.mort',{price:zl(p.price),dp:S.dp,down:zl(c.down),loan:zl(c.loan),rate:dec(c.effRate,0,2),term:S.term+' '+t('yr'),pay:zl(c.pay)});
function howEx(c){
  const e=c.ea, add=[S.ex.extra>0?t('how.add.extra',{x:zl(S.ex.extra)}):'',S.ex.lump>0?t('how.add.lump',{x:zl(S.ex.lump),m:S.ex.lumpM}):''].filter(Boolean).join(' + ')||'—';
  const old=fmtTerm(S.term*12), fee=e.fee>0?t('how.fee',{fee:zl(e.fee)}):'';
  return t(S.ex.mode==='pay'?'how.ex.pay':'how.ex.term',{base:zl(e.base),add,new:fmtTerm(e.months),old,after:zl(e.payAfter),int:zl(e.interest),baseInt:zl(e.baseInterest),saved:zl(e.saved),fee,net:zl(e.netSaved)});
}
const fmtTerm = m => {const y=Math.floor(m/12), r=m%12; return ((y?y+' '+t('yr')+' ':'')+(r?r+' '+t('mo'):(y?'':'0'))).trim()};
function czEff(p){
  if(CZOVR[p.id]!=null) return {v:CZOVR[p.id], src:'own'};
  if(p.czynsz!=null) return {v:p.czynsz, src:'listing'};
  return {v:S.czDef, src:S.czDef>0?'default':'none'};
}
const czLabel = p => {const c=czEff(p); return c.src==='listing'?zl(c.v):c.src==='none'?t('cz.none'):'~'+zl(c.v)};
function calc(p){
  const down = S.mort ? p.price*S.dp/100 : p.price;
  const loan = p.price-down;
  const o = ownCfg(ownOf(p));
  const effRate = S.mort ? S.rate + (o.prem||0) : 0;
  const pay = monthly(loan,effRate,S.term);
  const total = pay*S.term*12;
  const comm = p.agency ? p.price*S.comm/100 : 0;
  const reno = (p.reno[0]+p.reno[1])/2;
  const cz = czEff(p).v;
  const ea=amort(loan,effRate,S.term,S.ex);
  return {ea, down, loan, pay, effRate, ownCost:o.cost||0, interest: total-loan, total, comm, reno, cz,
          monthAll: pay+cz, cash: down+comm+reno+(o.cost||0), net: p.rentMid==null?null:p.rentMid-pay-cz};
}
