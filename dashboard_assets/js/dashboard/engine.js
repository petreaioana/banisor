/* ========== Smart Manager Edition | dashboard_assets\js\dashboard\engine.js ========== */

import { FK } from '../shared/state.js';
import autoManager from './autoManager.js';
import initSmartUI from './uiSmart.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DAY_MINUTES = FK.DAY_MINUTES || (8 * 60);
const EARLY_WINDOW = 120;
const LOOP_MS = 220;

let runtime = {
  timer: null,
  smartUI: null,
  configs: null,
  diff: null,
  kidMode: true,
  focus: 'balanced'
};

let S = FK.getState();
let summary = null;
let dayPlan = null;
let middayTriggered = false;

// DOM references
const elDay = $('#top-day');
const elTime = $('#top-time');
const elCash = $('#top-cash');
const elStock = $('#top-stock');
const elRep = $('#top-rep');
const elBoost = $('#top-boost');

const btnPause = $('#btn-pause');
const speedBtns = $$('.speed-btn');
const ticker = $('#ticker');
const banCorner = $('#banisor-corner');

const barQ = $('#bar-q');
const barW = $('#bar-w');
const barC = $('#bar-c');
const barN = $('#bar-n');
const mSold = $('#m-sold');
const mRev = $('#m-rev');
const mProf = $('#m-prof');

const inpPrice = $('#inp-price');
const rngPrice = $('#rng-price');
const inpLot = $('#inp-lot');
const selCashiers = $('#sel-cashiers');
const chkFlyer = $('#chk-flyer');
const chkSocial = $('#chk-social');
const inpHHs = $('#inp-hh-start');
const inpHHe = $('#inp-hh-end');
const inpHHd = $('#inp-hh-disc');
const upOven = $('#up-oven');
const upPos = $('#up-pos');
const upAuto = $('#up-auto');

const CONFETTI_COLORS = ['#f9d423', '#ff4e50', '#1aafd0', '#82d173', '#f78da7'];

function celebrate(message = 'Bravo!') {
  const existing = document.querySelectorAll('.confetti-overlay');
  if (existing.length > 2) existing[0]?.remove();
  const layer = document.createElement('div');
  layer.className = 'confetti-overlay';
  const count = 120;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.left = Math.round(Math.random() * 100) + '%';
    piece.style.setProperty('--dx', `${(Math.random() * 2 - 1) * 220}px`);
    piece.style.setProperty('--dur', `${0.9 + Math.random() * 0.6}s`);
    layer.appendChild(piece);
  }
  if (message) {
    const msg = document.createElement('div');
    msg.className = 'confetti-message';
    msg.textContent = message;
    layer.appendChild(msg);
  }
  document.body.appendChild(layer);
  requestAnimationFrame(() => layer.classList.add('show'));
  setTimeout(() => layer.classList.add('hide'), 900);
  setTimeout(() => { try { layer.remove(); } catch (_) {} }, 1600);
}

function updateTicker(message) {
  if (!ticker) return;
  ticker.textContent = message;
}

async function bootstrap() {
  S = FK.getState();
  runtime.kidMode = !!S?.modes?.kidMode;
  runtime.focus = S?.policy?.focus || 'balanced';

  try {
    await FK.loadConfigs();
  } catch (_) {}
  runtime.configs = FK.getConfigs();
  await autoManager.init();

  runtime.smartUI = initSmartUI({
    onToggle: handleSmartToggle,
    onFocusChange: handleFocusChange,
    onBoostClick: triggerHappyBoost
  });
  runtime.smartUI.setSmart(S?.modes?.smartManager !== false);
  runtime.smartUI.updatePlan({ focus: runtime.focus });
  document.body.classList.toggle('smart-manager-on', S?.modes?.smartManager !== false);

  mountProductSelector();
  cacheMascot();
  hydrateAdvancedControls();
  handleOfflineCatchUp();
  bindUI();
  startNewDay(true);
  startLoop();
}

document.addEventListener('DOMContentLoaded', bootstrap);

