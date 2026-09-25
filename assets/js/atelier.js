(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const shapeNames = { circle: 'Cerc', heart: 'Inimă', star: 'Stea' };
  const sizeNames = { 1: 'S', 2: 'M', 3: 'L' };

  const ingredients = [
    { id: 'strawberries', name: 'Căpșuni', image: 'assets/images/strawberries.png' },
    { id: 'sprinkles', name: 'Ornamente', image: 'assets/images/sprinkles.png' },
    { id: 'chocolate_chips', name: 'Cipuri', image: 'assets/images/chocolate_chips.png' },
    { id: 'cacao', name: 'Cacao', image: 'assets/images/cacao.png' },
    { id: 'sugar', name: 'Zahăr', image: 'assets/images/sugar.png' },
    { id: 'coconut', name: 'Cocos', image: 'assets/images/coconut.png' },
  ];

  const state = {
    step: 'pour',
    order: null,
    sizeKey: 'M',
    fillPct: 0,
    baking: { running: false, progress: 0, zone: [0.54, 0.62], duration: 3000, inWindow: false, tried: false },
    scores: { pour: 0, toppings: 0, bake: 0, quality: 0.82, quantity: 10 },
  };
  let pourTimer = null;
  let bakeTimer = null;

  function translatedRange(range) {
    return `${Math.round(range[0] * 100)}% până la ${Math.round(range[1] * 100)}%`;
  }

  function syncShapeSize() {
    const mold = $('#shape-mold');
    const zone = $('#dropzone');
    if (!mold || !zone || !state.order) return;

    const preferred = state.sizeKey === 'S' ? 160 : state.sizeKey === 'L' ? 240 : 200;
    const available = Math.max(136, Math.min(260, $('.build-stage').clientWidth - 40));
    const pixels = Math.min(preferred, available);
    mold.dataset.shape = state.order.shape;
    mold.style.setProperty('--size', `${pixels}px`);
    zone.dataset.shape = state.order.shape;
    zone.style.width = `${pixels}px`;
    zone.style.height = `${pixels}px`;
  }

  function paintOrder() {
    $('#ord-shape').textContent = shapeNames[state.order.shape] || shapeNames.circle;
    $('#ord-size').textContent = state.sizeKey;
    $('#ord-tops').textContent = state.order.toppings
      .map(id => ingredients.find(item => item.id === id)?.name || id)
      .join(' + ');
    $('#ord-bake').textContent = translatedRange(state.order.bake);
    $('#shape-select').value = state.order.shape;
    $('#size-range').value = String({ S: 1, M: 2, L: 3 }[state.sizeKey] || 2);
    $('#size-label').textContent = state.sizeKey;
  }

  function paintBakeWindow() {
    const [start, end] = state.order.bake;
    const target = $('.hit-window span');
    target.style.left = `${Math.round(start * 100)}%`;
    target.style.width = `${Math.round((end - start) * 100)}%`;
    $('#bake-window').textContent = translatedRange(state.order.bake);
  }

  function updatePourScore() {
    const [start, end] = state.order.pour;
    const middle = (start + end) / 2;
    const half = Math.max((end - start) / 2, 0.001);
    const distance = Math.abs(state.fillPct - middle);
    const raw = distance <= half
      ? 70 + (1 - distance / half) * 30
      : Math.max(0, 70 - Math.min(1, (distance - half) / 0.25) * 60);
    state.scores.pour = Math.round(clamp(raw, 0, 100));
  }

  function updateFill() {
    const percentage = Math.round(clamp(state.fillPct, 0, 1) * 100);
    $('#shape-fill').style.height = `${percentage}%`;
    $('#pour-range').value = String(percentage);
    $('#pour-pct').textContent = String(percentage);
    $('#pour-range').setAttribute('aria-valuenow', String(percentage));
    updatePourScore();

    const inWindow = state.fillPct >= state.order.pour[0] && state.fillPct <= state.order.pour[1];
    $('#shape-mold').classList.toggle('good', inWindow);
    $('#pour-feedback').textContent = inWindow
      ? 'Umplerea este în zona cerută.'
      : state.fillPct < state.order.pour[0]
        ? `Mai toarnă până la ${Math.round(state.order.pour[0] * 100)}%.`
        : 'Ai turnat peste țintă. Poți ajusta cursorul.';
    renderScores();
  }

  function stopPour() {
    if (pourTimer !== null) {
      window.clearInterval(pourTimer);
      pourTimer = null;
    }
  }

  function stopBakeTimer() {
    if (bakeTimer !== null) {
      window.clearInterval(bakeTimer);
      bakeTimer = null;
    }
  }

  function setStep(step) {
    state.step = step;
    if (step !== 'pour') stopPour();
    if (step !== 'bake' && state.baking.running) {
      stopBakeTimer();
      state.baking.running = false;
      $('#btn-bake-start').disabled = false;
      $('#btn-bake-stop').disabled = true;
    }

    ['pour', 'decor', 'bake', 'serve'].forEach(name => {
      $(`#panel-${name}`).classList.toggle('d-none', name !== step);
    });
    $$('.stepper li').forEach(item => {
      item.classList.toggle('active', item.dataset.step === step);
      item.classList.toggle('done', ['pour', 'decor', 'bake'].indexOf(item.dataset.step) < ['pour', 'decor', 'bake', 'serve'].indexOf(step));
      if (item.dataset.step === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });

    const labels = { pour: 'Turnare', decor: 'Decor', bake: 'Coacere', serve: 'Servire' };
    $('#step-badge').textContent = labels[step];
    $('#station-title').textContent = 'Stație de lucru';
    $('#btn-prev').disabled = step === 'pour';
    $('#btn-next').disabled = step === 'serve';
    $('#btn-next').textContent = step === 'bake' ? 'Verifică coacerea' : 'Înainte';
  }

  function makeOrder() {
    stopPour();
    stopBakeTimer();
    const shapes = ['circle', 'heart', 'star'];
    const shuffled = ingredients.slice().sort(() => Math.random() - 0.5);
    const toppings = shuffled.slice(0, 2 + Math.floor(Math.random() * 3)).map(item => item.id);
    const bakeMiddle = 0.55 + (Math.random() * 0.06 - 0.03);
    const pourMiddle = 0.80 + (Math.random() * 0.06 - 0.03);

    state.order = {
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      toppings,
      bake: [clamp(bakeMiddle - 0.05, 0.35, 0.82), clamp(bakeMiddle + 0.05, 0.45, 0.92)],
      pour: [clamp(pourMiddle - 0.06, 0.55, 0.88), clamp(pourMiddle + 0.06, 0.67, 0.96)],
    };
    state.fillPct = 0;
    state.baking = {
      running: false,
      progress: 0,
      zone: state.order.bake.slice(),
      duration: 4500 + Math.floor(Math.random() * 1200),
      inWindow: false,
      tried: false,
    };
    state.scores = { pour: 0, toppings: 0, bake: 0, quality: 0.82, quantity: 10 };

    $('#dropzone').replaceChildren();
    $('#bake-bar').style.width = '0%';
    $('#bake-bar').setAttribute('aria-valuenow', '0');
    $('#btn-bake-start').disabled = false;
    $('#btn-bake-stop').disabled = true;
    $('#f-inwin').value = '0';
    paintOrder();
    syncShapeSize();
    paintBakeWindow();
    setStep('pour');
    updateFill();
  }

  function paintPalette() {
    const palette = $('#palette');
    palette.replaceChildren();
    ingredients.forEach(ingredient => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-chip';
      button.setAttribute('aria-label', `Adaugă ${ingredient.name}`);
      const image = document.createElement('img');
      image.src = ingredient.image;
      image.alt = '';
      image.loading = 'lazy';
      const label = document.createElement('span');
      label.textContent = ingredient.name;
      button.append(image, label);
      button.addEventListener('click', () => addTopping(ingredient));
      palette.append(button);
    });
  }

  function positionChip(chip, x, y) {
    const nextX = clamp(x, 14, 86);
    const nextY = clamp(y, 14, 86);
    chip.dataset.x = String(nextX);
    chip.dataset.y = String(nextY);
    chip.style.left = `${nextX}%`;
    chip.style.top = `${nextY}%`;
  }

  function addTopping(ingredient) {
    const zone = $('#dropzone');
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.dataset.type = ingredient.id;
    chip.dataset.x = '50';
    chip.dataset.y = '50';
    positionChip(chip, 36 + Math.random() * 28, 36 + Math.random() * 28);

    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'chip-handle';
    handle.setAttribute('aria-label', `${ingredient.name}. Mută cu săgețile sau trage în formă.`);
    const image = document.createElement('img');
    image.src = ingredient.image;
    image.alt = '';
    image.draggable = false;
    handle.append(image);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'chip-remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Elimină ${ingredient.name}`);
    remove.addEventListener('click', () => {
      chip.remove();
      updateToppingScore();
    });

    let pointerOrigin = null;
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      pointerOrigin = { x: event.clientX, y: event.clientY, moved: false };
      handle.setPointerCapture?.(event.pointerId);
    });
    handle.addEventListener('pointermove', event => {
      if (!pointerOrigin) return;
      const dx = event.clientX - pointerOrigin.x;
      const dy = event.clientY - pointerOrigin.y;
      if (Math.hypot(dx, dy) > 3) pointerOrigin.moved = true;
      if (!pointerOrigin.moved) return;
      const rect = zone.getBoundingClientRect();
      positionChip(chip,
        ((event.clientX - rect.left) / rect.width) * 100,
        ((event.clientY - rect.top) / rect.height) * 100);
    });
    handle.addEventListener('pointerup', () => {
      if (pointerOrigin?.moved) updateToppingScore();
      pointerOrigin = null;
    });
    handle.addEventListener('pointercancel', () => { pointerOrigin = null; });
    handle.addEventListener('keydown', event => {
      const x = Number(chip.dataset.x);
      const y = Number(chip.dataset.y);
      const step = event.shiftKey ? 8 : 3;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[event.key]) {
        event.preventDefault();
        positionChip(chip, x + moves[event.key][0], y + moves[event.key][1]);
        updateToppingScore();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        chip.remove();
        updateToppingScore();
      }
    });

    chip.append(handle, remove);
    zone.append(chip);
    updateToppingScore();
  }

  function insideSafeShape(x, y) {
    return Math.hypot((x - 50) / 50, (y - 50) / 50) <= 0.42;
  }

  function updateToppingScore() {
    const wanted = new Set(state.order.toppings);
    const placed = $$('.chip', $('#dropzone')).map(chip => ({
      type: chip.dataset.type,
      x: Number(chip.dataset.x),
      y: Number(chip.dataset.y),
    }));
    const correctlyPlaced = new Map();
    placed.forEach(item => {
      if (wanted.has(item.type) && insideSafeShape(item.x, item.y)) correctlyPlaced.set(item.type, item);
    });

    const coverage = correctlyPlaced.size / Math.max(1, wanted.size);
    let spreadBonus = 0;
    if (correctlyPlaced.size > 1) {
      const points = Array.from(correctlyPlaced.values());
      let totalDistance = 0;
      points.forEach((point, index) => {
        points.slice(index + 1).forEach(other => {
          totalDistance += Math.hypot(point.x - other.x, point.y - other.y);
        });
      });
      const possiblePairs = points.length * (points.length - 1) / 2;
      spreadBonus = clamp((totalDistance / Math.max(1, possiblePairs)) / 2, 0, 20);
    }
    state.scores.toppings = Math.round(80 * coverage + spreadBonus);
    renderScores();
    const missing = Array.from(wanted).filter(id => !correctlyPlaced.has(id));
    $('#decor-feedback').textContent = missing.length
      ? `Mai trebuie: ${missing.map(id => ingredients.find(item => item.id === id)?.name || id).join(', ')}.`
      : 'Toate toppingurile cerute sunt așezate în formă.';
  }

  function updateBakeScore() {
    const [start, end] = state.baking.zone;
    const middle = (start + end) / 2;
    const half = Math.max((end - start) / 2, 0.001);
    const distance = Math.abs(state.baking.progress - middle);
    state.scores.bake = Math.round(clamp(100 * (1 - Math.min(1, distance / half)), 0, 100));
    state.baking.inWindow = state.baking.progress >= start && state.baking.progress <= end;
  }

  function renderScores() {
    const pour = clamp(state.scores.pour / 100, 0, 1);
    const topping = clamp(state.scores.toppings / 100, 0, 1);
    const bake = clamp(state.scores.bake / 100, 0, 1);
    state.scores.quality = Number(clamp(0.82 + pour * 0.018 + topping * 0.04 + bake * 0.024, 0.82, 0.98).toFixed(2));
    const base = { S: 8, M: 10, L: 12 }[state.sizeKey] || 10;
    const toppingCount = $$('.chip', $('#dropzone')).length;
    state.scores.quantity = clamp(base + Math.round(state.fillPct * 3) + Math.floor(toppingCount / 3), 6, 18);

    $('#score-pour').textContent = String(state.scores.pour);
    $('#score-top').textContent = String(state.scores.toppings);
    $('#score-bake').textContent = String(state.scores.bake);
    $('#score-q').textContent = state.scores.quality.toFixed(2);
    $('#score-qty').textContent = String(state.scores.quantity);
    $('#serve-q').textContent = state.scores.quality.toFixed(2);
    $('#serve-qty').textContent = String(state.scores.quantity);
    $('#f-qty').value = String(state.scores.quantity);
    $('#f-q').value = state.scores.quality.toFixed(2);
    $('#f-inwin').value = state.baking.inWindow ? '1' : '0';
  }

  function startBake() {
    if (state.step !== 'bake' || state.baking.running) return;
    state.baking.running = true;
    state.baking.progress = 0;
    state.baking.tried = false;
    state.baking.inWindow = false;
    $('#bake-bar').style.width = '0%';
    $('#bake-bar').setAttribute('aria-valuenow', '0');
    $('#btn-bake-start').disabled = true;
    $('#btn-bake-stop').disabled = false;
    $('#bake-feedback').textContent = 'Cuptorul merge. Oprește-l când bara ajunge în fereastra verde.';
    stopBakeTimer();
    const tickMs = 70;
    bakeTimer = window.setInterval(() => {
      state.baking.progress = clamp(state.baking.progress + tickMs / state.baking.duration, 0, 1);
      const percentage = Math.round(state.baking.progress * 100);
      $('#bake-bar').style.width = `${percentage}%`;
      $('#bake-bar').setAttribute('aria-valuenow', String(percentage));
      if (state.baking.progress >= 1) stopBake(true);
    }, tickMs);
  }

  function stopBake(completed = false) {
    if (!state.baking.running) return;
    stopBakeTimer();
    state.baking.running = false;
    state.baking.tried = true;
    updateBakeScore();
    $('#btn-bake-stop').disabled = true;
    $('#btn-bake-start').disabled = false;
    $('#f-inwin').value = state.baking.inWindow ? '1' : '0';
    $('#bake-feedback').textContent = state.baking.inWindow
      ? 'Ai oprit cuptorul la timp. Coacere reușită!'
      : completed
        ? 'Cuptorul s-a oprit singur. Încearcă din nou pentru un scor mai bun.'
        : 'Ai oprit coacerea. Poți încerca din nou.';
    renderScores();
    if (state.baking.inWindow) setStep('serve');
    if (completed) {
      $('#bake-feedback').textContent = 'Cuptorul s-a oprit singur. Reglează din nou și oprește în fereastra verde.';
      $('#btn-next').disabled = false;
    }
  }

  $('#btn-pour').addEventListener('pointerdown', event => {
    if (state.step !== 'pour') return;
    event.preventDefault();
    $('#btn-pour').setPointerCapture?.(event.pointerId);
    stopPour();
    pourTimer = window.setInterval(() => {
      state.fillPct = clamp(state.fillPct + 0.01, 0, 1);
      updateFill();
      if (state.fillPct >= 1) stopPour();
    }, 70);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'].forEach(eventName => {
    $('#btn-pour').addEventListener(eventName, stopPour);
  });
  $('#pour-range').addEventListener('input', event => {
    state.fillPct = clamp(Number(event.target.value) / 100, 0, 1);
    updateFill();
  });

  $('#btn-bake-start').addEventListener('click', startBake);
  $('#btn-bake-stop').addEventListener('click', () => stopBake(false));
  document.addEventListener('keydown', event => {
    if (event.code === 'Space' && state.step === 'bake' && state.baking.running) {
      event.preventDefault();
      stopBake(false);
    }
  });

  $('#btn-next').addEventListener('click', () => {
    if (state.step === 'pour') {
      if (state.fillPct < state.order.pour[0]) {
        $('#pour-feedback').textContent = `Continuă până la cel puțin ${Math.round(state.order.pour[0] * 100)}%.`;
        return;
      }
      setStep('decor');
      paintPalette();
      return;
    }
    if (state.step === 'decor') {
      const placed = new Set($$('.chip', $('#dropzone')).map(chip => chip.dataset.type));
      const missing = state.order.toppings.filter(id => !placed.has(id));
      const valid = state.order.toppings.every(id => $$('.chip', $('#dropzone')).some(chip => chip.dataset.type === id && insideSafeShape(Number(chip.dataset.x), Number(chip.dataset.y))));
      if (missing.length || !valid) {
        $('#decor-feedback').textContent = missing.length
          ? `Adaugă toate ingredientele cerute: ${missing.map(id => ingredients.find(item => item.id === id)?.name || id).join(', ')}.`
          : 'Trage ingredientele în interiorul formei înainte să continui.';
        return;
      }
      setStep('bake');
      return;
    }
    if (state.step === 'bake' && state.baking.tried) setStep('serve');
  });

  $('#btn-prev').addEventListener('click', () => {
    if (state.step === 'decor') setStep('pour');
    else if (state.step === 'bake') setStep('decor');
    else if (state.step === 'serve') setStep('bake');
  });

  $('#shape-select').addEventListener('change', event => {
    if (state.step !== 'pour') {
      event.target.value = state.order.shape;
      return;
    }
    state.order.shape = event.target.value;
    paintOrder();
    syncShapeSize();
    updateToppingScore();
  });
  $('#size-range').addEventListener('input', event => {
    if (state.step !== 'pour') {
      event.target.value = String({ S: 1, M: 2, L: 3 }[state.sizeKey] || 2);
      return;
    }
    state.sizeKey = sizeNames[event.target.value] || 'M';
    paintOrder();
    syncShapeSize();
    renderScores();
  });

  window.addEventListener('resize', syncShapeSize, { passive: true });
  paintPalette();
  makeOrder();
})();
