export const CONSENT_TEXT = 'I agree to receive Evential news and product updates by email.';

export function createHandler({ env, fetch: request }) {
  return async function handler(req) {
    const allowed = (env('ALLOWED_ORIGINS') || 'https://evential.co,https://www.evential.co')
      .split(',').map(value => value.trim()).filter(Boolean);
    const origin = req.headers.get('Origin');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
    const respond = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (!allowed.includes(origin)) return respond(403, { error: 'Origin not allowed.' });
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return respond(405, { error: 'Method not allowed.' });
    if (!req.headers.get('Content-Type')?.startsWith('application/json')) {
      return respond(415, { error: 'JSON required.' });
    }
    const url = env('SUPABASE_URL');
    const key = env('SUPABASE_SERVICE_ROLE_KEY');
    const secret = env('TURNSTILE_SECRET_KEY');
    if (!url || !key || !secret) return respond(503, { error: 'Signup is temporarily unavailable.' });
    try {
      // Bound the actual streamed body; Content-Length alone can be omitted or forged.
      const reader = req.body?.getReader();
      if (!reader) return respond(400, { error: 'Missing request.' });
      const chunks = [];
      let length = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 8192) {
          await reader.cancel();
          return respond(413, { error: 'Request too large.' });
        }
        chunks.push(value);
      }
      let data;
      try { data = JSON.parse(await new Blob(chunks).text()); }
      catch { return respond(400, { error: 'Invalid request.' }); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return respond(400, { error: 'Invalid request.' });
      // Do not disclose whether a contact already exists or has unsubscribed.
      const accepted = { message: 'Thanks! Your request has been received. Existing email preferences are preserved.' };
      if (data.website) return respond(200, accepted);
      const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
      const firstName = typeof data.firstName === 'string' ? data.firstName.trim() : '';
      const lastName = typeof data.lastName === 'string' ? data.lastName.trim() : '';
      const company = typeof data.company === 'string' ? data.company.trim() : '';
      const position = typeof data.position === 'string' ? data.position.trim() : '';
      if (!firstName || !lastName || !company || firstName.length > 100 || lastName.length > 100 || company.length > 200 || position.length > 150 ||
          (data.position != null && typeof data.position !== 'string') ||
          [firstName, lastName, company, position].some(value => /[\u0000-\u001f\u007f<>]/.test(value))) {
        return respond(400, { error: 'Enter your first name, last name and company or organization using plain text. Keep names under 101 characters, organization under 201 and position under 151.' });
      }
      if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 254 || data.consent !== true) {
        return respond(400, { error: 'Enter a valid email and agree to receive updates.' });
      }
      if (typeof data.token !== 'string' || !data.token || data.token.length > 2048) {
        return respond(400, { error: 'Please complete the spam check.' });
      }
      const verification = await request('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', body: new URLSearchParams({ secret, response: data.token }), signal: AbortSignal.timeout(10000)
      });
      if (!verification.ok) return respond(503, { error: 'Spam check unavailable. Please try again.' });
      const result = await verification.json();
      if (!result.success || result.action !== 'mailing-list' || result.hostname !== new URL(origin).hostname) {
        return respond(400, { error: 'Spam check expired or failed. Please try again.' });
      }
      const saved = await request(`${url}/rest/v1/mailing_contacts?on_conflict=email`, {
        method: 'POST',
        headers: {
          apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates,return=minimal'
        },
        body: JSON.stringify({ email, first_name: firstName, last_name: lastName, company, position, source: 'website', contact_type: 'Website',
          consent_at: new Date().toISOString(), consent_text: CONSENT_TEXT }),
        signal: AbortSignal.timeout(10000)
      });
      if (!saved.ok) return respond(503, { error: 'Could not save your signup. Please try again.' });
      return respond(200, accepted);
    } catch {
      return respond(503, { error: 'Signup is temporarily unavailable. Please try again.' });
    }
  };
}