function cacheMascot() {
  if (!banCorner) return;
  try {
    banCorner.innerHTML = '';
    const fragment = document.createElement('div');
    fragment.className = 'ban-body';
    ['ban-ring', 'ban-highlight', 'ban-eye ban-eye-left', 'ban-eye ban-eye-right', 'ban-brow ban-brow-left', 'ban-brow ban-brow-right', 'ban-mouth', 'ban-cheek ban-cheek-left', 'ban-cheek ban-cheek-right', 'ban-sparkle ban-sparkle-left', 'ban-sparkle ban-sparkle-right', 'ban-sparkle ban-sparkle-top'].forEach((cls) => {
      const span = document.createElement('span');
      span.className = cls;
      fragment.appendChild(span);
    });
    banCorner.appendChild(fragment);
    const shadow = document.createElement('div');
    shadow.className = 'ban-shadow';
    banCorner.appendChild(shadow);
  } catch (_) {}
}

function bindUI() {
  btnPause?.addEventListener('click', () => {
    const running = FK.getState().autosim?.running;
    setPaused(running);
    if (!running) applyControlsToState();
  });
  speedBtns.forEach((btn) => btn.addEventListener('click', () => setSpeed(Number(btn.dataset.speed || 1))));
  document.getElementById('btn-import-manual')?.addEventListener('click', () => importFromManual(true));
  rngPrice?.addEventListener('input', () => { if (inpPrice) inpPrice.value = rngPrice.value; });
  inpPrice?.addEventListener('input', () => { if (rngPrice) rngPrice.value = inpPrice.value; });
}

function handleSmartToggle(enabled) {
  FK.setState({ modes: { ...(FK.getState().modes || {}), smartManager: enabled } });
  document.body.classList.toggle('smart-manager-on', enabled);
  updateTicker(enabled ? 'Smart Manager activ — relaxează-te!' : 'Smart Manager dezactivat. Controlezi tu!');
}

function handleFocusChange(focus) {
  runtime.focus = focus;
  FK.setPolicy({ focus });
  updateTicker(`Focus: ${focus === 'happy' ? 'Clienți fericiți' : focus === 'profit' ? 'Profit' : 'Echilibru'}`);
  if (dayPlan) dayPlan.focus = focus;
}

function triggerHappyBoost() {
  FK.addBuff({ id: 'happyDay', label: 'Zi bună', minutes: 480, trafficMult: 1.08, qBonus: 0.02 });
  updateTicker('Boost Zi bună activ! ✨');
  celebrate('Zi bună activată!');
}

function hydrateAdvancedControls() {
  try {
    const product = S.products?.[S.activeProduct || 'croissant'];
    if (inpPrice && product?.price) inpPrice.value = product.price;
    if (rngPrice && product?.price) rngPrice.value = product.price;
    if (inpLot && product?.plannedQty) inpLot.value = product.plannedQty;
    if (selCashiers) selCashiers.value = String(S.staff?.cashier || 1);
    if (chkFlyer) chkFlyer.checked = !!S.marketing?.flyerDaysLeft;
    if (chkSocial) chkSocial.checked = !!S.marketing?.socialToday;
    if (inpHHs) inpHHs.value = product?.happyHour?.start || '16:00';
    if (inpHHe) inpHHe.value = product?.happyHour?.end || '17:00';
    if (inpHHd) inpHHd.value = Math.round((product?.happyHour?.discount || 0.1) * 100);
    upOven && (upOven.checked = !!S.upgrades?.ovenPlus);
    upPos && (upPos.checked = !!S.upgrades?.posRapid);
    upAuto && (upAuto.checked = !!S.upgrades?.timerAuto);
  } catch (_) {}
}

