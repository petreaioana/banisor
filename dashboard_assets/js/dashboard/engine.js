/* ========== UnificareExport | dashboard_assets\js\dashboard\engine.js ========== */

// dashboard_assets/js/dashboard/engine.js
// =====================================================
// FinKids Tycoon — Dashboard autosim engine (complet)
// - Integrare FK v5 (world/seasons/weather/events/quests/staff/R&D/save-slots)
// - Buclă de simulare pe minute de joc, cu producție matinală & vânzări
// - UI injectată: Save Slots, R&D, Evenimente, Quests, Ingrediente
// - Control viteză, pauză, topbar metrici, buff popover
// =====================================================

import { FK } from '../shared/state.js';

const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const clamp = FK.clamp;
const DAY_MINUTES = FK.DAY_MINUTES;

// Stare
let S = FK.getState();

// DOM (index.php)
const elDay   = $('#top-day');
const elTime  = $('#top-time');
const elCash  = $('#top-cash');
const elStock = $('#top-stock');
const elRep   = $('#top-rep');
const elBoost = $('#top-boost');

const btnPause  = $('#btn-pause');
const speedBtns = $$('.speed-btn');

const inpPrice = $('#inp-price');
const rngPrice = $('#rng-price');
const inpLot   = $('#inp-lot');
const inpHHs   = $('#inp-hh-start');
const inpHHe   = $('#inp-hh-end');
const inpHHd   = $('#inp-hh-disc');

const chkFlyer   = $('#chk-flyer');
const chkSocial  = $('#chk-social');
const selCashiers= $('#sel-cashiers');

const upOven = $('#up-oven');
const upPos  = $('#up-pos');
const upAuto = $('#up-auto');

const barQ = $('#bar-q');
const barW = $('#bar-w');
const barC = $('#bar-c');
const barN = $('#bar-n');

const mSold = $('#m-sold');
const mRev  = $('#m-rev');
const mProf = $('#m-prof');

const ticker    = $('#ticker');
const banCorner = $('#banisor-corner');
async function importFromManual(clearAfter = true){
  try{
    const url = `game.php?action=export${clearAfter ? '&clear=1' : ''}`;
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json();
    if(!j || !j.ok){ alert('Import eșuat.'); return; }

    const t = j.transfer || {};
    const qty = Math.max(0, Number(t.qty||0));
    const q   = Math.max(0.70, Math.min(0.99, Number(t.avg_q||0.86)));
    const buffs = Array.isArray(t.buffs) ? t.buffs : [];

    // unde importăm stocul? → în produsul activ din dashboard
    const k = (FK.getActiveProductKey && FK.getActiveProductKey()) || 'croissant';

    if(qty>0){
      FK.addInventory(k, qty, q);
    }

    // traducem buff-urile din jocul manual în buffs FK (trafic / Q / (opțional) ușor wBonus)
    buffs.forEach(b=>{
      const minutes = Math.max(1, Math.ceil((Number(b.seconds_left||0))/60));
      FK.addBuff({
        id: `manual_${b.id||('b'+Date.now())}`,
        label: b.label || 'Boost manual',
        minutes,
        trafficMult: Number(b.trafficMult||1),
        qBonus: Number(b.qBonus||0),
        // mic "prod. boost" prin a reduce timpul de așteptare (productivitate percepută)
        // mapăm 30% din surplusul de trafic în -W (atenuare)
        wBonus: -0.3 * Math.max(0, (Number(b.trafficMult||1)-1))
      });
    });

    refreshTop();
    setMetrics({ sold: (FK.getState().autosim?.aggregates?.sold||0),
                 rev:  (FK.getState().autosim?.aggregates?.rev||0) });

    const msg = `Importat ${qty} buc · Q ${q.toFixed(2)}${buffs.length?` · ${buffs.length} boost-uri`:''}`;
    try{ const t = document.getElementById('ticker'); if(t) t.textContent = msg; }catch(_){}
    alert(msg);
  }catch(e){
    console.error(e);
    alert('Eroare rețea la import.');
  }
}

// Parametri economie
const ECON = {
  F_base: 120,        // clienți/zi (bază)
  C0: 0.50,
  epsilon: 1.6,       // elasticitate preț
  alpha: 0.75,        // conversie
  beta: 0.50,         // contribuție calitate
  kappa: 0.60, delta: 0.10, // penalizare coadă
  Wmax: 6, tau: 3,    // timp așteptare (cap)
  rho: 0.75,          // smoothing reputație
  gammaSalvage: 0.20
};

// ---------- Helpers produs activ ----------
function activeKey(){ S=FK.getState(); return (FK.getActiveProductKey && FK.getActiveProductKey()) || (S.activeProduct||'croissant'); }

function addInventory(qty,q){ FK.addInventory(activeKey(), qty, q); }

function totalStock(){ return FK.totalStock(activeKey()); }

function avgQuality(){
  S = FK.getState();
  const p = S.products[activeKey()];
  let sum=0,cnt=0;
  (p.stock||[]).forEach(l=>{ sum += (l.qty||0) * (l.q||0); cnt += (l.qty||0); });
  return cnt>0 ? (sum/cnt) : (0.86 + (S.boost?.qBonus||0));
}

function consumeInventory(qty){
  S = FK.getState();
  const p = S.products[activeKey()];
  let left = Math.max(0, Math.round(qty||0));
  let sold=0, qWeighted=0;
  for(const lot of p.stock){
    if(left<=0) break;
    const take = Math.min(lot.qty||0, left);
    lot.qty -= take; left -= take; sold += take; qWeighted += take*(lot.q||0);
  }
  p.stock = p.stock.filter(l=> (l.qty||0)>0);
  const qAvg = sold>0 ? (qWeighted/sold) : avgQuality();
  FK.saveState();
  return { sold, qAvg };
}

