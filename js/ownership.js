const OWN_BASE = {kro:'unknown', wol:'full', lan:'coop_kw', son:'coop_kw', g2:'coop_nokw', bac:'unknown', g1:'full', jp2:'coop_nokw', gro:'full', gjc:'full', ksa:'full', dyb:'coop_nokw', nis:'coop_kw'};
const OWN_NOTE_NEW = true;
const OWN_NOTE = {
  wol:'Оголошення: «pełna własność z KW», проблем із кредитом немає.',
  lan:'Otodom: кооперативне власницьке право; KW згадано в заголовку оголошення. Підтвердіть, що KW існує.',
  son:'Оголошення: «spółdzielcze własnościowe prawo do lokalu z księgą wieczystą», ґрунт врегульований, можна купити в кредит.',
  jp2:'Оголошення: «spółdzielcze własnościowe prawo do lokalu — brak KW (з можливістю заснування)». Для іпотеки банк вимагатиме створити KW.',
  kro:'У CSV вид права не вказано. Запитайте агента (Finest Estate).',
  g1:'Оголошення: «pełna własność z księgą wieczystą», прямий продаж від власника без комісії.',
  gro:'Otodom: повна власність; про KW в описі не сказано, підтвердьте.',
  gjc:'Оголошення: «pełna własność».',
  ksa:'Otodom: повна власність.',
  dyb:'Оголошення: кооператив SMB Imielim, KW немає, «можна створити». Для іпотеки банк вимагатиме KW.',
  nis:'Оголошення: кооперативне право з KW без обтяжень, ґрунт врегульований, можна в кредит, можливе виокремлення власності.',
  g2:'Оголошення: «spółdzielcze własnościowe prawo do lokalu», KW можна створити (зараз немає). Для іпотеки банк вимагатиме KW.',
  bac:'Ні в CSV, ні в оголошенні вид права не вказано. Запитайте агента (Freedom).'
};
P.forEach(p=>{p.own=OWN_BASE[p.id]||'unknown'; p.own_note=OWN_NOTE[p.id]||'';});
// числові параметри видів права; тексти (l, short, d, li) беруться з перекладу: own.<ключ>.<поле>
const OWN = {
  full:{risk:0, cost:0, prem:0, cls:'ok'},
  coop_kw:{risk:1, cost:500, prem:0, cls:'mid'},
  coop:{risk:2, cost:1000, prem:0, cls:'warn'},
  coop_nokw:{risk:3, cost:1500, prem:0, cls:'bad'},
  perp:{risk:1, cost:0, prem:0, cls:'warn'},
  unknown:{risk:null, cost:0, prem:0, cls:''},
};
const OWN_KEYS = Object.keys(OWN);
let OWNCFG = store.get('owncfg',{});      // {type:{cost,prem}}
let OWNSEL = store.get('ownsel',{});      // {flatId:type}
const ownOf = p => OWNSEL[p.id]||p.own||'unknown';
const ownTxt = (k,f) => t('own.'+k+'.'+f);
const ownCfg = k => ({...OWN[k], l:ownTxt(k,'l'), short:ownTxt(k,'short'), d:ownTxt(k,'d'), li:ownTxt(k,'li').split('\n'), ...(OWNCFG[k]||{})});

const VERDICTS = [[1,'son'],[2,'bac'],[3,'g2'],[4,'g1'],[5,'jp2'],[6,'wol']];
