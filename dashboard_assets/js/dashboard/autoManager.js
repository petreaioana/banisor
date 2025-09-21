import { FK } from '../shared/state.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const DEFAULT_ECONOMY = {
  traffic: {
    baseCustomers: 120,
    seasonMultipliers: { primavara: 1.05, vara: 1.1, toamna: 0.95, iarna: 0.9 }
  },
  difficulty: {
    easy: { safetyFactor: 1.2, targetConversion: 0.82, cashReserve: 0.15, voucherValue: 280, maxVoucherPerWeek: 1, topUpBatch: 18 },
    normal: { safetyFactor: 1.1, targetConversion: 0.78, cashReserve: 0.12, voucherValue: 220, maxVoucherPerWeek: 1, topUpBatch: 14 }
  },
  pricing: {
    floorFactor: 0.9,
    ceilFactor: 1.05,
    soldOutBump: 0.05,
    leftoverCut: 0.05,
    maxDailyShift: { easy: 0.05, normal: 0.07 }
  },
  production: {
    morningWindowMinutes: 120,
    middayCheckMinute: 240,
    lowStockThreshold: 0.25,
    topUpCap: 48,
    topUpBatch: 16
  },
  staffing: {
    kidMode: { normalTraffic: 70, rapidTraffic: 110 },
    minCashiers: 1,
    maxCashiers: 2
  },
  offline: { maxDays: 7 },
  ingredients: {},
  products: {}
};

const DEFAULT_POLICIES = {
  production: {
    planFloor: 40,
    planCeiling: 240,
    focusBias: {
      balanced: { safetyAdjust: 0, priceBias: 0 },
      profit: { safetyAdjust: -0.05, priceBias: 0.02 },
      happy: { safetyAdjust: 0.08, priceBias: -0.02 }
    }
  },
  restock: {
    minMultiplier: 1.6,
    targetMultiplier: 2.4,
    maxOrdersPerDay: 3,
    ingredientBuffer: 0.2,
    priorityIngredients: ['flour', 'sugar', 'butter', 'milk', 'eggs']
  },
  pricing: { soldOutMinutesThreshold: 90, leftoverThreshold: 0.15, happyFocusBonus: -0.02 },
  staffing: { queueSmall: 2, queueLarge: 5, rapidDurationMinutes: 120 },
  events: { festivalMinPlan: 80, boostCooldownDays: 2, festivalCashBuffer: 0.2, boostTraffic: 0.12, boostQuality: 0.02 },
  upgrades: { roiDays: { easy: 6, normal: 5 }, cashBuffer: 0.2, priority: ['ovenPlus', 'timerAuto', 'posRapid'] },
  rewards: { goodStreakDays: 3, buffTraffic: 0.12, buffQuality: 0.02, encourageMessage: true },
  safety: { lowCashTrigger: 0.1, voucherCooldownDays: 7, voucherRange: [180, 300] },
  offline: { maxDays: 7, summaryLines: 3 }
};

let configsRequested = false;


function smartEnabled() {
  const modes = FK.getModes ? FK.getModes() : { smartManager: true };
  return modes.smartManager !== false;
}

function ensureConfigs() {
  let economy = FK.getEconomyConfig();
  let policies = FK.getPolicyConfig();
  if (!economy && !configsRequested && typeof window !== 'undefined') {
    configsRequested = true;
    try { FK.loadEconomyConfig(); } catch (_) {}
    try { FK.loadPolicyConfig(); } catch (_) {}
  }
  if (!economy) economy = DEFAULT_ECONOMY;
  if (!policies) policies = DEFAULT_POLICIES;
  return { economy, policies };
}

function getFocusBias(policies, focus) {
  const bias = policies.production?.focusBias || DEFAULT_POLICIES.production.focusBias;
  return bias[focus] || bias.balanced || { safetyAdjust: 0, priceBias: 0 };
}

function getActiveProductState() {
  const S = FK.getState();
  const key = (FK.getActiveProductKey && FK.getActiveProductKey()) || S.activeProduct || 'croissant';
  return { S, key, product: S.products?.[key] };
}

function seasonTrafficMultiplier(S, economy) {
  try {
    const season = S.world?.season || 'primavara';
    const base = economy.traffic?.seasonMultipliers?.[season];
    if (typeof base === 'number') return base;
  } catch (_) {}
  return 1;
}

function weatherTrafficMultiplier(S) {
  try {
    const w = S.economy2?.weather || 'sunny';
    const effW = FK.weatherEffects ? FK.weatherEffects(w) : { traffic: 1 };
    return effW.traffic || 1;
  } catch (_) { return 1; }
}