function applyControlsToState() {
  const key = S.activeProduct || 'croissant';
  const products = { ...S.products };
  const product = { ...products[key] };
  if (inpPrice) product.price = clamp(Number(inpPrice.value) || product.price || 10, 1, 200);
  if (inpLot) product.plannedQty = Math.max(10, Math.round(Number(inpLot.value) || product.plannedQty || 80));
  product.happyHour = product.happyHour || { start: '16:00', end: '17:00', discount: 0.1 };
  if (inpHHs) product.happyHour.start = inpHHs.value || product.happyHour.start;
  if (inpHHe) product.happyHour.end = inpHHe.value || product.happyHour.end;
  if (inpHHd) product.happyHour.discount = clamp((Number(inpHHd.value) || 10) / 100, 0.05, 0.25);
  products[key] = product;
  const staff = Object.assign({}, S.staff || {}, { cashier: selCashiers ? Math.max(1, Math.min(3, Number(selCashiers.value) || S.staff?.cashier || 1)) : (S.staff?.cashier || 1) });
  FK.setState({ products, staff });
  S = FK.getState();
}

function handleOfflineCatchUp() {
  const beforeCash = S.cash || 0;
  FK.fastForwardFromLastSeen();
  FK.markOfflineSeen(Date.now());
  S = FK.getState();
  const report = S.today?.report;
  const list = [];
  if (report) {
    list.push(`Am vândut ${report.sold || 0} prăjituri.`);
    list.push(`Venituri: ${Math.round(report.revenue || 0)} lei.`);
    list.push(`Calitate medie: ${(report.Q || 0).toFixed(2)}.`);
  } else if ((S.cash || 0) > beforeCash) {
    list.push(`Am câștigat ${Math.round((S.cash || 0) - beforeCash)} lei în timp ce ai lipsit.`);
  }
  if (list.length) runtime.smartUI.showOfflineSummary(list);
}

function startLoop() {
  if (runtime.timer) clearInterval(runtime.timer);
  runtime.timer = setInterval(stepMinute, LOOP_MS);
}

function createEmptySummary(state) {
  return {
    plan: 0,
    produced: 0,
    sold: 0,
    revenue: 0,
    cogs: 0,
    profit: 0,
    minute: 0,
    restockSpent: 0,
    qualitySum: 0,
    qualitySamples: 0,
    avgPrice: 0,
    stockStart: FK.totalStock(state.activeProduct || 'croissant'),
    stockEnd: 0,
    cashStart: state.cash || 0,
    cashEnd: state.cash || 0,
    usedVoucher: false,
    messages: []
  };
}

function startNewDay(resetMinute) {
  S = FK.getState();
  runtime.kidMode = !!S?.modes?.kidMode;
  runtime.focus = S?.policy?.focus || runtime.focus;
  if (resetMinute) {
    const open = S.world?.open || 8 * 60;
    FK.setState({ timeMin: open, world: { ...(S.world || {}), minute: open } });
    S = FK.getState();
  }
  summary = createEmptySummary(S);
  middayTriggered = false;

  const instructions = autoManager.onDayStart(S);
  applyDayStartInstructions(instructions);
  dayPlan = autoManager.getCurrentPlan();
  runtime.diff = dayPlan?.diff || autoManager.difficultyProfile(S);
  if (dayPlan) {
    summary.plan = dayPlan.plannedQty;
    summary.avgPrice = dayPlan.nextPrice;
  } else {
    const product = S.products?.[S.activeProduct || 'croissant'];
    summary.plan = product?.plannedQty || 80;
    summary.avgPrice = product?.price || 10;
  }

  runtime.smartUI.updatePlan({ plannedQty: summary.plan, price: summary.avgPrice, cashiers: S.staff?.cashier || 1, focus: runtime.focus });
  runtime.smartUI.updateGoals(S.goals || {}, { sold: 0 });

  const eventDecision = autoManager.onEventToday(S) || {};
  if (eventDecision.joinFestival) {
    try {
      (FK.todayEvents?.() || []).filter((ev) => ev.type === 'festival').forEach((ev) => FK.joinTodayFestival && FK.joinTodayFestival(ev.id));
      updateTicker('Astazi participam la festival!');
    } catch (_) {}
  }
  if (eventDecision.triggerBoost) {
    FK.addBuff({ id: 'eventBoost', label: 'Zi speciala', minutes: 240, trafficMult: 1.05, qBonus: 0.01 });
  }

  refreshTop();
}

