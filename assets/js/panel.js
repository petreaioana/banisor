const API_URL = 'api.php';
const REFRESH_INTERVAL = 30000;

const targets = {
  sold: document.getElementById('stat-sold'),
  revenue: document.getElementById('stat-revenue'),
  profit: document.getElementById('stat-profit'),
  qty: document.getElementById('plan-qty'),
  price: document.getElementById('plan-price'),
  cashiers: document.getElementById('plan-cashiers'),
  customers: document.getElementById('plan-customers'),
};

async function refresh() {
  try {
    const response = await fetch(API_URL, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    if (!data || data.status !== 'ok') return;
    const state = data.state;
    if (!state) return;

    if (targets.sold) targets.sold.textContent = state.metrics?.sold_today ?? '0';
    if (targets.revenue) targets.revenue.textContent = formatLei(state.metrics?.revenue_today ?? 0);
    if (targets.profit) targets.profit.textContent = formatLei(state.metrics?.profit_today ?? 0);
    if (targets.qty) targets.qty.textContent = state.plan?.planned_qty ?? '0';
    if (targets.price) targets.price.textContent = formatLei(state.plan?.price ?? 0);
    if (targets.cashiers) targets.cashiers.textContent = state.plan?.cashiers ?? '1';
    if (targets.customers) targets.customers.textContent = state.plan?.expected_customers ?? '0';
  } catch (err) {
    console.error('Refresh failed', err);
  }
}

function formatLei(value) {
  return Number(value).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' lei';
}

setInterval(refresh, REFRESH_INTERVAL);
refresh();
