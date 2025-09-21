/**
 * FinKids Tycoon - Frontend logic (no modules)
 * Ce face:
 *  - Leaga UI + inputuri + canvas cu API-ul PHP.
 *  - Gestioneaza starea jocului (pour/decor/bake/serve) si scorurile.
 *
 * Dependente:
 *  - API JSON: game_assets/api.php (state/serve/reset)
 *  - Imagini:  game_assets/images/*
 *
 * Folosit de:
 *  - game.php
 */

// ---------- API bridge ----------
const API_BASE = 'game_assets/api.php';
const FK = {
  async state(){
    const r = await fetch(`${API_BASE}?action=state`, {cache:'no-store'});
    return r.json();
  },
  async serve(qty, q, inWin){
    const fd = new FormData();
    fd.append('qty', String(qty));
    fd.append('q', String(q));
    fd.append('inWin', inWin ? '1' : '0');
    const r = await fetch(`${API_BASE}?action=serve`, {method:'POST', body:fd});
    return r.json();
  },
  async reset(){
    const r = await fetch(`${API_BASE}?action=reset`, {cache:'no-store'});
    return r.json();
  }
};

// ---------- Utils ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const on = (sel, evt, handler) => $$(sel).forEach(node => node.addEventListener(evt, handler));
const setText = (target, text) => {
  const node = typeof target === 'string' ? $(target) : target;
  if (node) node.textContent = String(text);
};
const setFixed = (target, value, digits = 2) => {
  const node = typeof target === 'string' ? $(target) : target;
  if (node) node.textContent = Number(value || 0).toFixed(digits);
};
const toggleDisabled = (target, enabled) => {
  const node = typeof target === 'string' ? $(target) : target;
  if (!node) return;
  enabled ? node.removeAttribute('disabled') : node.setAttribute('disabled', 'true');
};

const SIZE_MAP = {1:'S',2:'M',3:'L'};
const SHAPE_LABEL = {circle:'Cerc', heart:'Inima', star:'Stea'};
const SHAPES = Object.keys(SHAPE_LABEL);
const randomOf = (arr) => arr[Math.floor(Math.random()*arr.length)];

// ---------- Ingredients ----------
const ING = [
  { id:'chocolate_chips', name:'Cipuri ciocolata' },
  { id:'strawberries',    name:'Capsuni' },
  { id:'coconut',         name:'Cocos' },
  { id:'sprinkles',       name:'Ornamente' },
  { id:'cacao',           name:'Cacao' },
  { id:'sugar',           name:'Zahar' },
];
const ING_MAP = Object.fromEntries(ING.map(item => [item.id, item]));

const TOP_IMG = {
  chocolate_chips: 'chocolate_chips.png',
  strawberries:    'strawberries.png',
  coconut:         'coconut.png',
  sprinkles:       'sprinkles.png',
  cacao:           'cacao.png',
  sugar:           'sugar.png',
};

const PHASES = ['pour','decorate','bake','serve'];

// ---------- Game state ----------
const state = {
  phase:'pour',
  order:null,        // {size, shape, tops[], bake:[a,b], pour:[a,b]}
  sizeKey:'M',
  fillPct:0,
  placed:[],
  baking:{ running:false, dur: 2800+Math.floor(Math.random()*900), p:0, zone:[0.52,0.62], inWin:false, attempted:false, locked:false },
  scores:{ pour:0, top:0, bake:0, q:0, qty:0 },
};
let bakeTimer=null, pourTimer=null;

