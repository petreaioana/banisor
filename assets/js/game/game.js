// assets/js/game/game.js
// =====================================================
// FinKids Tycoon — Joc manual (Turnare → Decor → Coacere → Servire)
// - HTML/CSS canvas (cerc / inimă / stea) + umplere animată
// - Mașină de stări simplă: pour → decorate → bake → serve
// - O SINGURĂ coacere per comandă (lock după stop)
// - Scoruri: turnare, decor, coacere → Q & qty
// - Integrare FK (consum rețetă + adăugare în stoc produs activ)
// =====================================================

import { FK } from '../shared/state.js';

// ---------- Utils ----------
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- Config ingrediente (paletă) ----------
const ING = [
  { id: 'chocolate_chips', name: 'Cipuri ciocolată' },
  { id: 'strawberries',    name: 'Căpșuni' },
  { id: 'coconut',         name: 'Cocos' },
  { id: 'sprinkles',       name: 'Ornamente' },
  { id: 'cacao',           name: 'Cacao' },
  { id: 'sugar',           name: 'Zahăr' },
];

const PHASES = ['pour', 'decorate', 'bake', 'serve'];

// ---------- Stare joc ----------
const state = {
  phase: 'pour',                 // pour | decorate | bake | serve
  order: null,                   // { size, shape, tops[], bake:[a,b], pour:[min,max] }
  sizeKey: 'M',                  // S | M | L
  fillPct: 0,                    // 0..1 (umplere turnare)
  placed: [],                    // [{id, x%, y%}]
  baking: {
    running: false,
    dur: 3000,
    p: 0,
    zone: [0.52, 0.62],
    inWin: false,
    attempted: false,
    locked: false
  },
  scores: { pour: 0, top: 0, bake: 0, q: 0, qty: 0 },
};

let bakeTimer = null;
let pourTimer = null;

// ---------- Sunet ----------
let audioOn = true;
let __AC = null;
function getAC() {
  if (!audioOn) return null;
  try {
    __AC = __AC || new (window.AudioContext || window.webkitAudioContext)();
  } catch (_) { /* noop */ }
  return __AC;
}
function playDing() {
  const ac = getAC(); if (!ac) return;
  const o = ac.createOscillator(); const g = ac.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(880, ac.currentTime);
  o.frequency.linearRampToValueAtTime(1320, ac.currentTime + 0.12);
  g.gain.setValueAtTime(0.0001, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.06, ac.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.2);
  o.connect(g); g.connect(ac.destination);
  o.start(); o.stop(ac.currentTime + 0.22);
}
function playBuzz() {
  const ac = getAC(); if (!ac) return;
  const o = ac.createOscillator(); const g = ac.createGain();
  o.type = 'sawtooth'; o.frequency.value = 220; g.gain.value = 0.03;
  o.connect(g); g.connect(ac.destination);
  o.start(); setTimeout(()=>{ try{o.stop();}catch(_){/*noop*/} }, 120);
}
function playPlop() {
  const ac = getAC(); if (!ac) return;
  const o = ac.createOscillator(); const g = ac.createGain();
  o.type = 'square'; o.frequency.value = 560 + Math.random()*160; g.gain.value = 0.04;
  o.connect(g); g.connect(ac.destination);
  o.start(); setTimeout(()=>{ try{o.stop();}catch(_){/*noop*/} }, 90);
}

// ---------- Particule / feedback ----------
function toast(msg) {
  let host = $('.toast-container');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-container';
    document.body.appendChild(host);
  }
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = msg;
  host.appendChild(d);
  setTimeout(() => { try { d.remove(); } catch (_) {} }, 1800);
}

function confettiAt(x, y, n = 18) {
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'particle';
    const ang = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 60;
    d.style.setProperty('--dx', (Math.cos(ang) * dist) + 'px');
    d.style.setProperty('--dy', (Math.sin(ang) * dist) + 'px');
    d.style.left = x + 'px';
    d.style.top  = y + 'px';
    d.style.position = 'fixed';
    d.style.background = ['#f3e38a','#f9a6a6','#a8d8f5','#c7f59e','#f7d57a'][i % 5];
    d.style.animation = 'pop .7s ease-out forwards';
    document.body.appendChild(d);
    setTimeout(() => { try{ d.remove(); }catch(_){ } }, 800);
  }
}

