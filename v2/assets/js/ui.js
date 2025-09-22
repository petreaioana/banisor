document.addEventListener('DOMContentLoaded', () => {
  // tooltips (Bootstrap)
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));
  // mic toast pe query ?ok=...
  const url = new URL(location.href);
  const ok = url.searchParams.get('ok');
  if (ok) {
    const div = document.createElement('div');
    div.className = 'position-fixed top-0 end-0 p-3';
    div.innerHTML = `<div class="toast show"><div class="toast-header"><strong>Info</strong></div><div class="toast-body">Operatie: ${ok}</div></div>`;
    document.body.appendChild(div);
    setTimeout(()=>div.remove(), 2000);
  }
});