// ---------- Audio ----------
let audioOn = true;
let __AC = null;
function getAC(){ if(!audioOn) return null; try{ __AC = __AC || new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} return __AC; }
function playDing(){ const ac=getAC(); if(!ac) return; const o=ac.createOscillator(), g=ac.createGain(); o.type='triangle'; o.frequency.setValueAtTime(880,ac.currentTime); o.frequency.linearRampToValueAtTime(1320,ac.currentTime+0.12); g.gain.setValueAtTime(0.0001,ac.currentTime); g.gain.exponentialRampToValueAtTime(0.06,ac.currentTime+0.02); g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+0.2); o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+0.22); }
function playBuzz(){ const ac=getAC(); if(!ac) return; const o=ac.createOscillator(), g=ac.createGain(); o.type='sawtooth'; o.frequency.value=220; g.gain.value=0.03; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(()=>{ try{o.stop();}catch(_){ } },120); }
function playPlop(){ const ac=getAC(); if(!ac) return; const o=ac.createOscillator(), g=ac.createGain(); o.type='square'; o.frequency.value=560+Math.random()*160; g.gain.value=0.04; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(()=>{ try{o.stop();}catch(_){ } },90); }

// ---------- Feedback ----------
function toast(msg){
  const host = document.querySelector('.toast-container');
  const d=document.createElement('div'); d.className='toast'; d.textContent=msg; host.appendChild(d);
  setTimeout(()=>{ try{ d.remove(); }catch(_){ } }, 1800);
}
function confettiAt(x,y,n=18){
  for(let i=0;i<n;i++){
    const d=document.createElement('div'); d.className='particle';
    const ang=Math.random()*Math.PI*2, dist=20+Math.random()*60;
    d.style.setProperty('--dx', Math.cos(ang)*dist+'px');
    d.style.setProperty('--dy', Math.sin(ang)*dist+'px');
    d.style.left=x+'px'; d.style.top=y+'px'; d.style.position='fixed';
    d.style.background=['#f3e38a','#f9a6a6','#a8d8f5','#c7f59e','#f7d57a'][i%5];
    d.style.animation='pop .7s ease-out forwards';
    document.body.appendChild(d); setTimeout(()=>{ try{ d.remove(); }catch(_){ } }, 800);
  }
}
function sprinkleAt(container, el){
  try{
    const rect=container.getBoundingClientRect();
    const r=el.getBoundingClientRect();
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    const xPct=((cx-rect.left)/rect.width)*100, yPct=((cy-rect.top)/rect.height)*100;
    for(let i=0;i<6;i++){
      const d=document.createElement('div'); d.className='particle';
      d.style.setProperty('--dx', (Math.random()*40-20)+'px');
      d.style.setProperty('--dy', (Math.random()*40-20)+'px');
      d.style.left=xPct+'%'; d.style.top=yPct+'%';
      d.style.background=['#f8c66a','#f5a8a8','#a8d8f5','#c7f59e','#f9f09a'][i%5];
      d.style.animation='pop .5s ease-out forwards';
      container.appendChild(d); setTimeout(()=>{ try{ d.remove(); }catch(_){ } }, 600);
    }
  }catch(_){}
}
function ovenPuff(success){
  const img=$('#oven-img'); if(!img) return;
  const r=img.getBoundingClientRect();
  confettiAt(r.left+r.width*0.5, r.top+r.height*0.15, success?16:8);
}

// ---------- UI helpers ----------
function setPhase(next){
  state.phase = next;

  // Stepper
  $$('#stepper li').forEach(li=>{
    const ph=li.getAttribute('data-phase');
    const idx=PHASES.indexOf(ph);
    const cur=PHASES.indexOf(next);
    li.classList.toggle('active', ph===next);
    li.classList.toggle('done', idx>-1 && idx<cur);
  });

  // Panels visibility
  $$('.tools--phase').forEach(sec=>{
    const ph=sec.getAttribute('data-phase');
    sec.classList.toggle('hidden', ph!==next);
  });

  // Buttons
  const canBakeStart = next==='bake' && !state.baking.locked && !state.baking.running;
  const canBakeStop  = next==='bake' && state.baking.running;
  const canServe     = next==='serve';

  toggleDisabled('#btn-bake-start', canBakeStart);
  toggleDisabled('#btn-bake-stop',  canBakeStop);
  toggleDisabled('#btn-serve',      canServe);
}

