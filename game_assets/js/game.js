/**
 * FinKids Tycoon — Frontend logic (no modules) for the Manual Game
 */

// ---------- API bridge (updated for new API structure) ----------
const API = {
    async fetchState() {
        try {
            const r = await fetch(`api/manual_game_api.php?action=state`, { cache: 'no-store' });
            if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
            return r.json();
        } catch (e) {
            console.error("API fetchState error:", e);
            return { ok: false, transfer: { qty: 0, percent: 0, buffs: [] } };
        }
    },
    async serve(qty, q, inWin) {
        const fd = new FormData();
        fd.append('qty', String(qty));
        fd.append('q', String(q));
        fd.append('inWin', inWin ? '1' : '0');
        try {
            const r = await fetch(`api/manual_game_api.php?action=serve`, { method: 'POST', body: fd });
            if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
            return r.json();
        } catch (e) {
            console.error("API serve error:", e);
            return { ok: false, error: "Network error" };
        }
    },
    async reset() {
        try {
            const r = await fetch(`api/manual_game_api.php?action=reset`, { cache: 'no-store' });
            if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
            return r.json();
        } catch (e) {
            console.error("API reset error:", e);
            return { ok: false, error: "Network error" };
        }
    }
};

// ---------- Utils ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Game Config ----------
const ING = [
    { id: 'chocolate_chips', name: 'Cipuri ciocolată', img: 'chocolate_chips.png' },
    { id: 'strawberries',    name: 'Căpșuni',          img: 'strawberries.png' },
    { id: 'coconut',         name: 'Cocos',            img: 'coconut.png' },
    { id: 'sprinkles',       name: 'Ornamente',        img: 'sprinkles.png' },
    { id: 'cacao',           name: 'Cacao',            img: 'cacao.png' },
    { id: 'sugar',           name: 'Zahăr',            img: 'sugar.png' },
];
const TOP_IMG = ING.reduce((acc, item) => ({ ...acc, [item.id]: item.img }), {});
const PHASES = ['pour', 'decorate', 'bake', 'serve'];

// ---------- Game state ----------
const state = {
    phase: 'pour',
    order: null,
    sizeKey: 'M',
    fillPct: 0,
    placed: [],
    baking: { running: false, dur: 3000, p: 0, zone: [0.52, 0.62], inWin: false, attempted: false, locked: false },
    scores: { pour: 0, top: 0, bake: 0, q: 0, qty: 0 },
};
let bakeTimer = null, pourTimer = null;
let audioOn = true;
let __AC = null;

// ---------- Audio Functions ----------
function getAC() { if (!audioOn) return null; try { __AC = __AC || new(window.AudioContext || window.webkitAudioContext)(); } catch (e) {} return __AC; }
function playDing() { const ac = getAC(); if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(880, ac.currentTime); o.frequency.linearRampToValueAtTime(1320, ac.currentTime + 0.12); g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.06, ac.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.2); o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.22); }
function playBuzz() { const ac = getAC(); if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = 220; g.gain.value = 0.03; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(() => { try { o.stop(); } catch (_) {} }, 120); }
function playPlop() { const ac = getAC(); if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = 560 + Math.random() * 160; g.gain.value = 0.04; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(() => { try { o.stop(); } catch (_) {} }, 90); }

// ---------- Feedback & UI Helpers ----------
function toast(msg) {
    const host = $('.toast-container');
    if (!host) return;
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = msg;
    host.appendChild(d);
    setTimeout(() => { try { d.remove(); } catch (_) {} }, 2200);
}

function confettiAt(x, y, n = 18) {
    const container = document.body;
    for (let i = 0; i < n; i++) {
        const d = document.createElement('div');
        d.className = 'particle';
        const ang = Math.random() * Math.PI * 2, dist = 20 + Math.random() * 60;
        d.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
        d.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
        d.style.left = `${x}px`;
        d.style.top = `${y}px`;
        d.style.background = ['#f3e38a', '#f9a6a6', '#a8d8f5', '#c7f59e', '#f7d57a'][i % 5];
        d.style.animation = 'pop .7s ease-out forwards';
        container.appendChild(d);
        setTimeout(() => { try { d.remove(); } catch (_) {} }, 800);
    }
}
function sprinkleAt(container, el) {
    try {
        const rect = container.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const xPct = ((cx - rect.left) / rect.width) * 100, yPct = ((cy - rect.top) / rect.height) * 100;
        for (let i = 0; i < 6; i++) {
            const d = document.createElement('div');
            d.className = 'particle';
            d.style.setProperty('--dx', (Math.random() * 40 - 20) + 'px');
            d.style.setProperty('--dy', (Math.random() * 40 - 20) + 'px');
            d.style.left = xPct + '%';
            d.style.top = yPct + '%';
            d.style.background = ['#f8c66a', '#f5a8a8', '#a8d8f5', '#c7f59e', '#f9f09a'][i % 5];
            d.style.animation = 'pop .5s ease-out forwards';
            container.appendChild(d);
            setTimeout(() => { try { d.remove(); } catch (_) {} }, 600);
        }
    } catch (_) {}
}
function ovenPuff(success) {
    const img = $('#oven-img');
    if (!img) return;
    const r = img.getBoundingClientRect();
    confettiAt(r.left + r.width * 0.5, r.top + r.height * 0.15, success ? 16 : 8);
}

