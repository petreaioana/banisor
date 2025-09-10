// assets/js/dashboard/engine.js
import { FK } from '../shared/state.js';

const $ = s=>document.querySelector(s); const $$ = s=>Array.from(document.querySelectorAll(s));
const clamp = FK.clamp;

let S = FK.getState();

// DOM
const elDay=$('#top-day'), elTime=$('#top-time'), elCash=$('#top-cash'), elStock=$('#top-stock'), elRep=$('#top-rep'), elBoost=$('#top-boost');
const btnPause=$('#btn-pause'); const speedBtns=$$('.speed-btn');
const inpPrice=$('#inp-price'), rngPrice=$('#rng-price'), inpLot=$('#inp-lot'), inpHHs=$('#inp-hh-start'), inpHHe=$('#inp-hh-end'), inpHHd=$('#inp-hh-disc');
const chkFlyer=$('#chk-flyer'), chkSocial=$('#chk-social'), selCashiers=$('#sel-cashiers');
const upOven=$('#up-oven'), upPos=$('#up-pos'), upAuto=$('#up-auto');
const barQ=$('#bar-q'), barW=$('#bar-w'), barC=$('#bar-c'), barN=$('#bar-n'); const mSold=$('#m-sold'), mRev=$('#m-rev'), mProf=$('#m-prof');
const ticker=$('#ticker'); const banCorner=$('#banisor-corner');

// Econ const
const ECON={ F_base:120, C0:0.50, epsilon:1.6, alpha:0.75, beta:0.50, kappa:0.60, delta:0.10, Wmax:6, tau:3, rho:0.75, gammaSalvage:0.20 };
const DAY_MINUTES=FK.DAY_MINUTES;

// Sprite mic (opțional)
function buildBanisorSprite(sizePx=120){
  const wrap=document.createElement('div');
  wrap.className='banisor-sprite'; wrap.style.width=sizePx+'px'; wrap.style.height=sizePx+'px';
  wrap.innerHTML=`<svg viewBox="0 0 200 200" aria-label="Banisor" role="img"><ellipse cx="100" cy="185" rx="45" ry="10" fill="#d3b37a" opacity=".35"/><g fill="#f0a82a" stroke="#c67a12" stroke-width="4"><path d="M75 160 q-8 12 8 18 h18 q10-2 6-10 q-6-14-32-8z"/><path d="M127 160 q8 12-8 18 h-18 q-10-2-6-10 q6-14 32-8z"/></g><g fill="#f0a82a" stroke="#c67a12" stroke-width="6" class="hand-wave"><path d="M150 110 q25 5 25 25" fill="none"/><circle cx="175" cy="135" r="14" /><circle cx="165" cy="128" r="6" /><circle cx="184" cy="142" r="6" /></g><g fill="#f0a82a" stroke="#c67a12" stroke-width="6"><path d="M50 110 q-25 5 -25 25" fill="none"/><circle cx="25" cy="135" r="14" /><circle cx="35" cy="128" r="6" /><circle cx="16" cy="142" r="6" /></g><defs><radialGradient id="g1" cx="35%" cy="35%"><stop offset="0%" stop-color="#ffe58a"/><stop offset="60%" stop-color="#ffd053"/><stop offset="100%" stop-color="#f2a62b"/></radialGradient></defs><circle cx="100" cy="100" r="68" fill="url(#g1)" stroke="#c67a12" stroke-width="8"/><circle cx="100" cy="100" r="56" fill="none" stroke="#ffde82" stroke-width="10" opacity=".9"/></svg>`;
  return wrap;
}

// Helpers inv
function addInventory(qty,q){ FK.addInventory('croissant', qty, q); }
function totalStock(){ return FK.totalStock('croissant'); }
function avgQuality(){
  const p=S.products.croissant; let sum=0,cnt=0;
  (p.stock||[]).forEach(l=>{sum+=l.qty*l.q;cnt+=l.qty}); return cnt>0? sum/cnt : 0.86;
}
function consumeInventory(qty){
  const p=S.products.croissant; let left=qty, sold=0, qWeighted=0;
  for(const lot of p.stock){ if(left<=0) break; const take=Math.min(lot.qty,left); lot.qty-=take; left-=take; sold+=take; qWeighted+=take*lot.q; }
  p.stock=p.stock.filter(l=>l.qty>0); const qAvg=sold>0? qWeighted/sold : avgQuality(); FK.saveState(); return {sold,qAvg};
}

function marketingBoost(){ let m=0; if(S.marketing.flyerDaysLeft>0) m+=0.10; if(S.marketing.socialToday) m+=0.25; return m; }
function trafficN(){ return Math.round(ECON.F_base * (S.economyIndex||1) * (S.reputation||1) * (S.seasonality||1) * (1+marketingBoost())); }
function waitW(lambda,mu){ return clamp((lambda-mu)*ECON.tau,0,ECON.Wmax); }
function conversionC(P,P0,Q,W){ const {C0,epsilon,alpha,beta,kappa,delta}=ECON; const priceTerm=Math.exp(-epsilon*(P/P0-1)); const qualityTerm=alpha+beta*Q; const waitPen=1-Math.min(kappa, delta*W); return clamp(C0*priceTerm*qualityTerm*waitPen,0,0.95); }

