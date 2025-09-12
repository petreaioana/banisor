// assets/js/game/game.js
// =====================================================
// FinKids Tycoon — Joc manual (Turnare → Decor → Coacere → Servire)
// - Canvas 100% HTML/CSS (cerc/inimă/stea) + umplere animată
// - Etape ghidate cu stepper: pour → decorate → bake → serve
// - O SINGURĂ coacere per comandă (fără bucle)
// - Scoruri: turnare, decor, coacere → Q & qty
// - Serve: consumă ingrediente rețetă produs activ + adaugă în stoc
// - Buff/efecte pentru coacere reușită, confetti/particule & SFX
// =====================================================

import { FK } from '../shared/state.js';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

// ---------- Config ingrediente (paletă) ----------
const ING = [
  {id:'chocolate_chips', name:'Cipuri ciocolată'},
  {id:'strawberries',    name:'Căpșuni'},
  {id:'coconut',         name:'Cocos'},
  {id:'sprinkles',       name:'Ornamente'},
  {id:'cacao',           name:'Cacao'},
  {id:'sugar',           name:'Zahăr'}
];

const PHASES = ['pour','decorate','bake','serve'];

// ---------- Stare joc ----------
let state = {
  phase: 'pour',               // pour | decorate | bake | serve
  order: null,                 // {size, shape, tops[], bake:[a,b], pour:[min,max]}
  placed: [],                  // [{id, x%, y%}]
  fillPct: 0,                  // 0..1 (umplere turnare)
  baking: { running:false, dur:3000, p:0, zone:[0.52,0.62], inWin:false, attempted:false, locked:false },
  sizeKey: 'M',                // S|M|L
  scores: { pour:0, top:0, bake:0, q:0, qty:0 }
};
let bakeTimerId = null;

// ---------- Audio ----------
let __AC=null;
function getAC(){ try{ __AC = __AC || new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} return __AC; }
function playDing(){ try{ const ac=getAC(); if(!ac) return; const o=ac.createOscillator(); const g=ac.createGain(); o.type='triangle'; o.frequency.setValueAtTime(880, ac.currentTime); o.frequency.linearRampToValueAtTime(1320, ac.currentTime+0.12); g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.06, ac.currentTime+0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime+0.2); o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+0.22);}catch(e){} }
function playBuzz(){ try{ const ac=getAC(); if(!ac) return; const o=ac.createOscillator(); const g=ac.createGain(); o.type='sawtooth'; o.frequency.value=220; g.gain.value=0.03; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(()=>{ try{o.stop();}catch(e){} },120);}catch(e){} }
function playPlop(){ try{ const ac=getAC(); if(!ac) return; const o=ac.createOscillator(); const g=ac.createGain(); o.type='square'; o.frequency.value=560+Math.random()*160; g.gain.value=0.04; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(()=>o.stop(), 90);}catch(e){} }

// ---------- Particule ----------
function confetti(x,y,count=18){
  try{
    for(let i=0;i<count;i++){
      const d=document.createElement('div'); d.className='particle';
      const ang=Math.random()*Math.PI*2, dist=20+Math.random()*60;
      d.style.setProperty('--dx', Math.cos(ang)*dist+'px');
      d.style.setProperty('--dy', Math.sin(ang)*dist+'px');
      d.style.left=x+'px'; d.style.top=y+'px';
      d.style.background=['#f3e38a','#f9a6a6','#a8d8f5','#c7f59e','#f7d57a'][i%5];
      d.style.position='fixed'; d.style.animation='pop .7s ease-out forwards';
      document.body.appendChild(d); setTimeout(()=>d.remove(), 800);
    }
  }catch(_){}
}
function ovenPuff(success){
  const oi=$('#oven-img'); if(!oi) return;
  const r=oi.getBoundingClientRect();
  confetti(r.left + r.width*0.5, r.top + r.height*0.15, success?16:8);
}