function applyDayStartInstructions(instr) {
  if (!instr) return;
  const key = instr.productKey || S.activeProduct || 'croissant';
  const products = { ...S.products };
  const product = { ...products[key] };
  if (instr.plannedQty !== undefined) product.plannedQty = Math.max(10, Math.round(instr.plannedQty));
  if (instr.price !== undefined) product.price = clamp(instr.price, 1, 200);
  if (instr.happyHour) product.happyHour = Object.assign({}, product.happyHour || {}, instr.happyHour, { enabled: !!instr.happyHour.enabled });
  products[key] = product;
  const patch = { products };
  if (instr.cashiers !== undefined) patch.staff = Object.assign({}, S.staff || {}, { cashier: Math.max(1, Math.min(3, Math.round(instr.cashiers))) });
  FK.setState(patch);
  S = FK.getState();
  if (Array.isArray(instr.restock) && instr.restock.length) executeRestock(instr.restock);
}

function executeRestock(orders = []) {
  if (!orders.length) return;
  const priceTable = runtime.configs?.economy?.ingredients || {};
  let spent = 0;
  orders.forEach((order) => {
    const qty = Math.max(0, Math.round(order.qty || 0));
    if (!qty) return;
    const price = order.price ?? priceTable[order.id] ?? 5;
    const ok = FK.buyIngredient(order.id, qty, priceTable);
    if (ok) spent += price * qty;
  });
  if (spent > 0) {
    summary.restockSpent += spent;
    updateTicker(`Aprovizionare automată (${spent} lei)`);
  }
  S = FK.getState();
}

function stepMinute() {
  S = FK.getState();
  const open = S.world?.open || 8 * 60;
  const minuteOfDay = Math.max(0, (S.timeMin || open) - open);
  summary.minute = minuteOfDay;
  if (minuteOfDay >= DAY_MINUTES) {
    endOfDay();
    return;
  }

  const instructions = autoManager.onMinute(S, minuteOfDay, summary) || {};
  if (Array.isArray(instructions.restock) && instructions.restock.length) executeRestock(instructions.restock);
  if (instructions.adjustPrice !== undefined && dayPlan) setProductPrice(dayPlan.productKey, instructions.adjustPrice);
  if (instructions.adjustCashiers !== undefined) setCashiers(instructions.adjustCashiers);
  if (instructions.produce) produce(instructions.produce);

  const sales = simulateSales(minuteOfDay);
  runtime.smartUI.updateGoals(FK.getState().goals || {}, { sold: summary.sold });
  updateMetrics(minuteOfDay, sales);

  if (!middayTriggered && minuteOfDay >= (runtime.configs?.policies?.staffing?.middayMinute || 240)) {
    middayTriggered = true;
    const adjust = autoManager.onMiddayCheck(FK.getState(), summary);
    if (adjust?.adjustPrice !== undefined && dayPlan) {
      setProductPrice(dayPlan.productKey, adjust.adjustPrice);
      updateTicker('Am ajustat prețul pentru restul zilei.');
    }
  }

  const stateAfter = FK.getState();
  const reserveRatio = stateAfter?.policy?.cashReserve || dayPlan?.diff?.cashReserve || 0.15;
  const reserve = reserveRatio * Math.max(200, (summary.avgPrice || 10) * 20);
  if ((stateAfter.cash || 0) < reserve) autoManager.onLowCash(stateAfter, summary);

  FK.tickMinutes(1);
  S = FK.getState();
}

function produce(requestedQty) {
  if (!dayPlan) return 0;
  let qty = Math.max(0, Math.round(requestedQty));
  if (!qty) return 0;
  const productKey = dayPlan.productKey || S.activeProduct || 'croissant';
  const product = S.products?.[productKey];
  if (!product) return 0;
  const recipeId = product.recipeId || `${productKey}_plain`;
  while (qty > 0 && !FK.canProduce(recipeId, qty)) qty -= 1;
  if (!qty) return 0;
  FK.consumeFor(recipeId, qty);
  const quality = computeQuality();
  FK.addInventory(productKey, qty, quality);
  summary.produced += qty;
  summary.qualitySum += quality * qty;
  summary.qualitySamples += qty;
  if (dayPlan) dayPlan.produced = (dayPlan.produced || 0) + qty;
  S = FK.getState();
  return qty;
}

