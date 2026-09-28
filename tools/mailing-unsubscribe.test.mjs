import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../supabase/functions/mailing-unsubscribe/handler.mjs';

const token = 'a'.repeat(64);
function fixture({ matched = true, dbStatus = 200, missingConfig = false, throws = false } = {}) {
  const calls = [];
  const env = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: missingConfig ? '' : 'server-only' };
  const handler = createHandler({ env: name => env[name], fetch: async (url, options) => {
    calls.push({ url, ...options });
    if (throws) throw new Error('private upstream details');
    return Response.json(matched, { status: dbStatus });
  } });
  const send = ({ method = 'POST', origin = 'https://evential.co', data = { token }, raw, contentType = 'application/json' } = {}) => handler(new Request('https://project.supabase.co/functions/v1/mailing-unsubscribe', {
    method, headers: { Origin: origin, 'Content-Type': contentType },
    ...(method === 'POST' ? { body: raw ?? JSON.stringify(data) } : {})
  }));
  return { calls, send };
}

test('valid link invokes only the unsubscribe RPC without returning contact data', async () => {
  const { send, calls } = fixture();
  const response = await send();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(calls[0].url, /\/rpc\/unsubscribe_mailing_contact$/);
  assert.deepEqual(JSON.parse(calls[0].body), { p_token: token });
  const body = await response.text();
  assert.match(body, /unsubscribed/);
  assert.doesNotMatch(body, /server-only|aaaaa|email_address|first_name/);
});
test('GET, HEAD and preflight do not mutate subscriptions', async () => {
  const { send, calls } = fixture();
  assert.equal((await send({ method: 'GET' })).status, 405);
  assert.equal((await send({ method: 'HEAD' })).status, 405);
  const response = await send({ method: 'OPTIONS' });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://evential.co');
  assert.equal(calls.length, 0);
});
test('rejects foreign origins and unsupported content types', async () => {
  const { send, calls } = fixture();
  assert.equal((await send({ origin: 'https://attacker.example' })).status, 403);
  assert.equal((await send({ contentType: 'text/plain' })).status, 415);
  assert.equal((await send({ contentType: 'application/json-unsupported' })).status, 415);
  assert.equal(calls.length, 0);
});
test('email address, missing, malformed and oversized tokens cannot unsubscribe anyone', async () => {
  const { send, calls } = fixture();
  for (const data of [null, {}, { email: 'person@example.com' }, { token: 'person@example.com' }, { token: 'a'.repeat(63) }, { token: 'z'.repeat(64) }, { token: 123 }]) {
    assert.equal((await send({ data })).status, 400);
  }
  assert.equal((await send({ raw: '{' })).status, 400);
  assert.equal((await send({ raw: 'a'.repeat(1025) })).status, 413);
  assert.equal(calls.length, 0);
});
test('unknown token is not falsely reported as saved', async () => {
  assert.equal((await fixture({ matched: false }).send()).status, 404);
});
test('missing config and upstream failures return controlled retryable errors', async () => {
  for (const opts of [{ missingConfig: true }, { dbStatus: 500 }, { throws: true }, { matched: {} }]) {
    const response = await fixture(opts).send();
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private upstream|server-only/);
  }
});
