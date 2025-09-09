<?php
declare(strict_types=1);
session_start();

// Endpoint pentru salvare progres în sesiune + cookie
if (isset($_GET['action']) && $_GET['action'] === 'save') {
    header('Content-Type: application/json; charset=utf-8');
    $raw = file_get_contents('php://input');
    $ok = false;
    if ($raw !== false && strlen($raw) < 3800) { // sub limita de cookie (~4KB)
        $data = json_decode($raw, true);
        if (is_array($data)) {
            $_SESSION['cookie_profile'] = $data;
            @setcookie('cookie_profile', json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES), time()+31536000, '/', '', false, true);
            $ok = true;
        }
    }
    echo json_encode(['ok' => $ok]);
    exit;
}

// Stare inițială din sesiune/cookie
$serverState = [ 'lei' => 0, 'progress' => ['cookies' => ['day' => 1, 'profitBest' => 0]], 'meta' => ['introSeen' => false] ];
if (!empty($_SESSION['cookie_profile']) && is_array($_SESSION['cookie_profile'])) {
    $serverState = array_replace_recursive($serverState, $_SESSION['cookie_profile']);
} elseif (!empty($_COOKIE['cookie_profile'])) {
    $decoded = json_decode((string)$_COOKIE['cookie_profile'], true);
    if (is_array($decoded)) { $serverState = array_replace_recursive($serverState, $decoded); }
}

// Citește index.html existent (păstrăm designul)
$html = @file_get_contents(__DIR__ . DIRECTORY_SEPARATOR . 'index.html');
if ($html === false) {
    $html = "<!doctype html><html><head><meta charset=\\"utf-8\\"><title>Lipsește index.html</title></head><body><p>Nu am găsit index.html. Te rog adaugă-l în același folder.</p></body></html>";
}

// Script cu starea server-ului (injectat în <head>)
$injectHead = "\n<script>window.__SERVER_STATE__ = "
    . json_encode($serverState, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)
    . ";</script>\n"
    // CSS de îmbunătățiri (non-invaziv, doar extensii/override-uri)
    . "<style>\n"
    . ".banisor .banisor-sprite{width:120px!important;height:120px!important;}\n"
    . ".banisor-counter .banisor-sprite{width:140px!important;height:140px!important;}\n"
    . ".order-ticket.pulse{animation:pulseGlow 2.2s ease-in-out infinite;}\n@keyframes pulseGlow{0%,100%{box-shadow:0 0 0 0 rgba(229,169,55,.0)}50%{box-shadow:0 0 0 8px rgba(229,169,55,.35)}}\n"
    . ".client-right.idle{animation:clientEnterFromRight 1s forwards,clientIdle 3.2s ease-in-out 1s infinite;}\n@keyframes clientIdle{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-4px) rotate(-1deg)}}\n"
    . ".ingredient-slot{transition:transform .2s ease,box-shadow .2s ease,opacity .2s ease;}\n.ingredient-slot:hover{transform:translateY(-3px) scale(1.05);box-shadow:0 6px 12px rgba(0,0,0,.2)}\n"
    . ".spin-once{animation:spinOnce .8s ease-out 1;}@keyframes spinOnce{from{transform:rotate(0)}to{transform:rotate(360deg)}}\n"
    . ".shake{animation:shake .4s ease both;}@keyframes shake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-4px)}40%,60%{transform:translateX(4px)}}\n"
    . "</style>\n";

