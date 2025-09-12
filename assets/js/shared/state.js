// assets/js/shared/state.js
export const FK = (() => {
  // Utils
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  // Program: 08:00–20:00 => 12h
  const DAY_MINUTES = 12*60;

  // v4 defaults (compat)
  const DEF = {
    version: 4,
    day: 1,
    timeMin: 8*60,
    cash: 500,
    reputation: 1.00,
    economyIndex: 1.00,
    seasonality: 1.00,
    marketing:{flyerDaysLeft:0,socialToday:false},
    upgrades:{ovenPlus:false,posRapid:false,timerAuto:false},
    staff:{cashier:1,total:3},
    capacity:{ prepPerDay:100, ovenBatchSize:50, ovenBatchesPerDay:2, decorPerDay:120, cashierMu:1.5 },
    products:{
      croissant:{ name:'Croissant', key:'croissant', P0:10, price:10,
        happyHour:{start:'16:00',end:'17:00',discount:0.10,enabled:false},
        cost:{ingredients:3,laborVar:0.5}, shelfLifeDays:2, plannedQty:100, stock:[], recipeId:'croissant_plain' }
    },
    autosim:{ running:false, speed:1, tickMsBase:200, aggregates:{sold:0,rev:0,cogs:0,holding:0,marketing:0,profit:0,N:0,C:0,W:0,Q:0} },
    boost:{ percent:0, qBonus:0, wBonus:0, trafficMult:1.00, decayPerMin:5, buffs: [] },
    ingredients:{
      flour:{qty:30,shelfLife:30}, milk:{qty:10,shelfLife:5}, sugar:{qty:20,shelfLife:90}, cacao:{qty:5,shelfLife:180}, chocolate_chips:{qty:8,shelfLife:180}, strawberries:{qty:6,shelfLife:3}, coconut:{qty:6,shelfLife:180}, sprinkles:{qty:6,shelfLife:365}
    },
    recipes:{
      croissant_plain:{ingredients:{flour:1, milk:1, sugar:1}}, croissant_cacao:{ingredients:{flour:1, milk:1, sugar:1, cacao:1}},
      croissant_choco:{ingredients:{flour:1, milk:1, sugar:1, chocolate_chips:1}}, croissant_straw:{ingredients:{flour:1, milk:1, sugar:1, strawberries:1}}, croissant_coconut:{ingredients:{flour:1, milk:1, sugar:1, coconut:1}}
    },
    today:null
  };

  // v5 additions
  const DEF_V5 = {
    version: 5,
    world: {
      year:1, season:'primavara', day:1, minute:8*60, open:8*60, close:20*60,
      seasons: { primavara:{mult:1.00}, vara:{mult:1.15}, toamna:{mult:0.95}, iarna:{mult:0.85} }
    },
    meta: { lastSeenTs: Date.now(), slot:'autosave' },
    economy: { competitorIndex:1.00, weather:'sunny' }
  };

  // BroadcastChannel for cross-tab sync
  let BC=null; try{ BC = new BroadcastChannel('finkids'); }catch(_){ BC=null; }
  function emit(type, payload){ try{ BC && BC.postMessage({type, payload}); }catch(_){} }
  if (BC) {
    BC.onmessage = (ev)=>{
      const m = ev?.data||{};
      if(m.type==='state:pull') emit('state:push', S);
      // Optionally accept pushes from other tabs (soft-merge)
      if(m.type==='state:push' && m.payload && typeof m.payload==='object'){
        try{ S = Object.assign(S, m.payload); }catch(_){ }
      }
    };
  }

  function loadRaw(){
    let local=null; try{ local=JSON.parse(localStorage.getItem('fk_state')||'null'); }catch(e){}
    const server = (typeof window!=='undefined') ? window.__SERVER_STATE__ : null;
    let base = {...DEF};
    if (server) {
      base.day = server.day ?? base.day;
      if (typeof server.lei === 'number') base.cash = Math.max(base.cash, server.lei);
    }
    if (local) base = Object.assign(base, local);
    return base;
  }

  // Migration to v5 (non-destructive)
  function migrateAny(src){
    const next = Object.assign({}, DEF, src||{});
    // ensure products/boost/ingredients/recipes
    next.products = next.products || { croissant: {...DEF.products.croissant} };
    if (!next.products.croissant.recipeId) next.products.croissant.recipeId = 'croissant_plain';
    next.boost = next.boost || { percent:0, qBonus:0, wBonus:0, trafficMult:1.00, buffs:[] };
    if (!Array.isArray(next.boost.buffs)) next.boost.buffs=[];
    if (!next.ingredients) next.ingredients = JSON.parse(JSON.stringify(DEF.ingredients));
    if (!next.recipes) next.recipes = JSON.parse(JSON.stringify(DEF.recipes));

    // v5 world/meta/economy + staff defaults
    if (!next.version || next.version < 5) {
      // seed world from v4 fields
      const day = Number(next.day)||1;
      const minute = Number(next.timeMin)||8*60;
      next.world = Object.assign({}, DEF_V5.world, { day, minute });
      next.meta = Object.assign({}, DEF_V5.meta, { lastSeenTs: Date.now() });
      next.economy = Object.assign({}, DEF_V5.economy);
      next.version = 5;
    } else {
      // ensure world keys exist
      next.world = Object.assign({}, DEF_V5.world, next.world||{});
      next.meta = Object.assign({}, DEF_V5.meta, next.meta||{});
      next.economy = Object.assign({}, DEF_V5.economy, next.economy||{});
      next.version = 5;
    }

    // Staff richer defaults (team, wages)
    next.staff = next.staff || {cashier:1,total:3};
    if (!Array.isArray(next.staff.team)) {
      next.staff.team = [
        {id:'ion', skill:0.62, mood:0.78, wage:70},
        {id:'ana', skill:0.71, mood:0.83, wage:75}
      ];
    }
    if (typeof next.staff.wagePerCashier !== 'number') next.staff.wagePerCashier = 70;

    // keep backwards compatibility mirrors
    next.day = next.world.day;
    next.timeMin = next.world.minute;
    return next;
  }

let S = migrateAny(loadRaw());

// Activate fast-forward on load (cap 7 days)
try{ fastForwardFromLastSeen(); }catch(e){}

  // Fallback storage events for cross-tab sync
  try{
    if (typeof window!== 'undefined' && window.addEventListener){
      window.addEventListener('storage', (ev)=>{
        if(ev && ev.key==='fk_state'){
          try{ const next = JSON.parse(ev.newValue||'null'); if(next && typeof next==='object'){ S = Object.assign(S, next); } }catch(e){}
        }
      });
    }
  }catch(e){}

  function save() {
    // keep compatibility mirrors updated
    if (S && S.world) { S.day = S.world.day; S.timeMin = S.world.minute; }
    try{ localStorage.setItem('fk_state', JSON.stringify(S)); localStorage.setItem('fk_last_seen', String(Date.now())); }catch(e){}
    emit('state:saved', {ts:Date.now()});
    // optional server snapshot (available only on dashboard route)
    try{
      const payload={ lei:S.cash||0, day:S.day||1, progress:{cookies:{day:S.day||1,profitBest:0}}, meta:{ when: Date.now() } };
      if (typeof navigator!=='undefined' && navigator.sendBeacon) {
        const b=new Blob([JSON.stringify(payload)],{type:'application/json'});
        navigator.sendBeacon('index.php?action=save', b);
      } else if (typeof fetch!=='undefined') {
        fetch('index.php?action=save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      }
    }catch(e){}
  }

  // Export / Import
  function exportJSON(){ try{ const blob = new Blob([JSON.stringify(S,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`finkids_save_v${S.version||5}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 5000); }catch(e){} }
  async function importJSON(file){ try{ const txt=await file.text(); const next=JSON.parse(txt); S = migrateAny(next); save(); emit('state:push', S); }catch(e){} }

  // WorldClock helpers
  function nextSeason(s){ return s==='primavara'?'vara': s==='vara'?'toamna': s==='toamna'?'iarna':'primavara'; }
  function rand(min,max){ return min + Math.random()*(max-min); }
  function rollWeatherFor(season){
    // Simple seasonal distribution
    const r=Math.random();
    if(season==='iarna') return r<0.15?'snow': (r<0.45?'rain':'sunny');
    if(season==='toamna') return r<0.10?'snow': (r<0.45?'rain':'sunny');
    if(season==='vara') return r<0.05?'rain':'sunny';
    return r<0.20?'rain':'sunny'; // primavara
  }
  function endOfDayHook(){
    S.world.minute = S.world.open;
    S.timeMin = S.world.open;
    S.world.day += 1; S.day = S.world.day;
    if (S.world.day>28){ S.world.day=1; S.world.season = nextSeason(S.world.season); }
    // new day: roll economy factors
    try{
      S.economy = S.economy || {};
      S.economy.weather = rollWeatherFor(S.world.season);
      S.economy.competitorIndex = Math.max(0.9, Math.min(1.1, +(rand(0.95,1.05)).toFixed(2)));
    }catch(e){}
    save(); emit('day:ended', {day:S.world.day});
  }
  function tickMinutes(n=1){
    const step = Math.max(1, Math.round(n));
    S.world.minute += step; S.timeMin = S.world.minute;
    // decay buffs with game minutes
    try{ tickBuffs(step); }catch(e){}
    if (S.world.minute > S.world.close) { S.world.minute = S.world.close; S.timeMin = S.world.minute; }
    save();
  }

  // Fast-forward (skeleton; not auto-invoked yet)
  function fastForwardFromLastSeen(){
    try{
      const last = Number(localStorage.getItem('fk_last_seen'))||S.meta.lastSeenTs||Date.now();
      const realMin = Math.floor((Date.now()-last)/60000);
      if(realMin<5) return;
      const maxDays=7; const ratioMinPerDay=10; // 10 min real ~= 1 zi in-game (placeholder)
      let daysToSim = Math.min(maxDays, Math.floor(realMin/ratioMinPerDay));
      for(let d=0; d<daysToSim; d++){ try{ simulateOneDayAggregate(); }catch(_){} }
      save();
    }catch(e){}
  }
  function simulateOneDayAggregate(){
    // Aggregate a day of simulation without per-minute loop
    const prod=S.products.croissant;
    const ECON={ F_base:120, C0:0.50, epsilon:1.6, alpha:0.75, beta:0.50, kappa:0.60, delta:0.10, Wmax:6, tau:3, rho:0.75 };

    // 1) Morning production within capacities and ingredients
    try{
      const ovenFactor = S.upgrades?.ovenPlus?1.5:1;
      const capDay = Math.ceil((S.capacity.ovenBatchSize*ovenFactor)*(S.capacity.ovenBatchesPerDay||2));
      const plan = Math.max(0, Math.round(prod.plannedQty||0));
      const qtyTarget = Math.max(0, Math.min(plan, capDay));
      const rid = (prod.recipeId||'croissant_plain');
      const need=(S.recipes?.[rid]?.ingredients)||{};
      const maxByStoc = Object.keys(need).length>0 ? Math.min(...Object.entries(need).map(([k,v])=> Math.floor(((S.ingredients?.[k]?.qty)||0)/Math.max(1,v)))) : qtyTarget;
      const made = Math.max(0, Math.min(qtyTarget, isFinite(maxByStoc)?maxByStoc:qtyTarget));
      if(made>0){
        consumeFor(rid, made);
        const baseQ = 0.86 + (S.upgrades?.ovenPlus?0.02:0) + (S.upgrades?.timerAuto?0.02:0) + (S.boost?.qBonus||0);
        const noise = (Math.random()*0.05)-0.025;
        addInventory('croissant', made, Math.max(0.70, Math.min(0.98, baseQ+noise)));
      }
    }catch(e){}

    // 2) Demand estimation
    const season = S.world?.season||'primavara';
    const seasonMult = (S.world?.seasons?.[season]?.mult) ?? 1.00;
    const weather = S.economy?.weather||'sunny';
    const weatherMult = weather==='rain'?0.92 : weather==='snow'?0.88 : 1.00;
    const compMult = (S.economy?.competitorIndex)||1.00;
    const baseN = ECON.F_base * (S.economyIndex||1) * (S.reputation||1) * seasonMult * weatherMult * compMult * (1+ (S.marketing?.flyerDaysLeft>0?0.10:0) + (S.marketing?.socialToday?0.25:0));
    const Nday = Math.round(baseN * (S.boost?.trafficMult||1));
    const lambdaMin = Nday / (S.world?.close - (S.world?.open||480) || DAY_MINUTES);

    // 3) Service capacity (mu) with staff factor
    const cashiers = Math.max(1, Number(S.staff?.cashier)||1);
    const baseMu=(S.capacity?.cashierMu||1.5) + (S.upgrades?.posRapid?0.8:0) + Math.max(0, cashiers-1)*0.5;
    const team = Array.isArray(S.staff?.team)? S.staff.team : [];
    const avgSkill = team.length? team.reduce((s,t)=>s+(t.skill||0),0)/team.length : 0.65;
    const avgMood = team.length? team.reduce((s,t)=>s+(t.mood||0),0)/team.length : 0.80;
    const staffFactor = 1 + 0.25*(avgSkill-0.6) + 0.2*(avgMood-0.8);
    const mu = Math.max(0.5, baseMu * staffFactor);

    // 4) Wait & conversion
    const waitSeason = season==='vara'? 0.5 : 0.0;
    const waitWeather = weather==='rain'?0.2 : weather==='snow'?0.4 : 0.0;
    const W = Math.max(0, Math.min(ECON.Wmax, (lambdaMin-mu)*ECON.tau + waitSeason + waitWeather + (S.boost?.wBonus||0)));
    const P0=prod.P0; const basePrice=prod.price;
    const hh = prod.happyHour||{enabled:false,discount:0.10,start:'16:00',end:'17:00'};
    const HHs = (Number((hh.start||'16:00').split(':')[0])*60 + Number((hh.start||'16:00').split(':')[1]||0));
    const HHe = (Number((hh.end||'17:00').split(':')[0])*60 + Number((hh.end||'17:00').split(':')[1]||0));
    const HHmins = Math.max(0, Math.min((S.world?.close||1200), HHe) - Math.max((S.world?.open||480), HHs));
    const P = (hh.enabled? (basePrice*(1 - (hh.discount||0.10)*Math.max(0,HHmins)/Math.max(1,DAY_MINUTES))) : basePrice);
    const qSeason = season==='toamna'? 0.02 : 0;
    const Q = Math.max(0, Math.min(1, (avgQualityEst()+ (S.boost?.qBonus||0) + qSeason)));
    function avgQualityEst(){
      try{ const p=S.products.croissant; let sum=0,cnt=0; (p.stock||[]).forEach(l=>{sum+=l.qty*l.q;cnt+=l.qty}); return cnt>0? sum/cnt : 0.86; }catch(_){ return 0.86; }
    }
    function conversionC(P,P0,Q,W){ const {C0,epsilon,alpha,beta,kappa,delta}=ECON; const priceTerm=Math.exp(-epsilon*(P/P0-1)); const qualityTerm=alpha+beta*Q; const waitPen=1-Math.min(kappa, delta*W); return Math.max(0, Math.min(0.95, C0*priceTerm*qualityTerm*waitPen)); }
    const C = conversionC(P,P0,Q,W);

    // 5) Sales and costs
    let demand = Math.round(Nday * C);
    // consume finished goods FIFO
    let sold=0; try{
      const p=S.products.croissant; for(const lot of (p.stock||[])){ if(demand<=0) break; const take=Math.min(lot.qty,demand); lot.qty-=take; demand-=take; sold+=take; }
      p.stock=(p.stock||[]).filter(l=>l.qty>0);
    }catch(e){}
    const rev = sold * P;
    const cogs = sold * (prod.cost.ingredients + prod.cost.laborVar);
    S.cash += rev;

    // end-of-day like operations
    const stockLeft = (S.products.croissant.stock||[]).reduce((s,l)=>s+l.qty,0);
    const holding = stockLeft * 0.10;
    const marketingCost = (S.marketing?.socialToday?150:0) + (S.marketing?.flyerDaysLeft>0 ? 80 : 0);
    const staffWages = (S.staff?.cashier||1) * (S.staff?.wagePerCashier||70);
    const fixed = 150 + staffWages;
    const profit = rev - cogs - holding - marketingCost - fixed;

    // age lots and expire perishable finished goods
    try{
      const L=prod.shelfLifeDays;
      (S.products.croissant.stock||[]).forEach(l=>l.age++);
      S.products.croissant.stock = (S.products.croissant.stock||[]).filter(l=> l.age < L);
    }catch(e){}
    // raw perishables decay
    try{ ['milk','strawberries'].forEach(id=>{ const it=S.ingredients?.[id]; if(it && it.qty>0){ const loss=Math.ceil(it.qty*0.20); it.qty=Math.max(0,it.qty-loss);} }); }catch(e){}

    // reputation update
    const complaints = Math.max(0, (Nday>0)? (1 - sold/Math.max(1, Math.round(Nday*C))) : 0);
    const rho=ECON.rho; const f = Math.max(0.80, Math.min(1.20, 0.9 + 0.25*(Q-0.85) - 0.05*complaints));
    S.reputation = Math.max(0.80, Math.min(1.20, rho*(S.reputation||1) + (1-rho)*f));

    // marketing rollover
    if(S.marketing.flyerDaysLeft>0) S.marketing.flyerDaysLeft--;
    S.marketing.socialToday=false;

    // buff decay full day
    try{ tickBuffs(DAY_MINUTES); }catch(e){}

    S.today={ report:{ sold, revenue:rev, cogs, holding, marketing:marketingCost, fixed, profit, Q, W, C } };

    // advance day
    endOfDayHook();
  }

  // Inventory helpers
  function addInventory(key, qty, q){
    if(qty<=0) return;
    const p=S.products[key]; if(!p) return;
    p.stock.push({ qty:Math.round(qty), q:clamp(q,0,1), age:0 });
    save();
  }
  function totalStock(key){ const p=S.products[key]; if(!p || !p.stock) return 0; return p.stock.reduce((s,l)=>s+l.qty,0); }

  // Buffs
  function aggregateBuffs(){
    let q=0, w=0, t=1;
    (S.boost.buffs||[]).forEach(b=>{ q+=b.qBonus||0; w+=(b.wBonus||0); t*=(b.trafficMult||1); });
    S.boost.qBonus = clamp(q, -0.05, 0.05);
    S.boost.wBonus = clamp(w, -1.5, 1.5);
    S.boost.trafficMult = clamp(t, 0.90, 1.30);
    S.boost.percent = clamp(Math.round((S.boost.trafficMult-1)*200 + S.boost.qBonus*800 - S.boost.wBonus*40), 0, 100);
  }
  function addBuff(b){
    const buff = { id:b.id||('buff_'+Date.now()), label:b.label||'Boost', minutesLeft:Math.max(1,b.minutes||30), qBonus:b.qBonus||0, wBonus:b.wBonus||0, trafficMult:b.trafficMult||1 };
    if (!Array.isArray(S.boost.buffs)) S.boost.buffs=[]; S.boost.buffs.push(buff); aggregateBuffs(); save();
  }
  // Legacy compatibility: applyBoost(percent) -> simple traffic buff
  function applyBoost(percent){
    try{ const p=Math.max(0, Math.min(100, Math.round(Number(percent)||0))); const mult = 1 + p/200; addBuff({id:'legacyBoost', label:'Boost', minutes:30, trafficMult:mult}); }catch(e){}
  }
  function tickBuffs(minutes=1){
    if (!Array.isArray(S.boost.buffs)) { S.boost.buffs=[]; aggregateBuffs(); return; }
    S.boost.buffs.forEach(b=> b.minutesLeft -= minutes);
    S.boost.buffs = S.boost.buffs.filter(b=> (b.minutesLeft||0) > 0);
    aggregateBuffs();
  }

  // Ingredients & recipes
  function canProduce(recipeId, qty){
    const count = Math.max(1, Math.round(qty||1));
    const r=S.recipes && S.recipes[recipeId]; if(!r) return true;
    const need=r.ingredients||{};
    return Object.entries(need).every(([k,v]) => { const have = (S.ingredients?.[k]?.qty)||0; return have >= (v*count); });
  }
  function consumeFor(recipeId, qty){
    const count = Math.max(1, Math.round(qty||1));
    const r=S.recipes && S.recipes[recipeId]; if(!r) return;
    const need=r.ingredients||{};
    Object.entries(need).forEach(([k,v])=>{ if(!S.ingredients[k]) S.ingredients[k]={qty:0,shelfLife:30}; S.ingredients[k].qty = Math.max(0, (S.ingredients[k].qty||0) - v*count); });
    save();
  }
  function buyIngredient(id, qty, priceMap){
    const q = Math.max(0, Math.round(qty||0)); if(q<=0) return false;
    const price = priceMap?.[id] ?? 0; const cost = price*q;
    if ((S.cash||0) >= cost) { S.cash -= cost; if(!S.ingredients[id]) S.ingredients[id]={qty:0,shelfLife:30}; S.ingredients[id].qty += q; save(); return true; }
    return false;
  }

  // Public API
  return {
    getState(){ return S; },
    setState(next){ S = Object.assign(S, next); save(); },
    saveState: save,
    // Lifecycle
    fastForwardFromLastSeen,
    // Time/World
    tickMinutes, endOfDayHook,
    // Export/Import
    exportJSON, importJSON,
    // Inventory
    addInventory, totalStock,
    // Buffs
    addBuff, tickBuffs,
    applyBoost,
    // Ingredients
    canProduce, consumeFor, buyIngredient,
    // Utils
    clamp, DAY_MINUTES
  };
})();