function fmtTime(min){ const m=Math.max(0,Math.min(min,DAY_MINUTES)); const H=8+Math.floor(m/60), M=m%60; return `${H<10?'0':''}${H}:${M<10?'0':''}${M}`;}
function fmt(n,d=2){ return (Math.round(Number(n)*Math.pow(10,d))/Math.pow(10,d)).toFixed(d); }

function refreshTop(){
  S = FK.getState();
  elDay.textContent=String(S.day);
  elTime.textContent=fmtTime(S.timeMin);
  elCash.textContent=Math.round(S.cash);
  elStock.textContent=totalStock();
  elRep.textContent=S.reputation.toFixed(2);
  elBoost.textContent=Math.round(S.boost.percent)+'%';
}
function setMetrics({N=0,C=0,W=0,Q=0,sold=0,rev=0,profit=0}){
  barQ.style.width = Math.round(Math.max(0,Math.min(Q,1))*100)+'%';
  barW.style.width = Math.round(Math.max(0,Math.min(W/ECON.Wmax,1))*100)+'%';
  barC.style.width = Math.round(Math.max(0,Math.min(C,0.95))*100)+'%';
  barN.style.width = Math.round(Math.max(0,Math.min(N/(ECON.F_base*1.5),1))*100)+'%';
  mSold.textContent=String(sold); mRev.textContent=fmt(rev,0); mProf.textContent=fmt(profit,0);
}

function stepAuto(){
  if(!S.autosim.running) return;
  const prod=S.products.croissant;
  S.timeMin += 1;

  const earlyWindow = (S.timeMin - 8*60) < 120;
  if(earlyWindow){
    const planPerMin = Math.ceil(prod.plannedQty / 120);
    const ovenFactor = S.upgrades.ovenPlus?1.5:1;
    const ovenCapPerMin = Math.ceil((S.capacity.ovenBatchSize*ovenFactor*S.capacity.ovenBatchesPerDay)/DAY_MINUTES);
    const made = Math.max(0, Math.min(planPerMin, ovenCapPerMin));
    if(made>0){
      const baseQ = 0.86 + (S.upgrades.ovenPlus?0.02:0) + (S.upgrades.timerAuto?0.02:0) + (S.boost.qBonus||0);
      const noise = (Math.random()*0.06)-0.03;
      addInventory(made, Math.max(0.70, Math.min(0.98, baseQ+noise)));
    }
  }

  const Nday = trafficN();
  const lambdaMin = Nday / DAY_MINUTES;
  const arrivals = (Math.random()<lambdaMin?1:0) + (Math.random()<lambdaMin?1:0) + (Math.random()<lambdaMin?1:0);

  const baseMu=S.capacity.cashierMu + (S.upgrades.posRapid?0.8:0) + Math.max(0, S.staff.cashier-1)*0.5;
  let W = waitW(arrivals, baseMu) + (S.boost.wBonus||0); W = Math.max(0,W);

  const P0=prod.P0; let P=prod.price;
  const hh = prod.happyHour; const HHs=toMinutes(hh.start), HHe=toMinutes(hh.end);
  if(hh.enabled && S.timeMin>=HHs && S.timeMin<HHe) P = P * (1 - hh.discount);

  const Q=avgQuality() + (S.boost.qBonus||0);
  const C=conversionC(P,P0,Math.max(0,Math.min(Q,1)),W);

  const demandMin = Math.round(arrivals * C);
  const {sold} = consumeInventory(Math.min(totalStock(), demandMin));
  const rev = sold * P;
  const cogs = sold * (prod.cost.ingredients + prod.cost.laborVar);

  const A=S.autosim.aggregates; A.sold+=sold; A.rev+=rev; A.cogs+=cogs; A.N=Nday; A.C=C; A.W=W; A.Q=Q;

  S.cash += rev;

  if(S.boost.percent>0){
    S.boost.percent = Math.max(0, S.boost.percent - S.boost.decayPerMin);
    S.boost.qBonus = 0.05 * (S.boost.percent/100);
    S.boost.wBonus = -1.2 * (S.boost.percent/100);
  } else { S.boost.qBonus=0; S.boost.wBonus=0; }

  FK.setState(S);
  refreshTop();
  setMetrics({N:Nday,C,W,Q,sold:A.sold,rev:A.rev,profit:A.rev - A.cogs - (S.today?.fixed||0)});

  if(S.timeMin >= 8*60 + DAY_MINUTES){ endOfDay(); }
}

function toMinutes(hhmm){ const [h,m]=String(hhmm||'16:00').split(':').map(Number); return (h*60 + m); }