function eventTrafficMultiplier() {
  try {
    const mods = FK.eventModsForToday ? FK.eventModsForToday() : null;
    return mods && typeof mods.traffic === 'number' ? mods.traffic : 1;
  } catch (_) { return 1; }
}

function marketingMultiplier(S) {
  const flyer = (S.marketing?.flyerDaysLeft || 0) > 0 ? 1.1 : 1;
  const social = S.marketing?.socialToday ? 1.2 : 1;
  return flyer * social;
}

function computeExpectedDemand(S, economy) {
  const base = economy.traffic?.baseCustomers || 120;
  const rep = Math.max(0.6, Math.min(1.4, S.reputation || 1));
  const boost = S.boost?.trafficMult || 1;
  const seasonMult = seasonTrafficMultiplier(S, economy);
  const weatherMult = weatherTrafficMultiplier(S);
  const eventMult = eventTrafficMultiplier();
  const marketing = marketingMultiplier(S);
  return base * rep * boost * seasonMult * weatherMult * eventMult * marketing;
}

function getEconomyIngredientPriceMap(economy) {
  const out = {};
  const entries = economy.ingredients || {};
  Object.keys(entries).forEach((k) => {
    const price = Number(entries[k]?.price);
    if (!Number.isNaN(price)) out[k] = price;
  });
  return out;
}

function baseBatchQuality(S) {
  const boostQ = S.boost?.qBonus || 0;
  const oven = S.upgrades?.ovenPlus ? 0.02 : 0;
  const timer = S.upgrades?.timerAuto ? 0.02 : 0;
  return clamp(0.86 + boostQ + oven + timer, 0.7, 0.98);
}

function computePriceBounds(product, economy, difficulty) {
  const P0 = product?.P0 || 10;
  const pricing = economy.pricing || DEFAULT_ECONOMY.pricing;
  const floor = P0 * (pricing.floorFactor || 0.9);
  const ceil = P0 * (pricing.ceilFactor || 1.05);
  const maxShift = pricing.maxDailyShift?.[difficulty] || pricing.maxDailyShift?.easy || 0.05;
  return { P0, floor, ceil, maxShift: P0 * maxShift };
}

function safeNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function computePlannedQuantity(S, product, economy, policies, focusBias, demand, difficulty) {
  const minPlan = safeNumber(S.safety?.minPlan, policies.production?.planFloor || 40);
  const maxPlan = safeNumber(S.safety?.planCeiling, policies.production?.planCeiling || 240);
  const productPlan = product?.plannedQty || minPlan;
  const productCfg = economy.products?.[product?.key || S.activeProduct];
  const basePlan = safeNumber(productCfg?.plan?.[difficulty], productPlan);
  const targetConversion = economy.difficulty?.[difficulty]?.targetConversion ?? 0.8;
  const safetyFactor = Math.max(1, (economy.difficulty?.[difficulty]?.safetyFactor ?? 1.1) + (focusBias?.safetyAdjust || 0));
  const suggested = Math.ceil(demand * targetConversion * safetyFactor);
  const blended = Math.round((suggested + basePlan) / 2);
  return clamp(blended, minPlan, maxPlan);
}

function adjustedPrice(product, plan, economy, policies, focusBias, difficulty, lastDaySummary) {
  const { P0, floor, ceil, maxShift } = computePriceBounds(product, economy, difficulty);
  const current = Number(product?.price || P0);
  let target = current;
  const policy = FK.getPolicy ? FK.getPolicy() : null;
  const memory = (policy && policy.memory) || {};
  const soldOutYesterday = lastDaySummary?.soldOut ?? memory.soldOutYesterday;
  const leftoverRatio = lastDaySummary?.leftoverRatio ?? (memory.leftoverYesterday ? 0.2 : 0);
  const pricing = policies.pricing || DEFAULT_POLICIES.pricing;
  if (soldOutYesterday) {
    target = current + P0 * (economy.pricing?.soldOutBump || 0.05);
  } else if (leftoverRatio > (pricing.leftoverThreshold || 0.15)) {
    target = current - P0 * (economy.pricing?.leftoverCut || 0.05);
  }
  if (focusBias.priceBias) {
    target += P0 * focusBias.priceBias;
  }
  const diff = clamp(target - current, -maxShift, maxShift);
  let price = current + diff;
  price = clamp(price, floor, ceil);
  if (difficulty === 'easy' && typeof pricing.happyFocusBonus === 'number' && focusBias === policies.production?.focusBias?.happy) {
    price = clamp(price + P0 * pricing.happyFocusBonus, floor, ceil);
  }
  return Number(price.toFixed(2));
}

