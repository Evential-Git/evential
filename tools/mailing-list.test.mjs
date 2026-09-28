import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../supabase/functions/mailing-list/handler.mjs';

function fixture({ verify = {}, saveStatus = 201, missingSecret = false } = {}) {
  const writes = [];
  const env = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-only',
    TURNSTILE_SECRET_KEY: missingSecret ? '' : 'secret' };
  const handler = createHandler({ env: name => env[name], fetch: async (url, options) => {
    if (url.includes('siteverify')) return Response.json({ success: true, hostname: 'evential.co', action: 'mailing-list', ...verify });
    writes.push({ url, ...options, data: JSON.parse(options.body) });
    return new Response(null, { status: saveStatus });
  } });
  const send = (data = {}, method = 'POST', origin = 'https://evential.co') => handler(new Request('https://project.supabase.co/functions/v1/mailing-list', {
    method, headers: { Origin: origin, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify({ email: ' PERSON@Example.com ', firstName: ' Pat ', consent: true, token: 'captcha', ...data }) } : {})
  }));
  return { writes, handler, send };
}

test('stores normalized contact and consent; never updates duplicate or unsubscribed records', async () => {
  const { send, writes } = fixture();
  assert.equal((await send()).status, 200);
  assert.equal(writes[0].data.email, 'person@example.com');
  assert.equal(writes[0].data.first_name, 'Pat');
  assert.equal(writes[0].data.source, 'website');
  assert.ok(writes[0].data.consent_at);
  assert.match(writes[0].headers.Prefer, /ignore-duplicates/);
  assert.equal(writes[0].data.unsubscribed, undefined);
});
test('requires explicit consent and valid bounded fields', async () => {
  const { send, writes } = fixture();
  for (const invalid of [{ consent: false }, { consent: 'true' }, { email: 'bad' }, { firstName: 'a'.repeat(101) }, { token: '' }]) {
    assert.equal((await send(invalid)).status, 400);
  }
  assert.equal(writes.length, 0);
});
test('rejects invalid, wrong-action and wrong-host CAPTCHAs', async () => {
  for (const verify of [{ success: false }, { action: 'other' }, { hostname: 'attacker.example' }]) {
    const { send, writes } = fixture({ verify });
    assert.equal((await send()).status, 400);
    assert.equal(writes.length, 0);
  }
});
test('rejects unwanted origins and methods; supports preflight', async () => {
  const { send, writes } = fixture();
  assert.equal((await send({}, 'POST', 'https://attacker.example')).status, 403);
  assert.equal((await send({}, 'GET')).status, 405);
  const preflight = await send({}, 'OPTIONS');
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://evential.co');
  assert.equal(writes.length, 0);
});
test('does not claim success on database failure or missing config', async () => {
  assert.equal((await fixture({ saveStatus: 500 }).send()).status, 503);
  assert.equal((await fixture({ missingSecret: true }).send()).status, 503);
});
test('limits body size and silently discards honeypot submissions', async () => {
  const { send, writes } = fixture();
  assert.equal((await send({ extra: 'a'.repeat(9000) })).status, 413);
  assert.equal((await send({ website: 'spam.example' })).status, 200);
  assert.equal(writes.length, 0);
});
test('malformed JSON and unexpected upstream failures return controlled errors', async () => {
  const { handler } = fixture();
  assert.equal((await handler(new Request('https://example.com', { method: 'POST', headers: { Origin: 'https://evential.co', 'Content-Type': 'application/json' }, body: '{' }))).status, 400);
  // Use the default origins through an env adapter so this reaches the upstream failure.
  const handler2 = createHandler({ env: name => name === 'ALLOWED_ORIGINS' ? undefined : 'configured', fetch: async () => { throw new Error('private details'); } });
  const response = await handler2(new Request('https://example.com', { method: 'POST', headers: { Origin: 'https://evential.co', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@example.com', consent: true, token: 'captcha' }) }));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private details/);
});