function computeQuality() {
  const base = 0.86 + (S.upgrades?.ovenPlus ? 0.02 : 0) + (S.upgrades?.timerAuto ? 0.02 : 0) + (S.boost?.qBonus || 0);
  const noise = (Math.random() * 0.06) - 0.03;
  return clamp(base + noise, 0.7, 0.99);
}

function simulateSales(minuteOfDay) {
  const productKey = dayPlan?.productKey || S.activeProduct || 'croissant';
  const product = S.products?.[productKey];
  if (!product) return { sold: 0, demand: 0, wait: 0, conversion: 0 };
  const diff = dayPlan?.diff || autoManager.difficultyProfile(S);
  const price = product.price || 10;
  const basePrice = dayPlan?.priceBounds?.base || product.P0 || 10;
  const quality = computeAverageQuality(productKey);
  const arrivals = sampleArrivals(minuteOfDay, diff);
  const mu = FK.getCashierMu ? FK.getCashierMu(S.staff?.cashier || 1) : 1.5;
  const wait = clamp(waitW(arrivals, mu), 0, 6);
  const conversion = clamp(conversionC(price, basePrice, quality, wait), 0, 0.98);
  const demand = Math.max(0, Math.round(arrivals * conversion));
  const sale = sellFromStock(productKey, demand, price, product);
  summary.sold += sale.sold;
  summary.revenue += sale.revenue;
  summary.cogs += sale.cogs;
  summary.qualitySum += sale.qWeighted;
  summary.qualitySamples += sale.sold;
  summary.profit = summary.revenue - summary.cogs - summary.restockSpent;
  return { sold: sale.sold, demand, wait, conversion };
}

function sampleArrivals(minuteOfDay, diff) {
  const expected = dayPlan?.expectedTraffic || diff.baseTraffic || 90;
  const lambda = expected / DAY_MINUTES;
  const pulse = minutePulse(minuteOfDay);
  const rate = lambda * pulse;
  let arrivals = 0;
  for (let i = 0; i < 3; i++) arrivals += Math.random() < rate ? 1 : 0;
  return arrivals;
}

function minutePulse(minute) {
  if (minute < 60) return 0.6;
  if (minute < 180) return 1.1;
  if (minute < 300) return 1.3;
  if (minute < 360) return 1.1;
  return 0.8;
}

function conversionC(P, P0, Q, W) {
  const pricing = runtime.configs?.policies?.pricing || {};
  const C0 = pricing.C0 ?? 0.5;
  const epsilon = pricing.epsilon ?? 1.6;
  const alpha = pricing.alpha ?? 0.75;
  const beta = pricing.beta ?? 0.5;
  const priceTerm = Math.exp(-epsilon * (P / P0 - 1));
  const qualityTerm = alpha + beta * Q;
  const waitPenalty = 1 - Math.min(0.6, 0.1 * Math.max(0, W));
  return clamp(C0 * priceTerm * qualityTerm * waitPenalty, 0, 0.98);
}

function waitW(arrivals, mu) {
  if (mu <= 0) return 6;
  const rho = Math.max(0, Math.min(1, arrivals / mu));
  const tau = runtime.configs?.economy?.waitTau ?? 3;
  return tau * rho;
}

function computeAverageQuality(productKey) {
  const product = FK.getState().products?.[productKey];
  if (!product?.stock?.length) return 0.88 + (S.boost?.qBonus || 0);
  let sum = 0;
  let qty = 0;
  product.stock.forEach((lot) => {
    sum += (lot.q || 0.88) * (lot.qty || 0);
    qty += lot.qty || 0;
  });
  return qty > 0 ? sum / qty : 0.88 + (S.boost?.qBonus || 0);
}

