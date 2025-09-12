// assets/js/game/game.js
import { FK } from '../shared/state.js';

const $ = s=>document.querySelector(s);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

// Ingrediente disponibile
const ING = [
  {id:'chocolate_chips', name:'Cipuri ciocolată', icon:'images/chocolate_chips.png'},
  {id:'strawberries', name:'Căpșuni', icon:'images/strawberries.png'},
  {id:'coconut', name:'Cocos', icon:'images/coconut.png'},
  {id:'sprinkles', name:'Ornamente', icon:'images/sprinkles.png'},
  {id:'cacao', name:'Cacao', icon:'images/cacao.png'},
  {id:'sugar', name:'Zahăr', icon:'images/sugar.png'}
];

let state = {
  phase: 'build', // build | bake
  order: null,
  placed: [], // {id, x%, y%}
  baking: { running:false, t:0, dur:2800, zone:[0.50,0.60], p:0, inWin:false },
  scores: { top:0, bake:0, q:0, qty:0 }
};

function newOrder(){
  const sizes=['S','M','L']; const size = sizes[Math.floor(Math.random()*sizes.length)];
  const topsCount = 2 + Math.floor(Math.random()*3); // 2..4
  const shuffled = ING.slice().sort(()=>Math.random()-0.5);
  const tops = shuffled.slice(0,topsCount).map(t=>t.id);
  const center=0.55, spread=0.06+Math.random()*0.02;
  state.order = { size, tops, bake:[center-spread, center+spread] };
  state.placed=[]; state.baking={ running:false, t:0, dur:2800, zone:[...state.order.bake], p:0, inWin:false };
  state.scores={ top:0, bake:0, q:0, qty:0 };
  renderOrder(); renderBuild(); renderScores(); updateTopbar();
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
  const wrap=$('#build-palette'); wrap.innerHTML='';
  ING.forEach(ing=>{
    const b=document.createElement('button'); b.type='button';
    b.innerHTML=`<span class="swatch ${ing.shape||'dot'}" data-id="${ing.id}"></span><span>${ing.name}</span>`;
  try{ const sw=b.querySelector('.swatch'); if(sw && ing.color){ sw.style.background = ing.color; } }catch(e){}
    try{ b.title = ing.name; }catch(e){}
    b.addEventListener('click', ()=> spawnChip(ing.id));
    wrap.appendChild(b);
  });
}

// Global audio helpers and particles
let __AC=null; function getAC(){ try{ __AC = __AC || new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} return __AC; }
function playDing(){ try{ const ac=getAC(); if(!ac) return; const o=ac.createOscillator(); const g=ac.createGain(); o.type='triangle'; o.frequency.setValueAtTime(880, ac.currentTime); o.frequency.linearRampToValueAtTime(1320, ac.currentTime+0.12); g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.06, ac.currentTime+0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime+0.2); o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+0.22);}catch(e){} }
function playBuzz(){ try{ const ac=getAC(); if(!ac) return; const o=ac.createOscillator(); const g=ac.createGain(); o.type='sawtooth'; o.frequency.value=220; g.gain.value=0.03; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(()=>{ try{o.stop();}catch(e){} },120);}catch(e){} }
function emitOvenParticles(success=true){ try{ const oi=document.getElementById('oven-box')||document.getElementById('oven-img'); if(!oi) return; const r=oi.getBoundingClientRect(); const count= success? 12:6; for(let i=0;i<count;i++){ const d=document.createElement('div'); d.className='particle'; const dx=(Math.random()*60-30)+'px'; const dy=(success? - (20+Math.random()*40): -(10+Math.random()*20))+'px'; d.style.setProperty('--dx', dx); d.style.setProperty('--dy', dy); d.style.left=(r.left + r.width*0.5)+'px'; d.style.top=(r.top + r.height*0.15)+'px'; d.style.background= success? '#f3e38a' : '#d0d0d0'; d.style.position='fixed'; d.style.animation='pop .6s ease-out forwards'; document.body.appendChild(d); setTimeout(()=>d.remove(), 700);} }catch(e){} }