function sprinkleAt(container, el) {
  try {
    const rect = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const xPct = ((cx - rect.left) / rect.width) * 100;
    const yPct = ((cy - rect.top) / rect.height) * 100;
    for (let i = 0; i < 6; i++) {
      const d = document.createElement('div'); d.className = 'particle';
      d.style.setProperty('--dx', (Math.random()*40-20) + 'px');
      d.style.setProperty('--dy', (Math.random()*40-20) + 'px');
      d.style.left = xPct + '%';
      d.style.top  = yPct + '%';
      d.style.background = ['#f8c66a','#f5a8a8','#a8d8f5','#c7f59e','#f9f09a'][i % 5];
      d.style.animation = 'pop .5s ease-out forwards';
      container.appendChild(d);
      setTimeout(() => { try{ d.remove(); }catch(_){ } }, 600);
    }
  } catch (_) { /* noop */ }
}

function ovenPuff(success) {
  const img = $('#oven-img'); if (!img) return;
  const r = img.getBoundingClientRect();
  confettiAt(r.left + r.width * 0.5, r.top + r.height * 0.15, success ? 16 : 8);
}
function ensureCanvas() {
  const stage = document.querySelector('.build-stage');
  if (!stage) return;

  if (!$('#shape-mold')) {
    const mold = document.createElement('div');
    mold.id = 'shape-mold';
    mold.className = 'shape shape--circle';
    mold.innerHTML = `
      <div id="shape-base" class="shape-base"></div>
      <div id="shape-fill" class="shape-fill" style="height:0%"></div>
    `;
    stage.appendChild(mold);
  }
  if (!$('#dropzone')) {
    const dz = document.createElement('div');
    dz.id = 'dropzone';
    dz.className = 'build-dropzone';
    dz.setAttribute('aria-label','Plasare toppinguri');
    stage.appendChild(dz);
  }
}

// ---------- UI helpers ----------
function setPhase(next) {
  state.phase = next;

  // Stepper
  $$('#stepper li').forEach(li => {
    const ph = li.getAttribute('data-phase');
    const idx = PHASES.indexOf(ph);
    const cur = PHASES.indexOf(next);
    li.classList.toggle('active', ph === next);
    li.classList.toggle('done', idx > -1 && idx < cur);
  });

  // Arată doar panoul etapei curente
  $$('.tools--phase').forEach(sec => {
    const ph = sec.getAttribute('data-phase');
    sec.classList.toggle('hidden', ph !== next);
  });

  // Activări butoane
  const canBakeStart = next === 'bake' && !state.baking.locked && !state.baking.running;
  const canBakeStop  = next === 'bake' && state.baking.running;
  const canServe     = next === 'serve';

 const btnStart = $('#btn-bake-start') || $('#btn-bake');
const btnStop  = $('#btn-bake-stop')  || $('#btn-stop');
const btnServe = $('#btn-serve');

btnStart?.toggleAttribute('disabled', !(next === 'bake' && !state.baking.locked && !state.baking.running));
btnStop ?.toggleAttribute('disabled', !(next === 'bake' && state.baking.running));
btnServe?.toggleAttribute('disabled', !(next === 'serve'));

}

function updateMold() {
  const mold = $('#shape-mold'); if (!mold || !state.order) return;
  mold.className = 'shape shape--' + (state.order.shape || 'circle');
  // Dimensiune S/M/L
  const px = state.sizeKey === 'S' ? 160 : state.sizeKey === 'L' ? 240 : 200;
  mold.style.setProperty('--mold-size', px + 'px');

  // reflectă selectul de formă (dacă există)
  const sel = $('#shape-select');
  if (sel && sel.value !== state.order.shape) sel.value = state.order.shape;
}

function updateFillUI() {
  const fill = $('#shape-fill'); if (!fill || !state.order) return;
  const pct = clamp(state.fillPct, 0, 1);
  fill.style.height = Math.round(pct * 100) + '%';

  // „good” când se află în fereastra de turnare
  const [a, b] = state.order.pour;
  fill.classList.toggle('good', pct >= a && pct <= b);

  // UI text/slider
  $('#pour-pct')  && ($('#pour-pct').textContent = String(Math.round(pct * 100)));
  $('#pour-range') && ($('#pour-range').value = String(Math.round(pct * 100)));

  calcPourScore();
  renderScores();
}

