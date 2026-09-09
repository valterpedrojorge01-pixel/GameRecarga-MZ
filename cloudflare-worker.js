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
        endpoint: '/create-order'
      }, 200, origin);
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