function setPhase(next) {
    state.phase = next;
    const currentIndex = PHASES.indexOf(next);
    $$('#stepper li').forEach((li, idx) => {
        const phase = li.dataset.phase;
        li.classList.toggle('active', phase === next);
        li.classList.toggle('done', idx < currentIndex);
    });
    $$('.tools--phase').forEach(sec => sec.classList.toggle('hidden', sec.dataset.phase !== next));
    
    $('#btn-bake-start')?.toggleAttribute('disabled', !(next === 'bake' && !state.baking.locked && !state.baking.running));
    $('#btn-bake-stop')?.toggleAttribute('disabled', !(next === 'bake' && state.baking.running));
    $('#btn-serve')?.toggleAttribute('disabled', next !== 'serve');
}

function updateMold() {
    const mold = $('#shape-mold');
    if (!mold || !state.order) return;
    mold.className = 'shape shape--' + (state.order.shape || 'circle');
    const px = state.sizeKey === 'S' ? 160 : state.sizeKey === 'L' ? 240 : 200;
    mold.style.setProperty('--mold-size', px + 'px');

    const sel = $('#shape-select');
    if (sel && sel.value !== state.order.shape) sel.value = state.order.shape;
    
    const shapeText = { circle: 'Cerc', heart: 'Inimă', star: 'Stea' };
    $('#ord-shape').textContent = shapeText[state.order.shape] || 'Cerc';
    $('#ord-size').textContent = state.sizeKey;
}

function updateFillUI() {
    const fill = $('#shape-fill');
    if (!fill || !state.order) return;
    const pct = clamp(state.fillPct, 0, 1);
    fill.style.height = Math.round(pct * 100) + '%';
    const [a, b] = state.order.pour;
    fill.classList.toggle('good', pct >= a && pct <= b);
    $('#pour-pct').textContent = String(Math.round(pct * 100));
    $('#pour-range').value = String(Math.round(pct * 100));
    calcPourScore();
    renderScores();
}

function updateHitWindowUI() {
    if (!state.order) return;
    const [a, b] = state.order.bake;
    const span = $('.hit-window span');
    if (span) {
        span.style.left = Math.round(a * 100) + '%';
        span.style.width = Math.round((b - a) * 100) + '%';
    }
    $('#bake-window-label').textContent = `${Math.round(a * 100)}–${Math.round(b * 100)}%`;
}

function buildPalette() {
    const wrap = $('#palette');
    if (!wrap) return;
    wrap.innerHTML = '';
    ING.forEach(ing => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip-btn';
        const imgSrc = `game_assets/images/${TOP_IMG[ing.id] || 'sprinkles.png'}`;
        b.innerHTML = `<img src="${imgSrc}" alt="${ing.name}"><span>${ing.name}</span>`;
        b.addEventListener('click', () => spawnChip(ing.id));
        wrap.appendChild(b);
    });
}


