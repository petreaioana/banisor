import { FK } from '../shared/state.js';

const DAY_MINUTES = FK.DAY_MINUTES || (8 * 60);
const EARLY_WINDOW_MINUTES = 120;
const DEFAULT_LOW_STOCK = 35;
const PRICE_STEP_FRACTION = 0.05;

const AutoManager = (() => {
  let economy = null;
  let policies = null;
  let dayPlan = null;

  function ensureConfigs(state) {
    if (!economy || !policies) {
      const cfg = FK.getConfigs();
      if (cfg) {
        economy = cfg.economy || economy;
        policies = cfg.policies || policies;
      }
    }
    if ((!economy || !policies) && typeof window !== 'undefined') {
      FK.loadConfigs().then((cfg) => {
        if (cfg) {
          economy = cfg.economy;
          policies = cfg.policies;
        }
      }).catch(() => {});
    }
    if (!economy) {
      economy = {
        difficulties: {
          easy: {
            baseTraffic: 95,
            priceFlex: { min: -0.1, max: 0.05, step: 0.05 },
            safetyFactor: 1.2,
            conversionTarget: 0.82,
            seasonMultiplier: { primavara: 1, vara: 1.08, toamna: 0.95, iarna: 0.9 },
            weatherMultiplier: { sunny: 1, cloudy: 0.95, rain: 0.9, snow: 0.85, heat: 0.92 },
            lowStockThreshold: DEFAULT_LOW_STOCK,
            restock: { minLevel: 0.6, targetLevel: 2.0 },
            cashReserve: 0.15,
            roiDays: 6
          }
        },
        products: state?.products || {}
      };
    }
    if (!policies) {
      policies = {
        defaults: { cashReserve: 0.15, voucherAmount: 250, voucherCooldownDays: 7, minPlan: 40, maxPlan: 160 },
        pricing: { soldOutBoost: 0.05, leftoverDrop: -0.05, min: -0.1, max: 0.05 },
        restock: { minLevelMultiplier: 0.6, targetMultiplier: 2.0, emergencyFactor: 0.8 },
        staffing: { rapidThreshold: 'high', normal: 1, rapid: 2, middayMinute: 240 },
        goals: { minSoldRatio: 0.6, goodSoldRatio: 0.8, qualityStar: 0.9, qualityExcellent: 0.95 },
        events: { minPlan: 80, minCashReserve: 0.2, boostCooldownMinutes: 720 },
        upgrades: { maxRoiDays: 6, minCashReserve: 0.2 }
      };
    }
  }

  function difficultyProfile(state) {
    ensureConfigs(state);
    const key = state?.modes?.difficulty || 'easy';
    const diff = economy?.difficulties?.[key] || economy?.difficulties?.easy;
    return {
      baseTraffic: diff?.baseTraffic ?? 90,
      priceFlex: diff?.priceFlex || { min: -0.1, max: 0.05, step: PRICE_STEP_FRACTION },
      safetyFactor: diff?.safetyFactor ?? 1.2,
      conversionTarget: diff?.conversionTarget ?? 0.8,
      seasonMultiplier: diff?.seasonMultiplier || { primavara: 1, vara: 1.05, toamna: 0.95, iarna: 0.88 },
      weatherMultiplier: diff?.weatherMultiplier || { sunny: 1, cloudy: 0.95, rain: 0.9, snow: 0.85, heat: 0.92 },
      lowStockThreshold: diff?.lowStockThreshold ?? DEFAULT_LOW_STOCK,
      restock: diff?.restock || { minLevel: 0.6, targetLevel: 2.0 },
      cashReserve: diff?.cashReserve ?? 0.15,
      roiDays: diff?.roiDays ?? 6
    };
  }

  function selectProduct(state) {
    if (state?.modes?.kidMode && state?.products?.croissant) return 'croissant';
    if (state?.activeProduct && state.products?.[state.activeProduct]) return state.activeProduct;
    const firstKey = Object.keys(state?.products || {}).find((k) => !state.products[k].locked);
    return firstKey || 'croissant';
  }

  function seasonKey(state) {
    return state?.world?.season || 'primavara';
  }

  function weatherKey(state) {
    return state?.economy2?.weather || 'sunny';
  }

  function computeExpectedDemand(state, diff) {
    const reputation = state?.reputation ?? 1;
    const seasonMult = diff.seasonMultiplier?.[seasonKey(state)] ?? 1;
    const weatherMult = diff.weatherMultiplier?.[weatherKey(state)] ?? 1;
    const boostMult = state?.boost?.trafficMult ?? 1;
    const eventMult = (state?.events?.activeBoost || 1);
    return Math.max(40, Math.round(diff.baseTraffic * reputation * seasonMult * weatherMult * boostMult * eventMult));
  }

  function computePlannedQty(expectedTraffic, diff, state, focus, product) {
    const base = Math.max(state?.safety?.minPlan || policies?.defaults?.minPlan || 40, expectedTraffic * diff.conversionTarget);
    let qty = Math.ceil(base * diff.safetyFactor);
    if (focus === 'happy') qty = Math.ceil(base * (diff.safetyFactor + 0.1));
    if (focus === 'profit') qty = Math.ceil(base * Math.max(1, diff.safetyFactor - 0.1));
    const maxPlan = policies?.defaults?.maxPlan || 200;
    const minPlan = state?.safety?.minPlan || policies?.defaults?.minPlan || 40;
    qty = Math.max(minPlan, Math.min(maxPlan, qty));
    if (product?.shelfLifeDays === 1) qty = Math.round(qty * 0.9);
    return Math.max(minPlan, qty);
  }

  function priceBounds(product, diff) {
    const P0 = product?.P0 || product?.price || 10;
    const flex = diff?.priceFlex || { min: -0.1, max: 0.05 };
    return {
      min: P0 * (1 + (flex.min ?? -0.1)),
      max: P0 * (1 + (flex.max ?? 0.05)),
      base: P0,
      step: flex.step ?? PRICE_STEP_FRACTION
    };
  }

  function clampPrice(price, bounds) {
    return Math.max(bounds.min, Math.min(bounds.max, price));
  }

  function determineInitialPrice(state, productKey, product, diff) {
    const bounds = priceBounds(product, diff);
    let current = product?.price ?? bounds.base;
    current = clampPrice(current, bounds);
    return { price: current, bounds };
  }

  function restockOrders(state, productKey, product, plannedQty, diff, focus) {
    const recipeId = product?.recipeId || `${productKey}_plain`;
    const recipe = state?.recipes?.[recipeId]?.ingredients;
    if (!recipe) return [];
    const multiplier = diff?.restock?.targetLevel ?? 2.0;
    const minLevelMultiplier = diff?.restock?.minLevel ?? 0.6;
    const orders = [];
    const cashReserveRatio = state?.policy?.cashReserve ?? diff.cashReserve ?? policies?.defaults?.cashReserve ?? 0.15;
    const reserveAmount = cashReserveRatio * Math.max(200, state?.cash || 0);
    let availableCash = Math.max(0, (state?.cash || 0) - reserveAmount);
    const ingredientPrices = economy?.ingredients || {};

    Object.entries(recipe).forEach(([id, perUnit]) => {
      const needPerUnit = Math.max(1, Number(perUnit) || 1);
      const currentQty = state?.ingredients?.[id]?.qty ?? 0;
      const target = Math.ceil(plannedQty * needPerUnit * multiplier);
      const minLevel = Math.ceil(plannedQty * needPerUnit * minLevelMultiplier);
      if (currentQty < minLevel) {
        const missing = Math.max(0, target - currentQty);
        if (missing <= 0) return;
        const price = ingredientPrices[id] ?? 5;
        const affordable = price > 0 ? Math.min(missing, Math.floor(availableCash / price)) : missing;
        if (affordable > 0) {
          orders.push({ id, qty: affordable, price });
          availableCash -= affordable * price;
        }
      }
    });

    if (focus === 'happy') {
      orders.forEach((o) => { o.qty = Math.ceil(o.qty * 1.1); });
    }
    return orders;
  }

  function applyGoals(plannedQty, focus) {
    const goalSoldRatio = policies?.goals?.goodSoldRatio ?? 0.8;
    const targetSold = Math.max(30, Math.round(plannedQty * goalSoldRatio));
    FK.updateGoals({ targetSold, targetQ: focus === 'profit' ? 0.88 : 0.9, earnedStars: 0 });
  }

  function updatePolicyFocus(focus, diff) {
    FK.setPolicy({ focus, cashReserve: diff.cashReserve ?? policies?.defaults?.cashReserve ?? 0.15 });
  }

  function onDayStart(state) {
    ensureConfigs(state);
    const diff = difficultyProfile(state);
    const focus = state?.policy?.focus || 'balanced';
    const productKey = selectProduct(state);
    const product = state?.products?.[productKey];
    if (!product) return null;

    const expected = computeExpectedDemand(state, diff);
    const plannedQty = computePlannedQty(expected, diff, state, focus, product);
    const { price, bounds } = determineInitialPrice(state, productKey, product, diff);
    const restock = restockOrders(state, productKey, product, plannedQty, diff, focus);
    const lowThreshold = Math.max(state?.safety?.lowStockThreshold || DEFAULT_LOW_STOCK, Math.round(plannedQty * 0.35));
    applyGoals(plannedQty, focus);
    updatePolicyFocus(focus, diff);

    dayPlan = {
      productKey,
      diff,
      focus,
      expectedTraffic: expected,
      plannedQty,
      priceBounds: bounds,
      lowStockThreshold: lowThreshold,
      produced: 0,
      restockSpent: 0,
      nextPrice: price,
      vouchersGiven: 0,
      middayAdjusted: false
    };

    return {
      productKey,
      plannedQty,
      price,
      cashiers: selectCashiers(expected, diff, focus),
      restock,
      happyHour: determineHappyHour(state, product)
    };
  }

  function determineHappyHour(state, product) {
    if (state?.modes?.kidMode) {
      return { enabled: true, start: product?.happyHour?.start || '16:00', end: product?.happyHour?.end || '17:00', discount: product?.happyHour?.discount || 0.1 };
    }
    return { enabled: product?.happyHour?.enabled ?? false, start: product?.happyHour?.start, end: product?.happyHour?.end, discount: product?.happyHour?.discount };
  }

  function selectCashiers(expected, diff, focus) {
    const thresholds = {
      low: 60,
      medium: 90,
      high: 120
    };
    let level = thresholds.medium;
    if (focus === 'happy') level -= 10;
    if (focus === 'profit') level += 10;
    if (expected >= (thresholds.high)) return policies?.staffing?.rapid ?? 2;
    if (expected >= level) return policies?.staffing?.rapid ?? 2;
    return policies?.staffing?.normal ?? 1;
  }

  function onMinute(state, minuteOfDay, summary) {
    if (!dayPlan) return null;
    const instructions = { produce: 0, restock: [], adjustPrice: null, adjustCashiers: null };
    const stock = FK.totalStock(dayPlan.productKey);
    const remainingPlan = Math.max(0, dayPlan.plannedQty - summary.produced);

    if (minuteOfDay < EARLY_WINDOW_MINUTES && remainingPlan > 0) {
      const remainingWindow = Math.max(1, EARLY_WINDOW_MINUTES - minuteOfDay);
      instructions.produce = Math.max(instructions.produce, Math.min(remainingPlan, Math.ceil(remainingPlan / remainingWindow)));
    } else if (stock < dayPlan.lowStockThreshold && remainingPlan > 0) {
      instructions.produce = Math.min(remainingPlan, Math.max(4, Math.round(dayPlan.lowStockThreshold / 2)));
    }

    if (minuteOfDay % 30 === 0) {
      const stateNow = FK.getState();
      const product = stateNow.products?.[dayPlan.productKey];
      const diff = dayPlan.diff;
      const focus = dayPlan.focus;
      const restockNeeded = restockOrders(stateNow, dayPlan.productKey, product, dayPlan.plannedQty, diff, focus);
      if (restockNeeded.length) instructions.restock = restockNeeded;
    }

    return instructions;
  }

  function onMiddayCheck(state, summary) {
    if (!dayPlan || dayPlan.middayAdjusted) return null;
    dayPlan.middayAdjusted = true;
    const soldRatio = summary.plan > 0 ? summary.sold / summary.plan : 0;
    let adjustPrice = null;
    if (soldRatio >= 0.65 && summary.minute < DAY_MINUTES / 2) {
      adjustPrice = dayPlan.nextPrice * (1 + (dayPlan.priceBounds.step || PRICE_STEP_FRACTION));
    } else if (soldRatio < 0.4) {
      adjustPrice = dayPlan.nextPrice * (1 + Math.min(-0.03, -(dayPlan.priceBounds.step || PRICE_STEP_FRACTION)));
    }
    if (adjustPrice !== null) {
      adjustPrice = clampPrice(adjustPrice, dayPlan.priceBounds);
      dayPlan.nextPrice = adjustPrice;
      return { adjustPrice };
    }
    return null;
  }

  function onEventToday(state) {
    const reserveRatio = policies?.events?.minCashReserve ?? 0.2;
    const minPlan = policies?.events?.minPlan ?? 80;
    if (!dayPlan) return { joinFestival: false, triggerBoost: false };
    const hasCash = (state.cash || 0) > ((state.cash || 0) * reserveRatio) + 150;
    const canJoin = dayPlan.plannedQty >= minPlan && hasCash;
    return { joinFestival: canJoin, triggerBoost: dayPlan.focus === 'happy' && canJoin };
  }

  function onLowCash(state, summary) {
    if (!dayPlan) return null;
    const reserveRatio = state?.policy?.cashReserve ?? dayPlan.diff.cashReserve;
    const reserve = reserveRatio * Math.max(200, (summary.avgPrice || dayPlan.nextPrice || 10) * 20);
    if ((state.cash || 0) >= reserve) return null;
    dayPlan.plannedQty = Math.max(state?.safety?.minPlan || 30, Math.round(dayPlan.plannedQty * 0.85));
    dayPlan.lowStockThreshold = Math.max(20, Math.round(dayPlan.plannedQty * 0.3));
    applyGoals(dayPlan.plannedQty, dayPlan.focus);
    return { reducePlanTo: dayPlan.plannedQty };
  }

  function handleVoucher(state, summary) {
    const nowDay = `${state?.world?.year || 1}-${state?.world?.season || 'primavara'}-${state?.world?.day || 1}`;
    const cooldown = policies?.defaults?.voucherCooldownDays ?? 7;
    const lastVoucher = state?.rewards?.lastVoucherDay;
    const allow = !lastVoucher || daysBetween(lastVoucher, nowDay) >= cooldown;
    if (!allow) return null;
    const amount = policies?.defaults?.voucherAmount ?? 250;
    const nextRewards = Object.assign({}, state.rewards || {});
    nextRewards.lastVoucherDay = nowDay;
    FK.setState({ rewards: nextRewards, cash: (state.cash || 0) + amount });
    return amount;
  }

  function daysBetween(ref, current) {
    if (!ref || !current) return Infinity;
    try {
      const partsA = ref.split('-');
      const partsB = current.split('-');
      if (partsA.length !== 3 || partsB.length !== 3) return Infinity;
      const idxSeason = ['primavara', 'vara', 'toamna', 'iarna'];
      const a = Number(partsA[0]) * 28 * 4 + idxSeason.indexOf(partsA[1]) * 28 + Number(partsA[2]);
      const b = Number(partsB[0]) * 28 * 4 + idxSeason.indexOf(partsB[1]) * 28 + Number(partsB[2]);
      return Math.abs(b - a);
    } catch (_) {
      return Infinity;
    }
  }

  function onEndOfDay(summary, state) {
    if (!dayPlan) return null;
    const goals = policies?.goals || {};
    const soldRatio = summary.plan > 0 ? summary.sold / summary.plan : 0;
    const starsBench = { one: goals.minSoldRatio ?? 0.6, two: goals.goodSoldRatio ?? 0.8, quality: goals.qualityStar ?? 0.9 };
    let stars = 0;
    if (soldRatio >= starsBench.one) stars += 1;
    if (soldRatio >= starsBench.two && summary.quality >= starsBench.quality) stars += 1;
    if (summary.profit > 0 && !summary.usedVoucher) stars += 1;

    FK.updateGoals({ targetSold: summary.plan, targetQ: starsBench.quality, earnedStars: stars });
    FK.recordKidSummary({ sold: summary.sold, quality: Number(summary.quality || 0).toFixed(2), stars, profit: summary.profit, messages: summary.messages });

    const badges = [];
    if (summary.sold >= 100) { if (FK.grantBadge('sold100', { value: summary.sold })) badges.push('sold100'); }
    if (summary.quality >= (goals.qualityExcellent || 0.95)) { if (FK.grantBadge('qualityMaster', { value: summary.quality })) badges.push('qualityMaster'); }
    if (stars === 3) { if (FK.grantBadge('threeStarsDay', {})) badges.push('threeStarsDay'); }

    let nextPrice = dayPlan.nextPrice;
    const priceBoundsRef = dayPlan.priceBounds;
    if (soldRatio >= 1) {
      nextPrice = clampPrice(nextPrice * (1 + (policies?.pricing?.soldOutBoost ?? PRICE_STEP_FRACTION)), priceBoundsRef);
    } else if (soldRatio < (policies?.goals?.goodSoldRatio ?? 0.8)) {
      nextPrice = clampPrice(nextPrice * (1 + (policies?.pricing?.leftoverDrop ?? -PRICE_STEP_FRACTION)), priceBoundsRef);
    }

    let voucherAmount = null;
    if (summary.cashEnd < 0) {
      voucherAmount = handleVoucher(state, summary);
      if (voucherAmount) {
        summary.usedVoucher = true;
        stars = Math.max(0, stars - 1);
        FK.updateGoals({ earnedStars: stars });
      }
    }

    const result = {
      nextPrice,
      stars,
      badges,
      voucherAmount,
      focus: dayPlan.focus,
      plan: dayPlan.plannedQty,
      lowStockThreshold: dayPlan.lowStockThreshold
    };

    dayPlan = null;
    return result;
  }

  return {
    init: async () => {
      ensureConfigs(FK.getState());
      const cfg = await FK.loadConfigs().catch(() => null);
      if (cfg) {
        economy = cfg.economy;
        policies = cfg.policies;
      }
    },
    onDayStart,
    onMinute,
    onMiddayCheck,
    onEventToday,
    onLowCash,
    onEndOfDay,
    difficultyProfile: () => dayPlan?.diff || difficultyProfile(FK.getState()),
    getCurrentPlan: () => dayPlan
  };
})();

export default AutoManager;