// ---------- Sezon/Meteo/Evenimente ----------
function seasonWeather(){
  try{
    const sW = FK.getState().world?.season;
    const effS = FK.seasonEffects ? FK.seasonEffects(sW) : {traffic:1,wait:0,qBonus:0};
    const wW = FK.getState().economy2?.weather;
    const effW = FK.weatherEffects ? FK.weatherEffects(wW) : {traffic:1,wait:0,qBonus:0,label:'—'};
    const label = `${String(sW||'primavara')} · ${effW.label||'—'}`;
    return { traffic: (effS.traffic||1)*(effW.traffic||1), wait: (effS.wait||0)+(effW.wait||0), qBonus:(effS.qBonus||0)+(effW.qBonus||0), label };
  }catch(_){ return {traffic:1, wait:0, qBonus:0, label:'—'}; }
}
function eventMods(){
  try{ return FK.eventModsForToday ? FK.eventModsForToday() : {traffic:1,conv:0,qBonus:0,wait:0}; }
  catch(_){ return {traffic:1,conv:0,qBonus:0,wait:0}; }
}

function marketingBoost(){ let m=0; const S=FK.getState(); if(S.marketing.flyerDaysLeft>0) m+=0.10; if(S.marketing.socialToday) m+=0.25; return m; }
function trafficN(){
  const S=FK.getState();
  const eff = seasonWeather();
  const evm = eventMods();
  const base = ECON.F_base
    * (S.economyIndex||1)
    * (S.reputation||1)
    * eff.traffic
    * (evm.traffic||1)
    * (1+marketingBoost());
  return Math.round(base * (S.boost?.trafficMult || 1));
}
function waitW(lambda, mu){ return clamp((lambda - mu)*ECON.tau, 0, ECON.Wmax); }
function conversionC(P,P0,Q,W){
  const {C0,epsilon,alpha,beta,kappa,delta} = ECON;
  const priceTerm   = Math.exp(-epsilon * (P/P0 - 1));
  const qualityTerm = alpha + beta * Q;
  const waitPen     = 1 - Math.min(kappa, delta * Math.max(0,W));
  return clamp(C0*priceTerm*qualityTerm*waitPen, 0, 0.95);
}

// ---------- Formatare ----------
function fmtTime(min){
  const S=FK.getState();
  const m = Math.max(0, Math.min(min, DAY_MINUTES + (S.world?.open||8*60)));
  const dayStart = (S.world?.open)||8*60;
  const H = Math.floor((dayStart + (m - dayStart))/60);
  const M = (dayStart + (m - dayStart))%60;
  return `${H<10?'0':''}${H}:${M<10?'0':''}${M}`;
}
function fmt(n,d=0){
  const f = Math.pow(10,d);
  return (Math.round(Number(n)*f)/f).toFixed(d);
}

// ---------- UI Topbar & metrici ----------
function refreshTop(){
  S = FK.getState();
  elDay.textContent  = String(S.world?.day || S.day || 1);
  elTime.textContent = fmtTime(S.timeMin);
  elCash.textContent = Math.round(S.cash||0);
  elStock.textContent= totalStock();
  elRep.textContent  = (S.reputation||1).toFixed(2);
  const buffsCount = (S.boost?.buffs?.length)||0;
  elBoost.textContent= Math.round(S.boost.percent||0)+'%'+(buffsCount>0?` (${buffsCount})`:'');
  try{ if(typeof updateTickerBadge==='function') updateTickerBadge(); }catch(_){}
}
function setMetrics({N=0,C=0,W=0,Q=0,sold=0,rev=0,profit=0}){
  barQ.style.width = Math.round(Math.max(0,Math.min(Q,1))*100)+'%';
  barW.style.width = Math.round(Math.max(0,Math.min(W/ECON.Wmax,1))*100)+'%';
  barC.style.width = Math.round(Math.max(0,Math.min(C,0.95))*100)+'%';
  barN.style.width = Math.round(Math.max(0,Math.min(N/(ECON.F_base*1.5),1))*100)+'%';
  mSold.textContent = String(sold);
  mRev.textContent  = fmt(rev,0);
  mProf.textContent = fmt(profit,0);
}

// ---------- Bucla minute ----------
function toMinutes(hhmm){ const [h,m]=String(hhmm||'16:00').split(':').map(Number); return (h*60 + m); }