// ---------- UI bootstrap (inserăm dacă lipsesc) ----------
function ensureCanvas(){
  const stage=$('.build-stage'); if(!stage) return;
  // curățăm vechea imagine bază, dacă există
  const oldImg=$('#build-base'); if(oldImg) oldImg.remove();

  if(!$('#shape')){
    const wrap=document.createElement('div');
    wrap.id='shape'; wrap.className='shape shape--circle';
    wrap.innerHTML=`
      <div class="shape-base"></div>
      <div id="shape-fill" class="shape-fill"></div>
      <div id="build-drop" class="build-dropzone" aria-label="Zonă plasare toppinguri"></div>`;
    stage.appendChild(wrap);
  }

  if(!$('.canvas-controls')){
    const panel = stage.parentElement;
    const box = document.createElement('div');
    box.className='canvas-controls';
    box.innerHTML = `
      <div class="row">
        <label for="shape-select">Formă:</label>
        <select id="shape-select">
          <option value="circle">Cerc</option>
          <option value="heart">Inimă</option>
          <option value="star">Stea</option>
        </select>
        <span class="sep">•</span>
        Dimensiune:
        <input id="size-range" type="range" min="1" max="3" step="1" value="2" aria-label="Dimensiune aluat (S/M/L)">
      </div>
      <div class="row">
        <button id="btn-pour-hold" class="btn">Ține pentru turnare</button>
        <input id="pour-range" type="range" min="0" max="100" step="1" value="0" aria-label="Procent umplere">
        <b id="pour-pct">0%</b>
      </div>`;
    panel.appendChild(box);
  }

  if(!$('#build-palette')){
    const pal=document.createElement('div'); pal.id='build-palette'; pal.className='palette';
    stage.parentElement.appendChild(pal);
  }
}
function ensureStepper(){
  if($('#stepper')) return;
  const bar = document.createElement('nav'); bar.id='stepper';
  bar.innerHTML = `
    <ol>
      <li data-phase="pour">🫙 Turnare</li>
      <li data-phase="decorate">🍬 Decor</li>
      <li data-phase="bake">🔥 Coacere</li>
      <li data-phase="serve">🧁 Servire</li>
    </ol>`;
  document.body.insertBefore(bar, document.body.firstChild.nextSibling || document.body.firstChild);
}

function buildPalette(){
  const wrap=$('#build-palette'); if(!wrap) return; wrap.innerHTML='';
  ING.forEach(ing=>{
    const b=document.createElement('button'); b.type='button'; b.className='chip-btn';
    b.innerHTML=`<i data-type="${ing.id}"></i><span>${ing.name}</span>`;
    b.addEventListener('click', ()=> spawnChip(ing.id));
    wrap.appendChild(b);
  });
}

// ---------- Helper UI ----------
function setPhase(next){
  state.phase = next;
  // Stepper UI
  $$('#stepper li').forEach(li=>{
    const ph=li.getAttribute('data-phase');
    li.classList.toggle('active', ph===next);
    const idx = PHASES.indexOf(ph);
    const cur = PHASES.indexOf(next);
    li.classList.toggle('done', idx < cur);
  });

  // Tool visibility (implicit: toate vizibile, dar marcăm starea la butoane)
  $('#btn-bake')?.toggleAttribute('disabled', !(next==='bake' && !state.baking.locked));
  $('#btn-stop')?.toggleAttribute('disabled', !(next==='bake' && state.baking.running));
  $('#btn-serve')?.toggleAttribute('disabled', !(next==='serve'));
}

function updateShapeUI(){
  const shape=$('#shape'); if(!shape) return;
  shape.className='shape shape--'+(state.order.shape||'circle');
  const sz = state.sizeKey==='S'?150 : state.sizeKey==='L'?220 : 190;
  shape.style.setProperty('--mold-size', sz+'px');
}

function updateFillUI(){
  const fill=$('#shape-fill'); if(!fill) return;
  fill.style.height = Math.round(state.fillPct*100)+'%';
  fill.classList.toggle('good', state.fillPct >= state.order.pour[0] && state.fillPct <= state.order.pour[1]);
  const pctEl=$('#pour-pct'); if(pctEl) pctEl.textContent = Math.round(state.fillPct*100)+'%';
  const rng=$('#pour-range'); if(rng) rng.value = String(Math.round(state.fillPct*100));
  calcPourScore();
  renderScores();
}