function determineCashiers(S, economy, demand) {
  const staffing = S.safety?.staffing || economy.staffing || DEFAULT_ECONOMY.staffing;
  const kidRules = staffing.kidMode || DEFAULT_ECONOMY.staffing.kidMode;
  const rapidThreshold = kidRules?.rapidTraffic || 110;
  const normalThreshold = kidRules?.normalTraffic || 70;
  const maxCashiers = staffing.maxCashiers || 2;
  const minCashiers = staffing.minCashiers || 1;
  const projected = demand / (FK.DAY_MINUTES || 480) * 60; // hourly arrival rate
  if (projected > rapidThreshold) return Math.min(2, maxCashiers);
  if (projected > normalThreshold) return Math.min(2, maxCashiers);
  return Math.max(1, minCashiers);
}

function computeRestockPlan(S, productKey, plannedQty, economy, policies) {
  const recipeId = S.products?.[productKey]?.recipeId;
  const recipe = recipeId ? S.recipes?.[recipeId] : null;
  if (!recipe) return { orders: [], totalCost: 0 };
  const multipliers = S.safety?.restockMultipliers || { min: 1.6, target: 2.4 };
  const ingredientBuffer = S.safety?.ingredientBuffer ?? policies.restock?.ingredientBuffer ?? 0.2;
  const priceMap = getEconomyIngredientPriceMap(economy);
  const orders = [];
  Object.entries(recipe.ingredients || {}).forEach(([ingredient, qtyPerUnit]) => {
    const needPerDay = plannedQty * qtyPerUnit;
    const minLevel = Math.ceil(needPerDay * (multipliers.min || 1.6));
    const targetLevel = Math.ceil(needPerDay * (multipliers.target || 2.4) * (1 + ingredientBuffer));
    const current = S.ingredients?.[ingredient]?.qty || 0;
    if (current < minLevel) {
      const orderQty = Math.max(0, targetLevel - current);
      const price = priceMap[ingredient] || 0;
      const cost = orderQty * price;
      orders.push({ ingredient, qty: orderQty, cost, price });
    }
  });
  const totalCost = orders.reduce((sum, o) => sum + (o.cost || 0), 0);
  return { orders, totalCost, priceMap };
}

function applyRestockOrders(orders, priceMap, cashAvailable) {
  let spent = 0;
  const executed = [];
  orders.forEach((order) => {
    if (order.qty <= 0) return;
    const unitPrice = priceMap[order.ingredient] || 0;
    const cost = order.qty * unitPrice;
    if (cost <= 0) return;
    if (spent + cost > cashAvailable) return;
    const success = FK.buyIngredient(order.ingredient, order.qty, priceMap);
    if (success) {
      spent += cost;
      executed.push({ ingredient: order.ingredient, qty: order.qty, cost });
    }
  });
  return { spent, executed };
}

function ensureCashReserve(S, economy, difficulty) {
  const reserveRatio = economy.difficulty?.[difficulty]?.cashReserve ?? 0.15;
  return (S.cash || 0) * reserveRatio;
}

}

function computeGoals(plannedQty) {
  const targetSold = Math.round(plannedQty * 0.85);
  return {
    targetSold,
    targetQ: 0.9,
    earnedStars: 0
  };
}

function onDayStart() {
  if (!smartEnabled()) {
    FK.setAutoManagerPlan(null, true);
    return;
  }
  const { economy, policies } = ensureConfigs();
  const modes = FK.getModes();
  const focus = modes.focus || (FK.getPolicy().focus) || 'balanced';
  const focusBias = getFocusBias(policies, focus);
  const { S, key, product } = getActiveProductState();
  if (!product) return;

  const difficulty = modes.difficulty || 'easy';
  const demand = computeExpectedDemand(S, economy);
  const plannedQty = computePlannedQuantity(S, product, economy, policies, focusBias, demand, difficulty);
  const price = adjustedPrice(product, plannedQty, economy, policies, focusBias, difficulty, FK.getAutoManagerState().lastDay);
  const cashiers = determineCashiers(S, economy, demand);
  const restockPlan = computeRestockPlan(S, key, plannedQty, economy, policies);
  const reserve = ensureCashReserve(S, economy, difficulty);
  const available = Math.max(0, (S.cash || 0) - reserve);
  const restockResult = applyRestockOrders(restockPlan.orders, restockPlan.priceMap || {}, available);

  product.plannedQty = plannedQty;
  product.price = price;
  S.staff = S.staff || {};
  S.staff.cashier = cashiers;
  FK.updateGoals(computeGoals(plannedQty));
  FK.setAutoManagerPlan({
    day: S.world?.day || S.day || 1,
    product: key,
    plannedQty,
    price,
    cashiers,
    expectedDemand: Math.round(demand),
    restock: {
      requested: restockPlan.orders,
      executed: restockResult.executed,
      spent: restockResult.spent,
      reserve
    },
    focus,
    difficulty,
    createdAt: Date.now()
  });
  FK.updateAutoManagerMemory({ topUpProduced: 0 });
  FK.saveState();
}