function stepAuto(){
  S = FK.getState();
  if(!S.autosim?.running) return;

  const k    = activeKey();
  const prod = S.products[k];
  const dayStart = S.world?.open || 8*60;

  // timp
  S.timeMin += 1;

  // producție matinală (primele 120 min)
const earlyWindow = (S.timeMin - dayStart) < 120;
if(earlyWindow){
  const planPerMin = Math.ceil((prod.plannedQty||0) / 120);
  const ovenFactor = S.upgrades?.ovenPlus?1.5:1;

  const baseCapPerMin = ((S.capacity?.ovenBatchSize||50)*ovenFactor*(S.capacity?.ovenBatchesPerDay||2))/DAY_MINUTES;

  // nou: o parte din boost se traduce în productivitate (max +30% pentru un boost mare)
  const prodFactorFromBoost = 1 + Math.min(0.30, Math.max(0, (S.boost?.percent||0)/100 * 0.30));
  const ovenCapPerMin = Math.ceil(baseCapPerMin * prodFactorFromBoost);

  const rid = (prod?.recipeId)||'croissant_plain';
  const need = (S.recipes?.[rid]?.ingredients)||{};
  const maxByStoc = Object.keys(need).length>0 ? Math.min(...Object.entries(need).map(([id,qty]) => Math.floor(((S.ingredients?.[id]?.qty)||0)/Math.max(1,qty)))) : planPerMin;

  const made = Math.max(0, Math.min(planPerMin, ovenCapPerMin, maxByStoc||0));
  if(made>0){
    FK.consumeFor(rid, made);
    const baseQ = 0.86 + (S.upgrades?.ovenPlus?0.02:0) + (S.upgrades?.timerAuto?0.02:0) + (S.boost?.qBonus||0);
    const noise = (Math.random()*0.06)-0.03;
    addInventory(made, Math.max(0.70, Math.min(0.98, baseQ + noise)));
  }
}


  // trafic minute + sosiri
  const Nday      = trafficN();
  const lambdaMin = Nday / DAY_MINUTES;
  const arrivals  = (Math.random()<lambdaMin?1:0) + (Math.random()<lambdaMin?1:0) + (Math.random()<lambdaMin?1:0);

  // servicii
  const baseMu = (FK.getCashierMu ? FK.getCashierMu(S.staff?.cashier||1) : ((S.capacity?.cashierMu||1.5) + (S.upgrades?.posRapid?0.8:0) + Math.max(0,(S.staff?.cashier||1)-1)*0.5));
  const sw = seasonWeather();
  const evm = eventMods();
  let W = waitW(arrivals, baseMu) + (S.boost?.wBonus||0) + (sw.wait||0) + (evm.wait||0);
  W = Math.max(0, W);

  // preț / happy-hour
  const P0 = prod.P0 || 10; let P = prod.price || P0;
  const hh = prod.happyHour||{enabled:false,start:'16:00',end:'17:00',discount:0.10};
  const HHs=toMinutes(hh.start), HHe=toMinutes(hh.end);
  if(hh.enabled && S.timeMin>=HHs && S.timeMin<HHe) P = P * (1 - clamp(hh.discount||0.10,0.05,0.25));

  // calitate + conversie
  const Q = Math.max(0, Math.min(1, avgQuality() + (S.boost?.qBonus||0) + (sw.qBonus||0) + (evm.qBonus||0)));
  const C = clamp(conversionC(P,P0,Q,W) + (evm.conv||0), 0, 0.95);

  // cerere minut & vânzare din stoc
  const demandMin   = Math.max(0, Math.round(arrivals * C));
  const { sold }    = consumeInventory(Math.min(totalStock(), demandMin));
  const rev         = sold * P;
  const unitCost    = (prod.cost?.ingredients||3) + (prod.cost?.laborVar||0.5);
  const cogs        = sold * unitCost;

  // agregate zi
  const A=S.autosim.aggregates || (S.autosim.aggregates={sold:0,rev:0,cogs:0,holding:0,marketing:0,profit:0,N:0,C:0,W:0,Q:0});
  A.sold+=sold; A.rev+=rev; A.cogs+=cogs; A.N=Nday; A.C=C; A.W=W; A.Q=Q;

  // cash (doar venituri, costuri zilnice la endOfDay)
  S.cash = (S.cash||0) + rev;

  // Buffs tick
  FK.tickBuffs(1);

  // persist & UI
  FK.setState(S);
  refreshTop();
  setMetrics({
    N:Nday, C, W, Q,
    sold:A.sold, rev:A.rev,
    profit: (A.rev - A.cogs) // simplu live; costuri fixe la end-of-day
  });

  // end-of-day
  if(S.timeMin >= dayStart + DAY_MINUTES){ endOfDay(); }
}

// ---------- End of Day ----------
function endOfDay(){
  S = FK.getState();
  const k    = activeKey();
  const prod = S.products[k];
  const A    = S.autosim.aggregates || {sold:0,rev:0,cogs:0,N:0,C:0,W:0,Q:0};

  const stockLeft   = totalStock();
  const holding     = stockLeft * 0.10;
  const marketingCost = (S.marketing.socialToday?150:0) + ((S.marketing.flyerDaysLeft||0)>0 ? 80 : 0);

  // payroll + mood via staff API
  const complaints = Math.max(0, (A.N>0)? (1 - A.sold/Math.max(1, Math.round(A.N*A.C))) : 0);
  const payroll    = FK.staffDailyTick ? FK.staffDailyTick({avgW:A.W||0, complaints}) : (FK.teamSummary()?.payroll||0);

  const fixed  = 150;
  const profit = (A.rev||0) - (A.cogs||0) - holding - marketingCost - fixed - payroll;

  // expirare stoc & perisabile
  try{
    const L = prod.shelfLifeDays||2;
    (prod.stock||[]).forEach(l=> l.age = (l.age||0)+1);
    prod.stock = (prod.stock||[]).filter(l=> (l.age||0) < L);
    ['milk','strawberries'].forEach(id=>{
      const it = S.ingredients?.[id];
      if(it && it.qty>0){ it.qty = Math.max(0, it.qty - Math.ceil(it.qty*0.20)); }
    });
  }catch(_){}

  // reputație
  const rho=ECON.rho;
  const f = Math.max(0.80, Math.min(1.20, 0.9 + 0.25*((A.Q||0)-0.85) - 0.05*complaints));
  S.reputation = Math.max(0.80, Math.min(1.20, rho*(S.reputation||1) + (1-rho)*f));

  // raport
  S.today = { report: { sold:A.sold||0, revenue:A.rev||0, cogs:A.cogs||0, holding, marketing:marketingCost, fixed, payroll, profit, Q:A.Q||0, W:A.W||0, C:A.C||0 } };

  // marketing (consum)
  if((S.marketing.flyerDaysLeft||0)>0) S.marketing.flyerDaysLeft--;
  S.marketing.socialToday=false;

  // reset agregate
  S.autosim.aggregates={sold:0,rev:0,cogs:0,holding:0,marketing:0,profit:0,N:0,C:0,W:0,Q:0};

  // avansează ziua în world & vreme
  S.day = (S.day||1)+1;
  S.timeMin = S.world?.open || 8*60;
  S.world = S.world || {year:1,season:'primavara',day:S.day,minute:S.timeMin,open:8*60,close:8*60+DAY_MINUTES};
  S.world.day = (S.world.day||1)+1;
  if(S.world.day>28){ S.world.day=1; S.world.season = (S.world.season==='primavara'?'vara':S.world.season==='vara'?'toamna':S.world.season==='toamna'?'iarna':'primavara'); }
  S.world.minute = S.world.open;
  try{ FK.rollWeather && FK.rollWeather(S.world.season); }catch(_){}
  try{ FK.questEndOfDay && FK.questEndOfDay(S.autosim.aggregates); }catch(_){}

  // persist & UI
  FK.setState(S);
  refreshTop();
}