function updateHitWindowUI() {
  if (!state.order) return;
  const [a, b] = state.order.bake;
  const win = $('.hit-window span');
  if (win) {
    win.style.left = Math.round(a * 100) + '%';
    win.style.width = Math.round((b - a) * 100) + '%';
    win.classList.add('pulse');
  }
  $('#bake-window-label') && ($('#bake-window-label').textContent = `${Math.round(a*100)}–${Math.round(b*100)}%`);
}

function buildPalette() {
  const wrap = $('#build-palette') || $('#palette'); // <— suportă ambele ID-uri
  if (!wrap) return;
  wrap.innerHTML = '';
  ING.forEach(ing => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip-btn';
    b.innerHTML = `<i data-type="${ing.id}"></i><span>${ing.name}</span>`;
    b.addEventListener('click', () => spawnChip(ing.id));
    wrap.appendChild(b);
  });
}


function styleChip(el, type) {
  const paint = {
    chocolate_chips: 'radial-gradient(circle at 60% 40%, #6a3b1e, #4b2813)',
    strawberries: 'radial-gradient(circle at 60% 40%, #ff6b6b, #d23b3b)',
    coconut: 'linear-gradient(45deg, #fff, #f3f3f3)',
    sprinkles: 'repeating-linear-gradient(45deg, #ffeea8, #ffeea8 6px, #ffd77a 6px, #ffd77a 12px)',
    cacao: 'linear-gradient(45deg, #5a341c, #3b220f)',
    sugar: 'repeating-linear-gradient(45deg, #fff, #fff 4px, #f2f2f2 4px, #f2f2f2 8px)',
  };
  el.style.background = paint[type] || '#eee';
}

function spawnChip(id) {
  const zone = $('#dropzone'); if (!zone) return;
  const chip = document.createElement('div');
  chip.className = 'chip';
  chip.dataset.type = id;
  styleChip(chip, id);

  // poziție inițială aleatoare (în % din dropzone)
  chip.style.left = (25 + Math.random() * 50) + '%';
  chip.style.top  = (25 + Math.random() * 50) + '%';

  let dragging = false, pid = 0, sx = 0, sy = 0, ox = 0, oy = 0;

  const start = (e) => {
    dragging = true; pid = e.pointerId || 0;
    chip.setPointerCapture && chip.setPointerCapture(pid);
    sx = e.clientX; sy = e.clientY;
    const r = chip.getBoundingClientRect();
    ox = r.left; oy = r.top;
    chip.style.cursor = 'grabbing';
  };
  const move = (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    const parent = zone.getBoundingClientRect();
    const nx = ((ox + dx) - parent.left) / parent.width * 100;
    const ny = ((oy + dy) - parent.top ) / parent.height * 100;
    chip.style.left = clamp(nx, 5, 95) + '%';
    chip.style.top  = clamp(ny, 5, 95) + '%';
  };
  const end = () => {
    dragging = false; chip.style.cursor = 'move';
    try { chip.releasePointerCapture && chip.releasePointerCapture(pid); } catch(_) {}
    sprinkleAt(zone, chip);
    playPlop();
    savePlaced();
  };

  chip.addEventListener('pointerdown', start, { passive: true });
  chip.addEventListener('pointermove', move);
  chip.addEventListener('pointerup', end, { passive: true });

  zone.appendChild(chip);
  savePlaced();
}

function readPlacedFromDOM() {
  const chips = $$('#dropzone .chip');
  return chips.map(el => ({
    id: el.dataset.type || 'unknown',
    x: parseFloat(el.style.left) || 0,
    y: parseFloat(el.style.top) || 0,
  }));
}

function savePlaced() {
  state.placed = readPlacedFromDOM();
  $('#build-count')  && ($('#build-count').textContent  = String(state.placed.length));
$('#placed-count') && ($('#placed-count').textContent = String(state.placed.length));  calcTopScore();
  renderScores();


}

