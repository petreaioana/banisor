import { FK } from '../shared/state.js';
import AutoManager from './autoManager.js';

let root;
let toggleBtn;
let focusButtons;
let planQtyEl;
let planPriceEl;
let planCashiersEl;
let focusLabelEl;
let goalStarsEl;
let goalProgressEl;
let summaryEl;
let leftControls;
let resetBtn;
let offlineNotice = null;

function smartEnabled() {
  const modes = FK.getModes ? FK.getModes() : { smartManager: true };
  return modes.smartManager !== false;
}

function disableAdvancedControls(disabled) {
  if (!leftControls) return;
  leftControls.classList.toggle('smart-disabled', disabled);
  const elements = Array.from(leftControls.querySelectorAll('input, select, button'));
  elements.forEach((el) => {
    if (!root.contains(el)) {
      if (el.tagName === 'BUTTON' && el.id === 'btn-pause') return;
      if ('disabled' in el) el.disabled = disabled;
    }
  });
  Array.from(leftControls.children).forEach((child) => {
    if (root && root.contains(child)) return;
    child.style.opacity = disabled ? '0.4' : '';
  });
}

function applySmartMode(enabled) {
  if (!root) return;
  root.setAttribute('data-enabled', enabled ? 'on' : 'off');
  toggleBtn.textContent = enabled ? 'Smart Manager: ON' : 'Smart Manager: OFF';
  disableAdvancedControls(enabled);
}

function renderFocusButtons(currentFocus) {
  focusButtons.forEach((btn) => {
    const isActive = btn.dataset.focus === currentFocus;
    btn.classList.toggle('active', isActive);
  });
  if (focusLabelEl) {
    const focus = currentFocus === 'profit' ? 'Profit' : currentFocus === 'happy' ? 'Clienți fericiți' : 'Echilibru';
    focusLabelEl.textContent = focus;
  }
}

function formatStars(count) {
  const filled = '⭐'.repeat(count);
  const empty = '☆'.repeat(Math.max(0, 3 - count));
  return filled + empty;
}

export function refreshSmartManagerUI() {
  if (!root) return;
  const modes = FK.getModes ? FK.getModes() : { smartManager: true };
  const focus = modes.focus || (FK.getPolicy()?.focus) || 'balanced';
  const planState = FK.getAutoManagerState ? FK.getAutoManagerState() : null;
  const plan = planState?.plan;
  planQtyEl.textContent = plan ? plan.plannedQty : '—';
  planPriceEl.textContent = plan ? `${(plan.price ?? 0).toFixed(2)} lei` : '—';
  planCashiersEl.textContent = plan ? (plan.cashiers ?? 1) : '—';
  renderFocusButtons(focus);

  const goals = FK.getState()?.goals || {};
  goalStarsEl.textContent = formatStars(goals.earnedStars || 0);
  const targetSold = goals.targetSold ? `Țintă: ${goals.targetSold} buc` : 'Țintă: —';
  goalProgressEl.textContent = targetSold;

  const kidSummary = FK.getState()?.kidsTelemetry?.lastSummary;
  if (kidSummary) {
    const stars = kidSummary.stars != null ? `${formatStars(kidSummary.stars)} (${kidSummary.stars} stele)` : '';
    summaryEl.innerHTML = `Ziua ${kidSummary.day || ''}: <b>${kidSummary.sold || 0}</b> vândute, Q ${(kidSummary.avgQ || 0).toFixed(2)} ${stars}`;
  } else {
    summaryEl.textContent = 'Așteaptă finalul zilei pentru rezumat.';
  }
  if (offlineNotice) {
    const note = document.createElement('div');
    note.className = 'offline-note small muted';
    const days = offlineNotice.days || 0;
    const sold = offlineNotice.sold || 0;
    const revenue = offlineNotice.revenue || 0;
    note.textContent = `Ai lipsit ${days} ${days === 1 ? 'zi' : 'zile'}: ${sold} vândute, ${revenue} lei câștigați.`;
    summaryEl.appendChild(note);
    offlineNotice = null;
  }

  applySmartMode(modes.smartManager !== false);
}

