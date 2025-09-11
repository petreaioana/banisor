// assets/js/shared/state.js
export const FK = (() => {
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const DAY_MINUTES = 8*60;

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
    boost:{
      percent:0,
      qBonus:0,
      wBonus:0,
      trafficMult:1.00, // multiplicator trafic
      decayPerMin:5,    // compat: nu se mai folosește pentru scădere manuală
      buffs: []         // [{id,label,minutesLeft,qBonus,wBonus,trafficMult}]
    },
    // Ingrediente (materii prime)
    ingredients:{
      flour:{qty:30,shelfLife:30},
      milk:{qty:10,shelfLife:5},
      sugar:{qty:20,shelfLife:90},
      cacao:{qty:5,shelfLife:180},
      chocolate_chips:{qty:8,shelfLife:180},
      strawberries:{qty:6,shelfLife:3},
      coconut:{qty:6,shelfLife:180},
      sprinkles:{qty:6,shelfLife:365}
    },
    // Rețete (minim)
    recipes:{
      croissant_plain:  {ingredients:{flour:1, milk:1, sugar:1}},
      croissant_cacao:  {ingredients:{flour:1, milk:1, sugar:1, cacao:1}},
      croissant_choco:  {ingredients:{flour:1, milk:1, sugar:1, chocolate_chips:1}},
      croissant_straw:  {ingredients:{flour:1, milk:1, sugar:1, strawberries:1}},
      croissant_coconut:{ingredients:{flour:1, milk:1, sugar:1, coconut:1}}
    },
    today:null
  };

  function load() {
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

  let S = load();
  // Sync across tabs: listen to localStorage updates for 'fk_state'
  try{
    if (typeof window!== 'undefined' && window.addEventListener){
      window.addEventListener('storage', (ev)=>{
        if(ev && ev.key==='fk_state'){
          try{ const next = JSON.parse(ev.newValue||'null'); if(next && typeof next==='object'){ S = Object.assign(S, next); } }catch(e){}
        }
      });
    }
  }catch(e){}

  // Migrare non-destructivă la v4
  (function migrate(){
    if (!S.version || S.version < 4) {
      S.version = 4;
      S.products = S.products || {};
      S.products.croissant = S.products.croissant || {...DEF.products.croissant};
      if (!S.products.croissant.recipeId) S.products.croissant.recipeId = 'croissant_plain';

      S.boost = S.boost || {};
      if (typeof S.boost.percent !== 'number') S.boost.percent = 0;
      if (typeof S.boost.qBonus !== 'number') S.boost.qBonus = 0;
      if (typeof S.boost.wBonus !== 'number') S.boost.wBonus = 0;
      if (typeof S.boost.trafficMult !== 'number') S.boost.trafficMult = 1.00;
      if (!Array.isArray(S.boost.buffs)) S.boost.buffs = [];

      if (!S.ingredients) S.ingredients = JSON.parse(JSON.stringify(DEF.ingredients));
      if (!S.recipes) S.recipes = JSON.parse(JSON.stringify(DEF.recipes));

      try{ save(); }catch(e){}
    }
  })();

  function save() {
    try{ localStorage.setItem('fk_state', JSON.stringify(S)); }catch(e){}
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

  // Inventory helpers
  function addInventory(key, qty, q){
    if(qty<=0) return;
    const p=S.products[key]; if(!p) return;
    p.stock.push({ qty:Math.round(qty), q:clamp(q,0,1), age:0 });
    save();
  }
  function totalStock(key){
    const p=S.products[key]; if(!p || !p.stock) return 0;
    return p.stock.reduce((s,l)=>s+l.qty,0);
  }

  // Boost (sistem cu buff-uri)
  function aggregateBuffs(){
    let q=0, w=0, t=1;
    (S.boost.buffs||[]).forEach(b=>{ q+=b.qBonus||0; w+=(b.wBonus||0); t*=(b.trafficMult||1); });
    S.boost.qBonus = clamp(q, -0.05, 0.05);
    S.boost.wBonus = clamp(w, -1.5, 1.5);
    S.boost.trafficMult = clamp(t, 0.90, 1.30);
    // percent doar pentru UI: mapare simplă a efectelor combinate
    S.boost.percent = clamp(Math.round((S.boost.trafficMult-1)*200 + S.boost.qBonus*800 - S.boost.wBonus*40), 0, 100);
  }
  function addBuff(b){
    const buff = {
      id: b.id || ('buff_'+Date.now()),
      label: b.label || 'Boost',
      minutesLeft: Math.max(1, b.minutes||30),
      qBonus: b.qBonus||0,
      wBonus: b.wBonus||0,
      trafficMult: b.trafficMult||1
    };
    if (!Array.isArray(S.boost.buffs)) S.boost.buffs=[];
    S.boost.buffs.push(buff);
    aggregateBuffs(); save();
  }
  function tickBuffs(minutes=1){
    if (!Array.isArray(S.boost.buffs)) { S.boost.buffs=[]; aggregateBuffs(); return; }
    S.boost.buffs.forEach(b=> b.minutesLeft -= minutes);
    S.boost.buffs = S.boost.buffs.filter(b=> (b.minutesLeft||0) > 0);
    aggregateBuffs(); save();
  }

  // Ingrediente & rețete
  function canProduce(recipeId, qty){
    const count = Math.max(1, Math.round(qty||1));
    const r=S.recipes && S.recipes[recipeId]; if(!r) return true;
    const need=r.ingredients||{};
    return Object.entries(need).every(([k,v]) => {
      const have = (S.ingredients?.[k]?.qty)||0; return have >= (v*count);
    });
  }
  function consumeFor(recipeId, qty){
    const count = Math.max(1, Math.round(qty||1));
    const r=S.recipes && S.recipes[recipeId]; if(!r) return;
    const need=r.ingredients||{};
    Object.entries(need).forEach(([k,v])=>{
      if(!S.ingredients[k]) S.ingredients[k]={qty:0,shelfLife:30};
      S.ingredients[k].qty = Math.max(0, (S.ingredients[k].qty||0) - v*count);
    });
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
    addInventory, totalStock,
    // Boost API
    addBuff, tickBuffs,
    // Ingrediente
    canProduce, consumeFor, buyIngredient,
    // Utils
    clamp, DAY_MINUTES
  };
})();
