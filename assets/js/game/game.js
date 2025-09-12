// assets/js/game/game.js
// =====================================================
// FinKids Tycoon — Joc manual (Build → Bake → Serve)
// - Integrare cu FK v5 (produs activ, rețete, stoc, buffs)
// - Drag & drop toppinguri, fereastră „hit” la coacere
// - Scoruri (topping/bake) → calitate (Q) + cantitate (qty)
// - Serve consumă ingrediente (rețeta produsului activ) și adaugă în stoc
// - Audio/SFX/particule ușoare pentru feedback
// =====================================================

import { FK } from '../shared/state.js';

const $  = (s)=>document.querySelector(s);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

// ---------- Toppings disponibile (imagini placeholder) ----------
const ING = [
  {id:'chocolate_chips', name:'Cipuri ciocolată', icon:'images/chocolate_chips.png'},
  {id:'strawberries',    name:'Căpșuni',           icon:'images/strawberries.png'},
  {id:'coconut',         name:'Cocos',             icon:'images/coconut.png'},
  {id:'sprinkles',       name:'Ornamente',         icon:'images/sprinkles.png'},
  {id:'cacao',           name:'Cacao',             icon:'images/cacao.png'},
  {id:'sugar',           name:'Zahăr',             icon:'images/sugar.png'}
];

// ---------- Stare joc manual ----------
let state = {
  phase: 'build', // build | bake
  order: null,
  placed: [], // {id, x%, y%}
  baking: { running:false, t:0, dur:2800, zone:[0.50,0.60], p:0, inWin:false },
  sizeKey: 'M', // S | M | L
  scores: { top:0, bake:0, q:0, qty:0 }
};

// ---------- Audio & efecte ----------
let __AC=null; function getAC(){ try{ __AC = __AC || new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} return __AC; }
function playDing(){ try{ const ac=getAC(); if(!ac) return; const o=ac.createOscillator(); const g=ac.createGain(); o.type='triangle'; o.frequency.setValueAtTime(880, ac.currentTime); o.frequency.linearRampToValueAtTime(1320, ac.currentTime+0.12); g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.06, ac.currentTime+0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime+0.2); o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+0.22);}catch(e){} }
function playBuzz(){ try{ const ac=getAC(); if(!ac) return; const o=ac.createOscillator(); const g=ac.createGain(); o.type='sawtooth'; o.frequency.value=220; g.gain.value=0.03; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(()=>{ try{o.stop();}catch(e){} },120);}catch(e){} }
function emitOvenParticles(success=true){
  try{
    const oi=document.getElementById('oven-img'); if(!oi) return;
    const r=oi.getBoundingClientRect(); const count= success? 12:6;
    for(let i=0;i<count;i++){
      const d=document.createElement('div'); d.className='particle';
      const dx=(Math.random()*60-30)+'px';
      const dy=(success? - (20+Math.random()*40): -(10+Math.random()*20))+'px';
      d.style.setProperty('--dx', dx); d.style.setProperty('--dy', dy);
      d.style.left=(r.left + r.width*0.5)+'px'; d.style.top=(r.top + r.height*0.15)+'px';
      d.style.background= success? '#f3e38a' : '#d0d0d0';
      d.style.position='fixed'; d.style.animation='pop .6s ease-out forwards';
      document.body.appendChild(d); setTimeout(()=>d.remove(), 700);
    }
  }catch(e){}
}

// ---------- Comenzi & UI ----------
function productName(){
  const S=FK.getState(); const k=(FK.getActiveProductKey&&FK.getActiveProductKey())||'croissant';
  return S.products?.[k]?.name || 'Produs';
}
function newOrder(){
  // Dimensiune (de la slider 1..3 → S/M/L)
  const slider = $('#size-range');
  const map = {1:'S',2:'M',3:'L'};
  const key = map[Number(slider?.value||2)] || 'M';
  state.sizeKey = key;

  // Toppinguri cerute 2..4 (aleator)
  const topsCount = 2 + Math.floor(Math.random()*3); // 2..4
  const shuffled = ING.slice().sort(()=>Math.random()-0.5);
  const tops = shuffled.slice(0,topsCount).map(t=>t.id);

  // Fereastr ă de coacere (zona „hit”)
  const center=0.55, spread=0.06+Math.random()*0.02;
  state.order = { size: key, tops, bake:[center-spread, center+spread] };

  // Reset
  state.placed=[];
  state.baking={ running:false, t:0, dur:randInt(2400, 3600), zone:[...state.order.bake], p:0, inWin:false };
  state.scores={ top:0, bake:0, q:0, qty:0 };

  // UI
  renderOrder();
  renderBuild();
  renderScores();
  updateHitWindowUI();
  updateTopbar();
}

