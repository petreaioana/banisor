// public/assets/js/atelier.js
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

  const state = {
    step: 'pour',
    order: null,
    sizeKey: 'M',
    fillPct: 0,
    placed: [],
    baking: {running:false, p:0, zone:[0.54,0.62], dur:3000, inWin:false, tried:false},
    scores: {pour:0, top:0, bake:0, q:0, qty:0},
  };
  let pourTimer=null, bakeTimer=null;

  const ING = [
    { id:'strawberries', name:'Căpșuni', img:'game_assets/images/strawberries.png' },
    { id:'sprinkles',    name:'Ornamente', img:'game_assets/images/sprinkles.png' },
    { id:'chocolate_chips', name:'Cipuri', img:'game_assets/images/chocolate_chips.png' },
    { id:'cacao',        name:'Cacao', img:'game_assets/images/cacao.png' },
    { id:'sugar',        name:'Zahăr', img:'game_assets/images/sugar.png' },
    { id:'coconut',      name:'Cocos', img:'game_assets/images/coconut.png' },
  ];

  function setStep(s){
    state.step = s;
    $$('#panel-pour, #panel-decor, #panel-bake, #panel-serve').forEach(el=>el.classList.add('d-none'));
    if (s==='pour')   $('#panel-pour').classList.remove('d-none');
    if (s==='decor')  $('#panel-decor').classList.remove('d-none');
    if (s==='bake')   $('#panel-bake').classList.remove('d-none');
    if (s==='serve')  $('#panel-serve').classList.remove('d-none');
    $$('.stepper li').forEach(li=>{
      li.classList.toggle('active', li.dataset.step===s);
    });
    $('#step-badge').textContent = s==='pour'?'Turnare':s==='decor'?'Decor':'Coacere'===s?'Coacere':s==='bake'?'Coacere':'Servire';
  }

  function newOrder(){
    const shapes = ['circle','heart','star'];
    const shape = shapes[Math.floor(Math.random()*shapes.length)];
    const tops = ING.slice().sort(()=>Math.random()-0.5).slice(0, 2+Math.floor(Math.random()*3)).map(t=>t.id);
    const bakeCenter = 0.54 + (Math.random()*0.06 - 0.03);
    const bakeWidth  = 0.10;
    const pourCenter = 0.80 + (Math.random()*0.06 - 0.03);
    const pourWidth  = 0.12;

    state.order = {
      size: state.sizeKey,
      shape,
      tops,
      bake: [clamp(bakeCenter-bakeWidth/2, 0.2, 0.9), clamp(bakeCenter+bakeWidth/2, 0.25, 0.95)],
      pour: [clamp(pourCenter-pourWidth/2, 0.55, 0.95), clamp(pourCenter+pourWidth/2, 0.60, 0.98)]
    };
    state.fillPct=0; state.placed=[]; state.scores={pour:0,top:0,bake:0,q:0,qty:0};
    state.baking={running:false,p:0,zone:[...state.order.bake],dur:2800+Math.floor(Math.random()*900),inWin:false,tried:false};
    paintOrder(); updateMold(); updateFill(); paintPalette(); paintBakeWindow(); renderScores();
    $('#dropzone').innerHTML='';
  }

  function paintOrder(){
    $('#ord-shape').textContent = state.order.shape==='heart'?'Inimă':state.order.shape==='star'?'Stea':'Cerc';
    $('#ord-size').textContent  = state.sizeKey;
    $('#ord-tops').textContent  = state.order.tops.map(id=> ING.find(i=>i.id===id)?.name||id).join(' + ');
  }

  function updateMold(){
    const mold=$('#shape-mold');
    mold.dataset.shape = state.order.shape;
    const px = state.sizeKey==='S'?160 : state.sizeKey==='L'?240 : 200;
    mold.style.setProperty('--size', px+'px');
  }

  function updateFill(){
    const el=$('#shape-fill');
    const pct = clamp(state.fillPct,0,1);
    el.style.height = Math.round(pct*100)+'%';
    const [a,b]=state.order.pour;
    $('#pour-pct').textContent = String(Math.round(pct*100));
    calcPourScore();
    if (pct>=a && pct<=b) $('#shape-mold').classList.add('good'); else $('#shape-mold').classList.remove('good');
  }

  function paintBakeWindow(){
    const [a,b]=state.order.bake;
    const span=$('.hit-window span');
    span.style.left = Math.round(a*100)+'%';
    span.style.width= Math.round((b-a)*100)+'%';
    $('#bake-window').textContent = `${Math.round(a*100)}–${Math.round(b*100)}%`;
  }

  function paintPalette(){
    const p=$('#palette'); p.innerHTML='';
    ING.forEach(ing=>{
      const btn=document.createElement('button');
      btn.type='button'; btn.className='btn-chip';
      btn.innerHTML=`<img src="${ing.img}" alt="${ing.name}"><span>${ing.name}</span>`;
      btn.addEventListener('click', ()=> spawnChip(ing.id, ing.img));
      p.appendChild(btn);
    });
  }

  function spawnChip(id, imgSrc){
    const z=$('#dropzone');
    const chip=document.createElement('div'); chip.className='chip'; chip.dataset.type=id;
    chip.style.left=(25+Math.random()*50)+'%';
    chip.style.top =(25+Math.random()*50)+'%';
    const img=document.createElement('img'); img.src=imgSrc; img.alt=id;
    chip.appendChild(img);

    let dragging=false, sx=0, sy=0, ox=0, oy=0, pid=0;
    chip.addEventListener('pointerdown', (e)=>{ dragging=true; pid=e.pointerId||0; chip.setPointerCapture&&chip.setPointerCapture(pid);
      const r=chip.getBoundingClientRect(); sx=e.clientX; sy=e.clientY; ox=r.left; oy=r.top; chip.style.cursor='grabbing';
    }, {passive:true});
    chip.addEventListener('pointermove', (e)=>{ if(!dragging) return;
      const rect=z.getBoundingClientRect(); const dx=e.clientX-sx, dy=e.clientY-sy;
      const nx=((ox+dx)-rect.left)/rect.width*100; const ny=((oy+dy)-rect.top)/rect.height*100;
      chip.style.left=clamp(nx,5,95)+'%'; chip.style.top=clamp(ny,5,95)+'%';
    });
    chip.addEventListener('pointerup', ()=>{ dragging=false; chip.style.cursor='grab'; savePlaced(); }, {passive:true});

    z.appendChild(chip);
    savePlaced();
  }

  function savePlaced(){
    state.placed = $$('#dropzone .chip').map(el=>({ id:el.dataset.type, x:parseFloat(el.style.left)||0, y:parseFloat(el.style.top)||0 }));
    calcTopScore(); renderScores();
  }

  function calcPourScore(){
    const [a,b]=state.order.pour; const pct=clamp(state.fillPct,0,1);
    const c=(a+b)/2, half=(b-a)/2, d=Math.abs(pct-c);
    let score = d<=half ? 70 + (1 - d/half)*30 : Math.max(0, 70 - Math.min(1,(d-half)/0.25)*60);
    state.scores.pour = Math.round(clamp(score,0,100));
  }
  function calcTopScore(){
    const want=new Set(state.order.tops), have=new Set(state.placed.map(p=>p.id));
    let pts=0; want.forEach(id=>{ if(have.has(id)) pts+=25; }); pts=Math.min(100,pts);
    if(state.placed.length>1){
      const mx=state.placed.reduce((s,p)=>s+p.x,0)/state.placed.length;
      const my=state.placed.reduce((s,p)=>s+p.y,0)/state.placed.length;
      let spread=0; state.placed.forEach(p=>{ const dx=p.x-mx, dy=p.y-my; spread+=Math.hypot(dx,dy); });
      pts = clamp(pts + clamp(spread/(state.placed.length*20),0,1)*20, 0, 100);
    }
    state.scores.top = Math.round(pts);
  }
  function computeFinal(){
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
    computeFinal();
    $('#score-pour').textContent = state.scores.pour;
    $('#score-top').textContent  = state.scores.top;
    $('#score-bake').textContent = state.scores.bake;
    $('#score-q').textContent    = state.scores.q.toFixed(2);
    $('#score-qty').textContent  = state.scores.qty;
    $('#serve-q').textContent    = state.scores.q.toFixed(2);
    $('#serve-qty').textContent  = state.scores.qty;
    $('#f-qty').value = state.scores.qty;
    $('#f-q').value   = state.scores.q.toFixed(2);
  }

  // turnare
  $('#btn-pour').addEventListener('pointerdown', (e)=>{ e.preventDefault();
    clearInterval(pourTimer); pourTimer=setInterval(()=>{ state.fillPct=clamp(state.fillPct+0.01,0,1); $('#pour-range').value=String(Math.round(state.fillPct*100)); updateFill(); },70);
  });
  ['pointerup','pointerleave','pointercancel'].forEach(ev => $('#btn-pour').addEventListener(ev, ()=>{ clearInterval(pourTimer); }));

  $('#pour-range').addEventListener('input', e=>{ state.fillPct=clamp((+e.target.value||0)/100,0,1); updateFill(); });

  // bake
  $('#btn-bake-start').addEventListener('click', ()=>{
    if (state.baking.running) return;
    state.baking.running=true; state.baking.p=0;
    $('#btn-bake-start').setAttribute('disabled','true');
    $('#btn-bake-stop').removeAttribute('disabled');
    clearInterval(bakeTimer);
    const step=90;
    bakeTimer=setInterval(()=>{
      state.baking.p = clamp(state.baking.p + step/state.baking.dur, 0, 1);
      $('#bake-bar').style.width = (state.baking.p*100)+'%';
      if (state.baking.p>=1) stopBake();
    }, step);
  });
  function stopBake(){
    if(!state.baking.running) return;
    state.baking.running=false; clearInterval(bakeTimer);
    $('#btn-bake-stop').setAttribute('disabled','true');
    const [a,b]=state.baking.zone; const p=state.baking.p;
    const c=(a+b)/2, maxD=Math.max(0.0001,(b-a)/2), d=Math.abs(p-c);
    const inWin = p>=a && p<=b;
    state.baking.inWin = inWin; state.baking.tried = true;
    state.scores.bake = Math.round(clamp(100*(1-Math.min(1,d/maxD)), 0, 100));
    $('#f-inwin').value = inWin? '1':'0';
    setStep('serve'); renderScores();
  }
  $('#btn-bake-stop').addEventListener('click', stopBake);
  document.addEventListener('keydown', (e)=>{ if(e.code==='Space' && state.step==='bake'){ e.preventDefault(); stopBake(); } });

  // navigație simplă
  $('#btn-next').addEventListener('click', ()=>{
    if (state.step==='pour')  { if (state.fillPct < state.order.pour[0]) return; setStep('decor'); return; }
    if (state.step==='decor') { if (state.placed.length<2) return; setStep('bake'); return; }
    if (state.step==='bake')  { if (!state.baking.tried) return; setStep('serve'); return; }
  });
  $('#btn-prev').addEventListener('click', ()=>{
    if (state.step==='decor') { setStep('pour'); return; }
    if (state.step==='bake')  { setStep('decor'); return; }
    if (state.step==='serve') { setStep('bake'); return; }
  });

  // setări rapide
  $('#shape-select').addEventListener('change', e=>{ state.order.shape = e.target.value; updateMold(); });
  $('#size-range').addEventListener('input', e=>{
    const map={1:'S',2:'M',3:'L'}; state.sizeKey=map[+e.target.value]||'M'; $('#size-label').textContent=state.sizeKey; state.order.size=state.sizeKey; updateMold(); renderScores();
  });

  // init
  (function init(){
    const map={1:'S',2:'M',3:'L'}; $('#size-label').textContent=map[2];
    newOrder(); setStep('pour'); updateFill();
  })();
})();