function onMinute() {
  if (!smartEnabled()) return;
  const { economy } = ensureConfigs();
  const { S, key, product } = getActiveProductState();
  if (!product) return;
  const managerState = FK.getAutoManagerState();
  const plan = managerState?.plan;
  const memory = managerState?.memory || {};
  const plannedQty = plan?.plannedQty || product.plannedQty || 0;
  if (!plannedQty) return;
  const totalStock = FK.totalStock ? FK.totalStock(key) : (product.stock || []).reduce((acc, lot) => acc + (lot.qty || 0), 0);
  const threshold = Math.floor(plannedQty * (S.safety?.lowStockThreshold ?? economy.production?.lowStockThreshold ?? 0.25));
  const currentMinute = S.timeMin || (S.world?.minute) || 8 * 60;
  const morningWindow = S.safety?.morningWindowMinutes ?? economy.production?.morningWindowMinutes ?? 120;
  const dayStart = S.world?.open || 8 * 60;
  if (currentMinute - dayStart < morningWindow) return;
  if (totalStock > threshold) return;
  const topUpCap = S.safety?.topUpCap || economy.production?.topUpCap || 48;
  const alreadyProduced = memory.topUpProduced || 0;
  if (alreadyProduced >= topUpCap) return;
  const topUpBatch = Math.min(S.safety?.topUpBatch || economy.production?.topUpBatch || 16, topUpCap - alreadyProduced);
  const success = bakeBatch(key, topUpBatch, baseBatchQuality(S));
  if (success) {
    FK.updateAutoManagerMemory({ topUpProduced: alreadyProduced + topUpBatch }, true);
  }
}

function bakeBatch(productKey, qty, qualityBase) {
  const S = FK.getState();
  const product = S.products?.[productKey];
  if (!product) return false;
  const recipeId = product.recipeId || 'croissant_plain';
  if (!FK.canProduce(recipeId, qty)) return false;
  FK.consumeFor(recipeId, qty);
  const quality = clamp(qualityBase + (Math.random() * 0.06 - 0.03), 0.72, 0.98);
  FK.addInventory(productKey, qty, quality);
  FK.saveState();
  return true;
}