function renderOrder(){
  $('#ord-size').textContent = state.order.size;
  const ul=$('#ord-tops'); ul.innerHTML='';
  state.order.tops.forEach(id=>{
    const li=document.createElement('li'); li.textContent = (ING.find(i=>i.id===id)?.name || id); ul.appendChild(li);
  });
  $('#ord-bake').textContent = `${Math.round(state.order.bake[0]*100)}–${Math.round(state.order.bake[1]*100)}%`;
}

function buildPalette(){
  const wrap=$('#build-palette'); if(!wrap) return;
  wrap.innerHTML='';
  ING.forEach(ing=>{
    const b=document.createElement('button'); b.type='button';
    b.innerHTML=`<img src="${ing.icon}" alt=""><span>${ing.name}</span>`;
    b.addEventListener('click', ()=> spawnChip(ing.id));
    wrap.appendChild(b);
  });
}

// ---------- Drag & Drop toppinguri ----------
function spawnChip(id){
  const zone=$('#build-drop');
  const img=document.createElement('img');
  img.src = ING.find(i=>i.id===id)?.icon;
  img.className='topping-chip'; img.draggable=false;

  // random pos % (centrată în zona blatului)
  const rx=25+Math.random()*50, ry=25+Math.random()*50;
  img.style.left=rx+'%'; img.style.top=ry+'%';

  let dragging=false, sx=0, sy=0, ox=0, oy=0, pid=0;

  const start=(e)=>{
    dragging=true; pid=e.pointerId||0; img.setPointerCapture && img.setPointerCapture(pid);
    sx=e.clientX; sy=e.clientY;
    const rect=img.getBoundingClientRect(); ox=rect.left; oy=rect.top;
    img.style.cursor='grabbing';
  };
  const move=(e)=>{
    if(!dragging) return;
    const dx=e.clientX - sx; const dy=e.clientY - sy;
    const parent=zone.getBoundingClientRect();
    const nx = ((ox + dx) - parent.left) / parent.width * 100;
    const ny = ((oy + dy) - parent.top) / parent.height * 100;
    img.style.left = clamp(nx,5,95)+'%';
    img.style.top  = clamp(ny,5,95)+'%';
  };
  const end=()=>{
    dragging=false; img.style.cursor='move'; try{ img.releasePointerCapture && img.releasePointerCapture(pid); }catch(_){}
    // Particule mici la drop
    try{
      const rect=zone.getBoundingClientRect(); const r=img.getBoundingClientRect();
      const xPct=((r.left + r.width/2 - rect.left)/rect.width)*100; const yPct=((r.top + r.height/2 - rect.top)/rect.height)*100;
      const colors=['#f8c66a','#f5a8a8','#a8d8f5','#c7f59e','#f9f09a'];
      for(let i=0;i<6;i++){
        const d=document.createElement('div'); d.className='particle';
        const dx=(Math.random()*40-20)+'px'; const dy=(Math.random()*40-20)+'px';
        d.style.setProperty('--dx', dx); d.style.setProperty('--dy', dy);
        d.style.left=xPct+'%'; d.style.top=yPct+'%';
        d.style.background=colors[i%colors.length]; d.style.animation='pop .5s ease-out forwards';
        zone.appendChild(d); setTimeout(()=>d.remove(), 600);
      }
    }catch(_){}
    // sunet scurt
    try{
      const ac=getAC(); if(ac && ac.state==='suspended'){ ac.resume().catch(()=>{}); }
      if(ac){ const o=ac.createOscillator(); const g=ac.createGain(); o.type='square'; o.frequency.value=650+Math.random()*200; g.gain.value=0.05; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(()=>o.stop(), 100); }
    }catch(_){}
    savePlaced();
  };

  img.addEventListener('pointerdown', start, {passive:true});
  img.addEventListener('pointermove', move);
  img.addEventListener('pointerup', end, {passive:true});

  zone.appendChild(img);
  savePlaced();
}

