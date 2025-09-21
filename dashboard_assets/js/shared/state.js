/* ========== UnificareExport | dashboard_assets\js\shared\state.js ========== */

// dashboard_assets/js/shared/state.js
// =====================================================
// FinKids Tycoon — Nucleu de stare & API (FK v5+)
// - World clock (year/season/day/minute)
// - Sezon & Meteo (helpers + roll)
// - Fast-forward offline (până la 7 zile)
// - Staff (mood/skill/payroll + mini-APIs)
// - Evenimente (calendar) & Quests (daily/weekly)
// - Multi-produs + R&D (unlock/load)
// - Inventar/Ingrediente/Rețete
// - Boosts/Buffs
// - Save-slots (A/B/C/autosave) + export/import
// - BroadcastChannel sync între tab-uri
// - Migrare compatibilă v4 → v5
// =====================================================

export const FK = (() => {
  // ---------- Utilitare interne ----------
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const DAY_MINUTES = 8 * 60;
  const MAX_KIDS_HISTORY = 30;

  function defaultModes() {
    return { kidMode: true, smartManager: true, difficulty: \"easy\" };
  }
  function defaultPolicy() {
    return {
      autoProduce: true,
      autoRestock: true,
      autoPrice: true,
      autoStaff: true,
      autoEvents: true,
      autoUpgrades: true,
      focus: \"balanced\",
      cashReserve: 0.15,
      memory: { soldOutYesterday: false, leftoverYesterday: false, lastPriceDelta: 0 }
    };
  }
  function defaultGoals() {
    return { targetSold: 0, targetQ: 0.9, earnedStars: 0 };
  }
  function defaultRewards() {
    return { badges: [], permaBuffs: [], streakGoodDays: 0, pendingBuff: null, lastVoucherDay: 0 };
  }
  function defaultSafety() {
    return {
      lowStockThreshold: 0.25,
      restockTargetDays: 2,
      minPlan: 20,
      softExpiration: true,
      minIngredientReserve: 4,
      voucherCooldownDays: 7,
      voucherValue: 250,
      voucherRange: [180, 300],
      morningWindowMinutes: 120,
      middayCheckMinute: 240,
      topUpCap: 48,
      topUpBatch: 12,
      planCeiling: 240,
      restockMultipliers: { min: 1.6, target: 2.4 },
      priorityIngredients: ['flour', 'sugar', 'butter', 'milk', 'eggs'],
      ingredientBuffer: 0.2,
      maxRestockOrders: 3,
      staffing: { minCashiers: 1, maxCashiers: 2, kidMode: { normalTraffic: 70, rapidTraffic: 110 } },
      lowCashTrigger: 0.1
    };
  }
  function defaultKidsTelemetry() {
    return { lastSummary: null, history: [] };
  }
  function defaultOffline() {
    return { maxDays: 7, pendingSummary: null, lastSimulatedTs: Date.now() };
  }
  function defaultEconomyFlags() {
    return { useWaitTime: false, softExpiration: true };
  }
  function ensureDefaults(current, factory) {
    const base = factory();
    if (!current || typeof current !== \"object\") return base;
    return Object.assign(base, current);
  }
  function pushUnique(arr, item, key = \"id\") {
    if (!Array.isArray(arr)) return [item];
    const exists = arr.some(entry => {
      if (key === null) return JSON.stringify(entry) === JSON.stringify(item);
      return entry && item && entry[key] === item[key];
    });
    if (!exists) arr.push(item);
    return arr;
  }



  // LocalStorage chei pe slot
  const SLOT_KEYS = { A: 'fk_slot_A', B: 'fk_slot_B', C: 'fk_slot_C', autosave: 'fk_slot_autosave' };
  const SLOT_LAST = (s) => `fk_last_seen_${s}`;
  const CHANNEL = 'finkids';
  const DAY_KEY = (w) => `Y${w?.year || 1}-${w?.season || 'primavara'}-D${w?.day || 1}`;

  // ---------- Stare implicită ----------
  const DEF = {
    version: 5,
    // compat v4
    day: 1,
    timeMin: 8 * 60,

    // economie & reputație
    cash: 500,
    reputation: 1.00,
    economyIndex: 1.00,

    // lume & meta
    world: { year: 1, season: 'primavara', day: 1, minute: 8 * 60, open: 8 * 60, close: 8 * 60 + DAY_MINUTES },
    meta: { lastSeenTs: Date.now(), slot: 'autosave', config: { economy: null, policies: null } },

    // marketing & upgrade-uri
    marketing: { flyerDaysLeft: 0, socialToday: false },
    upgrades: { ovenPlus: false, posRapid: false, timerAuto: false },

    // personal & capacități
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

    // produse & R&D
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

    // boost/buffs
    boost: {
      percent: 0,
      qBonus: 0,
      wBonus: 0,
      trafficMult: 1.00,
      decayPerMin: 5, // legacy (nefolosit pentru scădere manuală)
      buffs: [] // [{id,label,minutesLeft,qBonus,wBonus,trafficMult}]
    },

    // ingrediente & rețete
    ingredients: {
      flour: { qty: 30, shelfLife: 30 },
      milk: { qty: 10, shelfLife: 5 },
      sugar: { qty: 20, shelfLife: 90 },
      cacao: { qty: 5, shelfLife: 180 },
      chocolate_chips: { qty: 8, shelfLife: 180 },
      strawberries: { qty: 6, shelfLife: 3 },
      coconut: { qty: 6, shelfLife: 180 },
      sprinkles: { qty: 6, shelfLife: 365 },
      butter: { qty: 8, shelfLife: 20 },
      eggs: { qty: 12, shelfLife: 14 },
      yeast: { qty: 6, shelfLife: 30 },
      vanilla: { qty: 4, shelfLife: 180 },
      chocolate_glaze: { qty: 4, shelfLife: 30 },
      cream: { qty: 6, shelfLife: 5 },
      blueberries: { qty: 6, shelfLife: 5 }
    },
    recipes: {
      // croissant
      croissant_plain: { ingredients: { flour: 1, milk: 1, sugar: 1 } },
      croissant_cacao: { ingredients: { flour: 1, milk: 1, sugar: 1, cacao: 1 } },
      croissant_choco: { ingredients: { flour: 1, milk: 1, sugar: 1, chocolate_chips: 1 } },
      croissant_straw: { ingredients: { flour: 1, milk: 1, sugar: 1, strawberries: 1 } },
      croissant_coconut: { ingredients: { flour: 1, milk: 1, sugar: 1, coconut: 1 } },
      // noi
      donut_plain: { ingredients: { flour: 1, sugar: 1, milk: 1, butter: 1, eggs: 1, yeast: 1 } },
      donut_glazed: { ingredients: { flour: 1, sugar: 1, milk: 1, butter: 1, eggs: 1, yeast: 1, chocolate_glaze: 1 } },
      eclair_vanilla: { ingredients: { flour: 1, butter: 1, eggs: 1, sugar: 1, vanilla: 1, cream: 1 } },
      muffin_blueberry: { ingredients: { flour: 1, sugar: 1, milk: 1, butter: 1, eggs: 1, blueberries: 1 } },
    },

    // evenimente/meteo
    economy2: { competitorIndex: 1.00, weather: 'sunny' },
    events: {
      calendar: [
        { id: 'spring_fair', label: 'Târgul de Primăvară', season: 'primavara', day: 27, effects: { trafficMult: 1.8 }, type: 'festival', cost: 350 },
        { id: 'choco_week', label: 'Săptămâna Ciocolatei', season: 'toamna', day: 14, effects: { convBonus: 0.05, qBonus: 0.01 }, type: 'global' },
        { id: 'city_run', label: 'City Run', season: 'vara', day: 8, effects: { trafficMult: 1.3 }, type: 'global' },
        { id: 'snow_days', label: 'Zile cu zăpadă', season: 'iarna', day: 11, effects: { wait: +0.2 }, type: 'global' },
      ],
      joined: {}, // map DAY_KEY -> { [eventId]: true }
    },

    // quests
    quests: {
      daily: [],
      weekly: [],
      lastGenDay: 0,
      lastGenWeek: 0
    },

    // runtime (raport)
    today: null,
  };

  // ---------- Încărcare din slotul activ + migrare legacy ----------
  function load() {
    let active = localStorage.getItem('fk_active_slot') || 'autosave';
    if (!SLOT_KEYS[active]) {
      active = 'autosave';
      try { localStorage.setItem('fk_active_slot', 'autosave'); } catch (_) { }
    }

    // migrare din vechiul fk_state în autosave, dacă e cazul
    let legacy = null; try { legacy = JSON.parse(localStorage.getItem('fk_state') || 'null'); } catch (_) { }
    let fromSlot = null; try { fromSlot = JSON.parse(localStorage.getItem(SLOT_KEYS[active]) || 'null'); } catch (_) { }
    if (!fromSlot && legacy) {
      try {
        localStorage.setItem(SLOT_KEYS.autosave, JSON.stringify(legacy));
        localStorage.removeItem('fk_state');
        active = 'autosave';
        localStorage.setItem('fk_active_slot', 'autosave');
      } catch (_) { }
    }

    // încarcă din slotul activ
    let local = null; try { local = JSON.parse(localStorage.getItem(SLOT_KEYS[active]) || 'null'); } catch (_) { }
    const server = (typeof window !== 'undefined') ? window.__SERVER_STATE__ : null;

    let base = { ...DEF };
    if (server) {
      base.day = server.day ?? base.day;
      if (typeof server.lei === 'number') base.cash = Math.max(base.cash, server.lei);
    }
    if (local) base = Object.assign(base, local);
    base.meta = base.meta || {};
    base.meta.slot = active;
    return base;
  }

  let S = load();
  ensureKidFriendlyStructures();
  if (S.meta?.config?.economy) applyEconomyConfig(S.meta.config.economy, false);
  if (S.meta?.config?.policies) applyPolicyConfig(S.meta.config.policies, false);

  // ---------- BroadcastChannel + fallback pe storage ----------
  let BC = null; try { BC = new BroadcastChannel(CHANNEL); } catch (_) { }
  function emit(type, payload) { try { BC && BC.postMessage({ type, payload }); } catch (_) { } }
  if (BC) {
    BC.onmessage = (ev) => {
      const m = ev?.data || {};
      if (m.type === 'state:pull') emit('state:push', S);
      // pentru UI live sync, restul evenimentelor sunt pasive
    };
  }
  // storage event (fallback)
  try {
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('storage', (ev) => {
        if (ev && ev.key && Object.values(SLOT_KEYS).includes(ev.key)) {
          try {
            const next = JSON.parse(ev.newValue || 'null');
            if (next && typeof next === 'object') { S = Object.assign(S, next); }
          } catch (e) { }
        }
      });
    }
  } catch (e) { }

  // ---------- Migrare compatibilă v4 → v5 ----------
  (function migrate() {
    // la nevoie, initializează structuri lipsă
    if (!S.version || S.version < 4) {
      S.version = 4;
      S.products = S.products || {};
      S.products.croissant = S.products.croissant || { ...DEF.products.croissant };
      if (!S.products.croissant.recipeId) S.products.croissant.recipeId = 'croissant_plain';

      S.boost = S.boost || {};
      if (typeof S.boost.percent !== 'number') S.boost.percent = 0;
      if (typeof S.boost.qBonus !== 'number') S.boost.qBonus = 0;
      if (typeof S.boost.wBonus !== 'number') S.boost.wBonus = 0;
      if (typeof S.boost.trafficMult !== 'number') S.boost.trafficMult = 1.00;
      if (!Array.isArray(S.boost.buffs)) S.boost.buffs = [];

      if (!S.ingredients) S.ingredients = JSON.parse(JSON.stringify(DEF.ingredients));
      if (!S.recipes) S.recipes = JSON.parse(JSON.stringify(DEF.recipes));
      try { save(); } catch (e) { }
    }
    if (S.version < 5) {
      S.world = S.world || { year: 1, season: 'primavara', day: S.day || 1, minute: S.timeMin || 8 * 60, open: 8 * 60, close: 8 * 60 + DAY_MINUTES };
      S.meta = S.meta || { lastSeenTs: Date.now(), slot: 'autosave', config: { economy: null, policies: null } };
      S.economy2 = S.economy2 || { competitorIndex: 1.00, weather: 'sunny' };
      // multi-produs & research sensibili la migrare
      if (!S.products) S.products = JSON.parse(JSON.stringify(DEF.products));
      if (!S.activeProduct) S.activeProduct = 'croissant';
      if (!S.research) S.research = { unlocked: ['croissant'], labLevel: 1 };
      S.version = 5;
      try { save(); } catch (_) { }
    }
  })();

  // ---------- Persistență (salvare pe slot + beacon către server) ----------
  function save() {
    try {
      S.meta = S.meta || {};
      S.meta.lastSeenTs = Date.now();
      const slot = S.meta?.slot || localStorage.getItem('fk_active_slot') || 'autosave';
      localStorage.setItem('fk_active_slot', slot);
      localStorage.setItem(SLOT_KEYS[slot], JSON.stringify(S));
      localStorage.setItem(SLOT_LAST(slot), String(S.meta.lastSeenTs));
    } catch (e) { }
    emit('state:saved', { ts: Date.now() });

    // server snapshot (opțional)
    try {
      const payload = { lei: S.cash || 0, day: S.day || 1, progress: { cookies: { day: S.day || 1, profitBest: 0 } }, meta: { when: Date.now() } };
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const b = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon('index.php?action=save', b);
      } else if (typeof fetch !== 'undefined') {
        fetch('index.php?action=save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
    } catch (e) { }
  }

  // ---------- Export/Import JSON ----------
  function exportJSON(slotOpt) {
    try {
      const slot = slotOpt || S.meta?.slot || 'autosave';
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `finkids_${slot}_v${S.version}.json`; a.click();
    } catch (e) { }
  }
  async function importJSON(file, targetSlot) {
    try {
      const txt = await file.text();
      const next = JSON.parse(txt);
      if (!next || typeof next !== 'object') return false;
      const slot = targetSlot || S.meta?.slot || 'autosave';
      S = Object.assign({}, DEF, S, next);
      S.meta = S.meta || {}; S.meta.slot = slot; S.meta.lastSeenTs = Date.now();
      if (!S.world) { S.world = { year: 1, season: 'primavara', day: S.day || 1, minute: S.timeMin || 8 * 60, open: 8 * 60, close: 8 * 60 + DAY_MINUTES }; }
      S.version = Math.max(5, Number(S.version) || 5);
      try {
        localStorage.setItem(SLOT_KEYS[slot], JSON.stringify(S));
        localStorage.setItem('fk_active_slot', slot);
      } catch (_) { }
      touchOfflineTimestamp(Date.now(), false);

      save(); emit('state:push', S);
      return true;
    } catch (e) { return false; }
  }

  // ---------- Boosts/Buffs ----------
  function aggregateBuffs() {
    let q = 0, w = 0, t = 1;
    (S.boost.buffs || []).forEach(b => { q += b.qBonus || 0; w += (b.wBonus || 0); t *= (b.trafficMult || 1); });
    S.boost.qBonus = clamp(q, -0.05, 0.05);
    S.boost.wBonus = clamp(w, -1.5, 1.5);
    S.boost.trafficMult = clamp(t, 0.90, 1.30);
    S.boost.percent = clamp(Math.round((S.boost.trafficMult - 1) * 200 + S.boost.qBonus * 800 - S.boost.wBonus * 40), 0, 100);
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
    if (!Array.isArray(S.boost.buffs)) S.boost.buffs = [];
    S.boost.buffs.push(buff);
    aggregateBuffs(); save();
    emit('buff:added', buff);
  }
  function tickBuffs(minutes = 1) {
    if (!Array.isArray(S.boost.buffs)) { S.boost.buffs = []; aggregateBuffs(); return; }
    S.boost.buffs.forEach(b => b.minutesLeft -= minutes);
    S.boost.buffs = S.boost.buffs.filter(b => (b.minutesLeft || 0) > 0);
    aggregateBuffs(); save();
  }


  

  
  // ---------- Config loader ----------
  function applyEconomyConfig(data, persist = true) {
    if (!data || typeof data !== 'object') return null;
    ensureKidFriendlyStructures();
    S.meta = S.meta || {};
    S.meta.config = S.meta.config || { economy: null, policies: null };
    S.meta.config.economy = data;
    const diff = (S.modes?.difficulty) || 'easy';
    const diffCfg = data.difficulty && data.difficulty[diff];
    if (diffCfg && typeof diffCfg === 'object') {
      if (typeof diffCfg.cashReserve === 'number' && !Number.isNaN(diffCfg.cashReserve)) {
        S.policy.cashReserve = clamp(diffCfg.cashReserve, 0, 0.6);
      }
      if (typeof diffCfg.safetyFactor === 'number' && !Number.isNaN(diffCfg.safetyFactor)) {
        S.safety.safetyFactor = diffCfg.safetyFactor;
      }
      if (typeof diffCfg.targetConversion === 'number' && !Number.isNaN(diffCfg.targetConversion)) {
        S.safety.targetConversion = diffCfg.targetConversion;
      }
      if (typeof diffCfg.voucherValue === 'number' && !Number.isNaN(diffCfg.voucherValue)) {
        S.safety.voucherValue = diffCfg.voucherValue;
      }
      if (typeof diffCfg.topUpBatch === 'number' && !Number.isNaN(diffCfg.topUpBatch)) {
        S.safety.topUpBatch = Math.max(4, Math.round(diffCfg.topUpBatch));
      }
    }
    if (data.production && typeof data.production === 'object') {
      if (typeof data.production.lowStockThreshold === 'number') {
        S.safety.lowStockThreshold = clamp(data.production.lowStockThreshold, 0.1, 0.5);
      }
      if (typeof data.production.morningWindowMinutes === 'number') {
        S.safety.morningWindowMinutes = Math.max(30, Math.round(data.production.morningWindowMinutes));
      }
      if (typeof data.production.middayCheckMinute === 'number') {
        S.safety.middayCheckMinute = Math.max(60, Math.round(data.production.middayCheckMinute));
      }
      if (typeof data.production.topUpCap === 'number') {
        S.safety.topUpCap = Math.max(4, Math.round(data.production.topUpCap));
      }
      if (typeof data.production.topUpBatch === 'number') {
        S.safety.topUpBatch = Math.max(4, Math.round(data.production.topUpBatch));
      }
    }
    if (data.staffing && typeof data.staffing === 'object') {
      S.safety.staffing = Object.assign({}, S.safety.staffing || {}, data.staffing);
      if (data.staffing.kidMode) {
        S.safety.staffing.kidMode = Object.assign({}, S.safety.staffing.kidMode || {}, data.staffing.kidMode);
      }
    }
    if (data.pricing && typeof data.pricing === 'object') {
      S.safety.pricing = Object.assign({}, data.pricing);
    }
    if (data.offline && typeof data.offline.maxDays === 'number') {
      S.offline.maxDays = Math.max(1, Math.min(14, Math.round(data.offline.maxDays)));
    }
    if (persist) {
      save();
      emit('config:economyApplied', { config: data, difficulty: diff });
    }
    return data;
  }

  async function loadEconomyConfig(url = 'dashboard_assets/js/config/economy.json') {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      applyEconomyConfig(data, true);
      return data;
    } catch (err) {
      console.error('Economy config load failed', err);
      return null;
    }
  }

  function getEconomyConfig() {
    ensureKidFriendlyStructures();
    return (S.meta?.config?.economy) || null;
  }

  function applyPolicyConfig(data, persist = true) {
    if (!data || typeof data !== 'object') return null;
    ensureKidFriendlyStructures();
    S.meta = S.meta || {};
    S.meta.config = S.meta.config || { economy: null, policies: null };
    S.meta.config.policies = data;
    if (data.production) {
      if (typeof data.production.planFloor === 'number') {
        S.safety.minPlan = Math.max(10, Math.round(data.production.planFloor));
      }
      if (typeof data.production.planCeiling === 'number') {
        S.safety.planCeiling = Math.max(S.safety.minPlan || 10, Math.round(data.production.planCeiling));
      }
      if (data.production.focusBias) {
        S.policy.focusBias = Object.assign({}, data.production.focusBias);
      }
    }
    if (data.restock) {
      if (typeof data.restock.minMultiplier === 'number') {
        S.safety.restockMultipliers.min = Math.max(1, data.restock.minMultiplier);
      }
      if (typeof data.restock.targetMultiplier === 'number') {
        S.safety.restockMultipliers.target = Math.max(S.safety.restockMultipliers.min || 1, data.restock.targetMultiplier);
      }
      if (Array.isArray(data.restock.priorityIngredients) && data.restock.priorityIngredients.length) {
        S.safety.priorityIngredients = data.restock.priorityIngredients.slice(0, 12);
      }
      if (typeof data.restock.ingredientBuffer === 'number') {
        S.safety.ingredientBuffer = Math.max(0, Math.min(0.5, data.restock.ingredientBuffer));
      }
      if (typeof data.restock.maxOrdersPerDay === 'number') {
        S.safety.maxRestockOrders = Math.max(1, Math.round(data.restock.maxOrdersPerDay));
      }
    }
    if (data.pricing) {
      S.safety.pricing = Object.assign({}, S.safety.pricing || {}, data.pricing);
    }
    if (data.safety) {
      if (typeof data.safety.lowCashTrigger === 'number') {
        S.safety.lowCashTrigger = clamp(data.safety.lowCashTrigger, 0.05, 0.5);
      }
      if (Array.isArray(data.safety.voucherRange) && data.safety.voucherRange.length >= 2) {
        S.safety.voucherRange = [Number(data.safety.voucherRange[0]), Number(data.safety.voucherRange[1])];
      }
      if (typeof data.safety.voucherCooldownDays === 'number') {
        S.safety.voucherCooldownDays = Math.max(1, Math.round(data.safety.voucherCooldownDays));
      }
    }
    if (data.upgrades) {
      S.policy.upgradeRules = Object.assign({}, data.upgrades);
    }
    if (data.events) {
      S.policy.eventRules = Object.assign({}, data.events);
    }
    if (data.rewards) {
      S.policy.rewardRules = Object.assign({}, data.rewards);
    }
    if (data.offline && typeof data.offline.maxDays === 'number') {
      S.offline.maxDays = Math.max(1, Math.min(14, Math.round(data.offline.maxDays)));
    }
    if (persist) {
      save();
      emit('config:policiesApplied', { config: data });
    }
    return data;
  }

  async function loadPolicyConfig(url = 'dashboard_assets/js/config/policies.json') {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      applyPolicyConfig(data, true);
      return data;
    } catch (err) {
      console.error('Policy config load failed', err);
      return null;
    }
  }

  function getPolicyConfig() {
    ensureKidFriendlyStructures();
    return (S.meta?.config?.policies) || null;
  }



  // ---------- Auto-Manager state helpers ----------
  function getAutoManagerState() {
    ensureKidFriendlyStructures();
    if (!S.automanager || typeof S.automanager !== 'object') {
      S.automanager = { plan: null, lastDay: null, memory: {} };
    }
    return S.automanager;
  }

  function setAutoManagerPlan(plan, persist = true) {
    ensureKidFriendlyStructures();
    if (!S.automanager || typeof S.automanager !== 'object') {
      S.automanager = { plan: null, lastDay: null, memory: {} };
    }
    S.automanager.plan = plan ? Object.assign({ ts: Date.now() }, plan) : null;
    if (persist) save();
    return S.automanager.plan;
  }

  function updateAutoManagerMemory(patch = {}, persist = true) {
    ensureKidFriendlyStructures();
    if (!S.automanager || typeof S.automanager !== 'object') {
      S.automanager = { plan: null, lastDay: null, memory: {} };
    }
    S.automanager.memory = Object.assign({}, S.automanager.memory || {}, patch);
    if (persist) save();
    return S.automanager.memory;
  }

  function recordAutoManagerDay(summary, persist = true) {
    ensureKidFriendlyStructures();
    if (!S.automanager || typeof S.automanager !== 'object') {
      S.automanager = { plan: null, lastDay: null, memory: {} };
    }
    const entry = summary ? Object.assign({ ts: Date.now() }, summary) : null;
    S.automanager.lastDay = entry;
    if (!Array.isArray(S.automanager.history)) S.automanager.history = [];
    if (entry) {
      S.automanager.history.push(entry);
      if (S.automanager.history.length > 14) {
        S.automanager.history = S.automanager.history.slice(-14);
      }
    }
    if (persist) save();
    return entry;
  }

  // ---------- Kid mode & Smart Manager helpers ----------
  function getModes() {
    ensureKidFriendlyStructures();
    return { ...S.modes };
  }

  function setKidMode(enabled) {
    ensureKidFriendlyStructures();
    S.modes.kidMode = !!enabled;
    save(); emit('modes:kid', { enabled: S.modes.kidMode });
    return S.modes.kidMode;
  }

  function setSmartManager(enabled) {
    ensureKidFriendlyStructures();
    S.modes.smartManager = !!enabled;
    save(); emit('modes:smart', { enabled: S.modes.smartManager });
    return S.modes.smartManager;
  }

  function setDifficulty(level) {
    ensureKidFriendlyStructures();
    const norm = (typeof level === 'string' && level.toLowerCase() === 'normal') ? 'normal' : 'easy';
    if (S.modes.difficulty === norm) return norm;
    S.modes.difficulty = norm;
    if (S.meta?.config?.economy) applyEconomyConfig(S.meta.config.economy, false);
    if (S.meta?.config?.policies) applyPolicyConfig(S.meta.config.policies, false);
    save(); emit('modes:difficulty', { difficulty: norm });
    return norm;
  }

  function getPolicy() {
    ensureKidFriendlyStructures();
    return { ...S.policy };
  }

  function updatePolicy(partial = {}) {
    ensureKidFriendlyStructures();
    if (partial.focus) {
      const f = String(partial.focus).toLowerCase();
      if (['balanced', 'profit', 'happy'].includes(f)) partial.focus = f;
      else delete partial.focus;
    }
    if (Object.prototype.hasOwnProperty.call(partial, 'cashReserve')) {
      const v = Number(partial.cashReserve);
      if (!Number.isNaN(v)) partial.cashReserve = clamp(v, 0, 0.6);
      else delete partial.cashReserve;
    }
    S.policy = Object.assign(ensureDefaults(S.policy, defaultPolicy), partial);
    S.policy.memory = ensureDefaults(S.policy.memory, defaultPolicyMemory);
    save(); emit('policy:updated', { policy: S.policy });
    return S.policy;
  }

  function updatePolicyMemory(partial = {}) {
    ensureKidFriendlyStructures();
    S.policy.memory = ensureDefaults(S.policy.memory, defaultPolicyMemory);
    Object.assign(S.policy.memory, partial);
    save();
    return S.policy.memory;
  }

  function getGoals() {
    ensureKidFriendlyStructures();
    return { ...S.goals };
  }

  function resetGoals() {
    ensureKidFriendlyStructures();
    S.goals = defaultGoals();
    save();
    return { ...S.goals };
  }

  function updateGoals(next = {}) {
    ensureKidFriendlyStructures();
    Object.assign(S.goals, next);
    if (typeof S.goals.earnedStars !== 'number') S.goals.earnedStars = 0;
    save(); emit('goals:updated', { goals: S.goals });
    return S.goals;
  }

  function recordStars(count) {
    ensureKidFriendlyStructures();
    const stars = Math.max(0, Math.min(3, Math.round(Number(count) || 0)));
    S.goals.earnedStars = stars;
    save();
    return stars;
  }

  function getRewards() {
    ensureKidFriendlyStructures();
    return { ...S.rewards, badges: [...S.rewards.badges], permaBuffs: [...S.rewards.permaBuffs] };
  }

  function updateRewards(partial = {}) {
    ensureKidFriendlyStructures();
    Object.assign(S.rewards, partial);
    save();
    return S.rewards;
  }

  function grantBadge(id, meta = {}) {
    if (!id) return false;
    ensureKidFriendlyStructures();
    const entry = Object.assign({ id, earnedAt: Date.now() }, meta);
    S.rewards.badges = pushUnique(S.rewards.badges, entry, 'id');
    save(); emit('rewards:badge', { badge: entry });
    return true;
  }

  function grantPermaBuff(buff) {
    if (!buff || typeof buff !== 'object') return false;
    ensureKidFriendlyStructures();
    const entry = Object.assign({ id: buff.id || ('buff_' + Date.now()), grantedAt: Date.now() }, buff);
    S.rewards.permaBuffs = pushUnique(S.rewards.permaBuffs, entry, 'id');
    save(); emit('rewards:permaBuff', { buff: entry });
    return entry;
  }

  function bumpGoodStreak(goodDay = true) {
    ensureKidFriendlyStructures();
    if (goodDay) S.rewards.streakGoodDays += 1;
    else S.rewards.streakGoodDays = 0;
    save();
    return S.rewards.streakGoodDays;
  }

  function markSafetyVoucher(dayIndex, value) {
    ensureKidFriendlyStructures();
    S.rewards.lastVoucherDay = typeof dayIndex === 'number' ? dayIndex : (S.world?.day || 0);
    S.rewards.lastVoucherValue = value ?? S.safety.voucherValue;
    save();
  }

  function setPendingBuff(buff) {
    ensureKidFriendlyStructures();
    S.rewards.pendingBuff = buff || null;
    save();
  }

  function consumePendingBuff() {
    ensureKidFriendlyStructures();
    const buff = S.rewards.pendingBuff || null;
    S.rewards.pendingBuff = null;
    save();
    return buff;
  }

  function getSafety() {
    ensureKidFriendlyStructures();
    return { ...S.safety };
  }

  function updateSafety(partial = {}) {
    ensureKidFriendlyStructures();
    Object.assign(S.safety, partial);
    save();
    return S.safety;
  }

  function getKidsTelemetry() {
    ensureKidFriendlyStructures();
    return {
      lastSummary: S.kidsTelemetry.lastSummary,
      history: [...S.kidsTelemetry.history]
    };
  }

  function recordKidsTelemetry(summary) {
    ensureKidFriendlyStructures();
    const entry = Object.assign({ ts: Date.now() }, summary || {});
    S.kidsTelemetry.lastSummary = entry;
    S.kidsTelemetry.history.push(entry);
    if (S.kidsTelemetry.history.length > MAX_KIDS_HISTORY) {
      S.kidsTelemetry.history = S.kidsTelemetry.history.slice(-MAX_KIDS_HISTORY);
    }
    save();
    return entry;
  }

  function getOfflineSettings() {
    ensureKidFriendlyStructures();
    return { ...S.offline };
  }

  function setOfflineSummary(summary) {
    ensureKidFriendlyStructures();
    S.offline.pendingSummary = summary ? Object.assign({ ts: Date.now() }, summary) : null;
    save();
    return S.offline.pendingSummary;
  }

  function consumeOfflineSummary() {
    ensureKidFriendlyStructures();
    const summary = S.offline.pendingSummary || null;
    S.offline.pendingSummary = null;
    save();
    return summary;
  }

  function touchOfflineTimestamp(ts, persist = true) {
    ensureKidFriendlyStructures();
    S.offline.lastSimulatedTs = ts || Date.now();
    if (persist) save();
    return S.offline.lastSimulatedTs;
  }

  function getEconomyFlags() {
    ensureKidFriendlyStructures();
    return { ...S.economyFlags };
  }

  function updateEconomyFlags(partial = {}) {
    ensureKidFriendlyStructures();
    Object.assign(S.economyFlags, partial);
    save();
    return S.economyFlags;
  }

  // ---------- Inventar / Rețete / Ingrediente ----------
  function addInventory(key, qty, q) {
    if (qty <= 0) return;
    const p = S.products[key]; if (!p) return;
    p.stock.push({ qty: Math.round(qty), q: clamp(q, 0, 1), age: 0 });
    save(); emit('inventory:added', { key, qty });
  }
  function totalStock(key) {
    const p = S.products[key]; if (!p || !p.stock) return 0;
    return p.stock.reduce((s, l) => s + l.qty, 0);
  }
  function canProduce(recipeId, qty) {
    const count = Math.max(1, Math.round(qty || 1));
    const r = S.recipes && S.recipes[recipeId]; if (!r) return true;
    const need = r.ingredients || {};
    return Object.entries(need).every(([k, v]) => {
      const have = (S.ingredients?.[k]?.qty) || 0; return have >= (v * count);
    });
  }
  function consumeFor(recipeId, qty) {
    const count = Math.max(1, Math.round(qty || 1));
    const r = S.recipes && S.recipes[recipeId]; if (!r) return;
    const need = r.ingredients || {};
    Object.entries(need).forEach(([k, v]) => {
      if (!S.ingredients[k]) S.ingredients[k] = { qty: 0, shelfLife: 30 };
      S.ingredients[k].qty = Math.max(0, (S.ingredients[k].qty || 0) - v * count);
    });
    save();
  }
  function buyIngredient(id, qty, priceMap) {
    const q = Math.max(0, Math.round(qty || 0)); if (q <= 0) return false;
    const price = priceMap?.[id] ?? 0; const cost = price * q;
    if ((S.cash || 0) >= cost) { S.cash -= cost; if (!S.ingredients[id]) S.ingredients[id] = { qty: 0, shelfLife: 30 }; S.ingredients[id].qty += q; save(); return true; }
    return false;
  }

  // ---------- Products & R&D ----------
  function getActiveProductKey() { return S.activeProduct || 'croissant'; }
  function setActiveProduct(key) {
    if (!S.products[key]) return false;
    if (S.products[key].locked) return false;
    S.activeProduct = key; save(); emit('product:activeChanged', { key }); return true;
  }
  function isUnlocked(key) { return S.products[key] && !S.products[key].locked && (S.research?.unlocked || []).includes(key); }
  function unlockProduct(key, cost = 300) {
    if (!S.products[key]) return false;
    if (isUnlocked(key)) return true;
    if ((S.cash || 0) < cost) return false;
    S.cash -= cost;
    S.products[key].locked = false;
    S.research = S.research || { unlocked: [] };
    if (!S.research.unlocked.includes(key)) S.research.unlocked.push(key);
    save(); emit('product:unlocked', { key });
    return true;
  }
  async function loadRecipesJSON(url) {
    try {
      const res = await fetch(url, { cache: 'no-store' }); const data = await res.json();
      if (data && typeof data === 'object') {
        S.recipes = Object.assign({}, S.recipes, data.recipes || {});
        if (data.ingredients) {
          Object.keys(data.ingredients).forEach(k => {
            S.ingredients[k] = S.ingredients[k] || { qty: 0, shelfLife: 30 };
            if (typeof data.ingredients[k].shelfLife === 'number') S.ingredients[k].shelfLife = data.ingredients[k].shelfLife;
          });
        }
        save(); emit('recipes:loaded', { count: Object.keys(data.recipes || {}).length });
        return true;
      }
    } catch (_) { }
    return false;
  }

  // ---------- Sezon & Meteo ----------
  function seasonEffects(season) {
    const s = season || (S.world?.season) || 'primavara';
    if (s === 'vara') return { traffic: 1.15, wait: +0.20, qBonus: +0.00 };
    if (s === 'toamna') return { traffic: 0.95, wait: +0.00, qBonus: +0.02 };
    if (s === 'iarna') return { traffic: 0.85, wait: +0.00, qBonus: +0.00 };
    return { traffic: 1.00, wait: +0.00, qBonus: +0.00 }; // primăvara
  }
  function weatherEffects(weather) {
    const w = weather || (S.economy2?.weather) || 'sunny';
    if (w === 'rain') return { traffic: 0.92, wait: +0.20, qBonus: +0.00, label: '🌧️ Ploaie' };
    if (w === 'snow') return { traffic: 0.85, wait: +0.30, qBonus: +0.00, label: '❄️ Ninsoare' };
    if (w === 'heat') return { traffic: 0.97, wait: +0.40, qBonus: +0.00, label: '🔥 Caniculă' };
    if (w === 'cloudy') return { traffic: 0.98, wait: +0.05, qBonus: +0.00, label: '⛅ Înnorat' };
    return { traffic: 1.00, wait: +0.00, qBonus: +0.00, label: '☀️ Senin' };
  }
  function rollWeather(season) {
    const s = season || (S.world?.season) || 'primavara';
    const r = Math.random();
    let next = 'sunny';
    if (s === 'vara') {
      next = r < 0.50 ? 'sunny' : r < 0.72 ? 'heat' : r < 0.90 ? 'cloudy' : 'rain';
    } else if (s === 'toamna') {
      next = r < 0.35 ? 'sunny' : r < 0.65 ? 'cloudy' : r < 0.92 ? 'rain' : 'sunny';
    } else if (s === 'iarna') {
      next = r < 0.30 ? 'sunny' : r < 0.55 ? 'cloudy' : r < 0.85 ? 'snow' : 'sunny';
    } else { // primăvară
      next = r < 0.45 ? 'sunny' : r < 0.75 ? 'cloudy' : r < 0.92 ? 'rain' : 'sunny';
    }
    S.economy2 = S.economy2 || {};
    S.economy2.weather = next;
    save(); emit('weather:changed', { weather: next });
    return next;
  }

  // ---------- Evenimente ----------
  function todayEvents() {
    const w = S.world || { year: 1, season: 'primavara', day: S.day || 1 };
    return (S.events?.calendar || []).filter(e => e.season === (w.season) && Number(e.day) === (w.day));
  }
  function listUpcomingEvents(n = 7) {
    const w = S.world || { year: 1, season: 'primavara', day: S.day || 1 };
    const out = [];
    for (let i = 0; i < n; i++) {
      const day = ((w.day + i - 1) % 28) + 1;
      const seasonIndex = ['primavara', 'vara', 'toamna', 'iarna'].indexOf(w.season);
      const sIdx = (seasonIndex + Math.floor((w.day + i - 1) / 28)) % 4;
      const season = ['primavara', 'vara', 'toamna', 'iarna'][sIdx];
      const matches = (S.events?.calendar || []).filter(e => e.season === season && Number(e.day) === day);
      matches.forEach(ev => out.push({ day, season, ...ev }));
    }
    return out;
  }
  function joinTodayFestival(eventId) {
    const ev = todayEvents().find(e => e.id === eventId && e.type === 'festival');
    if (!ev) return false;
    const cost = Math.max(0, Number(ev.cost || 0));
    if ((S.cash || 0) < cost) return false;
    S.cash -= cost;
    const key = DAY_KEY(S.world);
    S.events.joined = S.events.joined || {};
    S.events.joined[key] = S.events.joined[key] || {};
    S.events.joined[key][ev.id] = true;
    save(); emit('event:joined', { day: key, eventId });
    addBuff({ id: 'festivalStand', label: 'Stand festival', minutes: 120, trafficMult: 1.05 });
    return true;
  }
  function eventModsForToday() {
    const evs = todayEvents();
    if (!evs || evs.length === 0) return { traffic: 1, conv: 0, qBonus: 0, wait: 0 };
    const key = DAY_KEY(S.world);
    const joined = (S.events?.joined?.[key]) || {};
    let traffic = 1, conv = 0, q = 0, w = 0;
    evs.forEach(e => {
      const eff = e.effects || {};
      const eligible = (e.type === 'global') || (e.type === 'festival' && joined[e.id]);
      if (!eligible) return;
      if (eff.trafficMult) traffic *= eff.trafficMult;
      if (typeof eff.convBonus === 'number') conv += eff.convBonus;
      if (typeof eff.qBonus === 'number') q += eff.qBonus;
      if (typeof eff.wait === 'number') w += eff.wait;
    });
    return { traffic, conv, qBonus: q, wait: w };
  }

  // ---------- Quests ----------
  function _makeDailyQuests() {
    const w = S.world || { season: 'primavara', day: 1 };
    const q1 = { id: `dq_sold_${w.season}_${w.day}`, label: 'Vinde 120 bucăți azi', type: 'sold', progress: 0, target: 120, reward: { cash: 120 }, status: 'active', expires: { season: w.season, day: w.day } };
    const q2 = { id: `dq_quality_${w.season}_${w.day}`, label: 'Q medie ≥ 0.90', type: 'qavg', progress: 0, target: 0.90, reward: { buff: { id: 'qualityStar', label: 'Calitate de top', minutes: 60, qBonus: 0.02 } }, status: 'active', expires: { season: w.season, day: w.day } };
    const q3 = { id: `dq_wait_${w.season}_${w.day}`, label: 'Timp mediu W ≤ 2.0', type: 'wait', progress: 0, target: 2.0, reward: { cash: 80 }, status: 'active', expires: { season: w.season, day: w.day } };
    return [q1, q2, q3];
  }
  function ensureDailyQuests() {
    const w = S.world || { day: S.day || 1 };
    S.quests = S.quests || { daily: [], weekly: [], lastGenDay: 0, lastGenWeek: 0 };
    if ((S.quests.lastGenDay || 0) === w.day && (S.quests.daily || []).length) return;
    S.quests.daily = _makeDailyQuests();
    S.quests.lastGenDay = w.day;
    save(); emit('quests:generated', { day: w.day });
  }
  function questEndOfDay(agg) {
    ensureDailyQuests();
    const d = S.quests.daily || [];
    const sold = Math.round(agg?.sold || 0);
    const qavg = Number((agg?.Q || 0).toFixed(2));
    const wavg = Number((agg?.W || 0).toFixed(2));
    d.forEach(q => {
      if (q.type === 'sold') { q.progress = sold; if (sold >= q.target) q.status = (q.status === 'claimed' ? 'claimed' : 'ready'); }
      if (q.type === 'qavg') { q.progress = qavg; if (qavg >= q.target) q.status = (q.status === 'claimed' ? 'claimed' : 'ready'); }
      if (q.type === 'wait') { q.progress = wavg; if (wavg <= q.target) q.status = (q.status === 'claimed' ? 'claimed' : 'ready'); }
    });
    save(); emit('quests:updated', { sold, qavg, wavg });
  }
  function claimQuest(id) {
    const all = [...(S.quests?.daily || []), ...(S.quests?.weekly || [])];
    const q = all.find(x => x.id === id); if (!q || q.status !== 'ready') return false;
    const r = q.reward || {};
    if (r.cash) { S.cash = (S.cash || 0) + Math.max(0, Number(r.cash || 0)); }
    if (r.buff) { addBuff(r.buff); }
    q.status = 'claimed'; save(); emit('quest:claimed', { id });
    return true;
  }
  function getQuests() { return { daily: (S.quests?.daily) || [], weekly: (S.quests?.weekly) || [] }; }

  // ---------- Staff ----------
  function _team() { return Array.isArray(S.staff?.team) ? S.staff.team : (S.staff.team = []); }
  function teamSummary() {
    const T = _team(); if (!T.length) return { avgSkill: 0.6, avgMood: 0.75, payroll: 0, cashiers: S.staff?.cashier || 1 };
    const sumSkill = T.reduce((s, e) => s + Number(e.skill || 0), 0);
    const sumMood = T.reduce((s, e) => s + Number(e.mood || 0), 0);
    const payroll = T.reduce((s, e) => s + Math.max(0, Number(e.wagePerDay || 0)), 0);
    const cashiers = (S.staff?.cashier || 1);
    return { avgSkill: sumSkill / T.length, avgMood: sumMood / T.length, payroll, cashiers };
  }
  function getCashierMu(cashiersOverride) {
    const base = (S.capacity?.cashierMu || 1.5);
    const fastPOS = (S.upgrades?.posRapid ? 0.8 : 0);
    const count = Math.max(1, Number(cashiersOverride ?? S.staff?.cashier ?? 1));
    const multi = Math.max(0, count - 1) * 0.5;
    const { avgSkill, avgMood } = teamSummary();
    const muStaff = 0.4 * avgSkill + 0.3 * (avgMood - 0.5);
    return Math.max(0.5, base + fastPOS + multi + muStaff);
  }
  function staffDailyTick({ avgW = 2, complaints = 0 } = {}) {
    const T = _team(); let payroll = 0;
    T.forEach(e => {
      payroll += Math.max(0, Number(e.wagePerDay || 0));
      let dmood = -0.04 * (Math.max(0, avgW - 3)) - 0.03 * complaints + 0.02; // un mic rebound pozitiv
      e.mood = clamp((e.mood || 0.75) + dmood, 0.20, 0.99);
      e.fatigue = clamp((e.fatigue || 0.2) - 0.25, 0, 0.9);
    });
    S.cash = (S.cash || 0) - payroll;
    save(); return payroll;
  }
  function staffAdjustMood(delta) {
    const T = _team(); T.forEach(e => e.mood = clamp((e.mood || 0.7) + (delta || 0), 0.2, 0.99)); save();
  }
  function staffTrain(id, delta = 0.02, cost = 100) {
    if ((S.cash || 0) < cost) return false;
    const e = _team().find(x => x.id === id); if (!e) return false;
    e.skill = clamp((e.skill || 0.6) + delta, 0.3, 0.98);
    S.cash -= cost; save(); return true;
  }

  // ---------- World time ----------
  function tickMinutes(n = 1) {
    const m = Math.max(1, Math.round(n || 1));
    S.timeMin += m;
    S.world = S.world || { year: 1, season: 'primavara', day: S.day || 1, minute: S.timeMin, open: 8 * 60, close: 8 * 60 + DAY_MINUTES };
    S.world.minute = (S.world.minute || S.timeMin) + m;
    tickBuffs(1);
    save();
  }

  // ---------- Fast-forward offline (agregat pe zi) ----------
  function _avgQuality(key = 'croissant') {
    const p = S.products?.[key]; if (!p || !Array.isArray(p.stock) || p.stock.length === 0) return 0.86 + (S.boost?.qBonus || 0);
    const sum = p.stock.reduce((acc, l) => acc + (l.q || 0) * Math.max(0, l.qty || 0), 0);
    const cnt = p.stock.reduce((acc, l) => acc + Math.max(0, l.qty || 0), 0);
    return cnt > 0 ? (sum / cnt) : (0.86 + (S.boost?.qBonus || 0));
  }
  function _sellFromStock(key = 'croissant', qty = 0) {
    const p = S.products?.[key]; if (!p || !Array.isArray(p.stock)) return { sold: 0, qAvg: _avgQuality(key) };
    let left = Math.max(0, Math.round(qty || 0)), sold = 0, qw = 0;
    for (const lot of p.stock) {
      if (left <= 0) break;
      const take = Math.min(lot.qty || 0, left);
      lot.qty = (lot.qty || 0) - take;
      left -= take; sold += take; qw += take * (lot.q || 0);
    }
    p.stock = p.stock.filter(l => (l.qty || 0) > 0);
    const qAvg = sold > 0 ? (qw / sold) : _avgQuality(key);
    return { sold, qAvg };
  }

  function _seasonMult() { // legacy helper pentru fast-forward (menținut pt. compat)
    const s = (S.world?.season) || 'primavara';
    return s === 'vara' ? 1.15 : s === 'toamna' ? 0.95 : s === 'iarna' ? 0.85 : 1.00;
  }
  function _weatherAdj() {
    const w = (S.economy2?.weather) || 'sunny';
    if (w === 'rain') return { traffic: 0.92, wait: +0.2 };
    if (w === 'snow') return { traffic: 0.85, wait: +0.3 };
    if (w === 'heat') return { traffic: 0.97, wait: +0.4 };
    if (w === 'cloudy') return { traffic: 0.98, wait: +0.05 };
    return { traffic: 1.00, wait: 0 };
  }

  async function fastForwardFromLastSeen() {
    try {
      const slot = S.meta?.slot || localStorage.getItem('fk_active_slot') || 'autosave';
      const last = Number(localStorage.getItem(SLOT_LAST(slot))) || (S.meta?.lastSeenTs) || Date.now();
      const realMin = Math.max(0, Math.floor((Date.now() - last) / 60000));
      // Heuristic: ~45 min reale ≈ 1 zi în joc; plafon 7 zile
      const daysToSim = Math.max(0, Math.min(7, Math.floor(realMin / 45)));
      if (daysToSim <= 0) return;
      const aggregate = { days: 0, sold: 0, revenue: 0, profit: 0, stars: 0 };
      const starFor = (summary) => {
        if (!summary || !summary.plannedQty) return 0;
        const soldRatio = summary.plannedQty > 0 ? summary.sold / summary.plannedQty : 0;
        let stars = 0;
        if (soldRatio >= 0.6) stars = 1;
        if (soldRatio >= 0.8 && (summary.avgQuality || 0) >= 0.9) stars = 2;
        if (soldRatio >= 0.8 && (summary.profit || 0) > 0) stars = 3;
        return stars;
      };
      for (let i = 0; i < daysToSim; i++) {
        const summary = simulateOneDayAggregate();
        if (summary) {
          aggregate.days += 1;
          aggregate.sold += summary.sold || 0;
          aggregate.revenue += summary.revenue || 0;
          aggregate.profit += summary.profit || 0;
          aggregate.stars += starFor(summary);
        }
      }
      if (aggregate.days > 0) {
        setOfflineSummary({ days: aggregate.days, sold: aggregate.sold, revenue: aggregate.revenue, profit: aggregate.profit, stars: aggregate.stars });
      }
      touchOfflineTimestamp(Date.now(), false);

      save(); emit('state:push', S);
    } catch (_) { }
  }

  function simulateOneDayAggregate() {
    const key = getActiveProductKey();
    const prod = S.products[key];

    // 1) Producție matinală (agregat)
    const ovenFactor = S.upgrades?.ovenPlus ? 1.5 : 1;
    const ovenCapPerDay = Math.ceil((S.capacity.ovenBatchSize * ovenFactor) * (S.capacity.ovenBatchesPerDay));
    const plan = Math.max(0, Math.round(prod.plannedQty || 0));
    const rid = (prod.recipeId || 'croissant_plain');
    const need = (S.recipes?.[rid]?.ingredients) || {};
    const maxByStoc = Object.keys(need).length > 0 ? Math.min(...Object.entries(need).map(([k, v]) => Math.floor(((S.ingredients?.[k]?.qty) || 0) / Math.max(1, v)))) : plan;
    const made = Math.max(0, Math.min(plan, ovenCapPerDay, maxByStoc || 0));
    if (made > 0) {
      consumeFor(rid, made);
      const baseQ = 0.86 + (S.upgrades?.ovenPlus ? 0.02 : 0) + (S.upgrades?.timerAuto ? 0.02 : 0) + (S.boost?.qBonus || 0);
      const noise = (Math.random() * 0.06) - 0.03;
      addInventory(key, made, Math.max(0.70, Math.min(0.98, baseQ + noise)));
    }

    // 2) Cerere/Conversie (agregat)
    const F_base = 120; // baseline clienți/zi
    const season = _seasonMult();
    const weather = _weatherAdj();
    const ev = eventModsForToday();
    const marketing = ((S.marketing?.flyerDaysLeft || 0) > 0 ? 1.10 : 1.00) * ((S.marketing?.socialToday) ? 1.25 : 1.00);
    const trafficMult = (S.boost?.trafficMult || 1.00) * season * weather.traffic * (ev.traffic || 1) * (S.economyIndex || 1) * (S.reputation || 1) * marketing;
    const Nday = Math.round(F_base * trafficMult);

    const cashierMuBase = getCashierMu(S.staff?.cashier || 1);
    const W = Math.max(0, Math.min(6, ((Nday / (DAY_MINUTES)) - cashierMuBase) * 3 + (S.boost?.wBonus || 0) + (weather.wait || 0) + (ev.wait || 0)));

    const P0 = prod.P0 || 10; let P = prod.price || P0;
    const Q = Math.max(0.70, Math.min(0.99, _avgQuality(key) + (S.boost?.qBonus || 0) + (ev.qBonus || 0)));

    // conversie medie pe zi (ECON)
    const C0 = 0.50, epsilon = 1.6, alpha = 0.75, beta = 0.50, kappa = 0.60, delta = 0.10;
    const priceTerm = Math.exp(-epsilon * (P / P0 - 1));
    const qualityTerm = alpha + beta * Q;
    const waitPen = 1 - Math.min(kappa, delta * Math.max(0, W));
    const C = Math.max(0, Math.min(0.95, (C0 * priceTerm * qualityTerm * waitPen) + (ev.conv || 0)));
    const demand = Math.round(Nday * C);

    const stockBefore = totalStock(key);
    const { sold } = _sellFromStock(key, Math.min(stockBefore, demand));
    const rev = sold * P;
    const cogs = sold * ((prod.cost?.ingredients || 3) + (prod.cost?.laborVar || 0.5));

    // 3) Costuri & profit
    const holding = Math.max(0, (totalStock(key) || 0) * 0.10);
    const marketingCost = (S.marketing?.socialToday ? 150 : 0) + ((S.marketing?.flyerDaysLeft || 0) > 0 ? 80 : 0);
    const complaints = Math.max(0, (Nday > 0) ? (1 - sold / Math.max(1, Math.round(Nday * C))) : 0);
    const payroll = staffDailyTick({ avgW: W, complaints });
    const fixed = 150;
    const profit = rev - cogs - holding - marketingCost - fixed - payroll;
    S.cash = (S.cash || 0) + rev;

    // 4) Expirări & perisabile
    try {
      const L = prod.shelfLifeDays || 2;
      prod.stock?.forEach(l => l.age = (l.age || 0) + 1);
      prod.stock = (prod.stock || []).filter(l => (l.age || 0) < L);
      ['milk', 'strawberries'].forEach(id => {
        const it = S.ingredients?.[id]; if (it && it.qty > 0) { it.qty = Math.max(0, it.qty - Math.ceil(it.qty * 0.20)); }
      });
    } catch (_) { }

    // 5) Reputație
    const rho = 0.75; const f = Math.max(0.80, Math.min(1.20, 0.9 + 0.25 * (Q - 0.85) - 0.05 * complaints));
    S.reputation = Math.max(0.80, Math.min(1.20, rho * (S.reputation || 1) + (1 - rho) * f));

    // 6) Marketing & raport & quests
    if ((S.marketing?.flyerDaysLeft || 0) > 0) S.marketing.flyerDaysLeft--;
    S.marketing.socialToday = false;
    S.today = { report: { sold, revenue: rev, cogs, holding, marketing: marketingCost, fixed, payroll, profit, Q, W, C } };
    questEndOfDay({ sold, Q, W });

    // 7) Avans timp (end-of-day)
    S.day = (S.day || 1) + 1;
    S.timeMin = S.world?.open ?? 8 * 60;
    if (!S.world) { S.world = { year: 1, season: 'primavara', day: S.day, minute: S.timeMin, open: 8 * 60, close: 8 * 60 + DAY_MINUTES }; }
    S.world.day = (S.world.day || 1) + 1;
    if (S.world.day > 28) { S.world.day = 1; S.world.season = (S.world.season === 'primavara' ? 'vara' : S.world.season === 'vara' ? 'toamna' : S.world.season === 'toamna' ? 'iarna' : 'primavara'); }
    S.world.minute = S.world.open;
    // rolăm vremea următoarei zile
    rollWeather(S.world.season);

    const leftover = totalStock(key);
    return { sold, revenue: rev, profit, avgQuality: Q, wait: W, conversion: C, leftover, plannedQty: plan };
  }

  // ---------- Save Slots API ----------
  function _switchToSlot(slot) {
    if (!SLOT_KEYS[slot]) return false;
    const raw = localStorage.getItem(SLOT_KEYS[slot]);
    let load = raw ? JSON.parse(raw) : null;
    if (!load) {
      load = Object.assign({}, DEF);
      load.meta = { lastSeenTs: Date.now(), slot };
      localStorage.setItem(SLOT_KEYS[slot], JSON.stringify(load));
      localStorage.setItem(SLOT_LAST(slot), String(load.meta.lastSeenTs));
    }
    S = Object.assign({}, DEF, load);
    S.meta = S.meta || {}; S.meta.slot = slot;
    localStorage.setItem('fk_active_slot', slot);
    save(); emit('state:push', S); return true;
  }

  function getActiveSlot() { return S.meta?.slot || localStorage.getItem('fk_active_slot') || 'autosave'; }
  function setActiveSlot(slot) { return _switchToSlot(slot); }
  function listSlots() {
    return ['A', 'B', 'C', 'autosave'].map(s => {
      const raw = localStorage.getItem(SLOT_KEYS[s]);
      let obj = null; try { obj = JSON.parse(raw || 'null'); } catch (_) { }
      const when = Number(localStorage.getItem(SLOT_LAST(s))) || (obj?.meta?.lastSeenTs) || 0;
      return {
        slot: s,
        exists: !!obj,
        day: obj?.day || obj?.world?.day || 0,
        season: obj?.world?.season || '-',
        cash: Math.round(obj?.cash || 0),
        when
      };
    });
  }
  function saveToSlot(slot) {
    if (!SLOT_KEYS[slot]) return false;
    const snap = Object.assign({}, S, { meta: { ...(S.meta || {}), slot, lastSeenTs: Date.now() } });
    localStorage.setItem(SLOT_KEYS[slot], JSON.stringify(snap));
    localStorage.setItem(SLOT_LAST(slot), String(snap.meta.lastSeenTs));
    localStorage.setItem('fk_active_slot', slot);
    return true;
  }
  function deleteSlot(slot) {
    if (!SLOT_KEYS[slot]) return false;
    localStorage.removeItem(SLOT_KEYS[slot]);
    localStorage.removeItem(SLOT_LAST(slot));
    if ((S.meta?.slot) === slot) { // dacă ai șters slotul activ, comută pe autosave
      return _switchToSlot('autosave');
    }
    return true;
  }
  function duplicateSlot(from, to) {
    if (!SLOT_KEYS[from] || !SLOT_KEYS[to]) return false;
    const raw = localStorage.getItem(SLOT_KEYS[from]);
    if (!raw) return false;
    let obj = JSON.parse(raw); obj.meta = obj.meta || {}; obj.meta.slot = to; obj.meta.lastSeenTs = Date.now();
    localStorage.setItem(SLOT_KEYS[to], JSON.stringify(obj));
    localStorage.setItem(SLOT_LAST(to), String(obj.meta.lastSeenTs));
    return true;
  }

  // ---------- API public ----------
  return {
    // Stare
    getState() { return S; },
    setState(next) { S = Object.assign(S, next); save(); },
    saveState: save,
    addBuff, tickBuffs,

    // Export/Import
    exportJSON, importJSON,

    // Timp
    tickMinutes,
    fastForwardFromLastSeen,

    // Sezon & Meteo
    seasonEffects, weatherEffects, rollWeather,

    // Evenimente
    todayEvents, listUpcomingEvents, joinTodayFestival, eventModsForToday,

    // Quests
    ensureDailyQuests, getQuests, questEndOfDay, claimQuest,

    // Staff
    teamSummary, getCashierMu, staffDailyTick, staffAdjustMood, staffTrain,

    // Products/R&D
    getActiveProductKey, setActiveProduct, unlockProduct, isUnlocked, loadRecipesJSON,

    // Inventar & ingrediente
    addInventory, totalStock, canProduce, consumeFor, buyIngredient,

    // Sloturi
    getActiveSlot, setActiveSlot, listSlots, saveToSlot, deleteSlot, duplicateSlot,

    // Utils
    clamp, DAY_MINUTES,
  };
})();