// ---------- Control rulare ----------
function setPaused(paused){
  S = FK.getState();
  S.autosim = S.autosim || {running:false, speed:1, tickMsBase:200, aggregates:{sold:0,rev:0,cogs:0,holding:0,marketing:0,profit:0,N:0,C:0,W:0,Q:0}};
  S.autosim.running = !paused;
  btnPause.textContent = paused? '▶️ Reia' : '⏸️ Pauză';
  $$('#left-controls input, #left-controls select, #left-controls button').forEach(el=>{ el.disabled = !paused && el.id!=='btn-rnd'; });
  FK.setState(S);
}
function setSpeed(mult){
  S = FK.getState();
  S.autosim = S.autosim || {};
  S.autosim.speed = mult;
  speedBtns.forEach(b=> b.classList.toggle('active', Number(b.dataset.speed)===mult));
  FK.setState(S);
}
function loopStart(){
  if(window.__tick){ clearInterval(window.__tick); }
  const tick = ()=>{ for(let i=0;i<(FK.getState().autosim?.speed||1); i++) stepAuto(); };
  window.__tick = setInterval(tick, FK.getState().autosim?.tickMsBase || 200);
}

// ---------- Hidrate & Apply controls ----------
function hydrateControls(){
  S = FK.getState();
  const p = S.products[activeKey()];
  if(!p) return;
  $('#inp-price').value = p.price;
  $('#rng-price').value = p.price;
  $('#inp-lot').value   = p.plannedQty;
  $('#inp-hh-start').value = p.happyHour?.start || '16:00';
  $('#inp-hh-end').value   = p.happyHour?.end   || '17:00';
  $('#inp-hh-disc').value  = Math.round((p.happyHour?.discount||0.10)*100);

  $('#chk-flyer').checked  = (S.marketing.flyerDaysLeft||0)>0;
  $('#chk-social').checked = !!S.marketing.socialToday;
  $('#sel-cashiers').value = String(S.staff?.cashier||1);

  $('#up-oven').checked = !!S.upgrades?.ovenPlus;
  $('#up-pos').checked  = !!S.upgrades?.posRapid;
  $('#up-auto').checked = !!S.upgrades?.timerAuto;
}
function applyControlsToState(){
  S = FK.getState();
  const p = S.products[activeKey()];
  if(!p) return;

  p.price = clamp(parseFloat(inpPrice.value)||p.P0, p.P0*0.7, p.P0*1.3);
  p.plannedQty = Math.max(0, Math.round(parseFloat(inpLot.value)||0));
  p.happyHour = p.happyHour || {};
  p.happyHour.start = inpHHs.value || '16:00';
  p.happyHour.end   = inpHHe.value || '17:00';
  p.happyHour.discount = clamp((parseFloat(inpHHd.value)||10)/100, 0.05, 0.25);
  p.happyHour.enabled  = true;

  S.marketing.socialToday = !!chkSocial.checked;
  if(chkFlyer.checked && (S.marketing.flyerDaysLeft||0)<=0){
    S.marketing.flyerDaysLeft = 2;
    if((S.cash||0)>=80){ S.cash -= 80; }
  }

  S.staff.cashier = parseInt(selCashiers.value,10)||1;

  S.upgrades.ovenPlus  = !!upOven.checked;
  S.upgrades.posRapid  = !!upPos.checked;
  S.upgrades.timerAuto = !!upAuto.checked;

  FK.setState(S);
  refreshTop();
}

// ---------- Mount principal ----------
function mount(){
  refreshTop();
  hydrateControls();

  if(banCorner){ try{ banCorner.innerHTML=''; banCorner.appendChild(buildBanisorSprite(120)); }catch(_){ } }
  if(ticker) ticker.textContent='Auto-sim '+(FK.getState().autosim?.running? 'activ' : 'în pauză');

  // UI adițională
  try{ mountSeasonCard(); }catch(_){}
  try{ mountEventsCard(); }catch(_){}
  try{ mountQuestsCard(); }catch(_){}
  try{ mountSaveSlots(); }catch(_){}
  try{ mountProductSelector(); }catch(_){}
  try{ mountBuyBtn(); }catch(_){}
}

// ---------- Evenimente UI ----------
function updateTickerBadge(){
  try{
    const t=document.getElementById('ticker'); if(!t) return;
    const S=FK.getState();
    const evs = FK.todayEvents ? FK.todayEvents() : [];
    const evTxt = evs.length? ` · 🎪 ${evs.map(e=>e.label||e.id).join(' + ')}` : '';
    const label = 'Manager '+(S.autosim?.running? 'activ…' : 'în pauză');
    t.textContent = `${label}${evTxt}`;
  }catch(_){}
}