function sellFromStock(productKey, qty, price, product) {
  const state = FK.getState();
  const products = { ...state.products };
  const prod = { ...products[productKey] };
  const stock = (prod.stock || []).map((lot) => ({ ...lot }));
  let left = Math.max(0, Math.round(qty));
  let sold = 0;
  let qWeighted = 0;
  while (left > 0 && stock.length) {
    const lot = stock[0];
    const take = Math.min(lot.qty || 0, left);
    if (!take) {
      stock.shift();
      continue;
    }
    lot.qty -= take;
    sold += take;
    left -= take;
    qWeighted += take * (lot.q || 0.88);
    if (lot.qty <= 0) stock.shift();
  }
  prod.stock = stock.filter((lot) => lot.qty > 0);
  products[productKey] = prod;
  FK.setState({ products });
  S = FK.getState();
  const unitCost = (product?.cost?.ingredients || 3) + (product?.cost?.laborVar || 0.5);
  return { sold, revenue: sold * price, cogs: sold * unitCost, qWeighted };
}

function updateMetrics(minuteOfDay, sales) {
  if (!barQ) return;
  const goals = FK.getState().goals || {};
  const quality = summary.qualitySamples > 0 ? summary.qualitySum / summary.qualitySamples : computeAverageQuality(dayPlan?.productKey || S.activeProduct || 'croissant');
  const conversion = sales?.conversion || 0;
  const wait = sales?.wait || 0;
  const soldRatio = goals.targetSold ? summary.sold / goals.targetSold : 0;

  barQ.style.width = `${clamp(quality, 0, 1) * 100}%`;
  barC.style.width = `${clamp(conversion, 0, 0.98) * 100}%`;
  barW.style.width = runtime.kidMode ? (wait < 1.5 ? '33%' : wait < 3 ? '66%' : '100%') : `${clamp(wait / 6, 0, 1) * 100}%`;
  barN.style.width = `${clamp(soldRatio, 0, 1) * 100}%`;

  mSold.textContent = String(summary.sold);
  mRev.textContent = `${Math.round(summary.revenue)} lei`;
  mProf.textContent = `${Math.round(summary.profit)} lei`;

  runtime.smartUI.updatePlan({ plannedQty: summary.plan, price: summary.avgPrice, cashiers: S.staff?.cashier || 1 });
}

function endOfDay() {
  const productKey = dayPlan?.productKey || S.activeProduct || 'croissant';
  summary.cashEnd = S.cash || 0;
  summary.stockEnd = FK.totalStock(productKey);
  summary.quality = summary.qualitySamples > 0 ? summary.qualitySum / summary.qualitySamples : computeAverageQuality(productKey);
  summary.messages.push(`Stoc rămas: ${summary.stockEnd} buc.`);
  const result = autoManager.onEndOfDay(summary, S) || {};
  if (result.nextPrice !== undefined) setProductPrice(productKey, result.nextPrice);
  if (result.voucherAmount) {
    summary.usedVoucher = true;
    summary.messages.push(`Voucher de siguranță: +${result.voucherAmount} lei.`);
  }
  runtime.smartUI.updateGoals(FK.getState().goals || {}, { sold: summary.sold });
  runtime.smartUI.showEndOfDay({ sold: summary.sold, quality: summary.quality, stars: result.stars || 0, messages: summary.messages });
  celebrate(`Ai câștigat ${result.stars || 0} stele!`);
  applySoftExpiration(productKey);
  startNewDay(true);
}

function applySoftExpiration(productKey) {
  if (!runtime.kidMode) return;
  const state = FK.getState();
  const product = state.products?.[productKey];
  if (!product?.stock?.length) return;
  const updated = product.stock.map((lot) => ({ ...lot, qty: Math.max(0, Math.floor((lot.qty || 0) * 0.9)) })).filter((lot) => lot.qty > 0);
  FK.setState({ products: { ...state.products, [productKey]: { ...product, stock: updated } } });
  S = FK.getState();
}

function setProductPrice(productKey, price) {
  const products = { ...FK.getState().products };
  if (!products[productKey]) return;
  products[productKey] = { ...products[productKey], price: clamp(price, 1, 200) };
  FK.setState({ products });
  S = FK.getState();
  summary.avgPrice = products[productKey].price;
}

function setCashiers(count) {
  FK.setState({ staff: { ...(FK.getState().staff || {}), cashier: Math.max(1, Math.min(3, Math.round(count || 1))) } });
  S = FK.getState();
}