function spawnChip(id){
  const zone=$('#build-drop');
  const img=document.createElement('div');
  // CSS/JS based token
  try{ img.className='topping-chip chip '+id; if(id==='sprinkles'){ img.style.width='8px'; img.style.height='20px'; img.style.borderRadius='4px'; img.style.transform='rotate('+(Math.floor(Math.random()*360))+'deg)'; } else if(id==='sugar'){ img.style.width='16px'; img.style.height='16px'; img.style.borderRadius='4px'; } else { img.style.width='28px'; img.style.height='28px'; img.style.borderRadius='50%'; } }catch(e){}
  img.draggable=false;
  // random pos %
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
    img.style.top = clamp(ny,5,95)+'%';
  };
  const end=(e)=>{
    dragging=false; img.style.cursor='move'; try{ img.releasePointerCapture && img.releasePointerCapture(pid); }catch(_){}
    // feedback
    try{
      const rect=zone.getBoundingClientRect(); const r=img.getBoundingClientRect();
      const xPct=((r.left + r.width/2 - rect.left)/rect.width)*100; const yPct=((r.top + r.height/2 - rect.top)/rect.height)*100;
      const colors=['#f8c66a','#f5a8a8','#a8d8f5','#c7f59e','#f9f09a'];
      for(let i=0;i<6;i++){ const d=document.createElement('div'); d.className='particle'; const dx=(Math.random()*40-20)+'px'; const dy=(Math.random()*40-20)+'px'; d.style.setProperty('--dx', dx); d.style.setProperty('--dy', dy); d.style.left=xPct+'%'; d.style.top=yPct+'%'; d.style.background=colors[i%colors.length]; d.style.animation='pop .5s ease-out forwards'; zone.appendChild(d); setTimeout(()=>d.remove(), 600);} }
    catch(_){ }
    try{ const ac=getAC(); if(ac && ac.state==='suspended'){ ac.resume().catch(()=>{}); } }catch(_){}
    try{ const ac=getAC(); if(ac) { const o=ac.createOscillator(); const g=ac.createGain(); o.type='square'; o.frequency.value=650+Math.random()*200; g.gain.value=0.05; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(()=>o.stop(), 100);} }catch(_){ }
    // snap to nearest guide if enabled
    try{
      const guides = Array.from(document.querySelectorAll('.guide-dot'));
      if(guides.length>0){
        const gr = guides.map(g=> g.getBoundingClientRect());
        const ir = img.getBoundingClientRect(); const zr = zone.getBoundingClientRect();
        let best=-1, bestD=1e9;
        gr.forEach((g,i)=>{ const dx=(g.left+g.width/2) - (ir.left+ir.width/2); const dy=(g.top+g.height/2) - (ir.top+ir.height/2); const d=Math.sqrt(dx*dx+dy*dy); if(d<bestD){ bestD=d; best=i; } });
        if(best>=0 && bestD < 32){
          const gx=((gr[best].left+gr[best].width/2 - zr.left)/zr.width)*100;
          const gy=((gr[best].top+gr[best].height/2 - zr.top)/zr.height)*100;
          img.style.left = gx+'%'; img.style.top = gy+'%';
        }
      }
    }catch(_){ }
    savePlaced();
  };
  img.addEventListener('pointerdown', start, {passive:true});
  img.addEventListener('pointermove', move);
  img.addEventListener('pointerup', end, {passive:true});

  zone.appendChild(img);
  try{ img.classList.add('pop-in'); setTimeout(()=> img.classList.remove('pop-in'), 220); }catch(e){}
  savePlaced();
}

