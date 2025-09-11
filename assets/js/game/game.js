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
    b.innerHTML=`<img src="${ing.icon}" alt=""><span>${ing.name}</span>`;
    b.addEventListener('click', ()=> spawnChip(ing.id));
    wrap.appendChild(b);
  });
}

function spawnChip(id){
  const zone=$('#build-drop');
  const img=document.createElement('img');
  img.src = ING.find(i=>i.id===id)?.icon; img.className='topping-chip'; img.draggable=false;
  // random pos %
  const rx=25+Math.random()*50, ry=25+Math.random()*50;
  img.style.left=rx+'%'; img.style.top=ry+'%';
  let dragging=false, sx=0, sy=0, ox=0, oy=0;

  const start=(e)=>{
    dragging=true;
    const p=e.touches? e.touches[0]: e;
    sx=p.clientX; sy=p.clientY;
    const rect=img.getBoundingClientRect();
    ox=rect.left; oy=rect.top;
    img.style.cursor='grabbing';
  };
  const move=(e)=>{
    if(!dragging) return;
    const p=e.touches? e.touches[0]: e;
    const dx=p.clientX - sx; const dy=p.clientY - sy;
    const parent=zone.getBoundingClientRect();
    const nx = ((ox + dx) - parent.left) / parent.width * 100;
    const ny = ((oy + dy) - parent.top) / parent.height * 100;
    img.style.left = clamp(nx,5,95)+'%';
    img.style.top = clamp(ny,5,95)+'%';
  };
  const end=()=>{
    dragging=false; img.style.cursor='move'; savePlaced();
  };
  img.addEventListener('mousedown', start); img.addEventListener('touchstart', start, {passive:true});
  window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, {passive:false});
  window.addEventListener('mouseup', end); window.addEventListener('touchend', end);

  zone.appendChild(img);
  savePlaced();
}

function savePlaced(){
  const chips=[...document.querySelectorAll('.topping-chip')];
  state.placed = chips.map(el=>{
    return { id: ING.find(i=> el.src.includes(i.id))?.id || 'unknown', x:parseFloat(el.style.left), y:parseFloat(el.style.top) };
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

function renderBuild(){
  $('#build-count').textContent = String(state.placed.length);
  const drop=$('#build-drop'); drop.innerHTML='';
  state.placed.forEach(p=> spawnChip(p.id));
}

let bakeTimer=null;
function startBake(){
  if(state.baking.running) return;
  state.baking.running=true; state.baking.t=0; state.baking.p=0; state.baking.inWin=false;
  $('#oven-img').src='images/oven_open.png';
  clearInterval(bakeTimer);
  bakeTimer=setInterval(()=>{
    state.baking.t+=100; const p = clamp(state.baking.t/state.baking.dur, 0, 1);
    state.baking.p = p;
    $('#bake-bar').style.width = (p*100)+'%';
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
  const q = clamp(0.82 + (state.scores.top/100)*0.10*topW + (state.scores.bake/100)*0.10*bakeW, 0.82, 0.97);
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
