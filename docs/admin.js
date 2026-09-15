const API = 'https://gamerecarga-mz.valterpedrojorge01.workers.dev';
const money = n => new Intl.NumberFormat('pt-MZ').format(Number(n || 0)) + ' MT';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let allOrders = [];

async function api(path) {
  const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function statusClass(status) {
  if (status === 'Pagamento confirmado') return 'paid';
  if (status === 'Pagamento falhou') return 'failed';
  return 'pending';
}

function renderStats(d) {
  document.querySelector('#stats').innerHTML = `
    <article><span>Pedidos</span><b>${d.orders}</b><small>Total registado</small></article>
    <article><span>Pagamentos confirmados</span><b>${d.paid}</b><small>Pedidos pagos</small></article>
    <article><span>Receita</span><b>${money(d.revenue)}</b><small>Pagamentos confirmados</small></article>
    <article><span>Pendentes</span><b>${d.pending}</b><small>Aguardando pagamento</small></article>
    <article><span>Falhados</span><b>${d.failed}</b><small>Necessitam atenção</small></article>`;
}

function renderOrders() {
  const q = document.querySelector('#search').value.toLowerCase().trim();
  const status = document.querySelector('#status').value;
  const filtered = allOrders.filter(o => {
    const hay = [o.id, o.game, o.pack, o.playerId, o.contact, o.paymentReference, o.paymentStatus].join(' ').toLowerCase();
    return (!q || hay.includes(q)) && (!status || o.status === status);
  });
  document.querySelector('#orders').innerHTML = filtered.length ? filtered.slice(0, 100).map(o => `
    <article class="order">
      <div class="order-main"><strong>${esc(o.game)} — ${esc(o.pack)}</strong><span>${esc(o.id)}</span><small>Jogador: ${esc(o.playerId || '—')} · Contacto: ${esc(o.contact || '—')}</small></div>
      <div class="order-meta"><b>${money(o.amount)}</b><span>${esc(o.paymentReference || o.payment || '—')}</span><em class="${statusClass(o.status)}">${esc(o.status || 'Desconhecido')}</em></div>
    </article>`).join('') : '<div class="empty">Nenhum pedido corresponde aos filtros.</div>';
}

async function refresh() {
  const [dashboard, orders] = await Promise.all([api('/admin/dashboard'), api('/admin/orders')]);
  renderStats(dashboard);
  allOrders = Array.isArray(orders) ? orders : [];
  renderOrders();
  document.querySelector('#lastUpdate').textContent = `Atualizado: ${new Intl.DateTimeFormat('pt-MZ', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date())}`;
}

document.querySelector('#refresh').onclick = async () => {
  document.querySelector('#refresh').disabled = true;
  try { await refresh(); } catch (e) { alert(`Não foi possível atualizar: ${e.message}`); }
  finally { document.querySelector('#refresh').disabled = false; }
};
document.querySelector('#search').oninput = renderOrders;
document.querySelector('#status').onchange = renderOrders;
refresh().catch(e => document.querySelector('#orders').innerHTML = `<div class="empty error">Erro ao carregar: ${esc(e.message)}</div>`);
