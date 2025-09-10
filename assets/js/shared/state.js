// assets/js/shared/state.js
export const FK = (() => {
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const DAY_MINUTES = 8*60;

  const DEF = {
    version: 3,
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
        cost:{ingredients:3,laborVar:0.5}, shelfLifeDays:2, plannedQty:100, stock:[] }
    },
    autosim:{ running:false, speed:1, tickMsBase:200, aggregates:{sold:0,rev:0,cogs:0,holding:0,marketing:0,profit:0,N:0,C:0,W:0,Q:0} },
    boost:{ percent:0, qBonus:0, wBonus:0, decayPerMin:5 },
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

  // Boost
  function applyBoost(percent){
    S.boost.percent = clamp((S.boost.percent||0) + (percent||0), 0, 100);
    S.boost.qBonus = 0.05 * (S.boost.percent/100);
    S.boost.wBonus = -1.2 * (S.boost.percent/100);
    save();
  }

  // Public API
  return {
    getState(){ return S; },
    setState(next){ S = Object.assign(S, next); save(); },
    saveState: save,
    addInventory, totalStock, applyBoost,
    clamp, DAY_MINUTES
  };
})();