// ---------- Buffs popover ----------
function openBuffsPopover(){
  try{
    const old=document.getElementById('buffs-popover'); if(old) { old.remove(); return; }
    const pop=document.createElement('div'); pop.id='buffs-popover';
    Object.assign(pop.style,{position:'fixed',top:'48px',right:'12px',background:'#fff',color:'#000',border:'1px solid #333',borderRadius:'8px',padding:'.5rem .7rem',zIndex:'99999',boxShadow:'0 4px 16px rgba(0,0,0,.2)'});
    const buffs=(FK.getState().boost?.buffs)||[];
    if(buffs.length===0){ pop.textContent='Niciun boost activ'; }
    else{
      const ul=document.createElement('ul'); ul.style.listStyle='none'; ul.style.margin='0'; ul.style.padding='0';
      buffs.forEach(b=>{
        const li=document.createElement('li'); li.style.display='flex'; li.style.justifyContent='space-between'; li.style.gap='.5rem'; li.style.minWidth='220px'; li.style.padding='.15rem 0';
        const mins=Math.max(0, Math.ceil(b.minutesLeft||0));
        li.innerHTML=`<span>${b.label||b.id}</span><b>${mins}m</b>`;
        ul.appendChild(li);
      });
      pop.appendChild(ul);
    }
    document.body.appendChild(pop);
    const close=(ev)=>{ if(!pop.contains(ev.target) && ev.target!==elBoost){ pop.remove(); window.removeEventListener('mousedown', close); } };
    window.addEventListener('mousedown', close);
  }catch(_){}
}
try{ if(elBoost) elBoost.addEventListener('click', openBuffsPopover); }catch(_){}

// ---------- Banisor sprite mic ----------
function buildBanisorSprite(sizePx=120){
  const wrap=document.createElement('div');
  wrap.className='banisor-sprite'; wrap.style.width=sizePx+'px'; wrap.style.height=sizePx+'px';
  wrap.innerHTML=`<svg viewBox="0 0 200 200" aria-label="Banisor" role="img"><ellipse cx="100" cy="185" rx="45" ry="10" fill="#d3b37a" opacity=".35"/><g fill="#f0a82a" stroke="#c67a12" stroke-width="4"><path d="M75 160 q-8 12 8 18 h18 q10-2 6-10 q-6-14-32-8z"/><path d="M127 160 q8 12-8 18 h-18 q-10-2-6-10 q6-14 32-8z"/></g><g fill="#f0a82a" stroke="#c67a12" stroke-width="6" class="hand-wave"><path d="M150 110 q25 5 25 25" fill="none"/><circle cx="175" cy="135" r="14" /><circle cx="165" cy="128" r="6" /><circle cx="184" cy="142" r="6" /></g><g fill="#f0a82a" stroke="#c67a12" stroke-width="6"><path d="M50 110 q-25 5 -25 25" fill="none"/><circle cx="25" cy="135" r="14" /><circle cx="35" cy="128" r="6" /><circle cx="16" cy="142" r="6" /></g><defs><radialGradient id="g1" cx="35%" cy="35%"><stop offset="0%" stop-color="#ffe58a"/><stop offset="60%" stop-color="#ffd053"/><stop offset="100%" stop-color="#f2a62b"/></radialGradient></defs><circle cx="100" cy="100" r="68" fill="url(#g1)" stroke="#c67a12" stroke-width="8"/><circle cx="100" cy="100" r="56" fill="none" stroke="#ffde82" stroke-width="10" opacity=".9"/></svg>`;
  return wrap;
}