function onMiddayCheck() {
  if (!smartEnabled()) return;
  const plan = FK.getAutoManagerState()?.plan;
  if (!plan) return;
  const S = FK.getState();
  const sold = S.autosim?.aggregates?.sold || 0;
  const remaining = FK.totalStock ? FK.totalStock(plan.product) : 0;
  const halfwayTarget = Math.round((plan.plannedQty || 0) * 0.45);
  if (sold < halfwayTarget) {
    FK.updatePolicyMemory({ leftoverYesterday: true });
  }
  if (remaining < (plan.plannedQty * 0.3)) {
    FK.updatePolicyMemory({ soldOutYesterday: true });
  }


function onLowCash() {
  if (!smartEnabled()) return;
  const S = FK.getState();
  const modes = FK.getModes();
  const difficulty = modes.difficulty || 'easy';
  const { economy } = ensureConfigs();
  const reserve = ensureCashReserve(S, economy, difficulty);
  if ((S.cash || 0) >= reserve) return;
  // tighten belt: reduce planned qty for next cycles
  const plan = FK.getAutoManagerState()?.plan;
  if (plan) {
    plan.plannedQty = Math.max(Math.round(plan.plannedQty * 0.85), 20);
    FK.setAutoManagerPlan(plan, true);
  }
  FK.updatePolicyMemory({ lowCash: true });
}

function onEventToday() {
  if (!smartEnabled()) return;
  if (!smartEnabled()) {
    FK.setAutoManagerPlan(null, true);
    return;
  }
  const { economy, policies } = ensureConfigs();
  const S = FK.getState();
  if (!S.policy?.autoEvents) return;
  const events = FK.todayEvents ? FK.todayEvents() : [];
  const cashReserve = ensureCashReserve(S, economy, FK.getModes().difficulty || 'easy');
  events.filter(ev => ev.type === 'festival').forEach((ev) => {
    const cost = Number(ev.cost || 0);
    if ((S.cash || 0) - cost > cashReserve && (policyAllowsFestival(ev, policies))) {
      FK.joinTodayFestival(ev.id);
    }
  });
}

function policyAllowsFestival(event, policies) {
  const minPlan = policies.events?.festivalMinPlan || 80;
  const plan = FK.getAutoManagerState()?.plan;
  return (plan?.plannedQty || 0) >= minPlan;
}

function computeStars(summary, plan) {
  if (!summary || !plan) return 0;
  const soldRatio = plan.plannedQty > 0 ? summary.sold / plan.plannedQty : 0;
  let stars = 0;
  if (soldRatio >= 0.6) stars = 1;
  if (soldRatio >= 0.8 && summary.avgQuality >= 0.9) stars = 2;
  if (soldRatio >= 0.8 && summary.profit > 0 && !summary.voucherApplied) stars = 3;
  return Math.min(3, stars);
}

function applySafetyVoucher(S, summary) {
  if ((S.cash || 0) >= 0) return null;
  const voucherRange = S.safety?.voucherRange || [180, 300];
  const voucherValue = Math.round((voucherRange[0] + voucherRange[1]) / 2);
  S.cash = (S.cash || 0) + voucherValue;
  FK.markSafetyVoucher(S.world?.day || S.day || 1, voucherValue);
  if (summary) summary.voucherApplied = voucherValue;
  return voucherValue;
}

function onEndOfDay(summary) {
  if (!smartEnabled()) {
    FK.setAutoManagerPlan(null, true);
    return;
  }
  const plan = FK.getAutoManagerState()?.plan;
  if (!smartEnabled()) {
    FK.setAutoManagerPlan(null, true);
    return;
  }
  const { economy, policies } = ensureConfigs();
  const S = FK.getState();
  if (!summary || !plan) {
    FK.setAutoManagerPlan(null, true);
    return;
  }
  const leftoverQty = summary.leftover ?? Math.max(0, (plan.plannedQty || 0) - (summary.sold || 0));
  const leftoverRatio = summary.leftoverRatio ?? (plan.plannedQty > 0 ? leftoverQty / plan.plannedQty : 0);
  summary.leftover = leftoverQty;
  summary.leftoverRatio = leftoverRatio;
  applySafetyVoucher(S, summary);
  const stars = computeStars(summary, plan);
  summary.stars = stars;
  if (summary.sold >= 100) { FK.grantBadge && FK.grantBadge('sold_100', { label: 'Prima zi cu 100 buc vândute' }); }
  if (leftoverQty === 0) { FK.grantBadge && FK.grantBadge('no_leftover_day', { label: 'Prima zi fără stoc rămas' }); }
  if (summary.avgQuality >= 0.95) { FK.grantBadge && FK.grantBadge('quality_95', { label: 'Calitate peste 0.95' }); }

  FK.recordStars(stars);
  const stateNow = FK.getState();
  const dayNumber = stateNow?.world?.day || stateNow?.day || 0;
  FK.recordKidsTelemetry({
    day: dayNumber,
    sold: summary.sold,
    plan: plan.plannedQty,
    profit: summary.profit,
    avgQ: summary.avgQuality,
    stars,
    leftover: summary.leftover
  });
  FK.recordAutoManagerDay({
    day: S.world?.day || S.day || 1,
    plannedQty: plan.plannedQty,
    sold: summary.sold,
    revenue: summary.revenue,
    profit: summary.profit,
    avgQuality: summary.avgQuality,
    leftover: summary.leftover,
    stars
  }, true);
  const memoryUpdate = {
    soldOutYesterday: summary.sold >= plan.plannedQty * 0.98,
    leftoverYesterday: summary.leftoverRatio >= (policies.pricing?.leftoverThreshold || 0.15)
  };
  FK.updatePolicyMemory(memoryUpdate);
  if (stars >= (policies.rewards?.goodStreakDays || 3)) {
    const buffTraffic = policies.rewards?.buffTraffic || 0.12;
    const buffQuality = policies.rewards?.buffQuality || 0.02;
    FK.addBuff({ id: 'streak_bonus', label: 'Zi bună!', minutes: 120, trafficMult: 1 + buffTraffic, qBonus: buffQuality });
  }
  FK.setAutoManagerPlan(null, true);
  FK.saveState();
}

export const AutoManager = {
  onDayStart,
  onMinute,
  onMiddayCheck,
  onEndOfDay,
  onLowCash,
  onEventToday
};

export default AutoManager;