function updateHitWindowUI(){
  const span=document.querySelector('.hit-window span'); if(!span||!state.order) return;
  const [a,b]=state.order.bake;
  span.style.left=Math.round(a*100)+'%';
  span.style.width=Math.round((b-a)*100)+'%';
  span.classList.add('pulse');
}

function renderOrder(){
  $('#ord-size')?.replaceChildren(document.createTextNode(state.order.size));
  const ul=$('#ord-tops'); if(ul){ ul.innerHTML=''; state.order.tops.forEach(id=>{ const li=document.createElement('li'); li.textContent = (ING.find(i=>i.id===id)?.name || id); ul.appendChild(li); }); }
  $('#ord-bake')?.replaceChildren(document.createTextNode(`${Math.round(state.order.bake[0]*100)}–${Math.round(state.order.bake[1]*100)}%`));
  // (opțional) afișează forma
  const card=$('#order-card');
  if(card && !card.querySelector('.shape-line')){
    const p=document.createElement('div'); p.className='shape-line small muted'; card.appendChild(p);
  }
  card?.querySelector('.shape-line')?.replaceChildren(document.createTextNode(`Formă: ${shapeLabel(state.order.shape)} · Țintă turnare: ${Math.round(state.order.pour[0]*100)}–${Math.round(state.order.pour[1]*100)}%`));
}

function shapeLabel(s){ return s==='heart'?'Inimă':s==='star'?'Stea':'Cerc'; }
function productName(){
  const S=FK.getState(); const k=(FK.getActiveProductKey&&FK.getActiveProductKey())||'croissant';
  return S.products?.[k]?.name || 'Produs';
}
function updateTopbar(){
  try{
    const k = (FK.getActiveProductKey && FK.getActiveProductKey()) || 'croissant';
    $('#g-stock') && ($('#g-stock').textContent = FK.totalStock(k));
    const S=FK.getState(); const cnt=(S.boost?.buffs?.length)||0;
    $('#g-boost') && ($('#g-boost').textContent = Math.round(S.boost.percent||0)+'%'+(cnt>0?` (${cnt})`:'')); 
  }catch(_){}
}
function toast(msg){
  const d=document.createElement('div');
  d.textContent=msg; d.className='toast';
  let host=document.querySelector('.toast-container'); if(!host){ host=document.createElement('div'); host.className='toast-container'; document.body.appendChild(host); }
  host.appendChild(d); setTimeout(()=>{ try{ d.remove(); }catch(_){ } }, 1800);
}

// ---------- New Order ----------
function newOrder(){
  // Dimensiune din slider existent (dacă nu e, default M)
  const slider = $('#size-range'); const map={1:'S',2:'M',3:'L'};
  const size = map[ Number(slider?.value||2) ] || 'M';
  state.sizeKey = size;

  // Formă aleatoare
  const shapes=['circle','heart','star'];
  const shape = shapes[Math.floor(Math.random()*shapes.length)];

  // Toppinguri cerute 2..4
  const count = 2 + Math.floor(Math.random()*3);
  const tops = ING.slice().sort(()=>Math.random()-0.5).slice(0,count).map(t=>t.id);

  // Ferestre: coacere & turnare
  const bakeCenter = 0.54 + (Math.random()*0.06-0.03); // ~0.51..0.57
  const bakeWidth  = 0.08 + Math.random()*0.04;         // 8..12%
  const pourCenter = 0.80 + (Math.random()*0.06-0.03);  // 77..83%
  const pourWidth  = 0.12;                               // ±6%

  state.order = {
    size, shape, tops,
    bake: [clamp(bakeCenter-bakeWidth/2, 0.15, 0.85), clamp(bakeCenter+bakeWidth/2, 0.2, 0.95)],
    pour: [clamp(pourCenter-pourWidth/2, 0.55, 0.95), clamp(pourCenter+pourWidth/2, 0.60, 0.98)]
  };

  // reset stage
  state.phase='pour';
  state.placed=[];
  state.fillPct=0;
  state.baking={ running:false, dur:2800+Math.floor(Math.random()*900), p:0, zone:[...state.order.bake], inWin:false, attempted:false, locked:false };
  state.scores={ pour:0, top:0, bake:0, q:0, qty:0 };

  // UI
  updateShapeUI();
  updateFillUI();
  renderOrder();
  renderBuildFromState();
  updateHitWindowUI();
  setPhase('pour');
  updateTopbar();
}

