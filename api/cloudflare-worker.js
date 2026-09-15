const NETSHOP_BASE = 'https://www.netshop.co.mz/api/v1';
const WALLET_IDS = { mpesa: '574418', mkesh: '247460', bim: '767755', bci: '111895' };

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Admin-Key, X-NetShop-Signature, X-Webhook-Signature, X-Signature, X-NetShop-Timestamp, X-Webhook-Timestamp',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin) }
  });
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('258')) return `+${digits}`;
  if (digits.startsWith('0')) return `+258${digits.slice(1)}`;
  return `+258${digits}`;
}

function uuid() { return crypto.randomUUID(); }
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
function hex(buffer) { return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join(''); }

async function verifyWebhook(request, body, secret) {
  if (!secret) return false;
  const signature = request.headers.get('X-NetShop-Signature') || request.headers.get('X-Webhook-Signature') || request.headers.get('X-Signature');
  if (!signature) return false;
  const timestamp = request.headers.get('X-NetShop-Timestamp') || request.headers.get('X-Webhook-Timestamp');
  if (timestamp) {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return false;
    const millis = ts < 1e12 ? ts * 1000 : ts;
    if (Math.abs(Date.now() - millis) > 5 * 60 * 1000) return false;
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const normalized = signature.replace(/^sha256=/i, '').trim().toLowerCase();
  for (const value of timestamp ? [body, `${timestamp}.${body}`] : [body]) {
    const digest = hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
    if (timingSafeEqual(digest, normalized)) return true;
  }
  return false;
}

async function kvGet(env, key) { return env.DB ? env.DB.get(key, 'json') : null; }
async function kvPut(env, key, value) { if (env.DB) await env.DB.put(key, JSON.stringify(value)); }
async function saveOrder(env, order) { await kvPut(env, `order:${order.id}`, order); }
async function getOrder(env, id) { return kvGet(env, `order:${id}`); }
async function orderIds(env) { return (await kvGet(env, 'orders')) || []; }
async function rememberOrder(env, id) { const ids = await orderIds(env); if (!ids.includes(id)) { ids.unshift(id); await kvPut(env, 'orders', ids.slice(0, 500)); } }
async function allOrders(env) { const ids = await orderIds(env); const out = []; for (const id of ids.slice(0, 500)) { const o = await getOrder(env, id); if (o) out.push(o); } return out; }

function adminAuthorized(request, env) {
  return Boolean(env.ADMIN_KEY) && request.headers.get('X-Admin-Key') === env.ADMIN_KEY;
}

function applyPaymentStatus(order, status) {
  const s = String(status || '').toLowerCase();
  order.paymentStatus = s || order.paymentStatus;
  order.updatedAt = new Date().toISOString();
  if (s.includes('succeed') || s === 'successful' || s === 'paid' || s === 'completed' || s === 'payment.succeeded') {
    order.status = 'Pagamento confirmado'; order.deliveryStatus = 'ready_for_delivery'; order.paidAt = order.paidAt || new Date().toISOString();
  } else if (s.includes('fail') || s.includes('cancel') || s === 'payment.failed' || s === 'expired') {
    order.status = 'Pagamento falhou'; order.deliveryStatus = 'cancelled';
  } else if (s.includes('pending') || s === 'processing' || s === 'requires_action') {
    order.status = 'Pagamento pendente'; order.deliveryStatus = 'waiting_payment';
  }
  return order;
}

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...corsHeaders(allowedOrigin), 'Content-Length': '0' } });

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return json({ ok: true, service: 'GameRecarga MZ API', configured: Boolean(env.NETSHOP_API_KEY), webhookConfigured: Boolean(env.NETSHOP_WEBHOOK_SECRET), storageConfigured: Boolean(env.DB), adminConfigured: Boolean(env.ADMIN_KEY) }, 200, allowedOrigin);
    }

    if (request.method === 'POST' && url.pathname === '/webhook') {
      const rawBody = await request.text();
      if (!await verifyWebhook(request, rawBody, env.NETSHOP_WEBHOOK_SECRET)) return json({ error: 'invalid_webhook_signature' }, 401, allowedOrigin);
      let event; try { event = JSON.parse(rawBody); } catch { return json({ error: 'invalid_json' }, 400, allowedOrigin); }
      const data = event?.data || event?.charge || event?.payment || event;
      const reference = data?.reference || data?.payment_reference || data?.charge?.reference || data?.payment?.reference;
      const chargeId = data?.id || data?.charge_id || data?.charge?.id;
      const status = data?.status || data?.charge?.status || data?.payment?.status || event?.type || event?.event;
      const orders = await allOrders(env);
      const found = orders.find(o => (reference && (o.paymentReference === reference || o.id === reference)) || (chargeId && o.paymentId === chargeId));
      if (!found) return json({ ok: true, received: true, matched: false, reference, status }, 200, allowedOrigin);
      applyPaymentStatus(found, status);
      await saveOrder(env, found);
      return json({ ok: true, received: true, matched: true, orderId: found.id, status: found.status }, 200, allowedOrigin);
    }

    if (request.method === 'GET' && url.pathname === '/admin/orders') {
      if (!adminAuthorized(request, env)) return json({ error: 'unauthorized' }, 401, allowedOrigin);
      return json(await allOrders(env), 200, allowedOrigin);
    }
    if (request.method === 'GET' && url.pathname === '/admin/dashboard') {
      if (!adminAuthorized(request, env)) return json({ error: 'unauthorized' }, 401, allowedOrigin);
      const os = await allOrders(env);
      const paid = os.filter(o => o.status === 'Pagamento confirmado' || ['successful', 'succeeded', 'paid', 'completed'].includes(String(o.paymentStatus).toLowerCase()));
      return json({ orders: os.length, paid: paid.length, revenue: paid.reduce((s, o) => s + Number(o.amount || 0), 0), pending: os.filter(o => o.status === 'Pagamento pendente').length, failed: os.filter(o => o.status === 'Pagamento falhou').length }, 200, allowedOrigin);
    }

    if (!env.NETSHOP_API_KEY) return json({ error: 'server_not_configured' }, 500, allowedOrigin);

    if (request.method === 'POST' && url.pathname === '/create-order') {
      let body; try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, allowedOrigin); }
      const { amount, currency = 'MZN', method, msisdn, reference, game, pack, playerId } = body;
      const amountNumber = Number(amount);
      if (!Number.isFinite(amountNumber) || amountNumber < 10 || amountNumber > 50000) return json({ error: 'invalid_amount' }, 400, allowedOrigin);
      if (!WALLET_IDS[method]) return json({ error: 'invalid_method' }, 400, allowedOrigin);
      if (!msisdn || !reference || !game || !pack || !playerId) return json({ error: 'missing_fields' }, 400, allowedOrigin);

      const order = { id: String(reference), game: String(game), pack: String(pack), amount: amountNumber, currency, playerId: String(playerId), contact: String(msisdn), payment: String(method), status: 'Pagamento pendente', paymentStatus: 'pending', deliveryStatus: 'waiting_payment', createdAt: new Date().toISOString() };
      await saveOrder(env, order); await rememberOrder(env, order.id);
      const payload = { amount: amountNumber, currency, method, msisdn: normalizePhone(msisdn), reference: order.id, description: `${order.game} - ${order.pack}`.slice(0, 180) };
      const response = await fetch(`${NETSHOP_BASE}/charges`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${env.NETSHOP_API_KEY}`, 'X-API-Version': '2024-10-12', 'X-Wallet-ID': WALLET_IDS[method], 'Idempotency-Key': order.id }, body: JSON.stringify(payload) });
      const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      const result = data?.data || data;
      if (!response.ok) { order.status = 'Pagamento falhou'; order.paymentStatus = 'error'; order.error = result?.message || result?.error?.message || result?.error || text || `NetShop HTTP ${response.status}`; await saveOrder(env, order); return json({ ok: false, status: response.status, data, orderId: order.id }, 502, allowedOrigin); }
      order.paymentId = result?.id || result?.charge_id || null;
      order.paymentReference = result?.reference || result?.payment_reference || order.id;
      order.checkoutUrl = result?.checkout_url || result?.payment_url || result?.checkoutUrl || null;
      applyPaymentStatus(order, result?.status || 'pending'); await saveOrder(env, order);
      return json({ ok: true, orderId: order.id, id: order.id, status: order.status, paymentStatus: order.paymentStatus, paymentReference: order.paymentReference, checkoutUrl: order.checkoutUrl, chargeId: order.paymentId }, 200, allowedOrigin);
    }

    return json({ error: 'not_found', method: request.method, path: url.pathname }, 404, allowedOrigin);
  }
};