function calcTopScore() {
  if (!state.order) { state.scores.top = 0; return; }
  const want = new Set(state.order.tops);
  const have = new Set(state.placed.map(p => p.id));
  let pts = 0;

  // ingredientele cerute
  want.forEach(id => { if (have.has(id)) pts += 25; });
  pts = Math.min(100, pts);

  // împrăștiere (distribuție)
  if (state.placed.length > 1) {
    const mx = state.placed.reduce((s, p) => s + p.x, 0) / state.placed.length;
    const my = state.placed.reduce((s, p) => s + p.y, 0) / state.placed.length;
    let spread = 0;
    state.placed.forEach(p => { const dx = p.x - mx, dy = p.y - my; spread += Math.sqrt(dx*dx + dy*dy); });
    const spreadScore = clamp(spread / (state.placed.length * 20), 0, 1) * 20;
    pts = clamp(pts + spreadScore, 0, 100);
  }

  state.scores.top = Math.round(pts);
}

function calcPourScore() {
  if (!state.order) { state.scores.pour = 0; return; }
  const pct = clamp(state.fillPct, 0, 1);
  const [a, b] = state.order.pour;
  const center = (a + b) / 2;
  const half   = (b - a) / 2;

  const d = Math.abs(pct - center);
  let score;
  if (d <= half) {
    score = 70 + (1 - d / half) * 30;   // în fereastră → 70..100
  } else {
    const far = Math.min(1, (d - half) / 0.25);
    score = Math.max(0, 70 - far * 60); // în afara ferestrei → scade către 10
  }
  state.scores.pour = Math.round(clamp(score, 0, 100));
}

// ---------- Turnare ----------
function startPourHold() {
  clearInterval(pourTimer);
  pourTimer = setInterval(() => {
    state.fillPct = clamp(state.fillPct + 0.01, 0, 1);
    updateFillUI();
  }, 70);
}
function endPourHold() {
  clearInterval(pourTimer);
  pourTimer = null;
}

// ---------- Coacere (un singur ciclu) ----------
function startBake() {
  if (state.phase !== 'bake') return;
  if (state.baking.locked || state.baking.running) return;

  state.baking.running = true;
  state.baking.p = 0;

  $('#btn-bake-start')?.setAttribute('disabled', 'true');
  $('#btn-bake-stop') ?.removeAttribute('disabled');
  $('#oven-img')      ?.setAttribute('src', 'images/oven_closed.png');

  const bar = $('#bake-bar');
  clearInterval(bakeTimer);

  const dur = state.baking.dur;
  const step = 90;
  bakeTimer = setInterval(() => {
    state.baking.p = clamp(state.baking.p + step / dur, 0, 1);
    if (bar) bar.style.width = (state.baking.p * 100) + '%';
    if (state.baking.p >= 1) stopBake(); // auto-stop la capăt
  }, step);

  setPhase('bake');
}

function stopBake() {
  if (!state.baking.running) return;

  state.baking.running = false;
  clearInterval(bakeTimer); bakeTimer = null;

  $('#btn-bake-stop')?.setAttribute('disabled', 'true');
  $('#oven-img')     ?.setAttribute('src', 'images/oven_open.png');

  const p = state.baking.p;
  const [a, b] = state.baking.zone;
  const center = (a + b) / 2;
  const maxD   = Math.max(0.0001, (b - a) / 2);
  const d = Math.abs(p - center);

  const inWin = p >= a && p <= b;
  state.baking.inWin = inWin;
  state.baking.attempted = true;
  state.baking.locked = true;

  // scor coacere
  state.scores.bake = Math.round(clamp(100 * (1 - Math.min(1, d / maxD)), 0, 100));

  if (inWin) {
    try { FK.addBuff && FK.addBuff({ id:'freshBake', label:'Coacere perfectă', minutes:45, qBonus:0.02, trafficMult:1.08 }); } catch (_){}
    playDing(); ovenPuff(true);
  } else {
    playBuzz();
    $('#oven-img')?.classList.add('shake');
    setTimeout(() => $('#oven-img')?.classList.remove('shake'), 380);
    ovenPuff(false);
  }

  computeFinalScores();
  renderScores();

  // după o singură coacere → mergem la servire
  setPhase('serve');
}