function setSpeed(mult) {
  const autosim = Object.assign({}, FK.getState().autosim || { running: true, speed: 1, tickMsBase: 200 });
  autosim.speed = mult;
  FK.setState({ autosim });
  speedBtns.forEach((btn) => btn.classList.toggle('active', Number(btn.dataset.speed) === mult));
}

function setPaused(paused) {
  const autosim = Object.assign({}, FK.getState().autosim || { running: true, speed: 1, tickMsBase: 200 });
  autosim.running = !paused;
  FK.setState({ autosim });
  if (!paused) {
    startLoop();
    updateTicker('Simulare în desfășurare.');
  } else {
    if (runtime.timer) clearInterval(runtime.timer);
    updateTicker('Simulare în pauză.');
  }
}

async function importFromManual(clearAfter = true) {
  try {
    const url = `game_assets/api.php?action=fetch_transfer${clearAfter ? '&clear=1' : ''}`;
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const payload = await resp.json();
    if (!payload?.ok) { updateTicker('Import eșuat.'); return; }
    const transfer = payload.transfer || {};
    const qty = Math.max(0, Number(transfer.qty || 0));
    const q = Math.max(0.7, Math.min(0.99, Number(transfer.avg_q || 0.86)));
    const buffs = Array.isArray(transfer.buffs) ? transfer.buffs : [];
    const key = (FK.getActiveProductKey && FK.getActiveProductKey()) || 'croissant';
    if (qty > 0) FK.addInventory(key, qty, q);
    buffs.forEach((b) => {
      const minutes = Math.max(1, Math.ceil(Number(b.seconds_left || 0) / 60));
      FK.addBuff({ id: `manual_${b.id || ('b' + Date.now())}`, label: b.label || 'Boost manual', minutes, trafficMult: Number(b.trafficMult || 1), qBonus: Number(b.qBonus || 0) });
    });
    S = FK.getState();
    updateTicker(qty ? `Importat ${qty} buc • Q ${q.toFixed(2)}` : 'Boost-uri importate!');
    celebrate('Import reușit!');
    refreshTop();
  } catch (err) {
    console.error(err);
    updateTicker('Eroare la import.');
  }
}

function refreshTop() {
  S = FK.getState();
  if (elDay) elDay.textContent = String(S.world?.day || S.day || 1);
  if (elTime) {
    const minutes = S.timeMin || S.world?.minute || 8 * 60;
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    elTime.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }
  if (elCash) elCash.textContent = Math.round(S.cash || 0);
  const key = dayPlan?.productKey || S.activeProduct || 'croissant';
  if (elStock) elStock.textContent = FK.totalStock(key);
  if (elRep) elRep.textContent = (S.reputation || 1).toFixed(2);
  if (elBoost) {
    const percent = Math.round(S.boost?.percent || 0);
    const count = (S.boost?.buffs || []).length;
    elBoost.textContent = count ? `${percent}% (${count})` : `${percent}%`;
  }
}

function openIngModal() {
  const modal = document.createElement('div');
  modal.id = 'ing-modal';
  Object.assign(modal.style, { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '100000' });
  modal.innerHTML = `
    <div style="background:#fff;color:#000;min-width:340px;max-width:620px;width:92%;border-radius:12px;border:2px solid #333;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .8rem;background:#222;color:#fff">
        <div>Vizualizare ingrediente</div><button id="ing-close" class="btn small">×</button>
      </div>
      <div style="padding:.6rem .8rem;max-height:60vh;overflow:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.92rem">
          <thead><tr><th align="left">Ingredient</th><th align="right">Stoc</th><th align="right">TTL</th></tr></thead>
          <tbody id="ing-body"></tbody>
        </table>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const body = modal.querySelector('#ing-body');
  const render = () => {
    const state = FK.getState();
    body.innerHTML = '';
    Object.entries(state.ingredients || {}).forEach(([id, info]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${id.replaceAll('_', ' ')}</td><td align="right">${info.qty || 0}</td><td align="right">${info.shelfLife || '-'} zile</td>`;
      body.appendChild(tr);
    });
  };
  render();
  modal.querySelector('#ing-close')?.addEventListener('click', () => modal.remove());
}

