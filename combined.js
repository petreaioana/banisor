(()=>{
  // ---------- Utilities ----------
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const fmt=(n,d=2)=> (Math.round(Number(n)*Math.pow(10,d))/Math.pow(10,d)).toFixed(d);

  // ---------- Persistence ----------
  function loadState(){
    let local=null; try{ local=JSON.parse(localStorage.getItem('fk_state')||'null'); }catch(e){}
    const server=window.__SERVER_STATE__||null;
    const def={
      version:2,
      day: (server && server.day) || 1,
      timeMin: 8*60, // start 08:00
      cash: (server && typeof server.lei==='number') ? Math.max(500, server.lei) : 500,
      reputation: 1.00,
      economyIndex: 1.00,
      seasonality: 1.00,
      marketing:{flyerDaysLeft:0,socialToday:false},
      upgrades:{ovenPlus:false,posRapid:false,timerAuto:false},
      staff:{cashier:1,total:3},
      capacity:{ prepPerDay:100, ovenBatchSize:50, ovenBatchesPerDay:2, decorPerDay:120, cashierMu:1.5 },
      products:{
        croissant:{ name:'Croissant', key:'croissant', P0:10, price:10, happyHour:{start:'16:00',end:'17:00',discount:0.10,enabled:false}, cost:{ingredients:3,laborVar:0.5}, shelfLifeDays:2, plannedQty:100, stock:[] }
      },
      // Auto-sim runtime
      autosim:{ running:false, speed:1, tickMsBase:200, tickHandle:null, aggregates:{sold:0,rev:0,cogs:0,holding:0,marketing:0,profit:0,N:0,C:0,W:0,Q:0} },
      // Boost coming from Arcade
      boost:{ percent:0, // 0..100
              qBonus:0.0, // added to quality
              wBonus:0.0, // negative reduces W
              decayPerMin: 5 // % per in-game minute
      },
      // Report placeholder
      today:null
    };
    const base = local ? Object.assign(def, local) : def;
    // Carry server cash up if larger
    const serverLei = server && typeof server.lei==='number' ? server.lei : 0; if (serverLei > (base.cash||0)) base.cash = serverLei;
    return base;
  }
  function saveState(s){
    try{ localStorage.setItem('fk_state', JSON.stringify(s)); }catch(e){}
    try{
      const payload={ lei:s.cash||0, day:s.day||1, progress:{cookies:{day:s.day||1,profitBest:0}}, meta:{ when: Date.now() } };
      if(navigator.sendBeacon){ const b=new Blob([JSON.stringify(payload)],{type:'application/json'}); navigator.sendBeacon('?action=save', b);} else { fetch('?action=save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); }
    }catch(e){}
  }

  // ---------- Global State & DOM ----------
  let S = loadState();
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  // Topbar elements
  const elDay=$('#top-day'), elTime=$('#top-time'), elCash=$('#top-cash'), elStock=$('#top-stock'), elRep=$('#top-rep'), elBoost=$('#top-boost');
  const btnPause=$('#btn-pause');
  const speedBtns=$$('.speed-btn');

  // Controls
  const inpPrice=$('#inp-price'), rngPrice=$('#rng-price'), inpLot=$('#inp-lot'), inpHHs=$('#inp-hh-start'), inpHHe=$('#inp-hh-end'), inpHHd=$('#inp-hh-disc');
  const chkFlyer=$('#chk-flyer'), chkSocial=$('#chk-social');
  const selCashiers=$('#sel-cashiers');
  const upOven=$('#up-oven'), upPos=$('#up-pos'), upAuto=$('#up-auto');
  const btnArcade=$('#btn-arcade');

  // Metrics
  const barQ=$('#bar-q'), barW=$('#bar-w'), barC=$('#bar-c'), barN=$('#bar-n');
  const mSold=$('#m-sold'), mRev=$('#m-rev'), mProf=$('#m-prof');

  // Intro
  const intro=$('#intro'), btnStart=$('#btn-start'), chkHelp=$('#chk-show-help');

  // Arcade modal elements
  const modalArc=$('#arcade-modal'), btnArcClose=$('#btn-arc-close');
  const arcBar=$('#arc-bar'), arcOven=$('#arc-oven'), arcTray=$('#arc-tray'), arcCookie=$('#arc-cookie');

  // Ticker & Banisor
  const ticker=$('#ticker');
  const banCorner=$('#banisor-corner');

  // ---------- Constants ----------
  const ECON={ F_base:120, C0:0.50, epsilon:1.6, alpha:0.75, beta:0.50, kappa:0.60, delta:0.10, Wmax:6, tau:3, rho:0.75, gammaSalvage:0.20 };
  const DAY_MINUTES=8*60; // 8h workday

  // ---------- Helpers (Inventory) ----------
  function addInventory(key, qty, q){ if(qty<=0) return; const p=S.products[key]; p.stock.push({ qty:Math.round(qty), q:clamp(q,0,1), age:0 }); }
  function consumeInventory(key, qty){ const p=S.products[key]; let left=qty, sold=0, qWeighted=0; for(const lot of p.stock){ if(left<=0) break; const take=Math.min(lot.qty, left); lot.qty-=take; left-=take; sold+=take; qWeighted += take * lot.q; } p.stock=p.stock.filter(l=>l.qty>0); const qAvg=sold>0? qWeighted/sold : avgQuality(key); return { sold, qAvg } }
  function totalStock(key){ return (S.products[key].stock||[]).reduce((s,l)=>s+l.qty,0); }
  function avgQuality(key){ const p=S.products[key]; let sum=0,cnt=0; p.stock.forEach(l=>{sum+=l.qty*l.q;cnt+=l.qty}); return cnt>0? sum/cnt : 0.86; }
  function ageAndExpire(){ const expired={}; const L=S.products.croissant.shelfLifeDays; for(const k of Object.keys(S.products)){ const p=S.products[k]; p.stock.forEach(l=>l.age++); const keep=[], exp=[]; p.stock.forEach(l=>{ if(l.age>=L) exp.push(l); else keep.push(l); }); p.stock=keep; expired[k]=exp; } return expired; }

  // ---------- UI Setters ----------
  function refreshTop(){ elDay.textContent=String(S.day); elTime.textContent=fmtTime(S.timeMin); elCash.textContent=Math.round(S.cash); elStock.textContent=totalStock('croissant'); elRep.textContent=S.reputation.toFixed(2); elBoost.textContent=Math.round(S.boost.percent)+'%'; }
  function fmtTime(min){ const m=clamp(min,0,DAY_MINUTES); const H=8+Math.floor(m/60), M=m%60; return (H<10?'0':'')+H+':' + (M<10?'0':'')+M; }
  function setMetrics({N=0,C=0,W=0,Q=0,sold=0,rev=0,profit=0}){
    barQ.style.width = Math.round(clamp(Q,0,1)*100)+'%';
    barW.style.width = Math.round(clamp(W/ECON.Wmax,0,1)*100)+'%';
    barC.style.width = Math.round(clamp(C,0,0.95)*100)+'%';
    barN.style.width = Math.round(clamp(N/ (ECON.F_base*1.5) ,0,1)*100)+'%';
    mSold.textContent=String(sold);
    mRev.textContent=fmt(rev,0);
    mProf.textContent=fmt(profit,0);
  }

  function buildBanisorSprite(sizePx=120){ const wrap=document.createElement('div'); wrap.className='banisor-sprite'; wrap.style.width=sizePx+'px'; wrap.style.height=sizePx+'px'; wrap.innerHTML=`<svg viewBox="0 0 200 200" aria-label="Banisor" role="img"><ellipse cx="100" cy="185" rx="45" ry="10" fill="#d3b37a" opacity=".35"/><g fill="#f0a82a" stroke="#c67a12" stroke-width="4"><path d="M75 160 q-8 12 8 18 h18 q10-2 6-10 q-6-14-32-8z"/><path d="M127 160 q8 12-8 18 h-18 q-10-2-6-10 q6-14 32-8z"/></g><g fill="#f0a82a" stroke="#c67a12" stroke-width="6" class="hand-wave"><path d="M150 110 q25 5 25 25" fill="none"/><circle cx="175" cy="135" r="14" /><circle cx="165" cy="128" r="6" /><circle cx="184" cy="142" r="6" /></g><g fill="#f0a82a" stroke="#c67a12" stroke-width="6"><path d="M50 110 q-25 5 -25 25" fill="none"/><circle cx="25" cy="135" r="14" /><circle cx="35" cy="128" r="6" /><circle cx="16" cy="142" r="6" /></g><defs><radialGradient id="g1" cx="35%" cy="35%"><stop offset="0%" stop-color="#ffe58a"/><stop offset="60%" stop-color="#ffd053"/><stop offset="100%" stop-color="#f2a62b"/></radialGradient></defs><circle cx="100" cy="100" r="68" fill="url(#g1)" stroke="#c67a12" stroke-width="8"/><circle cx="100" cy="100" r="56" fill="none" stroke="#ffde82" stroke-width="10" opacity=".9"/><g stroke="#c67a12" stroke-width="4" opacity=".6"><line x1="155" y1="60"  x2="165" y2="62"/><line x1="160" y1="75"  x2="170" y2="78"/><line x1="164" y1="92"  x2="175" y2="95"/><line x1="165" y1="110" x2="176" y2="112"/><line x1="160" y1="128" x2="170" y2="130"/></g><circle cx="75" cy="112" r="9" fill="#f2a035" opacity=".8"/><circle cx="125" cy="112" r="9" fill="#f2a035" opacity=".8"/><g class="eye"><circle cx="80" cy="95" r="14" fill="#fff"/><circle cx="80" cy="98" r="7" fill="#2a2a2a"/><circle cx="76" cy="92" r="3.5" fill="#fff"/></g><g class="eye"><circle cx="120" cy="95" r="14" fill="#fff"/><circle cx="120" cy="98" r="7" fill="#2a2a2a"/><circle cx="116" cy="92" r="3.5" fill="#fff"/></g><path d="M68 82 q12-10 24 0" fill="none" stroke="#a86a12" stroke-width="5" stroke-linecap="round"/><path d="M108 82 q12-10 24 0" fill="none" stroke="#a86a12" stroke-width="5" stroke-linecap="round"/><circle cx="100" cy="108" r="6" fill="#ffcf59" stroke="#c67a12" stroke-width="2"/><path d="M85 120 q15 18 30 0 q-7 18-30 0z" fill="#d3542f" stroke="#a63b1c" stroke-width="3"/><path d="M96 132 q7 6 14 0" fill="none" stroke="#e97b57" stroke-width="3" stroke-linecap="round"/><g class="hat"><ellipse cx="100" cy="52" rx="46" ry="12" fill="#1e8da1" stroke="#0f5e6b" stroke-width="5"/><path d="M65 45 q35-25 70 0 v22 h-70z" fill="#1da0b4" stroke="#0f5e6b" stroke-width="5" /><path d="M60 55 q40-18 80 0" fill="none" stroke="#147a8a" stroke-width="5" stroke-linecap="round"/></g></svg>`; return wrap; }

  // ---------- Auto‑Sim Core ----------
  function marketingBoost(){ let m=0; if(S.marketing.flyerDaysLeft>0) m+=0.10; if(S.marketing.socialToday) m+=0.25; return m; }
  function trafficN(){ return Math.round(ECON.F_base * (S.economyIndex||1) * (S.reputation||1) * (S.seasonality||1) * (1+marketingBoost())); }
  function waitW(lambda,mu){ return clamp((lambda-mu)*ECON.tau,0,ECON.Wmax); }
  function conversionC(P,P0,Q,W){ const {C0,epsilon,alpha,beta,kappa,delta}=ECON; const priceTerm=Math.exp(-epsilon*(P/P0-1)); const qualityTerm=alpha+beta*Q; const waitPen=1-Math.min(kappa, delta*W); return clamp(C0*priceTerm*qualityTerm*waitPen,0,0.95); }

  function stepAuto(){
    // if paused or not running, do nothing
    if(!S.autosim.running) return;

    const prod=S.products.croissant;
    // In‑game minute advance based on speed
    S.timeMin += 1;

    // Production planning: spread planned lot across first 120 min
    // If at minute 0: allocate plannedQty to a production queue
    if(S.timeMin===8*60){ // new day started earlier; ensure queue
      // (no-op here; day rollover handled when S.timeMin >= 8*60 + DAY_MINUTES)
    }
    const earlyWindow = (S.timeMin - 8*60) < 120; // first 2 hours
    if(earlyWindow){
      const planPerMin = Math.ceil(prod.plannedQty / 120);
      const ovenFactor = S.upgrades.ovenPlus?1.5:1;
      const ovenCapPerMin = Math.ceil((S.capacity.ovenBatchSize*ovenFactor*S.capacity.ovenBatchesPerDay)/DAY_MINUTES);
      const made = Math.max(0, Math.min(planPerMin, ovenCapPerMin));
      if(made>0){
        const baseQ = 0.86 + (S.upgrades.ovenPlus?0.02:0) + (S.upgrades.timerAuto?0.02:0) + (S.boost.qBonus||0);
        const noise = (Math.random()*0.06)-0.03;
        addInventory('croissant', made, clamp(baseQ+noise,0.70,0.98));
      }
    }

    // Customers per minute
    const Nday = trafficN();
    const lambdaMin = Nday / DAY_MINUTES; // arrivals per minute
    // Stochastic arrivals ~ Poisson(lambda) approximated via Bernoulli trials
    const arrivals = (Math.random()<lambdaMin?1:0) + (Math.random()<lambdaMin?1:0) + (Math.random()<lambdaMin?1:0);

    const baseMu=S.capacity.cashierMu + (S.upgrades.posRapid?0.8:0) + Math.max(0, S.staff.cashier-1)*0.5;
    let mu=baseMu; // service rate (customers/min)

    // Boost W bonus
    let W = waitW(arrivals, mu) + (S.boost.wBonus||0); W = Math.max(0,W);

    // Determine active price (happy hour windows)
    const P0=prod.P0; let P=prod.price;
    const hh = prod.happyHour; const HHs=toMinutes(hh.start), HHe=toMinutes(hh.end);
    if(hh.enabled && S.timeMin>=HHs && S.timeMin<HHe) P = P * (1 - hh.discount);
    if(S.marketing.socialToday) P = P; // no direct price change, only N via marketing

    const Q=avgQuality('croissant') + (S.boost.qBonus||0); // average quality including boost
    const C=conversionC(P,P0,clamp(Q,0,1),W);

    const demandMin = Math.round(arrivals * C);
    const {sold} = consumeInventory('croissant', Math.min(totalStock('croissant'), demandMin));
    const rev = sold * P;
    const cogs = sold * (prod.cost.ingredients + prod.cost.laborVar);

    // Aggregate for the day (reset at day start)
    const A=S.autosim.aggregates; A.sold+=sold; A.rev+=rev; A.cogs+=cogs; A.N=Nday; A.C=C; A.W=W; A.Q=Q;

    S.cash += rev; // collect revenue immediately

    // Gradually decay boost
    if(S.boost.percent>0){
      S.boost.percent = Math.max(0, S.boost.percent - S.boost.decayPerMin);
      S.boost.qBonus = 0.05 * (S.boost.percent/100); // up to +0.05 Q
      S.boost.wBonus = -1.2 * (S.boost.percent/100); // up to −1.2 min W
    } else { S.boost.qBonus=0; S.boost.wBonus=0; }

    // Update UI
    refreshTop();
    setMetrics({N:Nday,C,W,Q,sold:A.sold,rev:A.rev,profit:A.rev - A.cogs - (S.today?.fixed||0)});

    // Day end
    if(S.timeMin >= 8*60 + DAY_MINUTES){ endOfDay(); }
  }

  function endOfDay(){
    const prod=S.products.croissant; const A=S.autosim.aggregates; const stockLeft=totalStock('croissant');
    const holding = stockLeft * 0.10; // hold cost per unit per day
    const marketingCost = (S.marketing.socialToday?150:0) + (S.marketing.flyerDaysLeft>0 && !S.today?.chargedFlyer ? 80 : 0);
    const fixed = 150; // fixed cost per day
    const profit = A.rev - A.cogs - holding - marketingCost - fixed;

    // Expiry salvage
    const expPrev = ageAndExpire();
    const lots=expPrev['croissant']||[]; const expired=lots.reduce((s,l)=>s+l.qty,0);
    const salvage = expired * ECON.gammaSalvage * (prod.cost.ingredients + prod.cost.laborVar);
    S.cash += salvage;

    // Reputation update
    const complaints = Math.max(0, (A.N>0)? (1 - A.sold/Math.max(1, Math.round(A.N*A.C))) : 0);
    const rho=ECON.rho; const f = clamp(0.80,1.20, 0.9 + 0.25*(A.Q-0.85) - 0.05*complaints);
    S.reputation = clamp(0.80,1.20, rho*(S.reputation||1) + (1-rho)*f);

    S.today={ report:{ sold:A.sold, revenue:A.rev, cogs:A.cogs, holding, marketing:marketingCost, fixed, profit, expired, salvage, Q:A.Q, W:A.W, C:A.C }, chargedFlyer: (S.marketing.flyerDaysLeft>0)};

    // Decrease marketing durations
    if(S.marketing.flyerDaysLeft>0) S.marketing.flyerDaysLeft--; S.marketing.socialToday=false;

    // Reset aggregates for next day
    S.autosim.aggregates={sold:0,rev:0,cogs:0,holding:0,marketing:0,profit:0,N:0,C:0,W:0,Q:0};

    // Advance day & reset time
    S.day += 1; S.timeMin = 8*60; // start next day 08:00

    // Re-apply planned lot next day (user can change in pause). Nothing else needed.

    saveState(S);
    refreshTop();

    // Show small confetti if profit > 0
    if(profit>0) spawnConfetti();
  }

  function spawnConfetti(){
    const colors=['#f9c74f','#f9844a','#90be6d','#fda65f','#87b6e5','#f27ba5'];
    const container=document.createElement('div'); container.className='confetti-container'; container.style.position='fixed'; container.style.inset='0'; container.style.pointerEvents='none'; container.style.overflow='hidden'; document.body.appendChild(container);
    for(let i=0;i<36;i++){ const d=document.createElement('div'); d.className='confetti-piece'; d.style.position='absolute'; d.style.width='10px'; d.style.height='10px'; d.style.borderRadius='50%'; d.style.backgroundColor=colors[Math.floor(Math.random()*colors.length)]; d.style.left=Math.random()*100+'%'; d.style.animation='confetti-fall 3s linear forwards'; d.style.animationDelay=(Math.random()*0.5)+'s'; container.appendChild(d); }
    setTimeout(()=>{ container.remove(); }, 3200);
  }

  // ---------- Controls & Pause/Speed ----------
  function applyControlsToState(){ const prod=S.products.croissant; prod.price=clamp(parseFloat(inpPrice.value)||10, prod.P0*0.7, prod.P0*1.3); prod.plannedQty=Math.max(0, Math.round(parseFloat(inpLot.value)||0)); prod.happyHour.start=inpHHs.value||'16:00'; prod.happyHour.end=inpHHe.value||'17:00'; prod.happyHour.discount=clamp((parseFloat(inpHHd.value)||10)/100, 0.05, 0.20); prod.happyHour.enabled=true; S.marketing.socialToday = !!chkSocial.checked; if(chkFlyer.checked && S.marketing.flyerDaysLeft<=0){ S.marketing.flyerDaysLeft=2; S.today={...(S.today||{}), chargedFlyer:true}; if(S.cash>=80){ S.cash-=80; } }
    S.staff.cashier=parseInt(selCashiers.value,10)||1; S.upgrades.ovenPlus=!!upOven.checked; S.upgrades.posRapid=!!upPos.checked; S.upgrades.timerAuto=!!upAuto.checked; saveState(S); refreshTop(); }

  function setPaused(paused){ S.autosim.running = !paused; btnPause.textContent = paused? '▶️ Reia' : '⏸️ Pauză'; // Disable inputs when running
    $$('#left-controls input, #left-controls select').forEach(el=>{ el.disabled = !paused; }); }

  function setSpeed(mult){ S.autosim.speed = mult; speedBtns.forEach(b=>b.classList.toggle('active', Number(b.dataset.speed)===mult)); }

  function loopStart(){ if(S.autosim.tickHandle) clearInterval(S.autosim.tickHandle); const tick = ()=>{ for(let i=0;i<S.autosim.speed;i++) stepAuto(); }; S.autosim.tickHandle = setInterval(tick, S.autosim.tickMsBase); }

  // ---------- Arcade Mini‑Game ----------
  let arcadeRunning=false, arcadeTimer=null, arcElapsed=0;
  function openArcade(){ modalArc.hidden=false; arcadeRunning=true; arcElapsed=0; arcBar.style.width='0%'; arcOven.src='oven_open.png'; arcTray.style.opacity='1'; document.addEventListener('keydown', onArcadeKey); // animation keyframes are in CSS
    setTimeout(()=>{ arcOven.src='oven_closed.png'; }, 600); setTimeout(()=>{ arcOven.src='oven_open.png'; }, 2400);
    arcadeTimer=setInterval(()=>{ arcElapsed+=100; arcBar.style.width = Math.min(100,(arcElapsed/3000)*100)+'%'; if(arcElapsed>=3000) { finishArcade(1.0); } },100); }
  function onArcadeKey(e){ if(!arcadeRunning) return; if(e.code==='Space'){ // 55%±7%
      const p=arcElapsed/3000; const inWin = p>=0.48 && p<=0.62; finishArcade(p, inWin); }
  }
  function finishArcade(p, inWin){ if(!arcadeRunning) return; arcadeRunning=false; document.removeEventListener('keydown', onArcadeKey); clearInterval(arcadeTimer); const ideal=0.55; const d=Math.abs(p-ideal); let boost=0; let q=0.9 - d*0.5; if(inWin){ boost = Math.max(10, Math.round((1 - d/0.07)*30)); q = clamp(q,0.88,0.97); } else { boost = 5; q = clamp(0.80,0.85,0.86 - d*0.4); }
    // Add some fresh inventory from manual success
    addInventory('croissant', 10, q);
    // Apply boost percent (cap at 100)
    S.boost.percent = clamp(S.boost.percent + boost, 0, 100);
    S.boost.qBonus = 0.05 * (S.boost.percent/100);
    S.boost.wBonus = -1.2 * (S.boost.percent/100);
    refreshTop(); setTimeout(()=>{ modalArc.hidden=true; }, 400); saveState(S); }

  // ---------- Time helpers ----------
  function toMinutes(hhmm){ const [h,m]=String(hhmm||'16:00').split(':').map(Number); return (h*60 + m); }

  // ---------- Init ----------
  function hydrateControls(){ const prod=S.products.croissant; inpPrice.value=prod.price; rngPrice.value=prod.price; inpLot.value=prod.plannedQty; inpHHs.value=prod.happyHour.start; inpHHe.value=prod.happyHour.end; inpHHd.value=Math.round((prod.happyHour.discount||0.10)*100); chkFlyer.checked=S.marketing.flyerDaysLeft>0; chkSocial.checked=S.marketing.socialToday; selCashiers.value=String(S.staff.cashier||1); upOven.checked=!!S.upgrades.ovenPlus; upPos.checked=!!S.upgrades.posRapid; upAuto.checked=!!S.upgrades.timerAuto; }

  function mount(){ refreshTop(); hydrateControls(); banCorner.innerHTML=''; banCorner.appendChild(buildBanisorSprite(120)); ticker.textContent='Auto‑sim '+(S.autosim.running? 'activ' : 'în pauză'); if(localStorage.getItem('fk_help')==='off'){ intro.remove(); } }

  // ---------- Wire events ----------
  btnStart?.addEventListener('click', ()=>{ intro.remove(); localStorage.setItem('fk_help', chkHelp.checked? 'on':'off'); });
  btnPause.addEventListener('click', ()=>{ const nowPaused=S.autosim.running; setPaused(nowPaused); ticker.textContent = nowPaused? 'Auto‑sim în pauză' : 'Auto‑sim activ…'; if(!nowPaused){ applyControlsToState(); } });
  rngPrice.addEventListener('input', ()=> inpPrice.value=rngPrice.value);
  inpPrice.addEventListener('input', ()=> rngPrice.value=inpPrice.value);
  [inpLot, inpHHs, inpHHe, inpHHd, chkFlyer, chkSocial, selCashiers, upOven, upPos, upAuto].forEach(el=> el.addEventListener('change', ()=>{}));
  speedBtns.forEach(b=> b.addEventListener('click', ()=> setSpeed(Number(b.dataset.speed))));
  btnArcade.addEventListener('click', ()=> openArcade());
  btnArcClose.addEventListener('click', ()=> { modalArc.hidden=true; arcadeRunning=false; clearInterval(arcadeTimer); document.removeEventListener('keydown', onArcadeKey); });

  // ---------- Start engine ----------
  setPaused(false); // start running
  loopStart();
  mount();
})();