function handleToggle() {
  const enabled = !smartEnabled();
  FK.setSmartManager && FK.setSmartManager(enabled);
  if (enabled) {
    try { AutoManager.onDayStart(); } catch (err) { console.error('[SmartUI] onDayStart', err); }
  } else {
    FK.setAutoManagerPlan && FK.setAutoManagerPlan(null, true);
  }
  refreshSmartManagerUI();
}

function handleFocusChange(focus) {
  FK.updatePolicy && FK.updatePolicy({ focus });
  renderFocusButtons(focus);
  if (smartEnabled()) {
    try { AutoManager.onDayStart(); } catch (err) { console.error('[SmartUI] focus -> onDayStart', err); }
  }
  refreshSmartManagerUI();
}

export function initSmartManagerUI() {
  leftControls = document.getElementById('left-controls');
  if (!leftControls) {
    if (typeof window !== 'undefined') {
      setTimeout(initSmartManagerUI, 32);
    }
    return;
  }
  if (root) return;

  root = document.createElement('section');
  root.id = 'smart-manager-panel';
  root.className = 'panel smart';
  root.innerHTML = `
    <div class="smart-header">
      <button type="button" data-role="smart-toggle" class="btn full" style="width:100%;margin-bottom:0.5rem;"></button>
      <div class="focus-switch">
        <span>Focus:</span>
        <div class="btn-group" role="group">
          <button type="button" class="btn" data-focus="balanced">Echilibru</button>
          <button type="button" class="btn" data-focus="profit">Profit</button>
          <button type="button" class="btn" data-focus="happy">Clienți fericiți</button>
        </div>
        <div class="current-focus" data-focus-label=""></div>
      </div>
    </div>
    <div class="smart-card">
      <h4>Planul zilei</h4>
      <div class="row tight"><span>Producem:</span><b data-plan-qty>—</b></div>
      <div class="row tight"><span>Preț:</span><b data-plan-price>—</b></div>
      <div class="row tight"><span>Casieri:</span><b data-plan-cashiers>—</b></div>
    </div>
    <div class="smart-card">
      <h4>Obiectiv</h4>
      <div class="row tight" data-goal-progress>Țintă: —</div>
      <div class="row tight" data-goal-stars></div>
    </div>
    <div class="smart-card highlight">
      <h4>Rezumat</h4>
      <div data-summary>Încă nu avem date pentru ziua curentă.</div>
    </div>
    <div class="smart-note small muted">Controalele detaliate din stânga sunt gestionate automat când Smart Manager este ON. Poți reseta totul oricând pentru a reîncepe cu 1000 lei.</div>
    <button type="button" class="btn danger full" data-role="reset-progress">Resetează jocul</button>
  `;

  if (typeof leftControls.prepend === 'function') {
    leftControls.prepend(root);
  } else {
    leftControls.insertBefore(root, leftControls.firstChild || null);
  }

  toggleBtn = root.querySelector('[data-role="smart-toggle"]');
  focusButtons = root.querySelectorAll('[data-focus]');
  planQtyEl = root.querySelector('[data-plan-qty]');
  planPriceEl = root.querySelector('[data-plan-price]');
  planCashiersEl = root.querySelector('[data-plan-cashiers]');
  focusLabelEl = root.querySelector('[data-focus-label]');
  goalStarsEl = root.querySelector('[data-goal-stars]');
  goalProgressEl = root.querySelector('[data-goal-progress]');
  summaryEl = root.querySelector('[data-summary]');
  resetBtn = root.querySelector('[data-role="reset-progress"]');

  toggleBtn.addEventListener('click', handleToggle);
  focusButtons.forEach((btn) => {
    btn.addEventListener('click', () => handleFocusChange(btn.dataset.focus));
  });
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!window.confirm('Ești sigur că vrei să ștergi toate salvările și să reîncepi cu 1000 lei?')) return;
      try { FK.resetAllSlots && FK.resetAllSlots(1000); } catch (err) { console.error('[SmartUI] resetAllSlots', err); }
      window.location.reload();
    });
  }

  refreshSmartManagerUI();
}

export function setOfflineNotice(data) {
  offlineNotice = data;
  refreshSmartManagerUI();
}

export default {
  initSmartManagerUI,
  refreshSmartManagerUI,
};