// ---------- Scoruri finale ----------
function computeFinalScores() {
  // ponderi: pour 30%, decor 40%, bake 30%
  const wPour = 0.30, wTop = 0.40, wBake = 0.30;
  const p = clamp(state.scores.pour / 100, 0, 1);
  const t = clamp(state.scores.top  / 100, 0, 1);
  const b = clamp(state.scores.bake / 100, 0, 1);

  const q = clamp(0.82 + (p * 0.06 * wPour + t * 0.10 * wTop + b * 0.08 * wBake), 0.82, 0.98);

  // qty: mărime + mic bonus pentru turnare & toppinguri
  const sizeBase = { S: 8, M: 10, L: 12 }[state.sizeKey] || 10;
  const qty = clamp(sizeBase + Math.round(state.fillPct * 3) + Math.floor(state.placed.length / 3), 6, 18);

  state.scores.q = Number(q.toFixed(2));
  state.scores.qty = qty;
}

function renderScores() {
  $('#score-pour')  && ($('#score-pour').textContent  = String(state.scores.pour));
  $('#score-decor') && ($('#score-decor').textContent = String(state.scores.top));
  $('#score-bake')  && ($('#score-bake').textContent  = String(state.scores.bake));
  $('#score-q')     && ($('#score-q').textContent     = (state.scores.q || 0).toFixed(2));
  $('#score-qty')   && ($('#score-qty').textContent   = String(state.scores.qty || 0));
  // alias pentru decor:
$('#score-top') && ($('#score-top').textContent = String(state.scores.top));

// serve panel:
$('#score-q-serve')   && ($('#score-q-serve').textContent   = (state.scores.q || 0).toFixed(2));
$('#score-qty-serve') && ($('#score-qty-serve').textContent = String(state.scores.qty || 0));

}

// ---------- Serve ----------
function serveClient() {
  if (state.phase !== 'serve') { toast('Finalizează coacerea înainte de servire.'); return; }

  computeFinalScores();
  const q   = state.scores.q   || 0.86;
  const qty = state.scores.qty || 8;

  // Produsul activ & rețeta
  const S = FK.getState ? FK.getState() : {};
  const k = (FK.getActiveProductKey && FK.getActiveProductKey()) || 'produs';
  const rid = (S.products?.[k]?.recipeId) || (S.products?.[k]?.recipe_id) || 'recipe_default';

  // verifică ingrediente
  if (FK.canProduce && !FK.canProduce(rid, qty)) {
    toast('⚠️ Stoc ingrediente insuficient');
    return;
  }

  // consumă + adaugă în stoc
  try { FK.consumeFor && FK.consumeFor(rid, qty); } catch(_){}
  try { FK.addInventory && FK.addInventory(k, qty, q); } catch(_){}

  // buff mic dacă a fost în fereastră
  if (state.baking.inWin) {
    try { FK.addBuff && FK.addBuff({ id:'partySprinkles', label:'Yay! Party time', minutes:30, trafficMult:1.05 }); } catch(_){}
  }

  // confetti la buton
  const btn = $('#btn-serve');
  if (btn) {
    const r = btn.getBoundingClientRect();
    confettiAt(r.left + r.width / 2, r.top + r.height / 2, 24);
  }

  toast(`✅ Servit ${productName()}! +${qty} stoc · Q ${q.toFixed(2)}`);
  updateTopbar();

  // nouă comandă
  newOrder();
  setPhase('pour');
}

// ---------- Order / Topbar ----------
function shapeLabel(s) { return s === 'heart' ? 'Inimă' : s === 'star' ? 'Stea' : 'Cerc'; }
function productName() {
  const S = FK.getState ? FK.getState() : {};
  const k = (FK.getActiveProductKey && FK.getActiveProductKey()) || 'produs';
  return S.products?.[k]?.name || 'Produs';
}

function updateTopbar() {
  try {
    const k = (FK.getActiveProductKey && FK.getActiveProductKey()) || 'produs';
    $('#g-stock') && ($('#g-stock').textContent = String(FK.totalStock ? FK.totalStock(k) : 0));
    const S = FK.getState ? FK.getState() : {};
    const cnt = (S.boost?.buffs?.length) || 0;
    const pct = Math.round(S.boost?.percent || 0);
    $('#g-boost') && ($('#g-boost').textContent = pct + '%' + (cnt > 0 ? ` (${cnt})` : ''));
  } catch (_) { /* noop */ }
}

