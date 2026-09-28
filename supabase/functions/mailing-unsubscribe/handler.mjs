export function createHandler({ env, fetch: request }) {
  return async function handler(req) {
    const headers = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer', 'Vary': 'Origin'
    };
    const respond = (status, body) => new Response(JSON.stringify(body), { status, headers });
    const allowed = (env('ALLOWED_ORIGINS') || 'https://evential.co,https://www.evential.co')
      .split(',').map(value => value.trim()).filter(Boolean);
    const origin = req.headers.get('Origin');
    if (!allowed.includes(origin)) return respond(403, { error: 'Origin not allowed.' });
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    // A link preview, crawler, GET or HEAD must never change a subscription.
    if (req.method !== 'POST') return respond(405, { error: 'Use the unsubscribe button to confirm.' });
    if (req.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') {
      return respond(415, { error: 'JSON required.' });
    }
    const url = env('SUPABASE_URL');
    const key = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return respond(503, { error: 'Unsubscribe is temporarily unavailable. Please try again.' });
    try {
      const reader = req.body?.getReader();
      if (!reader) return respond(400, { error: 'Missing unsubscribe link.' });
      const chunks = [];
      let length = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 1024) {
          await reader.cancel();
          return respond(413, { error: 'Request too large.' });
        }
        chunks.push(value);
      }
      let data;
      try { data = JSON.parse(await new Blob(chunks).text()); }
      catch { return respond(400, { error: 'Invalid request.' }); }
      if (!data || typeof data.token !== 'string' || !/^[0-9a-f]{64}$/.test(data.token)) {
        return respond(400, { error: 'This unsubscribe link is incomplete or invalid.' });
      }
      const saved = await request(`${url}/rest/v1/rpc/unsubscribe_mailing_contact`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: data.token }), signal: AbortSignal.timeout(10000)
      });
      if (!saved.ok) return respond(503, { error: 'Could not save your preference. Please try again.' });
      const matched = await saved.json();
      if (matched === false) return respond(404, { error: 'This unsubscribe link is no longer valid. Please email contact@evential.co for help.' });
      if (matched !== true) return respond(503, { error: 'Could not confirm your preference. Please try again.' });
      // No email, name, token, or prior subscription status is returned or logged.
      return respond(200, { message: 'You’re unsubscribed. You will no longer receive Evential mailing-list emails.' });
    } catch {
      return respond(503, { error: 'Unsubscribe is temporarily unavailable. Please try again.' });
    }
  };
}