function updateMold(){
  if(!state.order) return;
  const mold=$('#shape-mold');
  if(!mold) return;
  mold.className = `shape shape--${state.order.shape || 'circle'}`;
  const sizePx = state.sizeKey==='S'?160 : state.sizeKey==='L'?240 : 200;
  mold.style.setProperty('--mold-size', sizePx+'px');
  const sel=$('#shape-select');
  if(sel && sel.value!==state.order.shape) sel.value = state.order.shape;
  setText('#ord-shape', SHAPE_LABEL[state.order.shape] || 'Cerc');
  setText('#ord-size', state.sizeKey);
}

function updateFillUI(){
  const fill=$('#shape-fill');
  if(!fill || !state.order) return;
  const pct=clamp(state.fillPct,0,1);
  const pct100=Math.round(pct*100);
  fill.style.height=pct100+'%';
  const [a,b]=state.order.pour;
  fill.classList.toggle('good', pct>=a && pct<=b);
  setText('#pour-pct', pct100);
  const slider=$('#pour-range');
  if(slider) slider.value = String(pct100);
  calcPourScore();
  renderScores();
}

function updateHitWindowUI(){
  if(!state.order) return;
  const [a,b]=state.order.bake;
  const span=document.querySelector('.hit-window span');
  if(span){
    span.style.left=Math.round(a*100)+'%';
    span.style.width=Math.round((b-a)*100)+'%';
  }
  setText('#bake-window-label', `${Math.round(a*100)}% - ${Math.round(b*100)}%`);
}

function buildPalette(){
  const wrap=$('#palette'); if(!wrap) return;
  wrap.innerHTML='';
  ING.forEach(ing=>{
    const b=document.createElement('button');
    b.type='button'; b.className='chip-btn';
    const imgSrc = 'game_assets/images/' + (TOP_IMG[ing.id] || 'sprinkles.png');
    b.innerHTML = `<img src="${imgSrc}" alt="${ing.name}"><span>${ing.name}</span>`;
    b.addEventListener('click', ()=> spawnChip(ing.id));
    wrap.appendChild(b);
  });
}

function spawnChip(id){
  const zone=$('#dropzone'); if(!zone) return;

  const chip=document.createElement('div');
  chip.className='chip'; chip.dataset.type=id;
  chip.style.left=(25+Math.random()*50)+'%';
  chip.style.top =(25+Math.random()*50)+'%';

  // imaginea efectiva a toppingului
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
  setText('#placed-count', state.placed.length);
  calcTopScore(); renderScores();
}