function savePlaced(){
  const chips=[...document.querySelectorAll('.topping-chip')];
  state.placed = chips.map(el=>{
    const match = ING.find(i=> (el.src||'').includes(i.id));
    return { id: match?.id || 'unknown', x:parseFloat(el.style.left), y:parseFloat(el.style.top) };
  });
  $('#build-count').textContent = String(state.placed.length);
  calcTopScore();
}

function calcTopScore(){
  if(!state.order) return;

  // 1) potrivire toppinguri — +25p per topping corect (max 100)
  const want = new Set(state.order.tops);
  const have = new Set(state.placed.map(p=>p.id));
  let pts = 0;
  want.forEach(id=>{ if(have.has(id)) pts += 25; });
  pts = Math.min(100, pts);

  // 2) distribuție (împrăștiere) — bonus până la 20p
  if(state.placed.length>1){
    const mx = state.placed.reduce((s,p)=>s+p.x,0)/state.placed.length;
    const my = state.placed.reduce((s,p)=>s+p.y,0)/state.placed.length;
    let spread=0; state.placed.forEach(p=>{ const dx=p.x-mx, dy=p.y-my; spread+=Math.sqrt(dx*dx+dy*dy); });
    const spreadScore = clamp(spread/(state.placed.length*20), 0, 1)*20;
    pts = clamp(pts + spreadScore, 0, 100);
  }
  state.scores.top = Math.round(pts);
  renderScores();
}

function renderBuild(){
  $('#build-count').textContent = String(state.placed.length);
  const drop=$('#build-drop'); drop.innerHTML='';
  // re-spawn pentru a păstra comportamentul drag & drop
  state.placed.forEach(p=> spawnChip(p.id));
}

// ---------- Coacere ----------
let bakeTimer=null;

function startBake(){
  if(state.baking.running) return;
  state.baking.running=true; state.baking.t=0; state.baking.p=0; state.baking.inWin=false;
  $('#oven-img').src='images/oven_open.png';
  clearInterval(bakeTimer);
  bakeTimer=setInterval(()=>{
    state.baking.t+=100;
    const p = clamp(state.baking.t/state.baking.dur, 0, 1);
    state.baking.p = p;

    // Easing ușor & puls final
    const bar = $('#bake-bar');
    const ease=(t)=>{ if(t<0.2) return t*t*2.5; if(t>0.8) return 0.8+(t-0.8)*0.85; return t; };
    bar.style.width = (ease(p)*100)+'%';
    bar.classList.toggle('pulse', p>0.8);

    if(p>=0.2 && p<0.8) { $('#oven-img').src='images/oven_closed.png'; }
    if(p>=1) stopBake();
  },100);
}

function stopBake(){
  if(!state.baking.running) return;
  state.baking.running=false;
  clearInterval(bakeTimer);
  const p=state.baking.p;
  const [a,b]=state.baking.zone;
  const inWin = p>=a && p<=b;
  state.baking.inWin = inWin;
  $('#oven-img').src='images/oven_open.png';

  // scor coacere: 100 la centru, scade cu distanța față de centru
  const center=(a+b)/2; const d=Math.abs(p-center); const maxD=(b-a)/2 || 0.001;
  let bakeScore = clamp(100*(1 - d/maxD), 0, 100);
  state.scores.bake = Math.round(bakeScore);

  // Buff pentru coacere reușită
  if(inWin){
    try{ FK.addBuff({id:'freshBake', label:'Coacere perfectă', minutes:45, qBonus:0.02, trafficMult:1.08}); }catch(_){}
  }

  // Feedback
  try{ if(inWin){ playDing(); emitOvenParticles(true); } else { playBuzz(); emitOvenParticles(false); } }catch(_){}

  computeFinalScores();
}

