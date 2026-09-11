const NETSHOP_BASE = 'https://www.netshop.co.mz/api/v1';
const WALLET_IDS = { mpesa: '574418', mkesh: '247460', bim: '767755', bci: '111895' };

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(origin)
    }
  });
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('258')) return `+${digits}`;
  if (digits.startsWith('0')) return `+258${digits.slice(1)}`;
  return `+258${digits}`;
}

function uuid() { return crypto.randomUUID(); }

function hex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function verifyWebhook(request, body, secret) {
  if (!secret) return false;

  const signature = request.headers.get('X-NetShop-Signature')
    || request.headers.get('X-Webhook-Signature')
    || request.headers.get('X-Signature');
  if (!signature) return false;

  const timestamp = request.headers.get('X-NetShop-Timestamp')
    || request.headers.get('X-Webhook-Timestamp');

  // If NetShop sends a timestamp, reject stale requests to reduce replay risk.
  if (timestamp) {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return false;
    const millis = ts < 1e12 ? ts * 1000 : ts;
    if (Math.abs(Date.now() - millis) > 5 * 60 * 1000) return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );

  const candidates = [body];
  if (timestamp) candidates.push(`${timestamp}.${body}`);

  for (const value of candidates) {
    const digest = hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
    const normalized = signature.replace(/^sha256=/i, '').trim().toLowerCase();
    if (timingSafeEqual(digest, normalized)) return true;
  }

  return false;
}

export default {
  async fetch(request, env) {
    const requestOrigin = request.headers.get('Origin') || '';
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const origin = requestOrigin === allowedOrigin ? allowedOrigin : allowedOrigin;
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(origin),
          'Content-Length': '0'
        }
      });
    }

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return json({
        ok: true,
        service: 'GameRecarga MZ API',
        configured: Boolean(env.NETSHOP_API_KEY),
        webhookConfigured: Boolean(env.NETSHOP_WEBHOOK_SECRET),
        endpoint: '/create-order',
        webhook: '/webhook'
      }, 200, origin);
    }

    if (request.method === 'GET' && url.pathname === '/webhook') {
      return json({
        ok: true,
        endpoint: '/webhook',
        method: 'POST',
        configured: Boolean(env.NETSHOP_WEBHOOK_SECRET)
      }, 200, origin);
    }

    if (request.method === 'POST' && url.pathname === '/webhook') {
      const rawBody = await request.text();
      const valid = await verifyWebhook(request, rawBody, env.NETSHOP_WEBHOOK_SECRET);
      if (!valid) return json({ error: 'invalid_webhook_signature' }, 401, origin);

      let event;
      try { event = JSON.parse(rawBody); } catch { return json({ error: 'invalid_json' }, 400, origin); }

      const eventType = event?.type || event?.event || event?.name || 'unknown';
      const reference = event?.data?.reference || event?.reference || event?.charge?.reference || null;
      const status = event?.data?.status || event?.status || event?.charge?.status || null;

      // The webhook is authenticated and accepted here. Persistent order storage
      // will be connected next so the public checkout can display the final state.
      return json({ ok: true, received: true, eventType, reference, status }, 200, origin);
    }

    if (!env.NETSHOP_API_KEY) return json({ error: 'server_not_configured' }, 500, origin);

    if (request.method === 'POST' && url.pathname === '/create-order') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, origin); }

      const { amount, currency = 'MZN', method, msisdn, reference } = body;
      const amountNumber = Number(amount);
      if (!Number.isFinite(amountNumber) || amountNumber < 10) return json({ error: 'invalid_amount' }, 400, origin);
      if (!WALLET_IDS[method]) return json({ error: 'invalid_method' }, 400, origin);
      if (!msisdn || !reference) return json({ error: 'missing_fields' }, 400, origin);

      const payload = { amount: amountNumber, currency, method, msisdn: normalizePhone(msisdn), reference: String(reference) };
      const response = await fetch(`${NETSHOP_BASE}/charges`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.NETSHOP_API_KEY}`,
          'X-API-Version': '2024-10-12',
          'X-Wallet-ID': WALLET_IDS[method],
          'Idempotency-Key': uuid()
        },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return json({ ok: response.ok, status: response.status, data }, response.ok ? 200 : 502, origin);
    }

    return json({ error: 'not_found', method: request.method, path: url.pathname }, 404, origin);
  }
};
