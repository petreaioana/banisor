(()=>{
  // Merge helpers
  const deepClone=o=>JSON.parse(JSON.stringify(o||{}));
  const mergeStates=(a,b)=>{const base=deepClone(a||{});const aLei=a&&a.lei||0,bLei=b&&b.lei||0;base.lei=Math.max(aLei,bLei);const aDay=a?.progress?.cookies?.day??1,bDay=b?.progress?.cookies?.day??1;const aBest=a?.progress?.cookies?.profitBest??0,bBest=b?.progress?.cookies?.profitBest??0;base.progress=base.progress||{};base.progress.cookies=base.progress.cookies||{};base.progress.cookies.day=Math.max(aDay,bDay);base.progress.cookies.profitBest=Math.max(aBest,bBest);base.meta={...(a?.meta||{}),...(b?.meta||{})};return {...a,...b,...base};};

  // Load/save state: localStorage + cookie + session
  function loadState(){
    let local=null; try{local=JSON.parse(localStorage.getItem('cookie_profile')||'null')}catch(e){}
    const server=window.__SERVER_STATE__||null;
    const def={lei:0, progress:{cookies:{day:1, profitBest:0}}, meta:{introSeen:false}};
    if(server && local) return mergeStates(server, local);
    if(server) return mergeStates(def, server);
    if(local) return mergeStates(def, local);
    return def;
  }
  function saveState(s){
    try{ localStorage.setItem('cookie_profile', JSON.stringify(s)); }catch(e){}
    try{ document.cookie='cookie_profile='+encodeURIComponent(JSON.stringify(s))+'; path=/; max-age=31536000; samesite=Lax'; }catch(e){}
    try{
      if(navigator.sendBeacon){ const blob=new Blob([JSON.stringify(s)],{type:'application/json'}); navigator.sendBeacon('?action=save', blob); }
      else { fetch('?action=save',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(s)}); }
    }catch(e){}
  }

  let state=loadState();
  const updateLeiDisplay=()=>{ const el=document.getElementById('lei-count'); if(el) el.textContent=String(state.lei); };
  const addLei=(amount)=>{ state.lei+=amount; updateLeiDisplay(); saveState(state); celebrateBanisor(); };
  const updateCookieProgress=(data)=>{ const prog=state.progress.cookies||{}; state.progress.cookies={...prog, ...data}; saveState(state); };

  // Data
  const DECORATIONS={ 'ciocolată':{piece:'chocolate_chips.png', final:'cookie_choco.png'}, 'fructe':{piece:'strawberries.png', final:'cookie_strawberry.png'}, 'bombonele':{piece:'sprinkles.png', final:'cookie_sprinkle.png'} };
  const ORDERS=[ {decoration:'ciocolată'}, {decoration:'fructe'}, {decoration:'bombonele'} ];
  const CLIENTS=[ {emoji:'🧒', name:'Maria'}, {emoji:'🧑', name:'Ion'}, {emoji:'🐻', name:'Ursuleț'}, {emoji:'🦊', name:'Vulpița'} ];
  let currentOrder=null, currentClient=null; let currentExtras={cacao:false, cocos:false};

  // Station bar
  const renderStationBar=(active)=>{ document.querySelectorAll('.station-bar').forEach(el=>el.remove()); const bar=document.createElement('div'); bar.className='station-bar'; ['Mixare','Coacere','Decorare'].forEach(name=>{ const div=document.createElement('div'); div.className='station'; div.textContent=name; if(name===active) div.classList.add('active'); bar.appendChild(div); }); document.body.appendChild(bar); };

  // Banisor SVG
  function buildBanisorSprite(sizePx=120){ const wrap=document.createElement('div'); wrap.className='banisor-sprite'; wrap.style.width=sizePx+'px'; wrap.style.height=sizePx+'px'; wrap.innerHTML=`
    <svg viewBox="0 0 200 200" aria-label="Banisor animat" role="img">
      <ellipse cx="100" cy="185" rx="45" ry="10" fill="#d3b37a" opacity=".35"/>
      <g fill="#f0a82a" stroke="#c67a12" stroke-width="4">
        <path d="M75 160 q-8 12 8 18 h18 q10-2 6-10 q-6-14-32-8z"/>
        <path d="M127 160 q8 12-8 18 h-18 q-10-2-6-10 q6-14 32-8z"/>
      </g>
      <g fill="#f0a82a" stroke="#c67a12" stroke-width="6" class="hand-wave">
        <path d="M150 110 q25 5 25 25" fill="none"/>
        <circle cx="175" cy="135" r="14" />
        <circle cx="165" cy="128" r="6" />
        <circle cx="184" cy="142" r="6" />
      </g>
      <g fill="#f0a82a" stroke="#c67a12" stroke-width="6">
        <path d="M50 110 q-25 5 -25 25" fill="none"/>
        <circle cx="25" cy="135" r="14" />
        <circle cx="35" cy="128" r="6" />
        <circle cx="16" cy="142" r="6" />
      </g>
      <defs>
        <radialGradient id="g1" cx="35%" cy="35%">
          <stop offset="0%"  stop-color="#ffe58a"/>
          <stop offset="60%" stop-color="#ffd053"/>
          <stop offset="100%" stop-color="#f2a62b"/>
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="68" fill="url(#g1)" stroke="#c67a12" stroke-width="8"/>
      <circle cx="100" cy="100" r="56" fill="none" stroke="#ffde82" stroke-width="10" opacity=".9"/>
      <g stroke="#c67a12" stroke-width="4" opacity=".6">
        <line x1="155" y1="60"  x2="165" y2="62"/>
        <line x1="160" y1="75"  x2="170" y2="78"/>
        <line x1="164" y1="92"  x2="175" y2="95"/>
        <line x1="165" y1="110" x2="176" y2="112"/>
        <line x1="160" y1="128" x2="170" y2="130"/>
      </g>
      <circle cx="75" cy="112" r="9" fill="#f2a035" opacity=".8"/>
      <circle cx="125" cy="112" r="9" fill="#f2a035" opacity=".8"/>
      <g class="eye"><circle cx="80" cy="95" r="14" fill="#fff"/><circle cx="80" cy="98" r="7" fill="#2a2a2a"/><circle cx="76" cy="92" r="3.5" fill="#fff"/></g>
      <g class="eye"><circle cx="120" cy="95" r="14" fill="#fff"/><circle cx="120" cy="98" r="7" fill="#2a2a2a"/><circle cx="116" cy="92" r="3.5" fill="#fff"/></g>
      <path d="M68 82 q12-10 24 0" fill="none" stroke="#a86a12" stroke-width="5" stroke-linecap="round"/>
      <path d="M108 82 q12-10 24 0" fill="none" stroke="#a86a12" stroke-width="5" stroke-linecap="round"/>
      <circle cx="100" cy="108" r="6" fill="#ffcf59" stroke="#c67a12" stroke-width="2"/>
      <path d="M85 120 q15 18 30 0 q-7 18-30 0z" fill="#d3542f" stroke="#a63b1c" stroke-width="3"/>
      <path d="M96 132 q7 6 14 0" fill="none" stroke="#e97b57" stroke-width="3" stroke-linecap="round"/>
      <g class="hat">
        <ellipse cx="100" cy="52" rx="46" ry="12" fill="#1e8da1" stroke="#0f5e6b" stroke-width="5"/>
        <path d="M65 45 q35-25 70 0 v22 h-70z" fill="#1da0b4" stroke="#0f5e6b" stroke-width="5" />
        <path d="M60 55 q40-18 80 0" fill="none" stroke="#147a8a" stroke-width="5" stroke-linecap="round"/>
      </g>
    </svg>`;
    wrap.addEventListener('click',()=>{ wrap.classList.remove('spin-once'); void wrap.offsetWidth; wrap.classList.add('spin-once'); });
    return wrap;
  }
  const createBanisor=(text)=>{ const c=document.createElement('div'); c.className='banisor'; c.appendChild(buildBanisorSprite(120)); const p=document.createElement('p'); p.textContent=text; c.appendChild(p); return c; };
  const celebrateBanisor=()=>{ const el=document.querySelector('.banisor-counter .banisor-sprite'); if(!el) return; el.classList.remove('spin-once'); void el.offsetWidth; el.classList.add('spin-once'); };

  // Financial decisions
  let financialStep=0, ingredientQuality=2, equipmentLevel=0, priceChoice=2, marketingLevel=0, hasInsurance=false, loanAmount=0;
  const financialDecisions=[
    {title:'Ce fel de ingrediente folosim?', description:'Alege tipul ingredientelor: gust și cost diferite.', options:[
      {text:'Ieftine (10 lei)', effect:()=>{ state.lei-=10; ingredientQuality=1; alert('Ingrediente ieftine: cost mic, gust mai slab.'); }},
      {text:'Normale (20 lei)', effect:()=>{ state.lei-=20; ingredientQuality=2; alert('Echilibru între cost și gust.'); }},
      {text:'Premium (30 lei)', effect:()=>{ state.lei-=30; ingredientQuality=3; alert('Gust foarte bun, cost mai mare.'); }}
    ]},
    {title:'Ce unelte folosim?', description:'Unelte mai bune cresc producția.', options:[
      {text:'Fără unelte noi', effect:()=>{ equipmentLevel=0; alert('Rămâi la baza: producție mică.'); }},
      {text:'Mixer (50 lei)', effect:()=>{ if(state.lei>=50){ state.lei-=50; equipmentLevel=1; alert('Mixer cumpărat: aluat mai mult.'); } else alert('Fonduri insuficiente.'); }},
      {text:'Cuptor (200 lei)', effect:()=>{ if(state.lei>=200){ state.lei-=200; equipmentLevel=2; alert('Cuptor electric: coacere rapidă.'); } else alert('Fonduri insuficiente.'); }}
    ]},
    {title:'Cât costă un biscuite?', description:'Alege un preț potrivit.', options:[
      {text:'Mic (2 lei)', effect:()=>{ priceChoice=1; alert('Vânzare rapidă, profit mic.'); }},
      {text:'Mediu (5 lei)', effect:()=>{ priceChoice=2; alert('Echilibru viteză/profit.'); }},
      {text:'Mare (10 lei)', effect:()=>{ priceChoice=3; alert('Mai puțini clienți, profit per bucată mai mare.'); }}
    ]},
    {title:'Facem reclamă?', description:'Atragere de clienți noi.', options:[
      {text:'Deloc', effect:()=>{ marketingLevel=0; alert('Vin cei care te cunosc.'); }},
      {text:'Pliante (30 lei)', effect:()=>{ if(state.lei>=30){ state.lei-=30; marketingLevel=1; alert('Câțiva clienți noi.'); } else alert('Fonduri insuficiente.'); }},
      {text:'Online (100 lei)', effect:()=>{ if(state.lei>=100){ state.lei-=100; marketingLevel=2; alert('Mulți clienți noi!'); } else alert('Fonduri insuficiente.'); }}
    ]},
    {title:'Cum gestionăm banii?', description:'Economisește, reinvestește sau cheltuiește.', options:[
      {text:'Economisim', effect:()=>{ const g=Math.floor(state.lei*0.05); state.lei+=g; alert('Economisire +5%'); }},
      {text:'Reinvestim', effect:()=>{ alert('Reinvestiția te ajută pe viitor.'); }},
      {text:'Răsfăț', effect:()=>{ const spent=Math.min(20,state.lei); state.lei-=spent; alert('Distracție acum, buget mai mic.'); }}
    ]},
    {title:'Protecție la surprize?', description:'Evenimente neașteptate pot apărea.', options:[
      {text:'Împrumut (100 lei)', effect:()=>{ loanAmount+=100; state.lei+=100; alert('Împrumut luat.'); }},
      {text:'Asigurare (20 lei)', effect:()=>{ if(state.lei>=20){ state.lei-=20; hasInsurance=true; alert('Ești asigurat.'); } else alert('Fonduri insuficiente.'); }},
      {text:'Nimic', effect:()=>{ alert('Riști pierderi când apare neprevăzutul.'); }}
    ]}
  ];

  function showFinancialDecision(){
    clearGame(); if(financialStep>=financialDecisions.length){ financialStep=0; showOrderScreen(); return; }
    const dec=financialDecisions[financialStep]; const root=document.getElementById('cookie-game'); const s=document.createElement('div'); s.className='screen active-screen scene-shop';
    const h=document.createElement('h2'); h.textContent=dec.title; s.appendChild(h); const p=document.createElement('p'); p.textContent=dec.description; s.appendChild(p);
    dec.options.forEach(opt=>{ const b=document.createElement('button'); b.textContent=opt.text; b.addEventListener('click',()=>{ opt.effect(); updateLeiDisplay(); saveState(state); financialStep++; showFinancialDecision(); }); s.appendChild(b); });
    s.appendChild(createBanisor('Alege o opțiune pentru a învăța despre bani!'));
    root.appendChild(s);
  }

  // Helpers
  const clearGame=()=>{ const root=document.getElementById('cookie-game'); root.innerHTML=''; };

  // Screens
  function showOrderScreen(){
    clearGame(); renderStationBar(''); currentOrder=ORDERS[Math.floor(Math.random()*ORDERS.length)]; currentClient=CLIENTS[Math.floor(Math.random()*CLIENTS.length)];
    const root=document.getElementById('cookie-game'); const s=document.createElement('div'); s.className='screen active-screen scene-shop';
    const orderNumber=(state.progress.cookies && state.progress.cookies.day) ? state.progress.cookies.day : 1;
    const ticket=document.createElement('div'); ticket.className='order-ticket pulse'; ticket.textContent='Comanda '+orderNumber; s.appendChild(ticket);
    const client=document.createElement('div'); client.className='client-right idle'; client.textContent=currentClient.emoji; s.appendChild(client);
    const bubble=document.createElement('div'); bubble.className='speech-bubble'; const oImg=document.createElement('img'); oImg.src=DECORATIONS[currentOrder.decoration].final; oImg.style.width='80px'; oImg.style.height='80px'; bubble.appendChild(oImg); s.appendChild(bubble);
    const panel=document.createElement('div'); panel.className='panel'; panel.innerHTML='<strong>Bun venit la FinKids Biscuiți!</strong><br>'+currentClient.name+' dorește un biscuite cu <em>'+currentOrder.decoration+'</em>.<br>Banisor te așteaptă după tejghea!'; s.appendChild(panel);
    const btn=document.createElement('button'); btn.textContent='Intră în bucătărie'; btn.addEventListener('click', showMixScreen); s.appendChild(btn);
    const ban=document.createElement('div'); ban.className='banisor-counter'; ban.appendChild(buildBanisorSprite(140)); s.appendChild(ban);
    root.appendChild(s);
  }

  function showMixScreen(){
    clearGame(); currentExtras={cacao:false, cocos:false}; renderStationBar('Mixare');
    const root=document.getElementById('cookie-game'); const s=document.createElement('div'); s.className='screen active-screen scene-worktop';
    const h=document.createElement('h2'); h.textContent='Pregătirea aluatului'; const p=document.createElement('p'); p.textContent='Trage ingredientele în bol pentru aluat.'; s.appendChild(h); s.appendChild(p);
    const bowl=document.createElement('div'); bowl.className='bowl'; let addedBase=0; const mixExtras={cacao:false, cocos:false}; const baseKeys=['faina','zahar','lapte']; let mixBtnShown=false;
    bowl.addEventListener('dragover',e=>e.preventDefault()); bowl.addEventListener('drop',e=>{ e.preventDefault(); const key=e.dataTransfer.getData('text/plain'); const item=document.querySelector('.ingredient-slot[data-key="'+key+'"]'); if(item && !item.classList.contains('used')){ item.classList.add('used'); if(baseKeys.includes(key)) addedBase++; if(key==='cacao') mixExtras.cacao=true; if(key==='cocos') mixExtras.cocos=true; const ing=ingredientsMaster.find(o=>o.key===key); if(ing){ const drop=document.createElement('img'); drop.src=ing.img; drop.className='drop-in'; const rect=bowl.getBoundingClientRect(); const size=Math.min(rect.width*0.12,50); drop.style.width=size+'px'; drop.style.height=size+'px'; drop.style.left=(rect.width*0.15+Math.random()*rect.width*0.7)+'px'; drop.style.top=(rect.height*0.1+Math.random()*rect.height*0.5)+'px'; bowl.appendChild(drop);} if(addedBase>=3 && !mixBtnShown){ mixBtn.style.display='inline-block'; mixBtnShown=true; } } });
    s.appendChild(bowl);
    const ingredientsMaster=[ {key:'faina', img:'flour.png', name:'Făină'}, {key:'zahar', img:'sugar.png', name:'Zahăr'}, {key:'lapte', img:'milk.png', name:'Lapte'}, {key:'cacao', img:'cacao.png', name:'Cacao'}, {key:'cocos', img:'coconut.png', name:'Nucă de cocos'} ];
    const board=document.createElement('div'); board.className='ingredients-board'; ingredientsMaster.forEach((ing,i)=>{ const slot=document.createElement('div'); slot.className='ingredient-slot'; slot.dataset.key=ing.key; slot.style.animationDelay=(i*0.1)+'s'; const img=document.createElement('img'); img.src=ing.img; img.alt=ing.name; img.setAttribute('draggable','true'); img.addEventListener('dragstart',ev=>{ ev.dataTransfer.setData('text/plain', ing.key); }); slot.appendChild(img); const label=document.createElement('div'); label.className='ingredient-name'; label.textContent=ing.name; const wrap=document.createElement('div'); wrap.style.display='flex'; wrap.style.flexDirection='column'; wrap.style.alignItems='center'; wrap.appendChild(slot); wrap.appendChild(label); board.appendChild(wrap); });
    s.appendChild(board);
    const mixBtn=document.createElement('button'); mixBtn.textContent='Amestecă și coace'; mixBtn.style.display='none'; mixBtn.style.position='absolute'; mixBtn.style.bottom='1.2rem'; mixBtn.style.left='50%'; mixBtn.style.transform='translateX(-50%)'; mixBtn.addEventListener('click',()=>{ currentExtras={...mixExtras}; showBakeScreen(); }); s.appendChild(mixBtn);
    s.appendChild(createBanisor('Adaugă făină, zahăr, lapte + (opțional) cacao sau cocos.'));
    root.appendChild(s);
  }

  function showBakeScreen(){
    clearGame(); renderStationBar('Coacere'); const root=document.getElementById('cookie-game'); const s=document.createElement('div'); s.className='screen active-screen scene-kitchen';
    const h=document.createElement('h2'); h.textContent='Coacerea biscuitului'; s.appendChild(h);
    const oven=document.createElement('div'); oven.className='oven-animation-container'; const ovenImg=document.createElement('img'); ovenImg.src='oven_open.png'; ovenImg.alt='Cuptor'; ovenImg.className='oven-image'; oven.appendChild(ovenImg);
    const tray=document.createElement('div'); tray.className='baking-tray'; const cookie=document.createElement('img'); cookie.className='cookie-on-tray'; let bakeSrc='cookie_bake_plain.png'; if(currentExtras.cacao) bakeSrc='cookie_bake_cacao.png'; if(currentExtras.cocos) bakeSrc='cookie_bake_cocos.png'; cookie.src=bakeSrc; cookie.alt='Biscuite pe tavă'; tray.appendChild(cookie); oven.appendChild(tray); s.appendChild(oven);
    const prog=document.createElement('div'); prog.className='progress-container'; const bar=document.createElement('div'); bar.className='progress-bar'; prog.appendChild(bar); s.appendChild(prog);
    s.appendChild(createBanisor('Așteaptă puțin până se coace biscuitele.'));
    root.appendChild(s);
    let elapsed=0; const t=setInterval(()=>{ elapsed+=100; bar.style.width=Math.min(100,(elapsed/3000)*100)+'%'; if(elapsed>=3000){ clearInterval(t); showDecorateScreen(); } },100);
    setTimeout(()=>{ ovenImg.src='oven_closed.png'; tray.style.opacity='0'; },600);
    setTimeout(()=>{ ovenImg.src='oven_open.png'; tray.style.opacity='1'; },2400);
  }

  function showDecorateScreen(){
    clearGame(); renderStationBar('Decorare'); const root=document.getElementById('cookie-game'); const s=document.createElement('div'); s.className='screen active-screen scene-kitchen';
    const h=document.createElement('h2'); h.textContent='Ornarea biscuitului'; const p=document.createElement('p'); p.textContent='Trage decorațiunea pe biscuite.'; s.appendChild(h); s.appendChild(p);
    const cont=document.createElement('div'); cont.className='cookie-container'; const base=document.createElement('div'); base.className='cookie-base'; cont.appendChild(base);
    const drop=document.createElement('div'); drop.style.position='absolute'; drop.style.inset='0'; cont.appendChild(drop);
    let pieces=0; let serveBtn;
    drop.addEventListener('dragover',e=>e.preventDefault()); drop.addEventListener('drop', e=>{ e.preventDefault(); const decor=e.dataTransfer.getData('text/plain'); if(decor===currentOrder.decoration){ const part=document.createElement('img'); part.src=DECORATIONS[currentOrder.decoration].piece; part.className='topping-img'; part.style.position='absolute'; part.style.left='75px'; part.style.top='75px'; part.style.width='30px'; part.style.height='30px'; cont.appendChild(part); pieces++; if(pieces>=1){ setTimeout(()=>{ cont.innerHTML=''; const final=document.createElement('img'); final.src=DECORATIONS[currentOrder.decoration].final; final.style.width='180px'; final.style.height='180px'; final.style.borderRadius='50%'; cont.appendChild(final); serveBtn.style.display='inline-block'; },500);} } else { cont.classList.add('shake'); setTimeout(()=>cont.classList.remove('shake'),450); alert('Decor greșit pentru comanda curentă.'); } });
    s.appendChild(cont);
    const tops=document.createElement('div'); tops.className='toppings-container'; const t=document.createElement('img'); t.src=DECORATIONS[currentOrder.decoration].piece; t.className='topping-img'; t.setAttribute('draggable','true'); t.addEventListener('dragstart',ev=>{ ev.dataTransfer.setData('text/plain', currentOrder.decoration); }); tops.appendChild(t); s.appendChild(tops);
    serveBtn=document.createElement('button'); serveBtn.textContent='Servește biscuitele'; serveBtn.style.display='none'; serveBtn.addEventListener('click', showServeScreen); s.appendChild(serveBtn);
    s.appendChild(createBanisor('Decorează cu grijă biscuitele.'));
    root.appendChild(s);
  }

  function showServeScreen(){
    clearGame(); document.querySelectorAll('.station-bar').forEach(el=>el.remove());
    const root=document.getElementById('cookie-game'); const s=document.createElement('div'); s.className='screen active-screen scene-shop';
    const h=document.createElement('h2'); h.textContent='Livrarea biscuitului'; const msg=document.createElement('p'); msg.textContent=currentClient.name+' a primit biscuitele și este fericit!'; s.appendChild(h); s.appendChild(msg);
    const final=document.createElement('img'); final.src=DECORATIONS[currentOrder.decoration].final; final.style.width='180px'; final.style.height='180px'; final.style.borderRadius='50%'; s.appendChild(final);
    addLei(3);
    const nextDay=(state.progress.cookies.day||1)+1; const best=Math.max(state.progress.cookies.profitBest||0, 3); updateCookieProgress({day:nextDay, profitBest:best});
    const panel=document.createElement('div'); panel.className='panel'; panel.innerHTML='<strong>Rezumat:</strong><br>Mixare: <span style="color:#d87b00">100%</span><br>Coacere: <span style="color:#d87b00">100%</span><br>Decorare: <span style="color:#d87b00">100%</span><br><br>Total lei: <span style="color:#d87b00">'+state.lei+'</span>'; s.appendChild(panel);
    const again=document.createElement('button'); again.textContent='Prepară alt biscuite'; again.addEventListener('click', showOrderScreen);
    const exit=document.createElement('button'); exit.textContent='Închide jocul'; exit.addEventListener('click',()=>alert('Mulțumim că ai jucat!'));
    s.appendChild(again); s.appendChild(exit); s.appendChild(createBanisor('Bravo! Biscuite delicios!'));
    root.appendChild(s);
    createConfetti(); setTimeout(showFinancialDecision, 500);
  }

  // Confetti
  function createConfetti(){ const colors=['#f9c74f','#f9844a','#90be6d','#fda65f','#87b6e5','#f27ba5']; const c=document.createElement('div'); c.className='confetti-container'; for(let i=0;i<40;i++){ const p=document.createElement('div'); p.className='confetti-piece'; p.style.backgroundColor=colors[Math.floor(Math.random()*colors.length)]; p.style.left=Math.random()*100+'%'; p.style.animationDelay=(Math.random()*0.5)+'s'; c.appendChild(p);} document.body.appendChild(c); setTimeout(()=>{ if(document.body.contains(c)) document.body.removeChild(c); },3000); }

  // Intro modal
  function showIntro(){ const overlay=document.createElement('div'); overlay.className='modal-overlay'; const m=document.createElement('div'); m.className='modal'; const h2=document.createElement('h2'); h2.textContent='Bun venit în Simulatorul Biscuiți FinKids!'; const content=document.createElement('div'); content.innerHTML='<p>Ghid rapid:</p><ul><li><strong>Mixare</strong>: tragi făină, zahăr, lapte (opțional cacao/cocos).</li><li><strong>Coacere</strong>: urmărești tava în cuptor.</li><li><strong>Decorare</strong>: tragi decorațiunea potrivită.</li><li><strong>Servește</strong>: câștigi lei și iei decizii financiare.</li><li><strong>Progres</strong>: salvat în browser, cookie și sesiune.</li></ul>';
    const mascot=document.createElement('div'); mascot.style.display='flex'; mascot.style.gap='12px'; mascot.style.alignItems='center'; mascot.appendChild(buildBanisorSprite(150)); const tip=document.createElement('div'); tip.textContent='Sfat: click pe Banisor pentru o rotire!'; mascot.appendChild(tip);
    const footer=document.createElement('div'); footer.className='footer'; const label=document.createElement('label'); const chk=document.createElement('input'); chk.type='checkbox'; chk.id='dontshow'; label.appendChild(chk); label.appendChild(document.createTextNode('Nu mai arăta data viitoare'));
    const start=document.createElement('button'); start.textContent='Start jocul'; start.addEventListener('click',()=>{ if(chk.checked){ state.meta=state.meta||{}; state.meta.introSeen=true; saveState(state);} document.body.removeChild(overlay); showOrderScreen(); });
    footer.appendChild(label); footer.appendChild(start);
    m.appendChild(h2); m.appendChild(content); m.appendChild(mascot); m.appendChild(footer); overlay.appendChild(m); document.body.appendChild(overlay);
  }

  function showIntroIfNeeded(){ if(state?.meta?.introSeen) { showOrderScreen(); } else { showIntro(); } }

  // Global interactions
  document.addEventListener('click', (e)=>{ const n=e.target; if(n && n.closest){ const b=n.closest('.banisor-sprite'); if(b){ b.classList.remove('spin-once'); void b.offsetWidth; b.classList.add('spin-once'); } } });

  // Start
  window.addEventListener('DOMContentLoaded', ()=>{ updateLeiDisplay(); showIntroIfNeeded(); });
})();