// ---------- Scoring ----------
function calcTopScore(){
  if(!state.order){ state.scores.top=0; return; }
  const placed = state.placed;
  let pts = state.order.tops.reduce((sum,id)=> sum + (placed.some(p=>p.id===id) ? 25 : 0), 0);
  pts = Math.min(100, pts);
  if(placed.length>1){
    const mx = placed.reduce((s,p)=>s+p.x,0)/placed.length;
    const my = placed.reduce((s,p)=>s+p.y,0)/placed.length;
    const spread = placed.reduce((s,p)=> s + Math.hypot(p.x-mx, p.y-my), 0);
    pts = clamp(pts + clamp(spread/(placed.length*20),0,1)*20, 0, 100);
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
  const {pour, top, bake, q, qty} = state.scores;
  [['#score-pour', pour], ['#score-top', top], ['#score-bake', bake], ['#score-qty', qty], ['#score-qty-serve', qty]]
    .forEach(([sel, val]) => setText(sel, val));
  ['#score-q', '#score-q-serve'].forEach(sel => setFixed(sel, q));
}

// ---------- Bake ----------
function startBake(){
  if(state.phase!=='bake' || state.baking.locked || state.baking.running) return;
  state.baking.running=true;
  state.baking.p=0;
  toggleDisabled('#btn-bake-start', false);
  toggleDisabled('#btn-bake-stop', true);
  const img=$('#oven-img');
  if(img) img.setAttribute('src','game_assets/images/oven_closed.png');
  const bar=$('#bake-bar');
  clearInterval(bakeTimer);
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
  clearInterval(bakeTimer);
  bakeTimer=null;
  toggleDisabled('#btn-bake-stop', false);
  const img=$('#oven-img');
  if(img) img.setAttribute('src','game_assets/images/oven_open.png');

  const p=state.baking.p, [a,b]=state.baking.zone;
  const c=(a+b)/2, maxD=Math.max(0.0001,(b-a)/2), d=Math.abs(p-c);
  const inWin = p>=a && p<=b;
  state.baking.inWin=inWin;
  state.baking.attempted=true;
  state.baking.locked=true;

  state.scores.bake = Math.round(clamp(100*(1-Math.min(1,d/maxD)), 0, 100));

  if(inWin){
    playDing();
    ovenPuff(true);
  } else {
    playBuzz();
    if(img){
      img.classList.add('shake');
      setTimeout(()=>img.classList.remove('shake'),380);
    }
    ovenPuff(false);
  }

  computeFinalScores();
  renderScores();
  setPhase('serve');
}

// ---------- Serve ----------
async function serveClient(){
  if(state.phase!=='serve') return void toast('Finalizeaza coacerea inainte de servire.');
  computeFinalScores();
  const q=state.scores.q||0.86;
  const qty=state.scores.qty||8;
  const inWin = !!state.baking.inWin;

  try{
    const res = await FK.serve(qty, q, inWin);
    if(res?.ok){
      const btn=$('#btn-serve');
      if(btn){
        const r=btn.getBoundingClientRect();
        confettiAt(r.left+r.width/2, r.top+r.height/2, 24);
      }
      toast(`Servit! +${qty} stoc, Q ${q.toFixed(2)}`);
      await refreshTopbar();
      newOrder();
      setPhase('pour');
    } else {
      toast('Eroare la servire.');
    }
  }catch(e){
    console.error(e);
    toast('Eroare de retea la servire.');
  }
}

// ---------- Order / topbar ----------
function renderOrder(){
  if(!state.order) return;
  const {shape, size, bake, tops} = state.order;
  setText('#ord-shape', SHAPE_LABEL[shape] || 'Cerc');
  setText('#ord-size', size);
  setText('#ord-bake', `${Math.round(bake[0]*100)}% - ${Math.round(bake[1]*100)}%`);
  const ul=$('#ord-tops');
  if(ul){
    ul.innerHTML='';
    tops.forEach(id=>{
      const li=document.createElement('li');
      li.textContent = ING_MAP[id]?.name || id;
      ul.appendChild(li);
    });
  }
}
async function refreshTopbar(){
  try{
    const s = await FK.state();
    if(!s?.ok) return;
    setText('#g-stock', s.stock?.units ?? 0);
    const pct = Math.round(s.boost?.percent || 0);
    const buffCount = s.boost?.buffs?.length || 0;
    setText('#g-boost', `${pct}%${buffCount ? ` (${buffCount})` : ''}`);
  }catch(_){}
}

function newOrder(){
  const slider=$('#size-range');
  state.sizeKey = SIZE_MAP[Number(slider?.value||2)] || 'M';

  const shape = randomOf(SHAPES);
  const tops = ING.slice().sort(()=>Math.random()-0.5).slice(0, 2+Math.floor(Math.random()*3)).map(t=>t.id);

  const bakeCenter = 0.54 + (Math.random()*0.06 - 0.03);
  const bakeWidth  = 0.08 + Math.random()*0.04;
  const pourCenter = 0.80 + (Math.random()*0.06 - 0.03);
  const pourWidth  = 0.12;

  state.order = {
    size: state.sizeKey,
    shape,
    tops,
    bake: [clamp(bakeCenter-bakeWidth/2, 0.15, 0.85), clamp(bakeCenter+bakeWidth/2, 0.20, 0.95)],
    pour: [clamp(pourCenter-pourWidth/2, 0.55, 0.95), clamp(pourCenter+pourWidth/2, 0.60, 0.98)],
  };

  state.phase='pour';
  state.fillPct=0;
  state.placed=[];
  state.baking={ running:false, dur:2800+Math.floor(Math.random()*900), p:0, zone:[...state.order.bake], inWin:false, attempted:false, locked:false };
  state.scores={ pour:0, top:0, bake:0, q:0, qty:0 };
  clearInterval(bakeTimer); bakeTimer=null;
  clearInterval(pourTimer); pourTimer=null;

  const sel=$('#shape-select'); if(sel) sel.value=shape;
  updateMold();
  updateFillUI();
  renderOrder();
  const zone=$('#dropzone'); if(zone) zone.innerHTML='';
  setText('#placed-count', 0);
  updateHitWindowUI();
  renderScores();
}

// ---------- Events ----------
function wireEvents(){
  on('#btn-prev', 'click', () => {
    if(state.phase==='bake' && state.baking.running){ toast('Opreste coacerea mai intai.'); return; }
    const idx=Math.max(0, PHASES.indexOf(state.phase)-1);
    setPhase(PHASES[idx]);
  });
  on('#btn-next', 'click', () => {
    const phase = state.phase;
    if(phase==='pour'){
      if(!state.order) return;
      if(state.fillPct < state.order.pour[0]) return void toast('Toarna putin mai mult!');
    }
    if(phase==='decorate' && state.placed.length<2) return void toast('Adauga cel putin doua toppinguri.');
    if(phase==='bake'){
      if(state.baking.running) return void toast('Opreste coacerea mai intai.');
      if(!state.baking.attempted) return void toast('Porneste coacerea inainte de a continua.');
    }
    const idx=Math.min(PHASES.length-1, PHASES.indexOf(phase)+1);
    setPhase(PHASES[idx]);
  });

  on('#btn-new-order', 'click', () => { newOrder(); setPhase('pour'); });

  const pourBtn=$('#btn-pour-hold');
  if(pourBtn){
    pourBtn.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      clearInterval(pourTimer);
      pourTimer=setInterval(()=>{
        state.fillPct=clamp(state.fillPct+0.01,0,1);
        updateFillUI();
      }, 70);
    });
    ['pointerup','pointerleave','pointercancel'].forEach(ev => pourBtn.addEventListener(ev, ()=>{
      clearInterval(pourTimer);
      pourTimer=null;
    }));
  }
  $('#pour-range')?.addEventListener('input', (e)=>{
    state.fillPct=clamp(Number(e.target.value||0)/100,0,1);
    updateFillUI();
  });

  buildPalette();

  $('#size-range')?.addEventListener('input', (e)=>{
    state.sizeKey = SIZE_MAP[Number(e.target.value||2)] || 'M';
    setText('#size-label', state.sizeKey);
    updateMold();
    computeFinalScores();
    renderScores();
  });
  $('#shape-select')?.addEventListener('change', (e)=>{
    if(!state.order) return;
    state.order.shape = e.target.value || 'circle';
    updateMold();
  });

  on('#btn-bake-start', 'click', startBake);
  on('#btn-bake-stop', 'click', stopBake);
  document.addEventListener('keydown', (e)=>{
    if(e.code==='Space' && state.phase==='bake'){
      e.preventDefault();
      if(state.baking.running) stopBake();
    }
  });

  on('#btn-serve', 'click', serveClient);

  on('#btn-audio', 'click', (e) => {
    audioOn = !audioOn;
    e.currentTarget.setAttribute('aria-pressed', audioOn ? 'true' : 'false');
    e.currentTarget.textContent = audioOn ? 'Sunet' : 'Mut';
    toast(audioOn ? 'Sunet activat' : 'Sunet oprit');
  });

  on('#btn-reset', 'click', async () => {
    try{
      await FK.reset();
      await refreshTopbar();
      toast('Sesiune resetata.');
    }catch(_){ }
  });
}

// ---------- Init ----------
async function mount(){
  wireEvents();
  const slider=$('#size-range');
  if(slider) setText('#size-label', SIZE_MAP[Number(slider.value||2)] || 'M');
  newOrder();
  updateHitWindowUI();
  setPhase('pour');
  await refreshTopbar();
  setInterval(refreshTopbar, 4000);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