function renderOrder() {
  if (!state.order) return;
  $('#ord-shape') && ($('#ord-shape').textContent = shapeLabel(state.order.shape));
  $('#ord-size')  && ($('#ord-size').textContent  = state.order.size);
  $('#ord-bake')  && ($('#ord-bake').textContent  = `${Math.round(state.order.bake[0]*100)}–${Math.round(state.order.bake[1]*100)}%`);
  const ul = $('#ord-tops');
  if (ul) {
    ul.innerHTML = '';
    state.order.tops.forEach(id => {
      const li = document.createElement('li');
      li.textContent = (ING.find(i => i.id === id)?.name) || id;
      ul.appendChild(li);
    });
  }
}

function newOrder() {
  // citește mărimea curentă din slider (1=S, 2=M, 3=L)
  const map = { 1: 'S', 2: 'M', 3: 'L' };
  const slider = $('#size-range');
  const size = map[ Number(slider?.value || 2) ] || 'M';
  state.sizeKey = size;

  // formă aleatoare
  const shapes = ['circle', 'heart', 'star'];
  const shape = shapes[Math.floor(Math.random() * shapes.length)];

  // toppinguri cerute: 2..4
  const tops = ING.slice().sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 3)).map(t => t.id);

  // ferestre coacere & turnare
  const bakeCenter = 0.54 + (Math.random() * 0.06 - 0.03); // 0.51..0.57
  const bakeWidth  = 0.08 + Math.random() * 0.04;          // 8..12%
  const pourCenter = 0.80 + (Math.random() * 0.06 - 0.03); // 77..83%
  const pourWidth  = 0.12;

  state.order = {
    size, shape, tops,
    bake: [clamp(bakeCenter - bakeWidth/2, 0.15, 0.85), clamp(bakeCenter + bakeWidth/2, 0.20, 0.95)],
    pour: [clamp(pourCenter - pourWidth/2, 0.55, 0.95), clamp(pourCenter + pourWidth/2, 0.60, 0.98)]
  };

  // reset stări
  state.phase = 'pour';
  state.fillPct = 0;
  state.placed = [];
  state.baking = {
    running: false,
    dur: 2800 + Math.floor(Math.random() * 900),
    p: 0,
    zone: [...state.order.bake],
    inWin: false,
    attempted: false,
    locked: false
  };
  state.scores = { pour: 0, top: 0, bake: 0, q: 0, qty: 0 };

  // UI
  // sincronizează selectul de formă, mărimea și canvas
  const sel = $('#shape-select'); if (sel) sel.value = shape;
  updateMold();
  updateFillUI();
  renderOrder();
  renderBuildFromState();
  updateHitWindowUI();
  renderScores();
  updateTopbar();
}

// ---------- Reconstruire chips din state ----------
function renderBuildFromState() {
  const zone = $('#dropzone'); if (!zone) return;
  zone.innerHTML = '';
  state.placed.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.dataset.type = p.id;
    styleChip(chip, p.id);
    chip.style.left = p.x + '%';
    chip.style.top  = p.y + '%';

    let dragging = false, pid = 0, sx = 0, sy = 0, ox = 0, oy = 0;
    const start = (e) => {
      dragging = true; pid = e.pointerId || 0;
      chip.setPointerCapture && chip.setPointerCapture(pid);
      sx = e.clientX; sy = e.clientY;
      const r = chip.getBoundingClientRect(); ox = r.left; oy = r.top;
      chip.style.cursor = 'grabbing';
    };
    const move = (e) => {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      const parent = zone.getBoundingClientRect();
      const nx = ((ox + dx) - parent.left) / parent.width * 100;
      const ny = ((oy + dy) - parent.top ) / parent.height * 100;
      chip.style.left = clamp(nx, 5, 95) + '%';
      chip.style.top  = clamp(ny, 5, 95) + '%';
    };
    const end = () => {
      dragging = false; chip.style.cursor = 'move';
      try { chip.releasePointerCapture && chip.releasePointerCapture(pid); } catch(_) {}
      sprinkleAt(zone, chip); playPlop(); savePlaced();
    };

    chip.addEventListener('pointerdown', start, { passive: true });
    chip.addEventListener('pointermove', move);
    chip.addEventListener('pointerup', end, { passive: true });

    zone.appendChild(chip);
  });
  
  $('#build-count')  && ($('#build-count').textContent  = String(state.placed.length));