function openRNDModal() {
  const state = FK.getState();
  const list = Object.values(state.products || {});
  const modal = document.createElement('div');
  modal.id = 'rnd-modal';
  Object.assign(modal.style, { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '100000' });
  modal.innerHTML = `
    <div style="background:#fff;color:#000;min-width:360px;max-width:720px;width:92%;border:2px solid #333;border-radius:10px;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .8rem;background:#222;color:#fff">
        <div>Laborator R&D</div><button id="rnd-close" class="btn small">×</button>
      </div>
      <div style="padding:.6rem .8rem;max-height:60vh;overflow:auto">
        <div id="rnd-list"></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const container = modal.querySelector('#rnd-list');
  const paint = () => {
    const fresh = FK.getState();
    container.innerHTML = '';
    list.forEach((p) => {
      const unlocked = !p.locked && (fresh.research?.unlocked || []).includes(p.key);
      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:1fr auto;gap:.5rem;align-items:center;border-bottom:1px solid #eee;padding:.4rem 0';
      row.innerHTML = `
        <div><b>${p.name}</b><div class="small muted">P0 ${p.P0} • TTL ${p.shelfLifeDays} zile</div></div>
        <div style="display:flex;gap:.4rem">
          ${unlocked ? `<button class="btn small act-proto" data-k="${p.key}">Taste test</button>` : `<button class="btn small act-unlock" data-k="${p.key}">Deblochează (300)</button>`}
        </div>`;
      container.appendChild(row);
    });
    container.querySelectorAll('.act-unlock').forEach((btn) => btn.addEventListener('click', () => {
      const ok = FK.unlockProduct && FK.unlockProduct(btn.dataset.k, 300);
      if (ok) {
        updateTicker('Produs nou deblocat!');
        celebrate('Produs deblocat!');
        paint();
      } else {
        updateTicker('Nu avem suficiente fonduri pentru R&D.');
      }
    }));
    container.querySelectorAll('.act-proto').forEach((btn) => btn.addEventListener('click', () => {
      const key = btn.dataset.k;
      const current = FK.getState();
      const rid = current.products?.[key]?.recipeId || 'croissant_plain';
      if (!FK.canProduce(rid, 6)) {
        updateTicker('Ingrediente insuficiente pentru prototip.');
        return;
      }
      FK.consumeFor(rid, 6);
      FK.addInventory(key, 6, clamp(0.9 + (Math.random() * 0.06 - 0.03), 0.86, 0.98));
      FK.addBuff({ id: 'prototypeHype', label: `Hype ${current.products?.[key]?.name || ''}`, minutes: 45, trafficMult: 1.06, qBonus: 0.01 });
      celebrate('Prototip servit!');
      refreshTop();
    }));
  };
  paint();
  modal.querySelector('#rnd-close')?.addEventListener('click', () => modal.remove());
}

function mountProductSelector() {
  try {
    const left = document.getElementById('left-controls');
    if (!left || document.getElementById('sel-product')) return;
    const wrap = document.createElement('div');
    wrap.className = 'row';
    wrap.innerHTML = <label>Produs activ</label>
      <select id="sel-product"></select>
      <button id="btn-rnd" class="btn">R&D</button>;
    left.insertBefore(wrap, left.firstElementChild);
    const sel = wrap.querySelector('#sel-product');
    const sync = () => {
      const fresh = FK.getState();
      sel.innerHTML = '';
      Object.values(fresh.products || {}).forEach((p) => {
        if (p.locked) return;
        const opt = document.createElement('option');
        opt.value = p.key;
        opt.textContent = p.name;
        if (fresh.activeProduct === p.key) opt.selected = true;
        sel.appendChild(opt);
      });
    };
    sync();
    sel.addEventListener('change', () => {
      FK.setActiveProduct && FK.setActiveProduct(sel.value);
      S = FK.getState();
      hydrateAdvancedControls();
      refreshTop();
    });
    wrap.querySelector('#btn-rnd')?.addEventListener('click', openRNDModal);
    setInterval(sync, 2000);
  } catch (_) {}
}
window.openIngModal = openIngModal;
window.openRNDModal = openRNDModal;