// ---------- Save Slots UI ----------
function mountSaveSlots(){
  const host=document.querySelector('#topbar .right'); if(!host) return;
  if(document.getElementById('btn-saves')) return;
  const sep=document.createElement('span'); sep.className='sep'; sep.textContent='•';
  const btn=document.createElement('button'); btn.id='btn-saves'; btn.className='btn'; btn.textContent='💽 Save';
  host.insertBefore(sep, host.lastElementChild);
  host.insertBefore(btn, host.lastElementChild);
  btn.addEventListener('click', openSavesModal);
}
function openSavesModal(){
  const modal=document.createElement('div'); modal.id='saves-modal';
  Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'99999'});
  modal.innerHTML=`
    <div style="background:#fff;color:#000;min-width:360px;max-width:640px;width:92%;border-radius:10px;border:2px solid #333;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .8rem;background:#222;color:#fff">
        <div>💽 Save slots</div>
        <button id="sv-close" class="btn small">✕</button>
      </div>
      <div id="sv-body" style="padding:.6rem .8rem;max-height:60vh;overflow:auto"></div>
      <div style="display:flex;gap:.5rem;align-items:center;justify-content:flex-end;padding:.6rem .8rem;border-top:1px solid #ddd">
        <button id="sv-refresh" class="btn secondary">🔄 Refresh</button>
      </div>
      <input id="sv-file" type="file" accept="application/json" style="display:none">
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#sv-close').addEventListener('click', ()=>modal.remove());
  modal.querySelector('#sv-refresh').addEventListener('click', renderList);
  const file=modal.querySelector('#sv-file');
  function renderList(){
    const body=modal.querySelector('#sv-body'); body.innerHTML='';
    const list=(FK.listSlots && FK.listSlots()) || [];
    const active = FK.getActiveSlot ? FK.getActiveSlot() : 'autosave';
    list.forEach(info=>{
      const when = info.when ? new Date(info.when).toLocaleString() : '—';
      const row=document.createElement('div'); row.style.cssText='display:grid;grid-template-columns:70px 1fr auto;gap:.5rem;align-items:center;border-bottom:1px solid #eee;padding:.35rem 0';
      row.innerHTML = `
        <div><b>${info.slot}${info.slot===active?'*':''}</b><div class="small muted">${when}</div></div>
        <div class="small">Zi: <b>${info.day||'-'}</b> · Sezon: <b>${info.season||'-'}</b> · Cash: <b>${info.cash||0}</b></div>
        <div style="display:flex;gap:.35rem;justify-content:flex-end">
          <button class="btn small act-use">Use</button>
          <button class="btn small act-save">Save→${info.slot}</button>
          <button class="btn small act-exp">Export</button>
          <button class="btn small act-imp">Import</button>
          <button class="btn small act-del">Delete</button>
        </div>`;
      // actions
      row.querySelector('.act-use').addEventListener('click', ()=>{
        FK.setActiveSlot && FK.setActiveSlot(info.slot);
        S=FK.getState(); refreshTop(); renderList();
      });
      row.querySelector('.act-save').addEventListener('click', ()=>{
        FK.saveToSlot && FK.saveToSlot(info.slot);
        renderList();
      });
      row.querySelector('.act-exp').addEventListener('click', ()=>{
        FK.exportJSON && FK.exportJSON(info.slot);
      });
      row.querySelector('.act-imp').addEventListener('click', ()=>{
        file.onchange = async ()=>{
          const f=file.files?.[0]; if(!f) return;
          await (FK.importJSON && FK.importJSON(f, info.slot));
          file.value=''; renderList(); S=FK.getState(); refreshTop();
        };
        file.click();
      });
      row.querySelector('.act-del').addEventListener('click', ()=>{
        const ok = confirm(`Ștergi slotul ${info.slot}?`);
        if(ok){ FK.deleteSlot && FK.deleteSlot(info.slot); renderList(); S=FK.getState(); refreshTop(); }
      });
      body.appendChild(row);
    });
  }
  renderList();
}

// ---------- Ingrediente UI ----------
function mountBuyBtn(){
  const topRight = document.querySelector('#topbar .right'); if(!topRight) return;
  if(document.getElementById('btn-buy')) return;
  const sep=document.createElement('span'); sep.className='sep'; sep.textContent='·';
  const btn=document.createElement('button'); btn.id='btn-buy'; btn.className='btn'; btn.textContent='🛒 Ingrediente';
  topRight.insertBefore(sep, topRight.lastElementChild);
  topRight.insertBefore(btn, topRight.lastElementChild);
  btn.addEventListener('click', openIngModal);
}
const PRICE = { flour:2, milk:3, sugar:2, cacao:5, chocolate_chips:6, strawberries:5, coconut:4, sprinkles:3,
                butter:5, eggs:3, yeast:3, vanilla:6, chocolate_glaze:7, cream:6, blueberries:6 };
function openIngModal(){
  const modal = document.createElement('div'); modal.id='ing-modal';
  Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'99999'});
  modal.innerHTML = `
    <div style="background:#fff; color:#000; min-width:320px; max-width:560px; width:90%; border-radius:10px; border:2px solid #333; overflow:hidden;">
      <div style="display:flex; align-items:center; justify-content:space-between; padding:.6rem .8rem; background:#222; color:#fff;">
        <div>🛒 Cumpără ingrediente</div>
        <button id="ing-close" class="btn small">✕</button>
      </div>
      <div id="ing-list" style="padding:.6rem .8rem; max-height:50vh; overflow:auto;"></div>
      <div style="display:flex; gap:.5rem; align-items:center; justify-content:flex-end; padding:.6rem .8rem; border-top:1px solid #ddd;">
        <div>Total: <b id="ing-total">0</b> lei</div>
        <button id="ing-buy" class="btn">Cumpără</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const close=()=>{ modal.remove(); };
  modal.querySelector('#ing-close').addEventListener('click', close);
  const list = modal.querySelector('#ing-list');
  const totalEl = modal.querySelector('#ing-total');
  const cart = {};
  const Sx=FK.getState();
  const makeRow=(id)=>{
    const name=id.replaceAll('_',' ');
    const qty=Sx.ingredients?.[id]?.qty||0; const price=PRICE[id]||0; const ttl=Sx.ingredients?.[id]?.shelfLife||0;
    const row=document.createElement('div'); row.style.display='grid'; row.style.gridTemplateColumns='1fr auto auto auto'; row.style.gap='.5rem'; row.style.alignItems='center'; row.style.padding='.25rem 0';
    row.innerHTML=`<div><b>${name}</b><div class="muted small">stoc: ${qty}, TTL: ${ttl}z</div></div>
      <div style="text-align:right;">${price} lei</div>
      <input type="number" min="0" step="1" value="0" style="width:70px;">
      <div style="width:80px; text-align:right;" class="row-total">0</div>`;
    const inp=row.querySelector('input'); const rtot=row.querySelector('.row-total');
    inp.addEventListener('input',()=>{const v=Math.max(0,Math.round(Number(inp.value)||0)); cart[id]=v; rtot.textContent=String(v*price); updateTotal();});
    return row;
  };
  const updateTotal=()=>{ const sum=Object.entries(cart).reduce((s,[k,v])=> s+(PRICE[k]||0)*Math.max(0,v),0); totalEl.textContent=String(sum); };
  Object.keys(PRICE).forEach(id=> list.appendChild(makeRow(id)));
  modal.querySelector('#ing-buy').addEventListener('click',()=>{
    let spent=0; Object.entries(cart).forEach(([id,qty])=>{ if(qty>0){ const ok=FK.buyIngredient(id,qty,PRICE); if(ok) spent+=(PRICE[id]||0)*qty; }});
    if(spent>0){ refreshTop(); }
    close();
  });
}

