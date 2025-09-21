import { FK } from '../shared/state.js';

const FOCUS_BUTTONS = [
  { id: 'balanced', label: 'Echilibru', icon: '??' },
  { id: 'profit', label: 'Profit', icon: '??' },
  { id: 'happy', label: 'Clien?i ferici?i', icon: '??' }
];

function createElement(tag, className, html) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html !== undefined) el.innerHTML = html;
  return el;
}

function formatStars(count) {
  const arr = [];
  for (let i = 1; i <= 3; i++) {
    arr.push(i <= count ? '?' : '?');
  }
  return arr.join(' ');
}

export default function initSmartUI({ onToggle = () => {}, onFocusChange = () => {}, onBoostClick = () => {} } = {}) {
  const host = document.getElementById('right-metrics');
  if (!host) {
    return {
      setSmart() {},
      updatePlan() {},
      updateGoals() {},
      showEndOfDay() {},
      showOfflineSummary() {}
    };
  }

  let smartEnabled = true;
  const wrapper = createElement('section', 'smart-manager');
  wrapper.innerHTML = `
    <div class="smart-header">
      <button class="smart-toggle" type="button" aria-pressed="true">Smart Manager: ON</button>
      <div class="smart-focus" role="group" aria-label="Focus manager">
        ${FOCUS_BUTTONS.map((btn) => `<button type="button" data-focus="${btn.id}" class="focus-btn">${btn.icon}<span>${btn.label}</span></button>`).join('')}
      </div>
    </div>
    <div class="smart-cards">
      <div class="smart-card smart-plan">
        <h3>Planul zilei</h3>
        <ul>
          <li>Producem: <strong data-plan-qty>0</strong> buc</li>
          <li>Pre?: <strong data-plan-price>0</strong> lei</li>
          <li>Casieri: <strong data-plan-cashiers>1</strong></li>
        </ul>
        <button type="button" class="smart-boost" aria-live="polite">Zi Buna ??</button>
      </div>
      <div class="smart-card smart-goals">
        <h3>Obiectivul zilei</h3>
        <div class="smart-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="smart-progress-bar"></div>
        </div>
        <div class="smart-stars" aria-hidden="true">? ? ?</div>
        <p class="smart-progress-text">A?teptam vizitatorii!</p>
      </div>
    </div>
  `;
  host.prepend(wrapper);

  const btnToggle = wrapper.querySelector('.smart-toggle');
  const btnBoost = wrapper.querySelector('.smart-boost');
  const focusButtons = Array.from(wrapper.querySelectorAll('.focus-btn'));
  const planQty = wrapper.querySelector('[data-plan-qty]');
  const planPrice = wrapper.querySelector('[data-plan-price]');
  const planCashiers = wrapper.querySelector('[data-plan-cashiers]');
  const progress = wrapper.querySelector('.smart-progress');
  const progressBar = wrapper.querySelector('.smart-progress-bar');
  const progressText = wrapper.querySelector('.smart-progress-text');
  const starsEl = wrapper.querySelector('.smart-stars');

  const overlay = createElement('div', 'smart-overlay hidden');
  overlay.innerHTML = `
    <div class="smart-modal" role="dialog" aria-modal="true">
      <div class="smart-modal-body"></div>
      <button type="button" class="btn smart-modal-close">Închide</button>
    </div>
  `;
  document.body.appendChild(overlay);
  const modalBody = overlay.querySelector('.smart-modal-body');
  overlay.querySelector('.smart-modal-close').addEventListener('click', () => hideOverlay());
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) hideOverlay(); });

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  btnToggle.addEventListener('click', () => {
    smartEnabled = !smartEnabled;
    btnToggle.textContent = smartEnabled ? 'Smart Manager: ON' : 'Smart Manager: OFF';
    btnToggle.setAttribute('aria-pressed', smartEnabled ? 'true' : 'false');
    document.body.classList.toggle('smart-manager-on', smartEnabled);
    onToggle(smartEnabled);
  });

  focusButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const focus = btn.getAttribute('data-focus');
      focusButtons.forEach((b) => b.classList.toggle('active', b === btn));
      onFocusChange(focus);
    });
  });

  btnBoost.addEventListener('click', () => {
    btnBoost.disabled = true;
    btnBoost.textContent = 'Boost activ! ?';
    onBoostClick();
    setTimeout(() => {
      btnBoost.disabled = false;
      btnBoost.textContent = 'Zi Buna ??';
    }, 3000);
  });

  function setSmart(state) {
    smartEnabled = !!state;
    btnToggle.textContent = smartEnabled ? 'Smart Manager: ON' : 'Smart Manager: OFF';
    btnToggle.setAttribute('aria-pressed', smartEnabled ? 'true' : 'false');
    document.body.classList.toggle('smart-manager-on', smartEnabled);
  }

  function setFocusButton(focus) {
    focusButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.focus === focus));
  }

  function updatePlan(details = {}) {
    if (typeof details.plannedQty === 'number') planQty.textContent = String(details.plannedQty);
    if (typeof details.price === 'number') planPrice.textContent = details.price.toFixed(2);
    if (typeof details.cashiers === 'number') planCashiers.textContent = String(details.cashiers);
    if (details.focus) setFocusButton(details.focus);
  }

  function updateGoals(goals = {}, summary = {}) {
    const target = goals.targetSold || 0;
    const sold = summary.sold || 0;
    const percent = target > 0 ? Math.min(100, Math.round((sold / target) * 100)) : 0;
    progress.setAttribute('aria-valuenow', percent);
    progressBar.style.width = `${percent}%`;
    progressText.textContent = target > 0 ? `Am vândut ${sold}/${target} prajituri` : 'A?teptam vizitatorii!';
    const stars = goals.earnedStars || 0;
    starsEl.textContent = formatStars(stars);
  }

  function showEndOfDay(summary = {}) {
    const quality = summary.quality ? Number(summary.quality).toFixed(2) : '0.00';
    const html = `
      <h2>Zi încheiata!</h2>
      <p>Prajituri vândute: <strong>${summary.sold || 0}</strong></p>
      <p>Calitate medie: <strong>${quality}</strong></p>
      <p>Stele câ?tigate: <strong>${formatStars(summary.stars || 0)}</strong></p>
      <p>${(summary.messages || []).join('<br>')}</p>
    `;
    modalBody.innerHTML = html;
    overlay.classList.remove('hidden');
  }

  function showOfflineSummary(list = []) {
    const items = list.map((item) => `<li>${item}</li>`).join('');
    modalBody.innerHTML = `<h2>Ce s-a întâmplat cât ai lipsit?</h2><ul>${items}</ul>`;
    overlay.classList.remove('hidden');
  }

  return {
    setSmart,
    updatePlan,
    updateGoals,
    showEndOfDay,
    showOfflineSummary
  };
}