function spawnChip(id){
  const zone=$('#dropzone'); if(!zone) return;

  const chip=document.createElement('div');
  chip.className='chip'; chip.dataset.type=id;
  chip.style.left=(25+Math.random()*50)+'%';
  chip.style.top =(25+Math.random()*50)+'%';

  // imaginea efectivă a toppingului
  const img=document.createElement('img');
  img.src = 'game_assets/images/' + (TOP_IMG[id] || 'sprinkles.png');
  img.alt = (ING.find(i=>i.id===id)?.name) || id;
  chip.appendChild(img);

  // drag & drop pe containerul .chip
  let dragging=false, pid=0, sx=0, sy=0, ox=0, oy=0;
  const start=(e)=>{ dragging=true; pid=e.pointerId||0; chip.setPointerCapture && chip.setPointerCapture(pid);
    sx=e.clientX; sy=e.clientY; const r=chip.getBoundingClientRect(); ox=r.left; oy=r.top; chip.style.cursor='grabbing'; };
  const move =(e)=>{ if(!dragging) return;
    const dx=e.clientX-sx, dy=e.clientY-sy;
    const parent=zone.getBoundingClientRect();
    const nx=((ox+dx)-parent.left)/parent.width*100;
    const ny=((oy+dy)-parent.top)/parent.height*100;
    chip.style.left=clamp(nx,5,95)+'%';
    chip.style.top =clamp(ny,5,95)+'%';
  };
  const end  =()=>{ dragging=false; chip.style.cursor='move';
    try{ chip.releasePointerCapture && chip.releasePointerCapture(pid); }catch(_){}
    sprinkleAt(zone, chip); playPlop(); savePlaced();
  };

  chip.addEventListener('pointerdown', start, {passive:true});
  chip.addEventListener('pointermove',  move);
  chip.addEventListener('pointerup',    end,  {passive:true});

  zone.appendChild(chip);
  savePlaced();
}

function readPlacedFromDOM(){
  return $$('#dropzone .chip').map(el=>({
    id: el.dataset.type || 'unknown',
    x: parseFloat(el.style.left) || 0,
    y: parseFloat(el.style.top)  || 0,
  }));
}
function savePlaced(){
  state.placed = readPlacedFromDOM();
  $('#placed-count') && ($('#placed-count').textContent = String(state.placed.length));
  calcTopScore(); renderScores();
}

// ---------- Scoring ----------
function calcTopScore(){
  if(!state.order){ state.scores.top=0; return; }
  const want=new Set(state.order.tops);
  const have=new Set(state.placed.map(p=>p.id));
  let pts=0;
  want.forEach(id=>{ if(have.has(id)) pts+=25; });
  pts=Math.min(100, pts);

  if(state.placed.length>1){
    const mx=state.placed.reduce((s,p)=>s+p.x,0)/state.placed.length;
    const my=state.placed.reduce((s,p)=>s+p.y,0)/state.placed.length;
    let spread=0; state.placed.forEach(p=>{ const dx=p.x-mx, dy=p.y-my; spread+=Math.sqrt(dx*dx+dy*dy); });
    const spreadScore = clamp(spread/(state.placed.length*20),0,1)*20;
    pts = clamp(pts + spreadScore, 0, 100);
  }
  state.scores.top = Math.round(pts);
}
function calcPourScore(){
  if(!state.order){ state.scores.pour=0; return; }
  const pct=clamp(state.fillPct,0,1);
  const [a,b]=state.order.pour;
  const c=(a+b)/2, half=(b-a)/2, d=Math.abs(pct-c);
  let score;
  if(d<=half) score = 70 + (1 - d/half)*30;
  else { const far=Math.min(1,(d-half)/0.25); score=Math.max(0, 70 - far*60); }
  state.scores.pour = Math.round(clamp(score,0,100));
}
function computeFinalScores(){
  const wPour=0.30, wTop=0.40, wBake=0.30;
  const p=clamp(state.scores.pour/100,0,1);
  const t=clamp(state.scores.top /100,0,1);
  const b=clamp(state.scores.bake/100,0,1);
  const q=clamp(0.82 + (p*0.06*wPour + t*0.10*wTop + b*0.08*wBake), 0.82, 0.98);
  const base={S:8,M:10,L:12}[state.sizeKey]||10;
  const qty=clamp(base + Math.round(state.fillPct*3) + Math.floor(state.placed.length/3), 6, 18);
  state.scores.q = Number(q.toFixed(2));
  state.scores.qty = qty;
}
function renderScores(){
  $('#score-pour') && ($('#score-pour').textContent = String(state.scores.pour));
  $('#score-top')  && ($('#score-top').textContent  = String(state.scores.top));
  $('#score-bake') && ($('#score-bake').textContent = String(state.scores.bake));
  $('#score-q')    && ($('#score-q').textContent    = (state.scores.q||0).toFixed(2));
  $('#score-qty')  && ($('#score-qty').textContent  = String(state.scores.qty||0));
  $('#score-q-serve')   && ($('#score-q-serve').textContent   = (state.scores.q||0).toFixed(2));
  $('#score-qty-serve') && ($('#score-qty-serve').textContent = String(state.scores.qty||0));
}