function computeFinalScores(){
  // Q: 60% topping, 40% coacere → mapăm în interval 0.82..0.97
  const topW = 0.6, bakeW = 0.4;
  const q = clamp(0.82 + (state.scores.top/100)*0.10*topW + (state.scores.bake/100)*0.10*bakeW, 0.82, 0.97);

  // Cantitate în funcție de mărime + nr. toppinguri
  const sizeMap={S:8, M:10, L:12};
  const qtyBase=sizeMap[state.sizeKey]||10;
  const qty = clamp(qtyBase + Math.floor(state.placed.length/3), 6, 16);

  state.scores.q = Number(q.toFixed(2));
  state.scores.qty = qty;
  renderScores();
}

function renderScores(){
  $('#score-top').textContent  = state.scores.top;
  $('#score-bake').textContent = state.scores.bake;
  $('#score-q').textContent    = (state.scores.q||0).toFixed(2);
  $('#score-qty').textContent  = String(state.scores.qty||0);
}

// ---------- Serve ----------
function serveClient(){
  if(state.baking.running) return;

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

  // Buff mic dacă topping score bun (servire rapidă)
  if(state.scores.top>=80){ try{ FK.addBuff({id:'fastServe', label:'Servire rapidă', minutes:30, wBonus:-0.6, trafficMult:1.05}); }catch(_){ } }

  // Notificare
  toast(`✅ Servit ${productName()}! +${qty} stoc · Q ${q.toFixed(2)}`);
  updateTopbar();

  // Re-pornește o comandă nouă
  newOrder();
}

// ---------- Top bar sync ----------
function updateTopbar(){
  try{
    const k = (FK.getActiveProductKey && FK.getActiveProductKey()) || 'croissant';
    $('#g-stock').textContent = FK.totalStock(k);
    const S=FK.getState();
    const cnt=(S.boost?.buffs?.length)||0;
    $('#g-boost').textContent = Math.round(S.boost.percent||0)+'%'+(cnt>0?` (${cnt})`:'');
  }catch(_){}
}

// Mic toast
function toast(msg){
  const d=document.createElement('div');
  d.textContent=msg; d.className='toast';
  let host=document.querySelector('.toast-container'); if(!host){ host=document.createElement('div'); host.className='toast-container'; document.body.appendChild(host); }
  host.appendChild(d); setTimeout(()=>{ try{ d.remove(); }catch(_){ } }, 1800);
}

// ---------- Hit window UI ----------
function updateHitWindowUI(){
  try{
    const span=document.querySelector('.hit-window span'); if(!span||!state.order) return;
    const [a,b]=state.order.bake;
    span.style.left=Math.round(a*100)+'%';
    span.style.width=Math.round((b-a)*100)+'%';
    span.classList.add('pulse');
  }catch(_){}
}

// ---------- Utilitare ----------
function randInt(min,max){ return Math.round(min + Math.random()*(max-min)); }

// ---------- Wire UI ----------
$('#btn-new-order')?.addEventListener('click', newOrder);
$('#btn-bake')?.addEventListener('click', startBake);
$('#btn-stop')?.addEventListener('click', stopBake);
document.addEventListener('keydown', (e)=>{ if(e.code==='Space') stopBake(); });
$('#btn-serve')?.addEventListener('click', serveClient);
$('#btn-prev')?.addEventListener('click', ()=>{ /* rămânem pe Build în această implementare */ });
$('#btn-next')?.addEventListener('click', ()=>{ startBake(); });

// Slider mărime (schimbă vizual baza + dimensiunea aluatului)
$('#size-range')?.addEventListener('input', (e)=>{
  const v = Number(e.target.value||2);
  const map = {1:'S',2:'M',3:'L'};
  state.sizeKey = map[v] || 'M';
  // scalează imaginea bazei: 1: 150px, 2: 180px, 3: 200px
  const sz = v===1?150 : v===3?200 : 180;
  const base = $('#build-base');
  if(base){ base.style.width = sz+'px'; base.style.height = sz+'px'; }
  computeFinalScores(); // recalculăm cantitatea de bază
});

// ---------- Init ----------
buildPalette();
newOrder();
updateTopbar();
updateHitWindowUI();

// Sync periodic boost/stoc (în caz de buffs noi din alt tab)
try{ setInterval(updateTopbar, 2000); }catch(_){}

// End.