function savePlaced(){
  const chips=[...document.querySelectorAll('.topping-chip')];
  state.placed = chips.map(el=>{
    let id='unknown';
    try{ const classes=[...el.classList]; const found = ING.find(i=> classes.includes(i.id)); if(found) id=found.id; }catch(e){}
    return { id, x:parseFloat(el.style.left), y:parseFloat(el.style.top) };
  });
  $('#build-count').textContent = String(state.placed.length);
  calcTopScore();
}

function calcTopScore(){
  if(!state.order) return;
  // match: +25 pts per topping present (up to 4), distribution bonus up to +20
  const want = new Set(state.order.tops);
  const have = new Set(state.placed.map(p=>p.id));
  let pts = 0;
  want.forEach(id=>{ if(have.has(id)) pts += 25; });
  pts = Math.min(100, pts);

  // distribuție (împrăștiere) — penalizare dacă toate în aceeași zonă
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

// Spawn at given percentage coords (helper for auto-place)
function spawnChipAt(id, xPct, yPct){
  const zone=$('#build-drop'); if(!zone) return;
  const img=document.createElement('div');
  try{ img.className='topping-chip chip '+id; if(id==='sprinkles'){ img.style.width='8px'; img.style.height='20px'; img.style.borderRadius='4px'; img.style.transform='rotate('+(Math.floor(Math.random()*360))+'deg)'; } else if(id==='sugar'){ img.style.width='16px'; img.style.height='16px'; img.style.borderRadius='4px'; } else { img.style.width='28px'; img.style.height='28px'; img.style.borderRadius='50%'; } }catch(e){}
  img.draggable=false; img.style.left=xPct+'%'; img.style.top=yPct+'%';
  zone.appendChild(img);
  try{ img.classList.add('pop-in'); setTimeout(()=> img.classList.remove('pop-in'), 220); }catch(e){}
}

function renderBuild(){
  $('#build-count').textContent = String(state.placed.length);
  const drop=$('#build-drop'); drop.innerHTML='';
  state.placed.forEach(p=> spawnChip(p.id));
}

let bakeTimer=null;
function startBake(){
  if(state.baking.running) return;
  state.baking.running=true; state.baking.t=0; state.baking.p=0; state.baking.inWin=false;
  try{ const box=document.getElementById('oven-box'); if(box){ box.classList.add('open'); box.classList.remove('closed'); } else { $('#oven-img').src='images/oven_open.png'; } }catch(e){}
  clearInterval(bakeTimer);
  bakeTimer=setInterval(()=>{
    state.baking.t+=100; const p = clamp(state.baking.t/state.baking.dur, 0, 1);
    state.baking.p = p;
    $('#bake-bar').style.width = (p*100)+'%';
    if(p>=0.2 && p<0.8) {
      try{ const box=document.getElementById('oven-box'); if(box){ box.classList.add('closed'); box.classList.remove('open'); } else { $('#oven-img').src='images/oven_closed.png'; } }catch(e){}
    }
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
  try{ const box=document.getElementById('oven-box'); if(box){ box.classList.add('open'); box.classList.remove('closed'); } else { $('#oven-img').src='images/oven_open.png'; } }catch(e){}
  // scor coacere: 100 la centru, scade cu distanța
  const center=(a+b)/2; const d=Math.abs(p-center);
  const maxD=(b-a)/2;
  let bakeScore = clamp(100*(1 - d/(maxD||0.001)), 0, 100);
  state.scores.bake = Math.round(bakeScore);
  // Buff la coacere reușită (în fereastra de timp)
  if(inWin){ try{ FK.addBuff({id:'freshBake', label:'Coacere perfectă', minutes:45, qBonus:0.02, trafficMult:1.08}); }catch(e){} }
  computeFinalScores();
}

function computeFinalScores(){
  // Q din 0.82..0.97 bazat pe 60% topping, 40% bake
  const topW = 0.6, bakeW = 0.4;
  const topRaw = state.scores.top||0;
  let penalty = 0;
  try{ (state.placed||[]).forEach(p=>{ if(p.x<20||p.x>80||p.y<20||p.y>80) penalty+=2; }); }catch(e){}
  const topAdj = Math.max(0, topRaw - Math.min(30, penalty));
  const q = clamp(0.82 + (topAdj/100)*0.10*topW + (state.scores.bake/100)*0.10*bakeW, 0.82, 0.97);
  // Cantitate după mărime + nr toppinguri
  const sizeMap={S:8, M:10, L:12}; const qtyBase=sizeMap[state.order.size]||10;
  const qty = clamp(qtyBase + Math.floor(state.placed.length/3), 6, 16);
  state.scores.q = Number(q.toFixed(2)); state.scores.qty = qty;
  renderScores();
}

function renderScores(){
  $('#score-top').textContent = state.scores.top;
  $('#score-bake').textContent = state.scores.bake;
  $('#score-q').textContent = state.scores.q.toFixed(2);
  $('#score-qty').textContent = String(state.scores.qty);
}

function serveClient(){
  // adaugă în stoc + boost ușor în funcție de calitate
  const q= state.scores.q || 0.86;
  const qty = state.scores.qty || 8;
  FK.addInventory('croissant', qty, q);
  const boost = clamp(Math.round((q-0.85)*180), 6, 28);
  FK.applyBoost(boost);
  toast(`✅ Servit! +${qty} stoc · Q ${q.toFixed(2)} · ⚡ +${boost}%`);
updateTopbar();
}

function updateTopbar(){
  $('#g-stock').textContent = FK.totalStock('croissant');
  $('#g-boost').textContent = Math.round(FK.getState().boost.percent)+'%';
}

function toast(msg){
  const d=document.createElement('div');
  d.textContent=msg; d.style.position='fixed'; d.style.left='50%'; d.style.top='12px'; d.style.transform='translateX(-50%)';
  d.style.background='#000'; d.style.color='#fff'; d.style.padding='8px 12px'; d.style.borderRadius='10px'; d.style.opacity='0.9'; d.style.zIndex='99999';
  document.body.appendChild(d); setTimeout(()=>{ d.remove(); }, 1800);
}

// Wire
$('#btn-new-order').addEventListener('click', newOrder);
$('#btn-bake').addEventListener('click', startBake);
$('#btn-stop').addEventListener('click', stopBake);
document.addEventListener('keydown', (e)=>{ if(e.code==='Space') stopBake(); });
$('#btn-serve').addEventListener('click', ()=>{ if(!state.baking.running){ computeFinalScores(); serveClient(); }});
$('#btn-prev').addEventListener('click', ()=>{ /* rămânem pe Build în această implementare simplă */ });
$('#btn-next').addEventListener('click', ()=>{ /* focus pe Bake */ startBake(); });

// Init
buildPalette();
newOrder();
updateTopbar();

// Build oven-box DOM (vectorized) and hide old image
(function(){
  try{
    const oven=document.querySelector('.oven'); if(!oven) return;
    // If HTML already contains oven-box (cleaned), just ensure visibility
    const existing=document.getElementById('oven-box');
    if(existing){ existing.classList.add('open'); existing.classList.remove('closed'); }
    else{
      const box=document.createElement('div'); box.id='oven-box'; box.className='oven-box open';
      box.innerHTML='<div class="window"></div><div class="door"></div><div class="handle"></div>';
      const img=document.getElementById('oven-img'); if(img) img.style.display='none';
      oven.insertBefore(box, oven.firstChild);
    }
  }catch(e){}
})();

// Override computeFinalScores to include radial penalty based on dough
try{
  const __origCompute = computeFinalScores;
  window.computeFinalScores = function(){
    const topW = 0.6, bakeW = 0.4;
    const topRaw = state?.scores?.top || 0;
    // radial penalty (outside dough)
    let outsidePen = 0;
    let cxPct=50, cyPct=50, rPct=35;
    try{
      const zone=document.getElementById('build-drop'); const dough=document.getElementById('dough-canvas');
      if(zone && dough){
        const zr=zone.getBoundingClientRect(); const dr=dough.getBoundingClientRect();
        cxPct=((dr.left+dr.width/2 - zr.left)/zr.width)*100;
        cyPct=((dr.top+dr.height/2 - zr.top)/zr.height)*100;
        rPct=(dr.width/2)/zr.width*100;
        (state.placed||[]).forEach(p=>{ const dx=p.x - cxPct; const dy=p.y - cyPct; const dist=Math.sqrt(dx*dx+dy*dy); if(dist > (rPct-1)){ outsidePen += 2 + Math.max(0, (dist - rPct))*0.5; } });
        outsidePen = Math.round(Math.min(40, outsidePen));
      }
    }catch(e){}
    // clustering penalty (small nearest-neighbor distance) and uniform bonus (angular spread)
    let clusterPen = 0, uniformBonus = 0;
    try{
      const pts = (state.placed||[]);
      if(pts.length>=2){
        // NN distance average
        const dists = pts.map((p,i)=>{
          let min=1e9; pts.forEach((q,j)=>{ if(i===j) return; const dx=p.x-q.x, dy=p.y-q.y; const d=Math.sqrt(dx*dx+dy*dy); if(d<min) min=d; }); return min; });
        const avgNN = dists.reduce((a,b)=>a+b,0)/dists.length; clusterPen = Math.max(0, 8-avgNN)*1.2; if(clusterPen>10) clusterPen=10;
        // angular coverage
        const ang = pts.map(p=> Math.atan2(p.y-cyPct, p.x-cxPct));
        const C = ang.reduce((s,a)=> s+Math.cos(a), 0)/pts.length;
        const S = ang.reduce((s,a)=> s+Math.sin(a), 0)/pts.length;
        const R = Math.sqrt(C*C+S*S); // 0 uniform, 1 concentrated
        const uniformity = 1 - R; uniformBonus = Math.min(10, Math.max(0, uniformity*12));
      }
    }catch(e){}
    const penalty = Math.max(0, Math.round(outsidePen + clusterPen - uniformBonus));
    const topAdj = Math.max(0, topRaw - Math.min(40, penalty));
    const q = clamp(0.82 + (topAdj/100)*0.10*topW + ((state?.scores?.bake||0)/100)*0.10*bakeW, 0.82, 0.97);
    const sizeMap={S:8, M:10, L:12}; const qtyBase=sizeMap[state?.order?.size]||10;
    const qty = clamp(qtyBase + Math.floor((state?.placed?.length||0)/3), 6, 16);
    state.scores.q = Number(q.toFixed(2)); state.scores.qty = qty;
    try{ document.getElementById('score-q').textContent = state.scores.q.toFixed(2); document.getElementById('score-qty').textContent = String(state.scores.qty); }catch(e){}
  };
}catch(e){}

// Replace Serve button handler to enforce ingredients & buffs
(function(){
  try{
    const old=document.getElementById('btn-serve'); if(!old) return;
    const btn=old.cloneNode(true); old.parentNode.replaceChild(btn, old);
    btn.addEventListener('click', ()=>{
      if(state.baking.running) return;
      computeFinalScores();
      const q = state.scores.q || 0.86;
      const qty = state.scores.qty || 8;
      const S = FK.getState(); const rid=(S.products?.croissant?.recipeId)||'croissant_plain';
      if(!FK.canProduce(rid, qty)) { toast('⚠️ Stoc ingrediente insuficient'); return; }
      FK.consumeFor(rid, qty);
      FK.addInventory('croissant', qty, q);
      if(state.scores.top>=80){ try{ FK.addBuff({id:'fastServe', label:'Servire rapidă', minutes:30, wBonus:-0.6, trafficMult:1.05}); }catch(e){} }
      toast(`✅ Servit! +${qty} stoc · Q ${q.toFixed(2)}`);
      try{ $('#g-stock').textContent = FK.totalStock('croissant'); const S2=FK.getState(); const cnt=(S2.boost?.buffs?.length)||0; $('#g-boost').textContent = Math.round(S2.boost.percent)+'%'+(cnt>0?` (${cnt})`:''); }catch(e){}
    });
  }catch(e){}
})();

// Periodically keep manual topbar boost fresh
try{ setInterval(()=>{ const S=FK.getState(); const cnt=(S.boost?.buffs?.length)||0; const el=document.getElementById('g-boost'); if(el) el.textContent=Math.round(S.boost.percent)+'%'+(cnt>0?` (${cnt})`:''); }, 2000); }catch(e){}

// --- Baking UX upgrades (randomized window, easing, particles, sfx) ---
(function(){
  function rand(min,max){ return min + Math.random()*(max-min); }
  function updateHitWindowUI(){ try{ const span=document.querySelector('.hit-window span'); if(!span||!state.order) return; const [a,b]=state.order.bake; span.style.left=Math.round(a*100)+'%'; span.style.width=Math.round((b-a)*100)+'%'; span.classList.add('pulse'); }catch(e){} }
  // sfx pop using WebAudio
  let AC=null; function playPop(){ try{ AC = AC || new (window.AudioContext||window.webkitAudioContext)(); const o=AC.createOscillator(); const g=AC.createGain(); o.type='square'; o.frequency.value=650+Math.random()*200; g.gain.value=0.05; o.connect(g); g.connect(AC.destination); o.start(); setTimeout(()=>o.stop(), 100); }catch(e){} }
  function emitParticlesAt(el){ try{ const zone=document.getElementById('build-drop'); if(!zone||!el) return; const rect=zone.getBoundingClientRect(); const r=el.getBoundingClientRect(); const xPct=((r.left + r.width/2 - rect.left)/rect.width)*100; const yPct=((r.top + r.height/2 - rect.top)/rect.height)*100; const colors=['#f8c66a','#f5a8a8','#a8d8f5','#c7f59e','#f9f09a']; for(let i=0;i<8;i++){ const d=document.createElement('div'); d.className='particle'; const dx=(Math.random()*40-20)+'px'; const dy=(Math.random()*40-20)+'px'; d.style.setProperty('--dx', dx); d.style.setProperty('--dy', dy); d.style.left=xPct+'%'; d.style.top=yPct+'%'; d.style.background=colors[i%colors.length]; d.style.animation='pop .5s ease-out forwards'; zone.appendChild(d); setTimeout(()=>d.remove(), 600);} }catch(e){} }

  // Rebind New Order to randomize hit window and duration
  try{
    const old=document.getElementById('btn-new-order'); if(old){
      const btn=old.cloneNode(true); old.parentNode.replaceChild(btn, old);
      btn.addEventListener('click', ()=>{
        const sizes=['S','M','L']; const size = sizes[Math.floor(Math.random()*sizes.length)];
        const topsCount = 2 + Math.floor(Math.random()*3);
        const shuffled = ING.slice().sort(()=>Math.random()-0.5);
        const tops = shuffled.slice(0,topsCount).map(t=>t.id);
        const center = Math.max(0.35, Math.min(0.75, rand(0.42,0.68)));
        const width = Math.max(0.06, Math.min(0.18, rand(0.08,0.14)));
        let a = Math.max(0.05, Math.min(0.90, center - width/2));
        let b = Math.max(0.10, Math.min(0.95, center + width/2));
        const dur = Math.round(rand(2400, 3600));
        state.order = { size, tops, bake:[a,b] };
        state.placed=[]; state.baking={ running:false, t:0, dur:dur, zone:[...state.order.bake], p:0, inWin:false };
        state.scores={ top:0, bake:0, q:0, qty:0 };
        renderOrder(); try{ document.getElementById('ord-bake').textContent = `${Math.round(a*100)}%–${Math.round(b*100)}%`; }catch(e){}; updateHitWindowUI(); renderBuild(); renderScores(); updateTopbar();
      });
    }
  }catch(e){}

  // Rebind Bake to add easing/pulse (leave Stop as-is)
  try{
    const oldB=document.getElementById('btn-bake'); if(oldB){
      const btn=oldB.cloneNode(true); oldB.parentNode.replaceChild(btn, oldB);
      btn.addEventListener('click', ()=>{
        if(state.baking.running) return;
        state.baking.running=true; state.baking.t=0; state.baking.p=0; state.baking.inWin=false;
        document.getElementById('oven-img').src='images/oven_open.png';
        clearInterval(bakeTimer);
        bakeTimer=setInterval(()=>{
          state.baking.t+=100; const p = Math.max(0, Math.min(1, state.baking.t/state.baking.dur));
          state.baking.p = p;
          const bar=document.getElementById('bake-bar');
          const ease=(t)=>{ if(t<0.2) return t*t*2.5; if(t>0.8) return 0.8+(t-0.8)*0.85; return t; };
          const pe=ease(p);
          bar.style.width=(pe*100)+'%';
          bar.classList.toggle('pulse', p>0.8);
          if(p>=0.2 && p<0.8) { document.getElementById('oven-img').src='images/oven_closed.png'; }
          if(p>=1) stopBake();
        },100);
      });
    }
  }catch(e){}

  // particles/sfx now handled inside spawnChip drag-end
})();

// Ensure initial hit-window UI aligns to current order
try{ const span=document.querySelector('.hit-window span'); if(span && state.order){ const [a,b]=state.order.bake; span.style.left=Math.round(a*100)+'%'; span.style.width=Math.round((b-a)*100)+'%'; span.classList.add('pulse'); } }catch(e){}

// Add bake stop feedback (ding/buzz + particles) without touching main function body
try{
  const __origStop = stopBake;
  window.stopBake = function(){
    __origStop();
    try{
      if(state && state.baking && typeof state.baking.inWin==='boolean'){
        if(state.baking.inWin){ playDing(); emitOvenParticles(true); try{ const d=document.getElementById('dough-canvas'); if(d){ d.classList.add('perfect-glow'); setTimeout(()=> d.classList.remove('perfect-glow'), 1800); } }catch(e){} }
        else { playBuzz(); emitOvenParticles(false); }
      }
    }catch(e){}
  };
}catch(e){}

// Override legacy serveClient to remove applyBoost and use addBuff
try{
  window.serveClient = function(){
    const q = state?.scores?.q || 0.86;
    const qty = state?.scores?.qty || 8;
    try{ FK.addInventory('croissant', qty, q); }catch(e){}
    try{ FK.addBuff({id:'fastServe', label:'Servire rapidă', minutes:30, wBonus:-0.6, trafficMult:1.05}); }catch(e){}
    try{ toast(`✔ Servit! +${qty} stoc × Q ${q.toFixed(2)}`); }catch(e){}
    try{ updateTopbar(); }catch(e){}
  }
}catch(e){}
// Ensure CSS dough canvas present and size slider works
(function(){
  try{
    const stage=document.querySelector('.build-stage');
    const base=document.getElementById('build-base'); if(base) base.style.display='none';
    // if canvas already exists in HTML, just ensure it's present
    const r=document.getElementById('size-range');
    const apply=(v)=>{ const px = v==1?160: v==2?190:220; const d=document.getElementById('dough-canvas'); if(d) d.style.setProperty('--dough-size', px+'px'); };
    if(r){ apply(parseInt(r.value||2)); r.addEventListener('input', ()=>apply(parseInt(r.value||2))); }
  }catch(e){}
})();

// Guides + density UI
(function(){
  try{
    const dens=document.getElementById('density-range'); const label=document.getElementById('density-label'); const toggle=document.getElementById('toggle-guides');
    const update=()=>{ if(label && dens){ label.textContent=String(dens.value); } if(toggle && toggle.checked){ renderGuides(); } else { clearGuides(); } };
    function clearGuides(){ try{ document.querySelectorAll('.guide-dot').forEach(n=>n.remove()); }catch(e){} }
    function renderGuides(){
      clearGuides();
      const zone=document.getElementById('build-drop'); const dough=document.getElementById('dough-canvas'); if(!zone||!dough) return;
      const zr=zone.getBoundingClientRect(); const dr=dough.getBoundingClientRect();
      const cx=((dr.left+dr.width/2 - zr.left)/zr.width)*100; const cy=((dr.top+dr.height/2 - zr.top)/zr.height)*100; const r=(dr.width/2)/zr.width*100*0.78;
      const n = Math.max(4, Math.min(30, parseInt(dens?.value||10)));
      for(let i=0;i<n;i++){
        const a = (i/n)*Math.PI*2 + (Math.random()*0.6-0.3);
        const rr = r * (0.65 + Math.random()*0.35);
        const x = cx + rr*Math.cos(a);
        const y = cy + rr*Math.sin(a);
        const dot=document.createElement('div'); dot.className='guide-dot'; dot.style.left=x+'%'; dot.style.top=y+'%'; zone.appendChild(dot);
      }
    }
    if(dens){ dens.addEventListener('input', update); }
    if(toggle){ toggle.addEventListener('change', update); }
    update();

    // Auto-place button
    const btn = document.getElementById('btn-autoplace');
    if(btn){ btn.addEventListener('click', ()=>{
      try{
        const target = Math.max(4, Math.min(30, parseInt(dens?.value||10)));
        const need = Math.max(0, target - (state.placed?.length||0));
        if(need<=0) return;
        const zone=document.getElementById('build-drop'); const dough=document.getElementById('dough-canvas'); if(!zone||!dough) return;
        const zr=zone.getBoundingClientRect(); const dr=dough.getBoundingClientRect();
        const cx=((dr.left+dr.width/2 - zr.left)/zr.width)*100; const cy=((dr.top+dr.height/2 - zr.top)/zr.height)*100; const r=(dr.width/2)/zr.width*100*0.80;
        const tops = (state.order?.tops?.length>0)? state.order.tops : ['chocolate_chips','strawberries','cacao','sugar'];
        for(let i=0;i<need;i++){
          const a = (i/need)*Math.PI*2 + (Math.random()*0.6-0.3);
          const rr = r * (0.55 + Math.random()*0.35);
          const x = cx + rr*Math.cos(a);
          const y = cy + rr*Math.sin(a);
          const id = tops[i%tops.length];
          spawnChipAt(id, x, y);
        }
        savePlaced();
      }catch(e){}
    }); }
  }catch(e){}
})();

// Final override: Serve without ingredient stock checks
(function(){
  try{
    const old=document.getElementById('btn-serve'); if(!old) return;
    const btn=old.cloneNode(true); old.parentNode.replaceChild(btn, old);
    btn.addEventListener('click', ()=>{
      if(state.baking.running) return;
      computeFinalScores();
      const q = state.scores.q || 0.86;
      const qty = state.scores.qty || 8;
      try{ FK.addInventory('croissant', qty, q); }catch(e){}
      try{ if(state.scores.top>=80) FK.addBuff({id:'fastServe', label:'Servire rapida', minutes:30, wBonus:-0.6, trafficMult:1.05}); }catch(e){}
      try{ toast(`✔ Servit! +${qty} stoc × Q ${q.toFixed(2)}`); }catch(e){}
      try{ $('#g-stock').textContent = FK.totalStock('croissant'); const S2=FK.getState(); const cnt=(S2.boost?.buffs?.length)||0; $('#g-boost').textContent = Math.round(S2.boost.percent)+'%'+(cnt>0?` (${cnt})`:''); }catch(e){}
    });
  }catch(e){}
})();