function endOfDay(){
  const prod=S.products.croissant; const A=S.autosim.aggregates; const stockLeft=totalStock();
  const holding = stockLeft * 0.10;
  const marketingCost = (S.marketing.socialToday?150:0) + (S.marketing.flyerDaysLeft>0 && !S.today?.chargedFlyer ? 80 : 0);
  const fixed = 150;
  const profit = A.rev - A.cogs - holding - marketingCost - fixed;

  // expirare (simplificată: doar age++)
  const L=prod.shelfLifeDays;
  prod.stock.forEach(l=>l.age++);
  prod.stock = prod.stock.filter(l=> l.age < L);

  const complaints = Math.max(0, (A.N>0)? (1 - A.sold/Math.max(1, Math.round(A.N*A.C))) : 0);
  const rho=ECON.rho; const f = Math.max(0.80, Math.min(1.20, 0.9 + 0.25*(A.Q-0.85) - 0.05*complaints));
  S.reputation = Math.max(0.80, Math.min(1.20, rho*(S.reputation||1) + (1-rho)*f));

  S.today={ report:{ sold:A.sold, revenue:A.rev, cogs:A.cogs, holding, marketing:marketingCost, fixed, profit, Q:A.Q, W:A.W, C:A.C } };

  if(S.marketing.flyerDaysLeft>0) S.marketing.flyerDaysLeft--;
  S.marketing.socialToday=false;
  S.autosim.aggregates={sold:0,rev:0,cogs:0,holding:0,marketing:0,profit:0,N:0,C:0,W:0,Q:0};
  S.day += 1; S.timeMin = 8*60;

  FK.setState(S);
  refreshTop();
}

function setPaused(paused){
  S.autosim.running = !paused;
  btnPause.textContent = paused? '▶️ Reia' : '⏸️ Pauză';
  $$('#left-controls input, #left-controls select').forEach(el=>{ el.disabled = !paused; });
  FK.setState(S);
}
function setSpeed(mult){ S.autosim.speed = mult; speedBtns.forEach(b=>b.classList.toggle('active', Number(b.dataset.speed)===mult)); FK.setState(S); }
function loopStart(){ if(window.__tick){ clearInterval(window.__tick); } const tick = ()=>{ for(let i=0;i<S.autosim.speed;i++) stepAuto(); }; window.__tick = setInterval(tick, S.autosim.tickMsBase); }

function hydrateControls(){
  const prod=S.products.croissant;
  $('#inp-price').value=prod.price; $('#rng-price').value=prod.price;
  $('#inp-lot').value=prod.plannedQty; $('#inp-hh-start').value=prod.happyHour.start; $('#inp-hh-end').value=prod.happyHour.end;
  $('#inp-hh-disc').value=Math.round((prod.happyHour.discount||0.10)*100);
  $('#chk-flyer').checked=S.marketing.flyerDaysLeft>0; $('#chk-social').checked=S.marketing.socialToday;
  $('#sel-cashiers').value=String(S.staff.cashier||1);
  $('#up-oven').checked=!!S.upgrades.ovenPlus; $('#up-pos').checked=!!S.upgrades.posRapid; $('#up-auto').checked=!!S.upgrades.timerAuto;
}
function applyControlsToState(){
  const prod=S.products.croissant;
  prod.price=clamp(parseFloat(inpPrice.value)||10, prod.P0*0.7, prod.P0*1.3);
  prod.plannedQty=Math.max(0, Math.round(parseFloat(inpLot.value)||0));
  prod.happyHour.start=inpHHs.value||'16:00';
  prod.happyHour.end=inpHHe.value||'17:00';
  prod.happyHour.discount=clamp((parseFloat(inpHHd.value)||10)/100, 0.05, 0.20);
  prod.happyHour.enabled=true;
  S.marketing.socialToday = !!chkSocial.checked;
  if(chkFlyer.checked && S.marketing.flyerDaysLeft<=0){ S.marketing.flyerDaysLeft=2; if(S.cash>=80){ S.cash-=80; } }
  S.staff.cashier=parseInt(selCashiers.value,10)||1; S.upgrades.ovenPlus=!!upOven.checked; S.upgrades.posRapid=!!upPos.checked; S.upgrades.timerAuto=!!upAuto.checked;
  FK.setState(S); refreshTop();
}

function mount(){
  refreshTop(); hydrateControls();
  if(banCorner){ banCorner.innerHTML=''; banCorner.appendChild(buildBanisorSprite(120)); }
  if(ticker) ticker.textContent='Auto-sim '+(S.autosim.running? 'activ' : 'în pauză');
}

// Events
btnPause.addEventListener('click', ()=>{ const nowPaused=S.autosim.running; setPaused(nowPaused); if(!nowPaused){ applyControlsToState(); } });
rngPrice.addEventListener('input', ()=> inpPrice.value=rngPrice.value);
inpPrice.addEventListener('input', ()=> rngPrice.value=inpPrice.value);
[ inpLot, inpHHs, inpHHe, inpHHd, chkFlyer, chkSocial, selCashiers, upOven, upPos, upAuto ].forEach(el=> el.addEventListener('change', ()=>{}));
speedBtns.forEach(b=> b.addEventListener('click', ()=> setSpeed(Number(b.dataset.speed))));

// Start
setPaused(false);
loopStart();
mount();