// ---------- Sezon & Meteo Card ----------
function mountSeasonCard(){
  try{
    const host = document.getElementById('right-metrics'); if(!host) return;
    if(document.getElementById('card-season')) return;
    const card=document.createElement('div'); card.id='card-season'; card.className='panel soft';
    card.innerHTML=`<h3 style="margin-top:0">Sezon & Meteo</h3><div id="season-line" class="small"></div>`;
    host.prepend(card);
    const t = document.getElementById('season-line');
    const refresh=()=>{
      const S=FK.getState(); const sw=seasonWeather();
      const team= FK.teamSummary ? FK.teamSummary() : {avgMood:0.75};
      const w = S.economy2?.weather;
      t.textContent = `${S.world?.season||'primavara'} ziua ${S.world?.day||1} · ${sw.label} · 👥 mood ${Math.round((team.avgMood||0.75)*100)}% · meteo=${w||'-'}`;
    };
    refresh();
    setInterval(refresh, 2000);
  }catch(_){}
}

// ---------- Evenimente Card ----------
function mountEventsCard(){
  try{
    const host=document.getElementById('right-metrics');
    if(!host || document.getElementById('card-events')) return;
    const card=document.createElement('div'); card.id='card-events'; card.className='panel soft';
    card.innerHTML=`<h3 style="margin-top:0">Evenimente</h3>
      <div id="ev-today" class="small muted">azi: —</div>
      <div id="ev-upcoming" class="small" style="margin-top:.35rem"></div>`;
    host.appendChild(card);
    const refresh=()=>{
      const evs = (FK.todayEvents&&FK.todayEvents())||[];
      const wrap=document.getElementById('ev-today');
      if(evs.length===0){ wrap.textContent='azi: —'; }
      else{
        wrap.innerHTML = 'azi: ' + evs.map(e=>{
          const joinBtn = (e.type==='festival')? ` <button class="btn small ev-join" data-id="${e.id}">Participă (${e.cost||0})</button>` : '';
          return `<b>${e.label||e.id}</b>${joinBtn}`;
        }).join(' · ');
      }
      const up=(FK.listUpcomingEvents&&FK.listUpcomingEvents(7))||[];
      const box=document.getElementById('ev-upcoming');
      box.innerHTML = up.length? ('urmează: ' + up.map(x=> `${x.season.slice(0,3)}-${x.day}: ${x.label||x.id}`).join(' · ')) : '—';
      // bind joins
      document.querySelectorAll('.ev-join').forEach(b=>{
        b.addEventListener('click', ()=>{
          FK.joinTodayFestival && FK.joinTodayFestival(b.dataset.id);
          refreshTop(); updateTickerBadge(); refresh();
        });
      });
    };
    refresh();
    setInterval(refresh, 2000);
  }catch(_){}
}

// ---------- Quests Card ----------
function mountQuestsCard(){
  try{
    const host=document.getElementById('right-metrics');
    if(!host || document.getElementById('card-quests')) return;
    const card=document.createElement('div'); card.id='card-quests'; card.className='panel soft';
    card.innerHTML=`<h3 style="margin-top:0">Quests azi</h3><div id="q-list" class="small"></div>`;
    host.appendChild(card);
    const render=()=>{
      try{ FK.ensureDailyQuests && FK.ensureDailyQuests(); }catch(_){}
      const qs=(FK.getQuests && FK.getQuests().daily)||[];
      const box=document.getElementById('q-list');
      const bar=(p,t,rev=false)=>{
        const pct = Math.max(0, Math.min(100, Math.round((rev? (p<=t?100:0) : (p/t*100)) )));
        return `<div class="bar" style="height:8px"><span style="display:block;height:8px;width:${pct}%;background:#69c56f"></span></div>`;
      };
      box.innerHTML = qs.map(q=>{
        let prog = q.type==='sold'? `${q.progress}/${q.target}` :
                   q.type==='qavg'? `${Number(q.progress||0).toFixed(2)}≥${q.target}` :
                   q.type==='wait'? `${Number(q.progress||0).toFixed(2)}≤${q.target}` : '';
        const isReady = q.status==='ready';
        const btn = isReady? `<button class="btn small q-claim" data-id="${q.id}">Revendică</button>` : '';
        const meter = q.type==='sold'? bar(q.progress,q.target)
                    : q.type==='qavg'? bar(q.progress, q.target)
                    : q.type==='wait'? bar(q.progress, q.target, true) : '';
        const reward = q.reward?.cash? (`+${q.reward.cash} lei`) : (q.reward?.buff? (q.reward.buff.label||'buff') : '');
        return `<div style="display:grid;grid-template-columns:1fr auto;gap:.4rem;align-items:center;margin:.25rem 0">
          <div><b>${q.label}</b><div class="small muted">${prog} · reward: ${reward}</div>${meter}</div>
          <div>${btn}</div>
        </div>`;
      }).join('');
      box.querySelectorAll('.q-claim').forEach(b=>{
        b.addEventListener('click', ()=>{
          FK.claimQuest && FK.claimQuest(b.dataset.id);
          refreshTop(); updateTickerBadge(); render();
        });
      });
    };
    render();
    setInterval(render, 2500);
  }catch(_){}
}