$('#placed-count') && ($('#placed-count').textContent = String(state.placed.length));

}

// ---------- Evenimente ----------
function wireEvents() {
  const btnStart = $('#btn-bake-start') || $('#btn-bake');
const btnStop  = $('#btn-bake-stop')  || $('#btn-stop');

btnStart?.addEventListener('click', startBake);
btnStop ?.addEventListener('click', stopBake);

  // Step nav
  $('#btn-prev')?.addEventListener('click', () => {
    const idx = Math.max(0, PHASES.indexOf(state.phase) - 1);
    if (state.phase === 'bake' && state.baking.running) { toast('Oprește coacerea mai întâi.'); return; }
    setPhase(PHASES[idx]);
  });
  $('#btn-next')?.addEventListener('click', () => {
    const idx = Math.min(PHASES.length - 1, PHASES.indexOf(state.phase) + 1);

    // Validări soft per etapă
    if (state.phase === 'pour') {
      if (!state.order) return;
      if (state.fillPct < state.order.pour[0]) { toast('Toarnă puțin mai mult!'); return; }
    }
    if (state.phase === 'decorate') {
      if (state.placed.length < 2) { toast('Adaugă cel puțin două toppinguri.'); return; }
    }
    if (state.phase === 'bake') {
      if (!state.baking.attempted) { toast('Pornește coacerea înainte de a continua.'); return; }
    }
    setPhase(PHASES[idx]);
  });

  // Comandă nouă
  $('#btn-new-order')?.addEventListener('click', () => { newOrder(); setPhase('pour'); });

  // Pour
  $('#btn-pour-hold')?.addEventListener('pointerdown', (e) => { e.preventDefault(); startPourHold(); e.currentTarget.classList.add('bounce'); setTimeout(()=>e.currentTarget.classList.remove('bounce'), 600); });
  ['pointerup','pointerleave','pointercancel'].forEach(ev => {
    $('#btn-pour-hold')?.addEventListener(ev, endPourHold);
  });
  $('#pour-range')?.addEventListener('input', (e) => {
    const v = Number(e.target.value || 0);
    state.fillPct = clamp(v / 100, 0, 1);
    updateFillUI();
  });

  // Decor
  buildPalette();

  // Mărime + formă
  $('#size-range')?.addEventListener('input', (e) => {
    const map = { 1: 'S', 2: 'M', 3: 'L' };
    state.sizeKey = map[ Number(e.target.value || 2) ] || 'M';
    $('#size-label') && ($('#size-label').textContent = state.sizeKey);
    updateMold();
    computeFinalScores(); renderScores();
  });
  $('#shape-select')?.addEventListener('change', (e) => {
    if (!state.order) return;
    state.order.shape = e.target.value || 'circle';
    updateMold();
  });

  // Bake
  $('#btn-bake-start')?.addEventListener('click', startBake);
  $('#btn-bake-stop') ?.addEventListener('click', stopBake);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      if (state.phase === 'bake') { e.preventDefault(); if (state.baking.running) stopBake(); }
    }
  });

  // Serve
  $('#btn-serve')?.addEventListener('click', serveClient);

  // Audio toggle
  $('#btn-audio')?.addEventListener('click', (e) => {
    audioOn = !audioOn;
    e.currentTarget.setAttribute('aria-pressed', audioOn ? 'true' : 'false');
    e.currentTarget.textContent = audioOn ? '🔊 Sunet' : '🔈 Mut';
    toast(audioOn ? '🔊 Sunet ON' : '🔈 Sunet OFF');
  });
}

// ---------- Init ----------
function mount() {
  wireEvents();
    ensureCanvas(); // <— ADĂUGAT

  // Dimensiune inițială (afișează eticheta)
  const map = { 1: 'S', 2: 'M', 3: 'L' };
  const slider = $('#size-range');
  if ($('#size-label') && slider) $('#size-label').textContent = map[ Number(slider.value || 2) ] || 'M';

  // Prima comandă
  newOrder();
  updateHitWindowUI();
  setPhase('pour');
  updateTopbar();

  // Sync periodic topbar
  try { setInterval(updateTopbar, 2000); } catch(_) {}
}

function ready(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
  else fn();
}

ready(mount);