// ---------- Drag & Drop toppinguri ----------
function spawnChip(id){
  const zone=$('#build-drop'); if(!zone) return;
  const chip=document.createElement('div');
  chip.className='chip'; chip.dataset.type=id;
  styleChip(chip, id);

  // random pos %
  const rx=25+Math.random()*50, ry=25+Math.random()*50;
  chip.style.left=rx+'%'; chip.style.top=ry+'%';

  let dragging=false, sx=0, sy=0, ox=0, oy=0, pid=0;

  const start=(e)=>{ dragging=true; pid=e.pointerId||0; chip.setPointerCapture && chip.setPointerCapture(pid); sx=e.clientX; sy=e.clientY; const r=chip.getBoundingClientRect(); ox=r.left; oy=r.top; chip.style.cursor='grabbing'; };
  const move=(e)=>{ if(!dragging) return; const dx=e.clientX-sx, dy=e.clientY-sy; const parent=zone.getBoundingClientRect(); const nx=((ox+dx)-parent.left)/parent.width*100; const ny=((oy+dy)-parent.top)/parent.height*100; chip.style.left=clamp(nx,5,95)+'%'; chip.style.top=clamp(ny,5,95)+'%'; };
  const end=()=>{ dragging=false; chip.style.cursor='move'; try{ chip.releasePointerCapture && chip.releasePointerCapture(pid); }catch(_){}
    sprinkleAt(zone, chip);
    playPlop();
    savePlaced();
  };

  chip.addEventListener('pointerdown', start, {passive:true});
  chip.addEventListener('pointermove', move);
  chip.addEventListener('pointerup', end, {passive:true});

  zone.appendChild(chip);
  savePlaced();
}
function sprinkleAt(container, el){
  try{
    const rect=container.getBoundingClientRect(); const r=el.getBoundingClientRect();
    const xPct=((r.left + r.width/2 - rect.left)/rect.width)*100; const yPct=((r.top + r.height/2 - rect.top)/rect.height)*100;
    for(let i=0;i<6;i++){
      const d=document.createElement('div'); d.className='particle';
      const dx=(Math.random()*40-20)+'px'; const dy=(Math.random()*40-20)+'px';
      d.style.setProperty('--dx', dx); d.style.setProperty('--dy', dy);
      d.style.left=xPct+'%'; d.style.top=yPct+'%';
      d.style.background=['#f8c66a','#f5a8a8','#a8d8f5','#c7f59e','#f9f09a'][i%5]; d.style.animation='pop .5s ease-out forwards';
      container.appendChild(d); setTimeout(()=>d.remove(), 600);
    }
  }catch(_){}
}
function styleChip(chip, type){
  const gradients={
    chocolate_chips:'radial-gradient(circle at 60% 40%, #6a3b1e, #4b2813)',
    strawberries:'radial-gradient(circle at 60% 40%, #ff6b6b, #d23b3b)',
    coconut:'linear-gradient(45deg, #fff, #f3f3f3)',
    sprinkles:'repeating-linear-gradient(45deg, #ffeea8, #ffeea8 6px, #ffd77a 6px, #ffd77a 12px)',
    cacao:'linear-gradient(45deg, #5a341c, #3b220f)',
    sugar:'repeating-linear-gradient(45deg, #fff, #fff 4px, #f2f2f2 4px, #f2f2f2 8px)'
  };
  chip.style.background = gradients[type] || '#eee';
}

