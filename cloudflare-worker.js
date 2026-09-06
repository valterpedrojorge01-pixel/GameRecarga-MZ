const NETSHOP_BASE = 'https://www.netshop.co.mz/api/v1';
const WALLET_IDS = { mpesa: '574418', mkesh: '247460', bim: '767755', bci: '111895' };

function json(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'Content-Type'
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
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    if (request.method === 'OPTIONS') return json({}, 204, allowedOrigin);

    const url = new URL(request.url);
    if (!env.NETSHOP_API_KEY) return json({ error: 'server_not_configured' }, 500, allowedOrigin);

    if (request.method === 'POST' && url.pathname === '/create-order') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, allowedOrigin); }

      const { amount, currency = 'MZN', method, msisdn, reference } = body;
      const amountNumber = Number(amount);
      if (!Number.isFinite(amountNumber) || amountNumber < 10) return json({ error: 'invalid_amount' }, 400, allowedOrigin);
      if (!WALLET_IDS[method]) return json({ error: 'invalid_method' }, 400, allowedOrigin);
      if (!msisdn || !reference) return json({ error: 'missing_fields' }, 400, allowedOrigin);

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
      return json({ ok: response.ok, status: response.status, data }, response.ok ? 200 : 502, allowedOrigin);
    }

    return json({ error: 'not_found' }, 404, allowedOrigin);
  }
};
