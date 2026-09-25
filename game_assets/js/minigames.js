(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const shuffle = (items) => items.slice().sort(() => Math.random() - 0.5);
  const config = window.MINIGAMES_CONFIG || {};
  const hub = $('#hub-view');
  const play = $('#play-view');
  const stage = $('#game-stage');
  const saveStatus = $('#save-status');

  const missions = [
    { id: 'quiz', icon: '💬', category: 'Întrebări', title: 'Știi ce alegi?', description: 'Întrebări scurte despre bani, cumpărături și planuri.', coach: 'Citește toate variantele. Un răspuns bun are și o explicație.' },
    { id: 'maze', icon: '🧭', category: 'Orientare', title: 'Drumul monedei', description: 'Găsește ieșirea prin labirint și adună surprizele.', coach: 'Privește o mutare înainte. Fiecare pas deschide drumul următor.' },
    { id: 'coins', icon: '🪙', category: 'Calcul', title: 'Casa de monede', description: 'Formează suma cerută folosind monede potrivite.', coach: 'Începe cu moneda mare, apoi completează restul cu pași mici.' },
    { id: 'barter', icon: '🤝', category: 'Schimb', title: 'Troc corect', description: 'Alege un schimb clar, voluntar și folositor.', coach: 'Un schimb bun este înțeles și acceptat de ambele persoane.' },
    { id: 'number_path', icon: '🔢', category: 'Calcul', title: 'Cărarea numerelor', description: 'Treci de cinci porți cu calcule rapide.', coach: 'Calculează liniștit și verifică semnul înainte să alegi.' },
    { id: 'puzzle', icon: '🧩', category: 'Planificare', title: 'Pușculița ordonată', description: 'Refă imaginea și găsește locul fiecărei piese.', coach: 'Caută întâi colțurile, apoi marginile. Imaginea se leagă treptat.' },
    { id: 'color_lab', icon: '🎨', category: 'Idei', title: 'Laboratorul culorilor', description: 'Combină culori și descoperă rezultatul.', coach: 'Privește cele două culori ca pe două ingrediente ale aceleiași idei.' },
    { id: 'entrepreneur', icon: '🛍️', category: 'Afaceri', title: 'Micul magazin', description: 'Alege un preț care acoperă costul și ajută clientul.', coach: 'Prețul trebuie să țină cont de cost, nevoie și buget.' },
    { id: 'clock', icon: '⏰', category: 'Timp', title: 'Ceasul isteț', description: 'Pune numerele la loc și potrivește ora.', coach: 'Ora arată cât a trecut, iar un plan bun ține cont de timp.' },
  ];

  let progress = { version: 1, games: {} };
  let currentId = null;
  let cleanupCurrent = () => {};
  let gameFinished = false;

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function getMission(id) { return missions.find(item => item.id === id) || missions[0]; }

  function starsText(count) {
    const n = clamp(Number(count) || 0, 0, 3);
    return '★'.repeat(n) + '☆'.repeat(3 - n);
  }

  function updateCollection() {
    const total = Object.values(progress.games || {}).reduce((sum, game) => sum + Number(game.bestStars || 0), 0);
    const done = Object.values(progress.games || {}).filter(game => game.completed).length;
    $('#total-stars').textContent = String(total);
    $('#done-count').textContent = String(done);
  }

  function renderHub() {
    const grid = $('#mission-grid');
    grid.replaceChildren();
    missions.forEach(mission => {
      const saved = progress.games?.[mission.id] || {};
      const card = make('article', 'mission-card');
      const head = make('div', 'mission-card-head');
      head.append(make('span', 'mission-icon', mission.icon));
      const stars = make('span', 'stars' + (saved.bestStars ? '' : ' empty'), starsText(saved.bestStars));
      stars.setAttribute('aria-label', `${saved.bestStars || 0} din 3 stele`);
      head.append(stars);
      card.append(head);
      card.append(make('p', 'eyebrow', mission.category));
      card.append(make('h3', '', mission.title));
      card.append(make('p', '', mission.description));
      const action = make('div', 'mission-action');
      const playButton = make('button', 'play-button', saved.completed ? 'Joacă din nou' : 'Începe');
      playButton.type = 'button';
      playButton.addEventListener('click', () => startGame(mission.id));
      action.append(playButton);
      const attempts = make('span', 'quiet-note', saved.attempts ? `${saved.attempts} încercări` : 'Nou');
      action.append(attempts);
      card.append(action);
      grid.append(card);
    });
    updateCollection();
  }

  function setCoach(copy, fraction = 0, label = 'Misiune în desfășurare') {
    $('#coach-copy').textContent = copy;
    $('#game-progress-bar').style.width = `${clamp(fraction, 0, 1) * 100}%`;
    $('#game-progress-label').textContent = label;
  }

  function stageIntro(category, title, description) {
    const intro = make('div', 'game-intro');
    intro.append(make('p', 'eyebrow', category));
    intro.append(make('h2', '', title));
    intro.append(make('p', '', description));
    return intro;
  }

  async function loadProgress() {
    try {
      const response = await fetch('game_assets/minigames_api.php?action=state', { cache: 'no-store' });
      const data = await response.json();
      if (data.ok && data.progress) progress = data.progress;
    } catch (error) {
      try { progress = JSON.parse(localStorage.getItem('banisor-minigames') || '{"version":1,"games":{}}'); } catch (_) {}
    }
    if (!progress.games || typeof progress.games !== 'object') progress.games = {};
    renderHub();
  }

  async function saveCompletion(id, score) {
    const payload = { game: id, score: Math.round(clamp(score, 0, 100)), csrf: config.csrf || '' };
    try {
      const response = await fetch('game_assets/minigames_api.php?action=complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.ok && data.progress) {
        progress = data.progress;
        saveStatus.textContent = 'Progres salvat.';
        return data;
      }
    } catch (error) {}
    const previous = progress.games[id] || {};
    const stars = payload.score >= 85 ? 3 : payload.score >= 60 ? 2 : 1;
    progress.games[id] = {
      attempts: Number(previous.attempts || 0) + 1,
      completed: true,
      bestScore: Math.max(payload.score, Number(previous.bestScore || 0)),
      bestStars: Math.max(stars, Number(previous.bestStars || 0)),
      lastPlayed: new Date().toISOString(),
    };
    try { localStorage.setItem('banisor-minigames', JSON.stringify(progress)); } catch (_) {}
    saveStatus.textContent = 'Progresul este păstrat în acest browser.';
    return { stars };
  }

  function finishGame(score, message) {
    if (gameFinished) return;
    gameFinished = true;
    const mission = getMission(currentId);
    const safeScore = Math.round(clamp(score, 0, 100));
    const stars = safeScore >= 85 ? 3 : safeScore >= 60 ? 2 : 1;
    cleanupCurrent();
    setCoach('Ai terminat provocarea. Poți încerca din nou și îți poți îmbunătăți scorul.', 1, `${safeScore} puncte`);
    stage.replaceChildren();
    const result = make('div', 'result-card');
    result.append(make('p', 'eyebrow', 'Provocare încheiată'));
    result.append(make('h2', '', stars >= 3 ? 'Excelent!' : stars === 2 ? 'Foarte bine!' : 'Bun început!'));
    result.append(make('div', 'result-stars', starsText(stars)));
    result.append(make('p', '', `${safeScore} puncte. ${message || 'Fiecare încercare îți arată ceva nou.'}`));
    const actions = make('div', 'result-actions');
    const again = make('button', 'primary-button', 'Joacă din nou');
    again.type = 'button';
    again.addEventListener('click', () => startGame(currentId));
    const all = make('button', 'secondary-button', 'Toate provocările');
    all.type = 'button';
    all.addEventListener('click', showHub);
    actions.append(again, all);
    result.append(actions);
    stage.append(result);
    saveCompletion(currentId, safeScore).then(renderHub);
  }

  function showHub() {
    cleanupCurrent();
    currentId = null;
    gameFinished = false;
    play.hidden = true;
    hub.hidden = false;
    renderHub();
    document.getElementById('hub-title').focus?.();
  }

  function startGame(id) {
    cleanupCurrent();
    currentId = id;
    gameFinished = false;
    const mission = getMission(id);
    $('#play-icon').textContent = mission.icon;
    $('#play-category').textContent = mission.category;
    $('#play-title').textContent = mission.title;
    $('#coach-title').textContent = mission.title;
    setCoach(mission.coach, 0, 'Misiune nouă');
    hub.hidden = true;
    play.hidden = false;
    stage.replaceChildren();
    const initializer = gameInitializers[id];
    cleanupCurrent = typeof initializer === 'function' ? initializer(stage) || (() => {}) : () => {};
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('#back-to-hub').addEventListener('click', showHub);

  function initQuiz(root) {
    let disposed = false;
    let questions = [];
    let index = 0;
    let correct = 0;
    let coins = 6;
    let answered = false;
    const cleanup = () => { disposed = true; };
    root.append(make('div', 'loading', 'Se pregătesc întrebările...'));
    fetch('game_assets/minigames/quiz.json', { cache: 'no-store' })
      .then(response => response.json())
      .then(data => {
        if (disposed || currentId !== 'quiz') return;
        questions = shuffle(data.questions || []).slice(0, 10);
        renderQuestion();
      })
      .catch(() => {
        if (!disposed) root.replaceChildren(make('div', 'feedback warn', 'Întrebările nu au putut fi încărcate. Reîncearcă.'));
      });

    function renderQuestion() {
      if (disposed) return;
      answered = false;
      root.replaceChildren();
      root.append(stageIntro('Întrebări', 'Alege răspunsul care explică cel mai bine situația.', 'Fiecare răspuns vine cu o explicație scurtă.'));
      const toolbar = make('div', 'game-toolbar');
      toolbar.append(make('span', 'token-counter', `🪙 ${coins} jetoane`));
      toolbar.append(make('span', 'quiet-note', `${index + 1} din ${questions.length}`));
      root.append(toolbar);
      const question = questions[index];
      const card = make('section', 'question-card');
      card.append(make('p', 'question-number', question.topic));
      card.append(make('h3', '', question.question));
      const answers = make('div', 'answer-grid');
      const order = shuffle(question.options.map((_, optionIndex) => optionIndex));
      order.forEach(optionIndex => {
        const button = make('button', 'answer-button', question.options[optionIndex]);
        button.type = 'button';
        button.addEventListener('click', () => chooseAnswer(button, optionIndex, question, answers, nextRow));
        answers.append(button);
      });
      card.append(answers);
      const feedback = make('div', 'feedback', 'Alege o variantă.');
      feedback.setAttribute('aria-live', 'polite');
      card.append(feedback);
      const nextRow = make('div', 'next-row');
      card.append(nextRow);
      root.append(card);
      setCoach(getMission('quiz').coach, index / questions.length, `Întrebarea ${index + 1} din ${questions.length}`);
    }

    function chooseAnswer(button, optionIndex, question, answers, nextRow) {
      if (answered) return;
      answered = true;
      const good = optionIndex === Number(question.correct);
      if (good) { correct += 1; coins += 1; } else coins = Math.max(0, coins - 1);
      answers.querySelectorAll('button').forEach(item => { item.disabled = true; });
      button.classList.add(good ? 'correct' : 'wrong');
      const feedback = $('.feedback', button.closest('.question-card'));
      feedback.classList.add(good ? 'good' : 'warn');
      feedback.textContent = `${good ? 'Da.' : 'Nu chiar.'} ${question.why}`;
      const next = make('button', 'primary-button', index === questions.length - 1 ? 'Vezi rezultatul' : 'Următoarea');
      next.type = 'button';
      next.addEventListener('click', () => {
        index += 1;
        if (index >= questions.length) finishGame((correct / questions.length) * 100, `${correct} răspunsuri corecte din ${questions.length}.`);
        else renderQuestion();
      });
      nextRow.append(next);
      setCoach(good ? 'Ai găsit ideea corectă. Uită-te și la explicație.' : 'Verifică explicația și păstrează regula pentru următoarea situație.', (index + 1) / questions.length, `Jetoane: ${coins}`);
    }
    return cleanup;
  }

  function buildMaze() {
    const cells = Array.from({ length: 16 }, () => ({ top: true, right: true, bottom: true, left: true, visited: false }));
    const directions = [
      { key: 'top', opposite: 'bottom', delta: -4 }, { key: 'right', opposite: 'left', delta: 1 },
      { key: 'bottom', opposite: 'top', delta: 4 }, { key: 'left', opposite: 'right', delta: -1 },
    ];
    function walk(index) {
      cells[index].visited = true;
      shuffle(directions).forEach(direction => {
        const next = index + direction.delta;
        const sameRow = direction.key === 'right' || direction.key === 'left' ? Math.floor(index / 4) === Math.floor(next / 4) : true;
        if (next < 0 || next >= 16 || !sameRow || cells[next].visited) return;
        cells[index][direction.key] = false;
        cells[next][direction.opposite] = false;
        walk(next);
      });
    }
    walk(0);
    return cells;
  }

  function initMaze(root) {
    let disposed = false;
    let timer = null;
    let mode = 'coin';
    let cells = buildMaze();
    let position = 0;
    let moves = 0;
    let tokens = 10;
    let seconds = 0;
    let treasures = new Set(shuffle([2, 5, 9, 12]).slice(0, 3));
    let found = new Set();
    const cleanup = () => { disposed = true; if (timer) window.clearInterval(timer); document.removeEventListener('keydown', onKey); };
    document.addEventListener('keydown', onKey);
    render();
    return cleanup;

    function restart(nextMode = mode) {
      mode = nextMode;
      cells = buildMaze(); position = 0; moves = 0; seconds = 0; tokens = 10; found = new Set();
      treasures = new Set(shuffle([2, 5, 9, 12]).slice(0, 3));
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(() => {
        if (disposed) return;
        seconds += 1;
        if (seconds > 0 && seconds % 5 === 0) tokens = Math.max(0, tokens - 1);
        updateStatus();
      }, 1000);
      render();
    }
    function onKey(event) {
      const keyMap = { ArrowUp: 'top', ArrowRight: 'right', ArrowDown: 'bottom', ArrowLeft: 'left' };
      if (keyMap[event.key]) { event.preventDefault(); move(keyMap[event.key]); }
    }
    function move(direction) {
      const cell = cells[position];
      if (cell[direction]) {
        setFeedback('Zidul este acolo. Caută altă ieșire.', 'warn');
        return;
      }
      const delta = direction === 'top' ? -4 : direction === 'right' ? 1 : direction === 'bottom' ? 4 : -1;
      position += delta; moves += 1;
      if (treasures.has(position) && !found.has(position)) {
        found.add(position);
        tokens += mode === 'note' ? 3 : 1;
        setFeedback(mode === 'note' ? 'Ai găsit o bancnotă. +3 jetoane.' : 'Ai găsit o monedă. +1 jeton.', 'good');
      }
      render();
      if (position === 15) {
        if (timer) window.clearInterval(timer);
        const score = clamp(100 - Math.max(0, moves - 8) * 5 - seconds * 2 + found.size * 4, 30, 100);
        finishGame(score, `Ai ieșit în ${moves} mutări și ai strâns ${tokens} jetoane.`);
      }
    }
    function setFeedback(text, tone) {
      const feedback = $('#maze-feedback', root);
      if (feedback) { feedback.textContent = text; feedback.className = `feedback ${tone || ''}`; }
    }
    function updateStatus() {
      const counter = $('.token-counter', root);
      if (counter) counter.textContent = `🪙 ${tokens} jetoane · ${seconds}s`;
    }
    function render() {
      if (disposed) return;
      root.replaceChildren();
      root.append(stageIntro('Orientare', 'Găsește ieșirea fără să pierzi drumul.', 'Monedele și bancnotele sunt jetoane pentru această rundă.'));
      const toolbar = make('div', 'game-toolbar');
      const toggles = make('div', 'mode-toggle');
      [['coin', '🪙 Monede'], ['note', '💵 Bancnote']].forEach(([value, label]) => {
        const button = make('button', value === mode ? 'active' : '', label); button.type = 'button';
        button.addEventListener('click', () => restart(value)); toggles.append(button);
      });
      toolbar.append(toggles, make('span', 'token-counter', `🪙 ${tokens} jetoane · ${seconds}s`));
      root.append(toolbar);
      const wrap = make('div', 'maze-wrap');
      const boardSide = make('div', 'maze-board-side');
      const board = make('div', 'maze-grid');
      cells.forEach((cell, index) => {
        const tile = make('button', 'maze-cell' + (index === position ? ' current' : '') + (index === 15 ? ' exit' : '') + (index < position ? ' visited' : ''));
        tile.type = 'button';
        ['top', 'right', 'bottom', 'left'].forEach(wall => { if (cell[wall]) tile.classList.add(`wall-${wall}`); });
        if (treasures.has(index) && found.has(index)) tile.classList.add('treasure');
        tile.setAttribute('aria-label', index === position ? 'Poziția curentă' : index === 15 ? 'Ieșire' : 'Cărare');
        if (index === position) tile.append(make('span', 'maze-player', '🧍'));
        else if (index === 15) tile.append(make('span', '', '🏁'));
        board.append(tile);
      });
      boardSide.append(board);
      const controls = make('div', 'maze-controls');
      [['top', '↑', 'sus'], ['left', '←', 'stânga'], ['right', '→', 'dreapta'], ['bottom', '↓', 'jos']].forEach(([dir, label, name]) => {
        const button = make('button', '', label); button.type = 'button'; button.setAttribute('aria-label', `Mergi ${name}`); button.addEventListener('click', () => move(dir)); controls.append(button);
      });
      boardSide.append(controls);
      const side = make('div', 'maze-side');
      side.append(make('h3', '', mode === 'coin' ? 'Monede în labirint' : 'Bancnote în labirint'));
      side.append(make('p', '', mode === 'coin' ? 'Ajungi la steag și culegi monedele găsite pe drum.' : 'Ajungi la steag și culegi bancnotele găsite pe drum.'));
      const feedback = make('div', 'feedback', 'Folosește săgețile de pe tastatură sau butoanele.'); feedback.id = 'maze-feedback'; feedback.setAttribute('aria-live', 'polite'); side.append(feedback);
      wrap.append(boardSide, side); root.append(wrap);
      if (!timer) restart(mode);
      setCoach(getMission('maze').coach, position / 15, `${moves} mutări`);
    }
  }

  function initCoins(root) {
    let round = 0;
    let amount = 0;
    let selected = [];
    let message = 'Alege monede și verifică suma.';
    let tone = '';
    const targets = [7, 16, 25, 60];
    const cleanup = () => {};
    render();
    return cleanup;
    function render() {
      root.replaceChildren();
      root.append(stageIntro('Calcul', 'Fă exact suma cerută.', 'Monedele folosite aici sunt jetoane ale jocului.'));
      const target = make('div', 'target-box'); target.append(make('span', '', `Runda ${round + 1} din ${targets.length}`), make('strong', '', `${targets[round]} ${targets[round] === 1 ? 'ban' : 'bani'}`)); root.append(target);
      const selectedBox = make('div', 'selected-coins');
      if (!selected.length) selectedBox.append(make('span', 'quiet-note', 'Nicio monedă aleasă încă.'));
      selected.forEach((coin, index) => { const button = make('button', 'coin-chip', String(coin)); button.type = 'button'; button.title = 'Elimină această monedă'; button.addEventListener('click', () => { selected.splice(index, 1); amount -= coin; render(); }); selectedBox.append(button); });
      root.append(selectedBox);
      const choices = make('div', 'coin-choices');
      [1, 5, 10, 50].forEach(value => { const button = make('button', 'coin-choice', `+${value} bani`); button.type = 'button'; button.addEventListener('click', () => { if (amount + value <= targets[round]) { selected.push(value); amount += value; render(); } else { message = 'Suma trece peste țintă. Scoate o monedă sau alege una mai mică.'; tone = 'warn'; render(); } }); choices.append(button); });
      root.append(choices);
      const feedback = make('div', `feedback ${tone}`, `${message} Total: ${amount} bani.`); feedback.setAttribute('aria-live', 'polite'); root.append(feedback);
      const actions = make('div', 'shop-actions');
      const clear = make('button', 'secondary-button', 'Golește'); clear.type = 'button'; clear.addEventListener('click', () => { selected = []; amount = 0; message = 'Alege monede și verifică suma.'; tone = ''; render(); });
      const check = make('button', 'primary-button', round === targets.length - 1 ? 'Încheie' : 'Verifică'); check.type = 'button'; check.addEventListener('click', () => { if (amount !== targets[round]) { message = amount < targets[round] ? 'Mai adaugă monede.' : 'Ai depășit suma.'; tone = 'warn'; render(); return; } if (round === targets.length - 1) { finishGame(100, 'Ai format toate sumele exact.'); return; } round += 1; amount = 0; selected = []; message = 'Runda următoare are o sumă nouă.'; tone = 'good'; render(); });
      actions.append(clear, check); root.append(actions);
      setCoach(getMission('coins').coach, round / targets.length, `Total curent: ${amount} bani`);
    }
  }

  function initBarter(root) {
    const rounds = [
      { prompt: 'Ai un măr în plus. Prietenul are un creion de care ai nevoie.', options: [['🍎', 'Măr contra creion, iar amândoi sunteți de acord.'], ['🎒', 'Iei ghiozdanul fără să întrebi.'], ['🧸', 'Ceri jucăria preferată pentru un măr.']], correct: 0, why: 'Amândoi primesc ceva folositor și aleg liber schimbul.' },
      { prompt: 'Vrei o carte, iar colegul are cartea și preferă să primească două abțibilduri.', options: [['🍬', 'Oferi o bomboană fără să întrebi.'], ['⭐', 'Propui două abțibilduri și verificați dacă sunteți mulțumiți.'], ['📏', 'Iei cartea și promiți că explici mai târziu.']], correct: 1, why: 'Schimbul este clar și acceptat înainte să aibă loc.' },
      { prompt: 'Un coleg propune o figurină stricată pentru toate economiile tale.', options: [['✅', 'Ceri timp să verifici obiectul și discuți o valoare corectă.'], ['💰', 'Dai imediat toți banii.'], ['🏃', 'Iei figurina și pleci.']], correct: 0, why: 'Un schimb bun nu se face sub presiune. Verifici obiectul și conveniți prețul.' },
    ];
    let index = 0; let score = 0; let answered = false;
    const cleanup = () => {};
    render(); return cleanup;
    function render() {
      root.replaceChildren(); root.append(stageIntro('Schimb', 'Alege un troc pe care îl pot accepta ambele persoane.', 'Într-un schimb bun, nimeni nu este grăbit sau păcălit.'));
      const card = make('section', 'scenario-card'); card.append(make('p', 'question-number', `Situația ${index + 1} din ${rounds.length}`)); card.append(make('h3', '', rounds[index].prompt));
      const list = make('div', 'barter-list');
      rounds[index].options.forEach((option, optionIndex) => { const button = make('button', 'barter-option'); button.type = 'button'; button.append(make('span', 'option-emoji', option[0]), make('span', '', option[1])); button.addEventListener('click', () => choose(button, optionIndex, list, card)); list.append(button); });
      card.append(list); const feedback = make('div', 'feedback', 'Alege varianta care păstrează schimbul corect.'); feedback.setAttribute('aria-live', 'polite'); card.append(feedback); root.append(card); setCoach(getMission('barter').coach, index / rounds.length, `Situația ${index + 1} din ${rounds.length}`);
    }
    function choose(button, optionIndex, list, card) { if (answered) return; answered = true; const good = optionIndex === rounds[index].correct; if (good) score += 1; list.querySelectorAll('button').forEach(item => { item.disabled = true; }); button.classList.add(good ? 'correct' : 'wrong'); const feedback = $('.feedback', card); feedback.className = `feedback ${good ? 'good' : 'warn'}`; feedback.textContent = `${good ? 'Da.' : 'Încearcă altă idee data viitoare.'} ${rounds[index].why}`; const next = make('button', 'primary-button', index === rounds.length - 1 ? 'Vezi rezultatul' : 'Următoarea'); next.type = 'button'; next.style.marginTop = '12px'; next.addEventListener('click', () => { index += 1; answered = false; if (index >= rounds.length) finishGame((score / rounds.length) * 100, `${score} schimburi corecte din ${rounds.length}.`); else render(); }); card.append(next); }
  }

  function initNumberPath(root) {
    const gates = [
      { expression: '4 + 3', answers: [6, 7, 8], correct: 7 }, { expression: '12 − 5', answers: [6, 7, 8], correct: 7 },
      { expression: '3 × 4', answers: [7, 12, 14], correct: 12 }, { expression: '20 ÷ 5', answers: [3, 4, 5], correct: 4 },
      { expression: '9 + 6 − 4', answers: [10, 11, 12], correct: 11 },
    ];
    let index = 0; let score = 0; let answered = false;
    const cleanup = () => {};
    render(); return cleanup;
    function render() {
      root.replaceChildren(); root.append(stageIntro('Calcul', 'Treci de porți cu răspunsul corect.', 'Fiecare poartă are un singur rezultat.'));
      const gatesRow = make('div', 'path-gates'); gates.forEach((gate, gateIndex) => { const button = make('button', `path-gate ${gateIndex === index ? 'active' : ''} ${gateIndex < index ? 'done' : ''}`, String(gateIndex + 1)); button.type = 'button'; button.disabled = gateIndex !== index; gatesRow.append(button); }); root.append(gatesRow);
      const card = make('section', 'number-card'); card.append(make('p', 'question-number', `Poarta ${index + 1} din ${gates.length}`)); card.append(make('div', 'number-expression', gates[index].expression)); const options = make('div', 'number-options'); gates[index].answers.forEach(answer => { const button = make('button', '', String(answer)); button.type = 'button'; button.addEventListener('click', () => choose(button, answer, options, card)); options.append(button); }); card.append(options); const feedback = make('div', 'feedback', 'Alege rezultatul.'); feedback.setAttribute('aria-live', 'polite'); card.append(feedback); root.append(card); setCoach(getMission('number_path').coach, index / gates.length, `Poarta ${index + 1} din ${gates.length}`);
    }
    function choose(button, answer, options, card) { if (answered) return; answered = true; const good = answer === gates[index].correct; if (good) score += 1; options.querySelectorAll('button').forEach(item => { item.disabled = true; }); button.classList.add(good ? 'correct' : 'wrong'); const feedback = $('.feedback', card); feedback.className = `feedback ${good ? 'good' : 'warn'}`; feedback.textContent = good ? 'Corect. Poarta se deschide.' : `Rezultatul corect era ${gates[index].correct}.`; const next = make('button', 'primary-button', index === gates.length - 1 ? 'Vezi rezultatul' : 'Deschide poarta'); next.type = 'button'; next.style.marginTop = '13px'; next.addEventListener('click', () => { index += 1; answered = false; if (index >= gates.length) finishGame((score / gates.length) * 100, `${score} porți deschise corect din ${gates.length}.`); else render(); }); card.append(next); }
  }

  function initPuzzle(root) {
    let order = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    if (order.every((value, index) => value === index)) [order[0], order[1]] = [order[1], order[0]];
    let selected = null;
    const cleanup = () => {};
    render(); return cleanup;
    function render() {
      root.replaceChildren(); root.append(stageIntro('Planificare', 'Rearanjează pușculița.', 'Apasă două piese pentru a le schimba locul.'));
      const board = make('div', 'puzzle-board');
      order.forEach((tileValue, position) => { const tile = make('button', `puzzle-tile${selected === position ? ' selected' : ''}`); tile.type = 'button'; tile.setAttribute('aria-label', `Piesă ${position + 1}`); tile.style.backgroundPosition = `${(tileValue % 3) * 50}% ${Math.floor(tileValue / 3) * 50}%`; tile.addEventListener('click', () => clickTile(position)); board.append(tile); });
      root.append(board); const hint = make('p', 'puzzle-hint', 'Colțurile și marginea oferă primele indicii.'); root.append(hint); setCoach(getMission('puzzle').coach, order.filter((value, index) => value === index).length / 9, 'Piese la locul lor');
    }
    function clickTile(position) { if (selected === null) { selected = position; render(); return; } if (selected === position) { selected = null; render(); return; } [order[selected], order[position]] = [order[position], order[selected]]; selected = null; render(); if (order.every((value, index) => value === index)) finishGame(100, 'Imaginea este din nou întreagă.'); }
  }

  function initColorLab(root) {
    const rounds = [
      { colors: ['#e95c53', '#f7c85e'], names: ['Roșu', 'Galben'], result: 'Portocaliu', resultColor: '#ef9654', options: [['Portocaliu', '#ef9654'], ['Verde', '#70ad66'], ['Mov', '#9b73b7']] },
      { colors: ['#4c88c7', '#f7c85e'], names: ['Albastru', 'Galben'], result: 'Verde', resultColor: '#70ad66', options: [['Verde', '#70ad66'], ['Portocaliu', '#ef9654'], ['Gri', '#a8aaa3']] },
      { colors: ['#e95c53', '#4c88c7'], names: ['Roșu', 'Albastru'], result: 'Mov', resultColor: '#9b73b7', options: [['Mov', '#9b73b7'], ['Verde', '#70ad66'], ['Maro', '#9b6a4d']] },
      { colors: ['#fffdf7', '#303d3d'], names: ['Alb', 'Negru'], result: 'Gri', resultColor: '#a8aaa3', options: [['Gri', '#a8aaa3'], ['Roz', '#e895a8'], ['Turcoaz', '#56bdb7']] },
    ];
    let index = 0; let score = 0; let answered = false;
    const cleanup = () => {};
    render(); return cleanup;
    function render() { const round = rounds[index]; root.replaceChildren(); root.append(stageIntro('Idei', 'Amestecă două culori.', 'În laborator exersăm combinații vizuale, ca într-o paletă de pictură.')); const lab = make('div', 'color-lab'); const coin = make('div', 'paint-coin', '?'); coin.style.background = `linear-gradient(135deg, ${round.colors[0]}, ${round.colors[1]})`; const side = make('div', 'color-side'); const swatches = make('div', 'mix-swatches'); round.colors.forEach((color, colorIndex) => { const swatch = make('span', 'swatch'); swatch.style.background = color; swatch.title = round.names[colorIndex]; swatches.append(swatch); if (colorIndex === 0) swatches.append(make('span', 'plus-sign', '+')); }); side.append(swatches); side.append(make('h3', '', `Ce culoare obții din ${round.names[0].toLowerCase()} și ${round.names[1].toLowerCase()}?`)); const options = make('div', 'color-options'); round.options.forEach(option => { const button = make('button', 'color-option'); button.type = 'button'; const dot = make('span'); dot.style.background = option[1]; button.append(dot, document.createTextNode(option[0])); button.addEventListener('click', () => choose(button, option[0], options, side, round)); options.append(button); }); side.append(options); lab.append(coin, side); root.append(lab); setCoach(getMission('color_lab').coach, index / rounds.length, `Combinația ${index + 1} din ${rounds.length}`); }
    function choose(button, value, options, side, round) { if (answered) return; answered = true; const good = value === round.result; if (good) score += 1; options.querySelectorAll('button').forEach(item => { item.disabled = true; }); button.classList.add(good ? 'correct' : 'wrong'); const feedback = make('div', `feedback ${good ? 'good' : 'warn'}`, good ? `Corect. Rezultatul este ${round.result}.` : `Rezultatul este ${round.result}.`); side.append(feedback); const next = make('button', 'primary-button', index === rounds.length - 1 ? 'Vezi rezultatul' : 'Următoarea combinație'); next.type = 'button'; next.style.marginTop = '14px'; next.addEventListener('click', () => { index += 1; answered = false; if (index >= rounds.length) finishGame((score / rounds.length) * 100, `${score} combinații potrivite din ${rounds.length}.`); else render(); }); side.append(next); }
  }

  function initEntrepreneur(root) {
    const rounds = [
      { product: 'Brioșă cu mere', cost: 3, demand: 'Clientul caută o gustare simplă.', budget: 7, prices: [2, 5, 9], correct: 5 },
      { product: 'Semn de carte', cost: 2, demand: 'Cumpărătorul vrea un cadou mic.', budget: 6, prices: [1, 4, 8], correct: 4 },
      { product: 'Cutie cu biscuiți', cost: 6, demand: 'Familia vrea să împartă produsul.', budget: 12, prices: [4, 9, 15], correct: 9 },
    ];
    let index = 0; let score = 0; let answered = false;
    const cleanup = () => {};
    render(); return cleanup;
    function render() { const round = rounds[index]; root.replaceChildren(); root.append(stageIntro('Afaceri', 'Alege un preț cu grijă.', 'Un preț trebuie să acopere costul și să rămână potrivit pentru client.')); const card = make('section', 'business-card'); const brief = make('div', 'business-brief'); [['Produs', round.product], ['Cost', `${round.cost} lei`], ['Buget orientativ', `${round.budget} lei`]].forEach(pair => { const cell = make('div', 'brief-cell'); cell.append(make('span', '', pair[0]), make('strong', '', pair[1])); brief.append(cell); }); card.append(brief); card.append(make('p', '', round.demand)); card.append(make('p', 'question-number', `Runda ${index + 1} din ${rounds.length}. Alege prețul.`)); const options = make('div', 'price-options'); round.prices.forEach(price => { const button = make('button', '', `${price} lei`); button.type = 'button'; button.addEventListener('click', () => choose(button, price, options, card, round)); options.append(button); }); card.append(options); root.append(card); setCoach(getMission('entrepreneur').coach, index / rounds.length, `Runda ${index + 1} din ${rounds.length}`); }
    function choose(button, price, options, card, round) { if (answered) return; answered = true; const good = price === round.correct; if (good) score += 1; options.querySelectorAll('button').forEach(item => { item.disabled = true; }); button.classList.add(good ? 'correct' : 'wrong'); const profit = price - round.cost; const feedback = make('div', `feedback ${good ? 'good' : 'warn'}`, good ? `Alegere echilibrată. Rămân ${profit} lei înainte de alte costuri.` : `Prețul potrivit aici este ${round.correct} lei. Costul este ${round.cost} lei, iar bugetul clientului este ${round.budget} lei.`); card.append(feedback); const next = make('button', 'primary-button', index === rounds.length - 1 ? 'Vezi rezultatul' : 'Următoarea rundă'); next.type = 'button'; next.style.marginTop = '14px'; next.addEventListener('click', () => { index += 1; answered = false; if (index >= rounds.length) finishGame((score / rounds.length) * 100, `${score} alegeri echilibrate din ${rounds.length}.`); else render(); }); card.append(next); }
  }

  function clockFace(root, hour, minute) {
    const face = make('div', 'clock-face');
    for (let number = 1; number <= 12; number += 1) { const angle = (number / 12) * Math.PI * 2 - Math.PI / 2; const node = make('span', 'clock-number', String(number)); node.style.left = `${50 + Math.cos(angle) * 39}%`; node.style.top = `${50 + Math.sin(angle) * 39}%`; face.append(node); }
    const hourHand = make('span', 'clock-hand hour'); hourHand.style.transform = `rotate(${((hour % 12) + minute / 60) * 30}deg)`;
    const minuteHand = make('span', 'clock-hand minute'); minuteHand.style.transform = `rotate(${minute * 6}deg)`;
    face.append(hourHand, minuteHand, make('span', 'clock-center')); return face;
  }

  function initClock(root) {
    let mode = 'numbers'; let numberOrder = shuffle(Array.from({ length: 12 }, (_, index) => index + 1)); let selected = null; let round = 0; let score = 0; let answered = false;
    if (numberOrder.every((value, index) => value === index + 1)) [numberOrder[0], numberOrder[1]] = [numberOrder[1], numberOrder[0]];
    const times = [{ hour: 3, minute: 0 }, { hour: 8, minute: 30 }, { hour: 11, minute: 15 }];
    const cleanup = () => {};
    render(); return cleanup;
    function render() { root.replaceChildren(); root.append(stageIntro('Timp', 'Ceasul isteț are două provocări.', 'Pune numerele la loc sau potrivește acele după ora cerută.')); const tabs = make('div', 'clock-tabs'); [['numbers', 'Pune numerele'], ['alarm', 'Potrivește ora']].forEach(([value, label]) => { const button = make('button', value === mode ? 'active' : '', label); button.type = 'button'; button.addEventListener('click', () => { mode = value; selected = null; answered = false; render(); }); tabs.append(button); }); root.append(tabs); if (mode === 'numbers') renderNumbers(); else renderAlarm(); }
    function renderNumbers() { const board = make('div', 'number-puzzle'); numberOrder.forEach((value, index) => { const button = make('button', selected === index ? 'selected' : '', String(value)); button.type = 'button'; button.addEventListener('click', () => { if (selected === null) { selected = index; render(); return; } if (selected === index) { selected = null; render(); return; } [numberOrder[selected], numberOrder[index]] = [numberOrder[index], numberOrder[selected]]; selected = null; render(); if (numberOrder.every((item, itemIndex) => item === itemIndex + 1)) finishGame(100, 'Numerele sunt în ordine, de la 1 la 12.'); }); board.append(button); }); root.append(board); root.append(make('p', 'puzzle-hint', 'Alege două numere pentru a le schimba locul.')); setCoach(getMission('clock').coach, numberOrder.filter((value, index) => value === index + 1).length / 12, 'Numere corect așezate'); }
    function renderAlarm() { const time = times[round]; const card = make('section', 'clock-card'); card.append(clockFace(root, time.hour, time.minute)); card.append(make('p', 'question-number', `Runda ${round + 1} din ${times.length}`)); card.append(make('h3', '', `Potrivește ora ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`)); const controls = make('div', 'clock-controls'); const hourLabel = make('label', '', 'Ora'); const minuteLabel = make('label', '', 'Minute'); const hourSelect = make('select'); const minuteSelect = make('select'); for (let hour = 1; hour <= 12; hour += 1) { const option = make('option', '', String(hour).padStart(2, '0')); option.value = String(hour); hourSelect.append(option); } [0, 15, 30, 45].forEach(minute => { const option = make('option', '', String(minute).padStart(2, '0')); option.value = String(minute); minuteSelect.append(option); }); hourLabel.append(hourSelect); minuteLabel.append(minuteSelect); controls.append(hourLabel, minuteLabel); card.append(controls); const feedback = make('div', 'feedback', 'Alege ora și minutele.'); feedback.setAttribute('aria-live', 'polite'); card.append(feedback); const check = make('button', 'primary-button', 'Verifică ora'); check.type = 'button'; check.style.marginTop = '16px'; check.addEventListener('click', () => { if (answered) return; answered = true; const good = Number(hourSelect.value) === time.hour && Number(minuteSelect.value) === time.minute; if (good) score += 1; feedback.className = `feedback ${good ? 'good' : 'warn'}`; feedback.textContent = good ? 'Ora este potrivită.' : `Ora cerută era ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}.`; check.disabled = true; const next = make('button', 'secondary-button', round === times.length - 1 ? 'Vezi rezultatul' : 'Următoarea oră'); next.type = 'button'; next.style.marginLeft = '8px'; next.addEventListener('click', () => { round += 1; answered = false; if (round >= times.length) finishGame((score / times.length) * 100, `${score} ore potrivite din ${times.length}.`); else render(); }); check.after(next); }); card.append(check); root.append(card); hourSelect.addEventListener('change', () => updateClockPreview()); minuteSelect.addEventListener('change', () => updateClockPreview()); function updateClockPreview() { const currentFace = $('.clock-face', card); if (currentFace) currentFace.replaceWith(clockFace(card, Number(hourSelect.value), Number(minuteSelect.value))); } setCoach(getMission('clock').coach, round / times.length, `Ora ${round + 1} din ${times.length}`); }
  }

  const gameInitializers = { quiz: initQuiz, maze: initMaze, coins: initCoins, barter: initBarter, number_path: initNumberPath, puzzle: initPuzzle, color_lab: initColorLab, entrepreneur: initEntrepreneur, clock: initClock };

  renderHub();
  loadProgress();
})();