// ---------- Bake ----------
function startBake(){
  if(state.phase!=='bake') return;
  if(state.baking.locked || state.baking.running) return;
  state.baking.running=true; state.baking.p=0;
  $('#btn-bake-start')?.setAttribute('disabled','true');
  $('#btn-bake-stop') ?.removeAttribute('disabled');
  $('#oven-img')?.setAttribute('src','game_assets/images/oven_closed.png');
  const bar=$('#bake-bar'); clearInterval(bakeTimer);
  const dur=state.baking.dur, step=90;
  bakeTimer=setInterval(()=>{
    state.baking.p = clamp(state.baking.p + step/dur, 0, 1);
    if(bar) bar.style.width=(state.baking.p*100)+'%';
    if(state.baking.p>=1) stopBake();
  }, step);
  setPhase('bake');
}
function stopBake(){
  if(!state.baking.running) return;
  state.baking.running=false;
  clearInterval(bakeTimer); bakeTimer=null;
  $('#btn-bake-stop')?.setAttribute('disabled','true');
  $('#oven-img')?.setAttribute('src','game_assets/images/oven_open.png');

  const p=state.baking.p, [a,b]=state.baking.zone;
  const c=(a+b)/2, maxD=Math.max(0.0001,(b-a)/2), d=Math.abs(p-c);
  const inWin = p>=a && p<=b;
  state.baking.inWin=inWin; state.baking.attempted=true; state.baking.locked=true;

  state.scores.bake = Math.round(clamp(100*(1-Math.min(1,d/maxD)), 0, 100));

  if(inWin){ playDing(); ovenPuff(true); }
  else     { playBuzz(); $('#oven-img')?.classList.add('shake'); setTimeout(()=>$('#oven-img')?.classList.remove('shake'),380); ovenPuff(false); }

  computeFinalScores(); renderScores();
  setPhase('serve');
}

// ---------- Serve ----------
async function serveClient(){
  if(state.phase!=='serve'){ toast('Finalizează coacerea înainte de servire.'); return; }
  computeFinalScores();
  const q=state.scores.q||0.86, qty=state.scores.qty||8;
  const inWin = !!state.baking.inWin;

  try{
    const res = await FK.serve(qty, q, inWin);
    if(res && res.ok){
      const btn=$('#btn-serve');
      if(btn){ const r=btn.getBoundingClientRect(); confettiAt(r.left+r.width/2, r.top+r.height/2, 24); }
      toast(`✅ Servit! +${qty} stoc · Q ${q.toFixed(2)}`);
      await refreshTopbar();
      newOrder();
      setPhase('pour');
    } else {
      toast('Eroare la servire.');
    }
  }catch(e){
    console.error(e); toast('Eroare de rețea la servire.');
  }
}

// ---------- Order / topbar ----------
function renderOrder(){
  if(!state.order) return;
  $('#ord-shape') && ($('#ord-shape').textContent = (state.order.shape==='heart'?'Inimă':state.order.shape==='star'?'Stea':'Cerc'));
  $('#ord-size')  && ($('#ord-size').textContent  = state.order.size);
  $('#ord-bake')  && ($('#ord-bake').textContent  = `${Math.round(state.order.bake[0]*100)}–${Math.round(state.order.bake[1]*100)}%`);
  const ul=$('#ord-tops');
  if(ul){
    ul.innerHTML='';
    state.order.tops.forEach(id=>{
      const li=document.createElement('li');
      const name = (ING.find(i=>i.id===id)?.name)||id;
      li.textContent = name;
      ul.appendChild(li);
    });
  }
}
async function serveClient() {
    if (state.phase !== 'serve') {
        toast('Finalizează coacerea înainte de servire.');
        return;
    }
    computeFinalScores();
    const { q, qty } = state.scores;
    const inWin = !!state.baking.inWin;

    try {
        const res = await API.serve(qty, q, inWin);
        if (res?.ok) {
            const btn = $('#btn-serve');
            if (btn) {
                const r = btn.getBoundingClientRect();
                confettiAt(r.left + r.width / 2, r.top + r.height / 2, 24);
            }
            toast(`✅ Servit! +${qty} produse transferate.`);
            await refreshTopbar(res.state);
            newOrder();
            setPhase('pour');
        } else {
            toast(res?.error || 'Eroare la servire.');
        }
    } catch (e) {
        console.error("Serve client error:", e);
        toast('Eroare de rețea la servire.');
    }
}

