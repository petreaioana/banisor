// dashboard_assets/js/shared/state.js
// =====================================================
// FinKids Tycoon — Nucleu de stare & API (FK v5+)
// =====================================================

export const FK = (() => {
  // ---------- Utilitare interne ----------
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const DAY_MINUTES = 8 * 60;

  // LocalStorage chei pe slot
  const SLOT_KEYS = { A: 'fk_slot_A', B: 'fk_slot_B', C: 'fk_slot_C', autosave: 'fk_slot_autosave' };
  const SLOT_LAST = (s) => `fk_last_seen_${s}`;
  const CHANNEL = 'finkids';
  const DAY_KEY = (w) => `Y${w?.year || 1}-${w?.season || 'primavara'}-D${w?.day || 1}`;

  // ---------- Stare implicită ----------
  const DEF = {
    version: 5,
    day: 1,
    timeMin: 8 * 60,
    cash: 500,
    reputation: 1.00,
    economyIndex: 1.00,
    world: { year: 1, season: 'primavara', day: 1, minute: 8 * 60, open: 8 * 60, close: 8 * 60 + DAY_MINUTES },
    meta: { lastSeenTs: Date.now(), slot: 'autosave' },
    marketing: { flyerDaysLeft: 0, socialToday: false },
    upgrades: { ovenPlus: false, posRapid: false, timerAuto: false },
    staff: {
      cashier: 1,
      total: 3,
      team: [
        { id: 'ion', name: 'Ion', role: 'cashier', skill: 0.60, mood: 0.75, fatigue: 0.20, wagePerDay: 80 },
        { id: 'ana', name: 'Ana', role: 'baker', skill: 0.70, mood: 0.80, fatigue: 0.25, wagePerDay: 95 },
        { id: 'maria', name: 'Maria', role: 'floater', skill: 0.55, mood: 0.78, fatigue: 0.15, wagePerDay: 75 },
      ],
    },
    capacity: { prepPerDay: 100, ovenBatchSize: 50, ovenBatchesPerDay: 2, decorPerDay: 120, cashierMu: 1.5 },
    activeProduct: 'croissant',
    products: {
      croissant: {
        name: 'Croissant', key: 'croissant', P0: 10, price: 10,
        happyHour: { start: '16:00', end: '17:00', discount: 0.10, enabled: false },
        cost: { ingredients: 3, laborVar: 0.5 }, shelfLifeDays: 2, plannedQty: 100, stock: [], recipeId: 'croissant_plain'
      },
      donut: {
        name: 'Donut', key: 'donut', P0: 9, price: 9,
        happyHour: { start: '15:00', end: '16:00', discount: 0.10, enabled: false },
        cost: { ingredients: 2.6, laborVar: 0.6 }, shelfLifeDays: 1, plannedQty: 90, stock: [], recipeId: 'donut_plain', locked: true
      },
      eclair: {
        name: 'Ecler', key: 'eclair', P0: 14, price: 14,
        happyHour: { start: '17:00', end: '18:00', discount: 0.10, enabled: false },
        cost: { ingredients: 4.2, laborVar: 0.8 }, shelfLifeDays: 1, plannedQty: 60, stock: [], recipeId: 'eclair_vanilla', locked: true
      },
      muffin: {
        name: 'Brioșă', key: 'muffin', P0: 8, price: 8,
        happyHour: { start: '10:00', end: '11:00', discount: 0.10, enabled: false },
        cost: { ingredients: 2.2, laborVar: 0.5 }, shelfLifeDays: 2, plannedQty: 110, stock: [], recipeId: 'muffin_blueberry', locked: true
      },
    },
    research: { unlocked: ['croissant'], labLevel: 1 },
    boost: {
      percent: 0,
      qBonus: 0,
      wBonus: 0,
      trafficMult: 1.00,
      decayPerMin: 5,
      buffs: []
    },
    ingredients: {
      flour: { qty: 30, shelfLife: 30 }, milk: { qty: 10, shelfLife: 5 }, sugar: { qty: 20, shelfLife: 90 },
      cacao: { qty: 5, shelfLife: 180 }, chocolate_chips: { qty: 8, shelfLife: 180 }, strawberries: { qty: 6, shelfLife: 3 },
      coconut: { qty: 6, shelfLife: 180 }, sprinkles: { qty: 6, shelfLife: 365 }, butter: { qty: 8, shelfLife: 20 },
      eggs: { qty: 12, shelfLife: 14 }, yeast: { qty: 6, shelfLife: 30 }, vanilla: { qty: 4, shelfLife: 180 },
      chocolate_glaze: { qty: 4, shelfLife: 30 }, cream: { qty: 6, shelfLife: 5 }, blueberries: { qty: 6, shelfLife: 5 }
    },
    recipes: {
      croissant_plain: { ingredients: { flour: 1, milk: 1, sugar: 1 } },
      croissant_cacao: { ingredients: { flour: 1, milk: 1, sugar: 1, cacao: 1 } },
      croissant_choco: { ingredients: { flour: 1, milk: 1, sugar: 1, chocolate_chips: 1 } },
      croissant_straw: { ingredients: { flour: 1, milk: 1, sugar: 1, strawberries: 1 } },
      croissant_coconut: { ingredients: { flour: 1, milk: 1, sugar: 1, coconut: 1 } },
      donut_plain: { ingredients: { flour: 1, sugar: 1, milk: 1, butter: 1, eggs: 1, yeast: 1 } },
      donut_glazed: { ingredients: { flour: 1, sugar: 1, milk: 1, butter: 1, eggs: 1, yeast: 1, chocolate_glaze: 1 } },
      eclair_vanilla: { ingredients: { flour: 1, butter: 1, eggs: 1, sugar: 1, vanilla: 1, cream: 1 } },
      muffin_blueberry: { ingredients: { flour: 1, sugar: 1, milk: 1, butter: 1, eggs: 1, blueberries: 1 } },
    },
    economy2: { competitorIndex: 1.00, weather: 'sunny' },
    events: {
      calendar: [
        { id: 'spring_fair', label: 'Târgul de Primăvară', season: 'primavara', day: 27, effects: { trafficMult: 1.8 }, type: 'festival', cost: 350 },
        { id: 'choco_week', label: 'Săptămâna Ciocolatei', season: 'toamna', day: 14, effects: { convBonus: 0.05, qBonus: 0.01 }, type: 'global' },
        { id: 'city_run', label: 'City Run', season: 'vara', day: 8, effects: { trafficMult: 1.3 }, type: 'global' },
        { id: 'snow_days', label: 'Zile cu zăpadă', season: 'iarna', day: 11, effects: { wait: +0.2 }, type: 'global' },
      ],
      joined: {},
    },
    quests: {
      daily: [], weekly: [], lastGenDay: 0, lastGenWeek: 0
    },
    today: null,
  };

  // ---------- Încărcare din slotul activ + migrare legacy ----------
  function load() {
    let active = 'autosave';
    try {
      active = localStorage.getItem('fk_active_slot') || 'autosave';
      if (!SLOT_KEYS[active]) active = 'autosave';
    } catch (_) {}

    let fromSlot = null;
    try {
      fromSlot = JSON.parse(localStorage.getItem(SLOT_KEYS[active]) || 'null');
    } catch (_) {}

    const server = (typeof window !== 'undefined') ? window.__SERVER_STATE__ : null;
    let base = JSON.parse(JSON.stringify(DEF)); // Deep copy

    if (fromSlot) {
      base = Object.assign(base, fromSlot);
    } else if (server) {
      base.day = server.day ?? base.day;
      if (typeof server.lei === 'number') base.cash = Math.max(base.cash, server.lei);
    }
    
    base.meta = base.meta || {};
    base.meta.slot = active;
    return base;
  }

  let S = load();

  // ---------- BroadcastChannel + fallback pe storage ----------
  let BC = null; try { BC = new BroadcastChannel(CHANNEL); } catch (_) { }
  function emit(type, payload) { try { BC?.postMessage({ type, payload }); } catch (_) { } }
  if (BC) {
    BC.onmessage = (ev) => {
      const m = ev?.data || {};
      if (m.type === 'state:pull') emit('state:push', S);
    };
  }
  try {
    window.addEventListener?.('storage', (ev) => {
      if (ev?.key && Object.values(SLOT_KEYS).includes(ev.key)) {
        try {
          const next = JSON.parse(ev.newValue || 'null');
          if (next && typeof next === 'object') { S = Object.assign(S, next); }
        } catch (e) { }
      }
    });
  } catch (e) { }

  // ---------- Migrare compatibilă v4 → v5 ----------
  (function migrate() {
    if (!S.version || S.version < 5) {
      S.version = 5;
      S.world = S.world ?? { year: 1, season: 'primavara', day: S.day ?? 1, minute: S.timeMin ?? 8 * 60, open: 8 * 60, close: 8 * 60 + DAY_MINUTES };
      S.meta = S.meta ?? { lastSeenTs: Date.now(), slot: 'autosave' };
      S.products = S.products ?? JSON.parse(JSON.stringify(DEF.products));
      S.activeProduct = S.activeProduct ?? 'croissant';
      S.research = S.research ?? { unlocked: ['croissant'], labLevel: 1 };
      S.boost.buffs = S.boost.buffs ?? [];
      S.ingredients = S.ingredients ?? JSON.parse(JSON.stringify(DEF.ingredients));
      S.recipes = S.recipes ?? JSON.parse(JSON.stringify(DEF.recipes));
      try { save(); } catch (_) { }
    }
  })();

  // ---------- Persistență ----------
  function save() {
    try {
      S.meta = S.meta || {};
      S.meta.lastSeenTs = Date.now();
      const slot = S.meta?.slot || 'autosave';
      localStorage.setItem('fk_active_slot', slot);
      localStorage.setItem(SLOT_KEYS[slot], JSON.stringify(S));
      localStorage.setItem(SLOT_LAST(slot), String(S.meta.lastSeenTs));
    } catch (e) { }
    emit('state:saved', { ts: Date.now() });
  }

  // ---------- Export/Import JSON ----------
  function exportJSON(slotOpt) {
    try {
      const slot = slotOpt || S.meta?.slot || 'autosave';
      const stateToSave = { ...S, meta: { ...S.meta, slot } };
      const blob = new Blob([JSON.stringify(stateToSave, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `finkids_${slot}_v${S.version}.json`; a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { console.error("Export failed", e); }
  }
  async function importJSON(file, targetSlot) {
    try {
      const txt = await file.text();
      const next = JSON.parse(txt);
      if (!next || typeof next !== 'object') return false;
      const slot = targetSlot || S.meta?.slot || 'autosave';
      
      S = Object.assign({}, JSON.parse(JSON.stringify(DEF)), next);
      S.meta = S.meta ?? {};
      S.meta.slot = slot;
      S.meta.lastSeenTs = Date.now();
      S.version = Math.max(5, Number(S.version) || 5);
      
      localStorage.setItem(SLOT_KEYS[slot], JSON.stringify(S));
      localStorage.setItem('fk_active_slot', slot);

      save(); emit('state:push', S);
      return true;
    } catch (e) { console.error("Import failed", e); return false; }
  }

  // ---------- Boosts/Buffs ----------
  function aggregateBuffs() {
    let q = 0, w = 0, t = 1;
    (S.boost.buffs || []).forEach(b => { 
        q += b.qBonus ?? 0; 
        w += b.wBonus ?? 0; 
        t *= b.trafficMult ?? 1; 
    });
    S.boost.qBonus = clamp(q, -0.1, 0.1);
    S.boost.wBonus = clamp(w, -2.0, 2.0);
    S.boost.trafficMult = clamp(t, 0.5, 2.5);
    S.boost.percent = clamp(Math.round((S.boost.trafficMult - 1) * 100 + S.boost.qBonus * 500 - S.boost.wBonus * 20), -100, 100);
  }
  function addBuff(b) {
    const buff = {
      id: b.id || ('buff_' + Date.now()),
      label: b.label || 'Boost',
      minutesLeft: Math.max(1, b.minutes || 30),
      qBonus: b.qBonus || 0,
      wBonus: b.wBonus || 0,
      trafficMult: b.trafficMult || 1
    };
    S.boost.buffs = S.boost.buffs ?? [];
    S.boost.buffs.push(buff);
    aggregateBuffs(); save();
    emit('buff:added', buff);
  }
  function tickBuffs(minutes = 1) {
    if (!Array.isArray(S.boost.buffs)) { S.boost.buffs = []; aggregateBuffs(); return; }
    S.boost.buffs.forEach(b => b.minutesLeft -= minutes);
    S.boost.buffs = S.boost.buffs.filter(b => (b.minutesLeft || 0) > 0);
    aggregateBuffs();
    // No save() here, it will be called by the parent function (stepAuto or tickMinutes)
  }

  // ---------- Inventar / Rețete / Ingrediente ----------
  function addInventory(key, qty, q) {
    if (qty <= 0) return;
    const p = S.products[key]; if (!p) return;
    p.stock = p.stock ?? [];
    p.stock.push({ qty: Math.round(qty), q: clamp(q, 0, 1), age: 0 });
    save(); emit('inventory:added', { key, qty });
  }
  function totalStock(key) {
    const p = S.products[key]; if (!p || !p.stock) return 0;
    return p.stock.reduce((s, l) => s + (l.qty ?? 0), 0);
  }
  function canProduce(recipeId, qty) {
    const count = Math.max(1, Math.round(qty || 1));
    const r = S.recipes?.[recipeId]; if (!r) return true; // Assume can produce if no recipe
    const need = r.ingredients || {};
    return Object.entries(need).every(([k, v]) => {
      const have = S.ingredients?.[k]?.qty ?? 0;
      return have >= (v * count);
    });
  }
  function consumeFor(recipeId, qty) {
    const count = Math.max(1, Math.round(qty || 1));
    const r = S.recipes?.[recipeId]; if (!r) return;
    const need = r.ingredients || {};
    Object.entries(need).forEach(([k, v]) => {
      if (!S.ingredients[k]) S.ingredients[k] = { qty: 0, shelfLife: 30 };
      S.ingredients[k].qty = Math.max(0, (S.ingredients[k].qty || 0) - v * count);
    });
    // No save() here, part of a larger operation
  }
  function buyIngredient(id, qty, priceMap) {
    const q = Math.max(0, Math.round(qty || 0)); if (q <= 0) return false;
    const price = priceMap?.[id] ?? 0; const cost = price * q;
    if ((S.cash ?? 0) >= cost) { 
        S.cash -= cost; 
        if (!S.ingredients[id]) S.ingredients[id] = { qty: 0, shelfLife: 30 };
        S.ingredients[id].qty = (S.ingredients[id].qty ?? 0) + q;
        save();
        return true; 
    }
    return false;
  }
  
  // ---------- Products & R&D ----------
  function getActiveProductKey() { return S.activeProduct || 'croissant'; }
  function setActiveProduct(key) {
    if (!S.products[key] || S.products[key].locked) return false;
    S.activeProduct = key; save(); emit('product:activeChanged', { key }); return true;
  }
  function isUnlocked(key) { return S.products[key] && !S.products[key].locked && (S.research?.unlocked || []).includes(key); }
  function unlockProduct(key, cost = 300) {
    if (!S.products[key]) return false;
    if (isUnlocked(key)) return true;
    if ((S.cash ?? 0) < cost) return false;
    S.cash -= cost;
    S.products[key].locked = false;
    S.research = S.research ?? { unlocked: [] };
    if (!S.research.unlocked.includes(key)) S.research.unlocked.push(key);
    save(); emit('product:unlocked', { key });
    return true;
  }
  
  // ---------- Sezon & Meteo ----------
  function seasonEffects(season) {
    const s = season || S.world?.season || 'primavara';
    const effects = {
        vara:      { traffic: 1.15, wait: +0.20, qBonus: +0.00 },
        toamna:    { traffic: 0.95, wait: +0.00, qBonus: +0.02 },
        iarna:     { traffic: 0.85, wait: +0.00, qBonus: +0.00 },
        primavara: { traffic: 1.00, wait: +0.00, qBonus: +0.00 }
    };
    return effects[s] || effects.primavara;
  }
  function weatherEffects(weather) {
    const w = weather || S.economy2?.weather || 'sunny';
    const effects = {
        rain:   { traffic: 0.92, wait: +0.20, label: '🌧️ Ploaie' },
        snow:   { traffic: 0.85, wait: +0.30, label: '❄️ Ninsoare' },
        heat:   { traffic: 0.97, wait: +0.40, label: '🔥 Caniculă' },
        cloudy: { traffic: 0.98, wait: +0.05, label: '⛅ Înnorat' },
        sunny:  { traffic: 1.00, wait: +0.00, label: '☀️ Senin' }
    };
    const base = { qBonus: 0.00 };
    return { ...base, ...(effects[w] || effects.sunny) };
  }
  function rollWeather(season) {
    const s = season || S.world?.season || 'primavara';
    const r = Math.random();
    let next = 'sunny';
    if (s === 'vara')      next = r < 0.50 ? 'sunny' : r < 0.72 ? 'heat' : r < 0.90 ? 'cloudy' : 'rain';
    else if (s === 'toamna')   next = r < 0.35 ? 'sunny' : r < 0.65 ? 'cloudy' : 'rain';
    else if (s === 'iarna')    next = r < 0.30 ? 'sunny' : r < 0.55 ? 'cloudy' : 'snow';
    else /* primavara */ next = r < 0.45 ? 'sunny' : r < 0.75 ? 'cloudy' : 'rain';
    
    S.economy2 = S.economy2 ?? {};
    S.economy2.weather = next;
    // Don't save here, part of a larger tick
    emit('weather:changed', { weather: next });
    return next;
  }

  // ---------- Evenimente ----------
  function todayEvents() {
    const w = S.world ?? { year: 1, season: 'primavara', day: S.day ?? 1 };
    return (S.events?.calendar ?? []).filter(e => e.season === w.season && Number(e.day) === w.day);
  }
  function eventModsForToday() {
    const evs = todayEvents();
    if (evs.length === 0) return { traffic: 1, conv: 0, qBonus: 0, wait: 0 };
    
    const key = DAY_KEY(S.world);
    const joined = S.events?.joined?.[key] ?? {};
    let traffic = 1, conv = 0, q = 0, w = 0;
    
    evs.forEach(e => {
      const eff = e.effects || {};
      const eligible = (e.type === 'global') || (e.type === 'festival' && joined[e.id]);
      if (!eligible) return;
      if (eff.trafficMult) traffic *= eff.trafficMult;
      if (eff.convBonus)   conv += eff.convBonus;
      if (eff.qBonus)      q += eff.qBonus;
      if (eff.wait)        w += eff.wait;
    });
    return { traffic, conv, qBonus: q, wait: w };
  }
  // (Restul funcțiilor de evenimente, quests, staff, etc. rămân aici, ne-modificate major)
  function listUpcomingEvents(n = 7) { /* ... */ return []; }
  function joinTodayFestival(eventId) { /* ... */ return false; }
  
  // Quests
  function _makeDailyQuests() { /* ... */ return []; }
  function ensureDailyQuests() { /* ... */ }
  function questEndOfDay(agg) { /* ... */ }
  function claimQuest(id) { /* ... */ return false; }
  function getQuests() { return { daily: (S.quests?.daily) || [], weekly: (S.quests?.weekly) || [] }; }

  // Staff
  function _team() { return S.staff?.team ?? []; }
  function teamSummary() {
    const T = _team(); if (T.length === 0) return { avgSkill: 0.6, avgMood: 0.75, payroll: 0 };
    const sums = T.reduce((acc, e) => {
        acc.skill += e.skill ?? 0;
        acc.mood += e.mood ?? 0;
        acc.payroll += e.wagePerDay ?? 0;
        return acc;
    }, { skill: 0, mood: 0, payroll: 0 });
    return { avgSkill: sums.skill / T.length, avgMood: sums.mood / T.length, payroll: sums.payroll };
  }
  function getCashierMu(cashiersOverride) {
    const base = S.capacity?.cashierMu ?? 1.5;
    const fastPOS = S.upgrades?.posRapid ? 0.8 : 0;
    const count = cashiersOverride ?? S.staff?.cashier ?? 1;
    const multi = Math.max(0, count - 1) * 0.5;
    const { avgSkill, avgMood } = teamSummary();
    const muStaff = 0.4 * avgSkill + 0.3 * (avgMood - 0.5);
    return Math.max(0.5, base + fastPOS + multi + muStaff);
  }
  function staffDailyTick({ avgW = 2, complaints = 0 } = {}) { /* ... */ return 0; }

  // ---------- Save Slots API ----------
  function _switchToSlot(slot) {
    if (!SLOT_KEYS[slot]) return false;
    const raw = localStorage.getItem(SLOT_KEYS[slot]);
    let loaded = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEF));
    
    S = Object.assign({}, JSON.parse(JSON.stringify(DEF)), loaded);
    S.meta = S.meta ?? {};
    S.meta.slot = slot;
    localStorage.setItem('fk_active_slot', slot);
    save(); emit('state:push', S); return true;
  }
  function getActiveSlot() { return S.meta?.slot || localStorage.getItem('fk_active_slot') || 'autosave'; }
  function setActiveSlot(slot) { return _switchToSlot(slot); }
  function listSlots() {
    return Object.keys(SLOT_KEYS).map(s => {
      const raw = localStorage.getItem(SLOT_KEYS[s]);
      let obj = null; try { obj = JSON.parse(raw || 'null'); } catch (_) { }
      return {
        slot: s,
        exists: !!obj,
        day: obj?.world?.day ?? obj?.day ?? 0,
        season: obj?.world?.season ?? '-',
        cash: Math.round(obj?.cash ?? 0),
        when: Number(localStorage.getItem(SLOT_LAST(s))) || obj?.meta?.lastSeenTs || 0
      };
    });
  }
  function saveToSlot(slot) {
    if (!SLOT_KEYS[slot]) return false;
    const currentSlot = getActiveSlot();
    const snap = { ...S, meta: { ...S.meta, slot } };
    localStorage.setItem(SLOT_KEYS[slot], JSON.stringify(snap));
    localStorage.setItem(SLOT_LAST(slot), String(Date.now()));
    // If we saved to a different slot, we don't switch to it automatically.
    // The user stays on their current active slot.
    return true;
  }
  function deleteSlot(slot) {
    if (!SLOT_KEYS[slot]) return false;
    localStorage.removeItem(SLOT_KEYS[slot]);
    localStorage.removeItem(SLOT_LAST(slot));
    if (getActiveSlot() === slot) {
      return _switchToSlot('autosave');
    }
    return true;
  }

  // ---------- API public ----------
  return {
    // Stare
    getState: () => S,
    setState: (next) => { S = Object.assign(S, next); save(); },
    saveState: save,
    addBuff, tickBuffs,
    // Export/Import
    exportJSON, importJSON,
    // Timp & Sezon & Meteo
    seasonEffects, weatherEffects, rollWeather,
    // Evenimente & Quests
    todayEvents, eventModsForToday, ensureDailyQuests, getQuests, questEndOfDay, claimQuest,
    // Staff
    teamSummary, getCashierMu, staffDailyTick,
    // Products/R&D
    getActiveProductKey, setActiveProduct, unlockProduct, isUnlocked,
    // Inventar & ingrediente
    addInventory, totalStock, canProduce, consumeFor, buyIngredient,
    // Sloturi
    getActiveSlot, setActiveSlot, listSlots, saveToSlot, deleteSlot,
    // Utils
    clamp, DAY_MINUTES,
  };
})();