// ---------- Selector Produs + R&D ----------
function mountProductSelector(){
  try{
    const left=document.getElementById('left-controls'); if(!left) return;
    if(document.getElementById('sel-product')) return;
    const wrap=document.createElement('div'); wrap.className='row';
    wrap.innerHTML=`<label>Produs activ</label>
      <select id="sel-product"></select>
      <button id="btn-rnd" class="btn">🔬 R&D</button>`;
    left.insertBefore(wrap, left.firstElementChild);
    const sel=wrap.querySelector('#sel-product');
    const sync=()=>{
      const S=FK.getState(); sel.innerHTML='';
      Object.values(S.products||{}).forEach(p=>{
        if(p.locked) return;
        const opt=document.createElement('option'); opt.value=p.key; opt.textContent=p.name; if(S.activeProduct===p.key) opt.selected=true;
        sel.appendChild(opt);
      });
    };
    sync();
    sel.addEventListener('change', ()=>{ FK.setActiveProduct && FK.setActiveProduct(sel.value); S=FK.getState(); hydrateControls(); refreshTop(); });
    wrap.querySelector('#btn-rnd').addEventListener('click', openRNDModal);
    setInterval(sync, 2000);
  }catch(_){}
}
function openRNDModal(){
  const S=FK.getState();
  const list = Object.values(S.products||{});
  const modal=document.createElement('div'); modal.id='rnd-modal';
  Object.assign(modal.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'100000'});
  modal.innerHTML=`
    <div style="background:#fff;color:#000;min-width:360px;max-width:720px;width:92%;border:2px solid #333;border-radius:10px;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .8rem;background:#222;color:#fff">
        <div>🔬 Laborator R&D</div><button id="rnd-close" class="btn small">✕</button>
      </div>
      <div style="padding:.6rem .8rem;max-height:60vh;overflow:auto">
        <div id="rnd-list"></div>
        <hr>
        <div class="small muted">Tip: poți încărca rețete externe (JSON) cu <code>FK.loadRecipesJSON('data/recipes.json')</code> în consola browserului.</div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#rnd-close').addEventListener('click', ()=>modal.remove());
  const rndList=modal.querySelector('#rnd-list');
  const paint=()=>{
    const S=FK.getState(); rndList.innerHTML='';
    list.forEach(p=>{
      const unlocked = !p.locked && (S.research?.unlocked||[]).includes(p.key);
      const row=document.createElement('div'); row.style.cssText='display:grid;grid-template-columns:1fr auto;gap:.5rem;align-items:center;border-bottom:1px solid #eee;padding:.35rem 0';
      row.innerHTML = `
        <div><b>${p.name}</b> <span class="small muted">P0:${p.P0} · TTL:${p.shelfLifeDays} · rețetă: ${p.recipeId}</span></div>
        <div style="display:flex;gap:.35rem">
          ${ unlocked ? `<button class="btn small act-test" data-k="${p.key}">🧪 Taste Test</button>` :
                        `<button class="btn small act-unlock" data-k="${p.key}">🔓 Deblochează (300)</button>`}
        </div>`;
      rndList.appendChild(row);
    });
    // bind
    rndList.querySelectorAll('.act-unlock').forEach(b=>{
      b.addEventListener('click', ()=>{ const ok = FK.unlockProduct && FK.unlockProduct(b.dataset.k, 300); if(ok){ paint(); refreshTop(); } });
    });
    rndList.querySelectorAll('.act-test').forEach(b=>{
      b.addEventListener('click', ()=>{
        const k=b.dataset.k; const S=FK.getState(); const rid=(S.products?.[k]?.recipeId)||'croissant_plain';
        if(!FK.canProduce(rid, 6)){ alert('Stoc ingrediente insuficient pentru prototip.'); return; }
        FK.consumeFor(rid, 6); FK.addInventory(k, 6, Math.max(0.88, Math.min(0.98, 0.9+(Math.random()*0.06-0.03))));
        FK.addBuff({id:'prototypeHype', label:`Hype ${S.products[k].name}`, minutes:45, trafficMult:1.06, qBonus:0.01});
        refreshTop(); alert('Prototip servit! +6 stoc & hype.');
      });
    });
  };
  paint();
}

// ---------- Wire evenimente UI existente ----------
btnPause.addEventListener('click', ()=>{
  const nowPaused = FK.getState().autosim?.running;
  setPaused(nowPaused);
  if(!nowPaused){ applyControlsToState(); }
});
rngPrice.addEventListener('input', ()=> inpPrice.value=rngPrice.value);
inpPrice.addEventListener('input', ()=> rngPrice.value=inpPrice.value);
[ inpLot, inpHHs, inpHHe, inpHHd, chkFlyer, chkSocial, selCashiers, upOven, upPos, upAuto ].forEach(el=> el.addEventListener('change', ()=>{}));
speedBtns.forEach(b=> b.addEventListener('click', ()=> setSpeed(Number(b.dataset.speed))));
document.getElementById('btn-import-manual')?.addEventListener('click', ()=> importFromManual(true));

// ---------- Start ----------
setPaused(false);
loopStart();
mount();

// ---------- Micro-tweaks post-mount ----------
try{
  const t=document.getElementById('ticker'); if(t) t.textContent='Manager activ…';
  const st=document.querySelector('#stationbar .station.active'); if(st) st.textContent='Manager';
}catch(_){}

// ---------- Monkey-patch: tick buffs în stepAuto deja se cheamă ----------

// ---------- Wrap addInventory respectând ingredientele (supliment de siguranță) ----------
try{
  const __origAddInventory = addInventory;
  window.addInventory = function(qty,q){
    try{
      const Sx = FK.getState();
      const k  = (FK.getActiveProductKey && FK.getActiveProductKey()) || 'croissant';
      const rid = (Sx.products?.[k]?.recipeId)||'croissant_plain';
      const need = (Sx.recipes?.[rid]?.ingredients)||{};
      const maxByStoc = Object.keys(need).length>0 ? Math.min(...Object.entries(need).map(([kk,vv])=> Math.floor(((Sx.ingredients?.[kk]?.qty)||0)/Math.max(1,vv)))) : qty;
      const made = Math.max(0, Math.min(qty, maxByStoc));
      if(made>0){ FK.consumeFor(rid, made); __origAddInventory(made,q); }
    }catch(e){ __origAddInventory(qty,q); }
  };
}catch(_){}

// ---------- Done ----------