async function refreshTopbar(data) {
    try {
        const res = data ? { ok: true, transfer: data } : await API.fetchState();
        if (res?.ok) {
            const transfer = res.transfer;
            const stockEl = $('#g-stock');
            const boostEl = $('#g-boost');
            if (stockEl) stockEl.textContent = String(transfer.qty ?? 0);
            if (boostEl) {
                const buffCount = transfer.buffs?.length || 0;
                boostEl.textContent = `${transfer.percent ?? 0}%${buffCount > 0 ? ` (${buffCount})` : ''}`;
            }
        }
    } catch (e) {
        console.error("Error refreshing topbar:", e);
    }
}

function newOrder() {
    const map = { 1: 'S', 2: 'M', 3: 'L' };
    const slider = $('#size-range');
    state.sizeKey = map[slider?.value ?? 2] || 'M';

    const shapes = ['circle', 'heart', 'star'];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const tops = [...ING].sort(() => 0.5 - Math.random()).slice(0, 2 + Math.floor(Math.random() * 3)).map(t => t.id);

    const bakeCenter = 0.54 + (Math.random() * 0.06 - 0.03);
    const bakeWidth = 0.08 + Math.random() * 0.04;
    const pourCenter = 0.80 + (Math.random() * 0.06 - 0.03);
    const pourWidth = 0.12;

    state.order = {
        size: state.sizeKey, shape, tops,
        bake: [clamp(bakeCenter - bakeWidth / 2, 0.15, 0.85), clamp(bakeCenter + bakeWidth / 2, 0.20, 0.95)],
        pour: [clamp(pourCenter - pourWidth / 2, 0.55, 0.95), clamp(pourCenter + pourWidth / 2, 0.60, 0.98)],
    };
    state.phase = 'pour'; state.fillPct = 0; state.placed = [];
    state.baking = { running: false, dur: 2800 + Math.floor(Math.random() * 900), p: 0, zone: [...state.order.bake], inWin: false, attempted: false, locked: false };
    state.scores = { pour: 0, top: 0, bake: 0, q: 0, qty: 0 };
    
    const shapeSelect = $('#shape-select');
    if (shapeSelect) shapeSelect.value = shape;
    
    updateMold();
    updateFillUI();
    renderOrder();
    
    $('#dropzone')?.remove();
    const dropzone = document.createElement('div');
    dropzone.id = 'dropzone';
    dropzone.className = 'build-dropzone';
    $('.build-stage')?.appendChild(dropzone);
    
    $('#placed-count').textContent = '0';
    updateHitWindowUI();
    renderScores();
}

function wireEvents() {
    $('#btn-prev')?.addEventListener('click', () => { /* ... cod ... */ });
    $('#btn-next')?.addEventListener('click', () => { /* ... cod ... */ });
    $('#btn-new-order')?.addEventListener('click', () => { newOrder(); setPhase('pour'); });
    const pourHoldBtn = $('#btn-pour-hold');
    pourHoldBtn?.addEventListener('pointerdown', (e) => { /* ... cod ... */ });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => pourHoldBtn?.addEventListener(ev, () => { clearInterval(pourTimer); pourTimer = null; }));
    $('#pour-range')?.addEventListener('input', (e) => { /* ... cod ... */ });
    $('#size-range')?.addEventListener('input', (e) => { /* ... cod ... */ });
    $('#shape-select')?.addEventListener('change', (e) => { /* ... cod ... */ });
    $('#btn-bake-start')?.addEventListener('click', startBake);
    $('#btn-bake-stop')?.addEventListener('click', stopBake);
    document.addEventListener('keydown', (e) => { /* ... cod ... */ });
    $('#btn-serve')?.addEventListener('click', serveClient);
    $('#btn-audio')?.addEventListener('click', (e) => { /* ... cod ... */ });
    $('#btn-reset')?.addEventListener('click', async () => { /* ... cod ... */ });
}

// ---------- Init ----------
async function mount() {
    buildPalette();
    wireEvents();
    const sizeLabel = $('#size-label'), sizeRange = $('#size-range');
    if (sizeLabel && sizeRange) {
        const map = { 1: 'S', 2: 'M', 3: 'L' };
        sizeLabel.textContent = map[sizeRange.value] || 'M';
    }
    newOrder();
    setPhase('pour');
    await refreshTopbar();
    setInterval(() => refreshTopbar(), 5000);
}

document.addEventListener('DOMContentLoaded', mount);