// Script cu funcții suplimentare și persistență (injectat înainte de </body>)
$injectFooter = "\n<script>(function(){\n\nfunction deepClone(o){try{return JSON.parse(JSON.stringify(o||{}))}catch(e){return {}}}\nfunction mergeStates(a,b){var base=deepClone(a||{});var aLei=(a&&a.lei)||0,bLei=(b&&b.lei)||0;base.lei=Math.max(aLei,bLei);var aDay=(a&&a.progress&&a.progress.cookies&&a.progress.cookies.day)||1;var bDay=(b&&b.progress&&b.progress.cookies&&b.progress.cookies.day)||1;var aBest=(a&&a.progress&&a.progress.cookies&&a.progress.cookies.profitBest)||0;var bBest=(b&&b.progress&&b.progress.cookies&&b.progress.cookies.profitBest)||0;base.progress=base.progress||{};base.progress.cookies=base.progress.cookies||{};base.progress.cookies.day=Math.max(aDay,bDay);base.progress.cookies.profitBest=Math.max(aBest,bBest);base.meta=Object.assign({},(a&&a.meta)||{},(b&&b.meta)||{});return Object.assign({},a,b,base)}\n\n// Forțăm top bar să afișeze corect "Lei:"
var leiEl=document.querySelector('.lei-display'); if(leiEl){ leiEl.innerHTML='Lei: <span id="lei-count">'+(window.state&&window.state.lei||0)+'</span>'; }
\n// Reconfigurează state combinând localStorage cu sesiunea server
try{var server=window.__SERVER_STATE__||null; if(server){var local=null; try{local=JSON.parse(localStorage.getItem('cookie_profile')||'null')}catch(e){} var merged=mergeStates(server, local||{}); window.state=merged; try{localStorage.setItem('cookie_profile', JSON.stringify(merged))}catch(e){}}}catch(e){}
\n// Suprascrie saveState pentru a salva în cookie + sesiune
window.saveState=function(s){try{localStorage.setItem('cookie_profile', JSON.stringify(s))}catch(e){} try{document.cookie='cookie_profile='+encodeURIComponent(JSON.stringify(s))+'; path=/; max-age=31536000; samesite=Lax'}catch(e){} try{if(navigator.sendBeacon){var blob=new Blob([JSON.stringify(s)],{type:'application/json'}); navigator.sendBeacon('?action=save', blob)}else{fetch('?action=save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)})}}catch(e){}};
\n// Rotire Banisor la click (delegare)
document.addEventListener('click',function(e){var n=e.target; if(n && n.closest){ var b=n.closest('.banisor-sprite'); if(b){ b.classList.remove('spin-once'); void b.offsetWidth; b.classList.add('spin-once'); } }});
\n// Suprascrie addLei ca să declanșeze celebrarea
var oldUpdate=window.updateLeiDisplay||function(){}; window.addLei=function(amount){ window.state=(window.state||{lei:0}); window.state.lei=(window.state.lei||0)+amount; oldUpdate(); window.saveState(window.state); var el=document.querySelector('.banisor-counter .banisor-sprite'); if(el){ el.classList.remove('spin-once'); void el.offsetWidth; el.classList.add('spin-once'); }};
\n// Marcare client animat după apariție
var cg=document.getElementById('cookie-game'); if(cg){ var obs=new MutationObserver(function(m){ m.forEach(function(x){ (x.addedNodes||[]).forEach(function(n){ if(n.nodeType===1){ var c=n.querySelector && n.querySelector('.client-right'); if(c){ c.classList.add('idle'); } var t=n.querySelector && n.querySelector('.order-ticket'); if(t){ t.classList.add('pulse'); } } }); }); }); obs.observe(cg,{childList:true,subtree:true}); }
\n// Intro modal & ghid
function showIntro(){ var overlay=document.createElement('div'); overlay.className='modal-overlay'; var modal=document.createElement('div'); modal.className='modal'; var h2=document.createElement('h2'); h2.textContent='Bun venit în Simulatorul Biscuiți FinKids!'; var content=document.createElement('div'); content.innerHTML='<p>Ghid rapid:</p><ul><li><strong>Mixare</strong>: tragi făină, zahăr, lapte în bol (poți adăuga cacao sau nucă de cocos).</li><li><strong>Coacere</strong>: urmărești tava și progresul în cuptor.</li><li><strong>Decorare</strong>: tragi decorațiunea potrivită pe biscuite.</li><li><strong>Servește</strong>: câștigi lei și iei decizii financiare educative.</li><li><strong>Progres</strong>: se salvează în browser, cookie și sesiune.</li></ul>'; var mascot=document.createElement('div'); mascot.style.display='flex'; mascot.style.gap='12px'; mascot.style.alignItems='center'; mascot.innerHTML='<div class="banisor"><div class="banisor-sprite" style="width:150px;height:150px"></div><p></p></div><div>Sfat: dă click pe Banisor pentru un mic truc!</div>'; var footer=document.createElement('div'); footer.className='footer'; var label=document.createElement('label'); var chk=document.createElement('input'); chk.type='checkbox'; chk.id='dontshow'; label.appendChild(chk); label.appendChild(document.createTextNode('Nu mai arată data viitoare')); var btn=document.createElement('button'); btn.textContent='Start jocul'; btn.addEventListener('click', function(){ window.state=window.state||{}; window.state.meta=window.state.meta||{}; if(chk.checked){ window.state.meta.introSeen=true; window.saveState(window.state); } document.body.removeChild(overlay); }); footer.appendChild(label); footer.appendChild(btn); modal.appendChild(h2); modal.appendChild(content); modal.appendChild(mascot); modal.appendChild(footer); overlay.appendChild(modal); document.body.appendChild(overlay); }); }
\nfunction ensureIntro(){ try{ var seen = !!(window.state && window.state.meta && window.state.meta.introSeen); if(!seen){ showIntro(); } }catch(e){} }
window.addEventListener('load', function(){ setTimeout(ensureIntro, 80); });
\n})();</script>\n";

// Injectează în document: în <head> și înainte de </body>
$html = preg_replace('/<\/head>/i', $injectHead . '</head>', $html, 1);
if (stripos($html, '</body>') !== false) {
    $html = preg_replace('/<\/body>/i', $injectFooter . '</body>', $html, 1);
} else {
    $html .= $injectFooter; // fallback
}

// Mic patch suplimentar: rescrie funcția showIntro (asigură lipsa erorilor de sintaxă)
$extraFix = "\n<script>window.showIntro = function(){ try{var overlay=document.createElement('div');overlay.className='modal-overlay';var modal=document.createElement('div');modal.className='modal';var h2=document.createElement('h2');h2.textContent='Bun venit în Simulator!';var p=document.createElement('p');p.textContent='Ghid: Mixare → Coacere → Decorare → Servește. Progresul se salvează automat.';var footer=document.createElement('div');footer.className='footer';var label=document.createElement('label');var chk=document.createElement('input');chk.type='checkbox';label.appendChild(chk);label.appendChild(document.createTextNode('Nu mai arăta data viitoare'));var btn=document.createElement('button');btn.textContent='Start';btn.addEventListener('click',function(){ window.state=window.state||{};window.state.meta=window.state.meta||{}; if(chk.checked){ window.state.meta.introSeen=true; window.saveState(window.state);} document.body.removeChild(overlay);});footer.appendChild(label);footer.appendChild(btn);modal.appendChild(h2);modal.appendChild(p);modal.appendChild(footer);overlay.appendChild(modal);document.body.appendChild(overlay);}catch(e){}};</script>\n";
$html = preg_replace('/<\/body>/i', $extraFix . '</body>', $html, 1);

// Servește pagina
header('Content-Type: text/html; charset=utf-8');
echo $html;
?>