function savePlaced(){
  const chips=[...document.querySelectorAll('.chip')];
  state.placed = chips.map(el=>{
    return { id: el.dataset.type||'unknown', x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
  });
  $('#build-count') && ($('#build-count').textContent = String(state.placed.length));
  calcTopScore();
  renderScores();
}

function calcTopScore(){
  if(!state.order) return;
  const want = new Set(state.order.tops);
  const have = new Set(state.placed.map(p=>p.id));
  let pts = 0;
  want.forEach(id=>{ if(have.has(id)) pts += 25; });
  pts = Math.min(100, pts);

  // Împrăștiere
  if(state.placed.length>1){
    const mx = state.placed.reduce((s,p)=>s+p.x,0)/state.placed.length;
    const my = state.placed.reduce((s,p)=>s+p.y,0)/state.placed.length;
    let spread=0; state.placed.forEach(p=>{ const dx=p.x-mx, dy=p.y-my; spread+=Math.sqrt(dx*dx+dy*dy); });
    const spreadScore = clamp(spread/(state.placed.length*20), 0, 1)*20;
    pts = clamp(pts + spreadScore, 0, 100);
  }
  state.scores.top = Math.round(pts);
}

// ---------- Turnare ----------
let pourHoldTimer=null;
function startPourHold(){
  clearInterval(pourHoldTimer);
  pourHoldTimer = setInterval(()=>{
    state.fillPct = clamp(state.fillPct + 0.01, 0, 1);
    updateFillUI();
  }, 70);
}
function endPourHold(){
  clearInterval(pourHoldTimer);
  pourHoldTimer=null;
}

$('#pour-range')?.addEventListener('input', (e)=>{
  state.fillPct = clamp((Number(e.target.value)||0)/100, 0, 1);
  updateFillUI();
});

function calcPourScore(){
  if(!state.order) return;
  const [a,b] = state.order.pour;
  const center=(a+b)/2;
  const width=(b-a)/2;
  const d = Math.abs(state.fillPct - center);
  let score;
  if(d<=width) score = 70 + (1 - d/width)*30; // 70..100 în interior
  else {
    const far = Math.min(1, (d-width)/0.25); // penalizare dacă e prea mult sau prea puțin
    score = Math.max(0, 70 - far*60);        // scade până la 10
  }
  state.scores.pour = Math.round(clamp(score, 0, 100));
}

// ---------- Coacere (un singur ciclu) ----------
function startBake(){
  if(state.baking.locked || state.baking.running) return; // un singur ciclu
  state.baking.running=true;
  state.baking.p=0;
  $('#btn-bake')?.setAttribute('disabled','true');
  $('#btn-stop')?.removeAttribute('disabled');
  $('#oven-img')?.setAttribute('src','images/oven_closed.png');

  const bar = $('#bake-bar');
  clearInterval(bakeTimerId);
  bakeTimerId = setInterval(()=>{
    const dt = 100;
    state.baking.p = clamp(state.baking.p + dt/state.baking.dur, 0, 1);
    const ease=(t)=>{ if(t<0.2) return t*t*2.5; if(t>0.8) return 0.8+(t-0.8)*0.85; return t; };
    if(bar){ bar.style.width = (ease(state.baking.p)*100)+'%'; bar.classList.toggle('pulse', state.baking.p>0.8); }
    if(state.baking.p>=1){ stopBake(); }
  }, 100);
  setPhase('bake');
}

function stopBake(){
  if(!state.baking.running) return;
  state.baking.running=false;
  clearInterval(bakeTimerId);
  bakeTimerId=null;
  $('#btn-stop')?.setAttribute('disabled','true');
  $('#oven-img')?.setAttribute('src','images/oven_open.png');

  const p=state.baking.p;
  const [a,b]=state.baking.zone;
  const center=(a+b)/2; const d=Math.abs(p-center); const maxD=(b-a)/2 || 0.001;
  const inWin = p>=a && p<=b;
  state.baking.inWin = inWin;
  state.baking.attempted = true;
  state.baking.locked = true; // blocăm reluarea coacerii la această comandă

  let bakeScore = clamp(100*(1 - Math.min(1, d/maxD)), 0, 100);
  state.scores.bake = Math.round(bakeScore);

  if(inWin){
    try{ FK.addBuff({id:'freshBake', label:'Coacere perfectă', minutes:45, qBonus:0.02, trafficMult:1.08}); }catch(_){}
    playDing(); ovenPuff(true);
  }else{
    playBuzz(); $('#oven-img')?.classList.add('shake'); setTimeout(()=>$('#oven-img')?.classList.remove('shake'), 380);
    ovenPuff(false);
  }

  computeFinalScores();
  // Trecem la servire, deoarece avem un singur ciclu
  setPhase('serve');
}

// ---------- Scoruri finale ----------
function computeFinalScores(){
  // Ponderi: pour 30%, decor 40%, bake 30%
  const wPour=0.30, wTop=0.40, wBake=0.30;
  const p = clamp(state.scores.pour/100, 0, 1);
  const t = clamp(state.scores.top/100,  0, 1);
  const b = clamp(state.scores.bake/100, 0, 1);
  const q = clamp(0.82 + (p*0.06*wPour + t*0.10*wTop + b*0.08*wBake), 0.82, 0.98);

  // qty: bazat pe mărime + mic bonus pt. turnare „plină” și nr. toppinguri
  const sizeMap={S:8, M:10, L:12};
  const qtyBase=sizeMap[state.sizeKey]||10;
  const qty = clamp(qtyBase + Math.round(state.fillPct*3) + Math.floor(state.placed.length/3), 6, 18);

  state.scores.q = Number(q.toFixed(2));
  state.scores.qty = qty;
  renderScores();
}

function renderScores(){
  $('#score-top')   && ($('#score-top').textContent  = state.scores.top);
  $('#score-bake')  && ($('#score-bake').textContent = state.scores.bake);
  $('#score-q')     && ($('#score-q').textContent    = (state.scores.q||0).toFixed(2));
  $('#score-qty')   && ($('#score-qty').textContent  = String(state.scores.qty||0));
}

// ---------- Serve ----------
function serveClient(){
  if(state.phase!=='serve'){ toast('Finalizează coacerea înainte de servire.'); return; }

  computeFinalScores();
  const q  = state.scores.q   || 0.86;
  const qty= state.scores.qty || 8;

  // Produsul activ și rețeta aferentă
  const S = FK.getState();
  const k = (FK.getActiveProductKey && FK.getActiveProductKey()) || 'croissant';
  const rid = (S.products?.[k]?.recipeId) || 'croissant_plain';

  // Verifică ingrediente
  if(!FK.canProduce(rid, qty)) { toast('⚠️ Stoc ingrediente insuficient'); return; }

  // Consumă ingrediente + adaugă în stoc produsul activ
  FK.consumeFor(rid, qty);
  FK.addInventory(k, qty, q);

  // Efect suplimentar dacă coacerea a fost în fereastra ideală
  if(state.baking.inWin){
    try{ FK.addBuff({id:'partySprinkles', label:'Yay! Party time', minutes:30, trafficMult:1.05}); }catch(_){}
  }

  // Confetti
  const btn=$('#btn-serve'); if(btn){ const r=btn.getBoundingClientRect(); confetti(r.left+r.width/2, r.top+r.height/2, 24); }
  toast(`✅ Servit ${productName()}! +${qty} stoc · Q ${q.toFixed(2)}`);
  updateTopbar();

  // Comandă nouă
  newOrder();
  setPhase('pour');
}

// ---------- Build zone helpers ----------
function renderBuildFromState(){
  const drop=$('#build-drop'); if(!drop) return;
  drop.innerHTML=''; // reset
  state.placed.forEach(p=>{
    const chip=document.createElement('div');
    chip.className='chip'; chip.dataset.type=p.id;
    styleChip(chip, p.id);
    chip.style.left=p.x+'%'; chip.style.top=p.y+'%';
    // reatașăm drag
    let dragging=false, sx=0, sy=0, ox=0, oy=0, pid=0;
    const start=(e)=>{ dragging=true; pid=e.pointerId||0; chip.setPointerCapture && chip.setPointerCapture(pid); sx=e.clientX; sy=e.clientY; const r=chip.getBoundingClientRect(); ox=r.left; oy=r.top; chip.style.cursor='grabbing'; };
    const move=(e)=>{ if(!dragging) return; const dx=e.clientX-sx, dy=e.clientY-sy; const parent=drop.getBoundingClientRect(); const nx=((ox+dx)-parent.left)/parent.width*100; const ny=((oy+dy)-parent.top)/parent.height*100; chip.style.left=clamp(nx,5,95)+'%'; chip.style.top=clamp(ny,5,95)+'%'; };
    const end=()=>{ dragging=false; chip.style.cursor='move'; try{ chip.releasePointerCapture && chip.releasePointerCapture(pid); }catch(_){}
      sprinkleAt(drop, chip); playPlop(); savePlaced();
    };
    chip.addEventListener('pointerdown', start, {passive:true});
    chip.addEventListener('pointermove', move);
    chip.addEventListener('pointerup', end, {passive:true});
    drop.appendChild(chip);
  });
  $('#build-count') && ($('#build-count').textContent = String(state.placed.length));
  calcTopScore();
}

// ---------- Event wiring ----------
function wireEvents(){
  // Step buttons
  $('#btn-prev')?.addEventListener('click', ()=>{
    const i = Math.max(0, PHASES.indexOf(state.phase)-1);
    const next = PHASES[i];
    if(state.phase==='bake' && state.baking.running){ toast('Oprește coacerea mai întâi.'); return; }
    setPhase(next);
  });
  $('#btn-next')?.addEventListener('click', ()=>{
    const i = Math.min(PHASES.length-1, PHASES.indexOf(state.phase)+1);
    // Validări soft
    if(state.phase==='pour'){
      if(state.fillPct < state.order.pour[0]){ toast('Toarnă puțin mai mult!'); return; }
    }
    if(state.phase==='decorate'){
      if(state.placed.length < 2){ toast('Adaugă cel puțin două toppinguri.'); return; }
    }
    if(state.phase==='bake'){
      if(!state.baking.attempted){ toast('Pornește coacerea înainte de a continua.'); return; }
    }
    setPhase(PHASES[i]);
  });

  // Comandă nouă
  $('#btn-new-order')?.addEventListener('click', ()=>{ newOrder(); setPhase('pour'); });

  // Bake controls
  $('#btn-bake')?.addEventListener('click', startBake);
  $('#btn-stop')?.addEventListener('click', stopBake);
  document.addEventListener('keydown', (e)=>{ if(e.code==='Space'){ e.preventDefault(); if(state.baking.running) stopBake(); } });

  // Serve
  $('#btn-serve')?.addEventListener('click', serveClient);

  // Canvas controls
  $('#shape-select')?.addEventListener('change', (e)=>{ state.order.shape = e.target.value; updateShapeUI(); });
  // dimensiune slider (dacă există deja în HTML, suprascriem)
  $('#size-range')?.addEventListener('input', (e)=>{
    const v = Number(e.target.value||2); const map={1:'S',2:'M',3:'L'};
    state.sizeKey = map[v] || 'M';
    updateShapeUI();
    computeFinalScores();
  });

  const holdBtn = $('#btn-pour-hold');
  if(holdBtn){
    holdBtn.addEventListener('pointerdown', (e)=>{ e.preventDefault(); startPourHold(); holdBtn.classList.add('bounce'); setTimeout(()=>holdBtn.classList.remove('bounce'), 600); });
    ['pointerup','pointerleave','pointercancel'].forEach(ev=> holdBtn.addEventListener(ev, endPourHold));
  }
}

// ---------- Init ----------
function mount(){
  ensureCanvas();
  ensureStepper();
  buildPalette();
  wireEvents();
  // dacă elementele de turnare există, legăm și range-ul
  $('#pour-range')?.addEventListener('input', (e)=>{
    state.fillPct = clamp((Number(e.target.value)||0)/100, 0, 1);
    updateFillUI();
  });
  // Primul order
  newOrder();
  updateHitWindowUI();
  updateTopbar();
  // Sync periodic boost/stoc
  try{ setInterval(updateTopbar, 2000); }catch(_){}
}

mount();
// End.
