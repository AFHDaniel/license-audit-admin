import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { extractEmailFromUserinfo, verifyOktaUser, verifySuperAdmin, clearOktaUserinfoCacheForTest } from './oktaVerify.mjs';

beforeEach(() => {
  process.env.OKTA_ISSUER = 'https://example.okta.com/oauth2/default';
  process.env.SUPER_ADMIN_EMAIL = 'daniel@atlantafinehomes.com';
  clearOktaUserinfoCacheForTest();
});

test('extractEmailFromUserinfo falls through claim aliases', () => {
  assert.equal(extractEmailFromUserinfo({ email: 'a@x.com' }), 'a@x.com');
  assert.equal(extractEmailFromUserinfo({ preferred_username: 'b@x.com' }), 'b@x.com');
  assert.equal(extractEmailFromUserinfo({ upn: 'c@x.com' }), 'c@x.com');
  assert.equal(extractEmailFromUserinfo({ unique_name: 'D@X.com' }), 'd@x.com');
  assert.equal(extractEmailFromUserinfo({ name: 'no email' }), '');
  assert.equal(extractEmailFromUserinfo(null), '');
});

function fakeFetch(response: { status?: number; json?: () => Promise<unknown>; text?: () => Promise<string>; ok?: boolean }) {
  return async () => ({
    ok: response.ok ?? (response.status ?? 200) < 400,
    status: response.status ?? 200,
    json: response.json ?? (async () => ({})),
    text: response.text ?? (async () => ''),
  });
}

test('verifySuperAdmin returns 401 when no bearer token is presented', async () => {
  const req = { headers: {} } as { headers: Record<string, string> };
  const result = await verifySuperAdmin(req, { fetchImpl: fakeFetch({ status: 200, json: async () => ({ email: 'daniel@atlantafinehomes.com' }) }) });
  assert.deepEqual(result, { ok: false, status: 401, error: 'Missing bearer token.' });
});

test('verifySuperAdmin returns 403 when token is valid but email is not the super admin', async () => {
  const req = { headers: { authorization: 'Bearer abc' } } as { headers: Record<string, string> };
  const result = await verifySuperAdmin(req, { fetchImpl: fakeFetch({ status: 200, json: async () => ({ email: 'sarah@atlantafinehomes.com' }) }) });
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
});

test('verifySuperAdmin accepts the super admin via preferred_username fallback', async () => {
  const req = { headers: { authorization: 'Bearer abc' } } as { headers: Record<string, string> };
  const result = await verifySuperAdmin(req, { fetchImpl: fakeFetch({ status: 200, json: async () => ({ preferred_username: 'daniel@atlantafinehomes.com' }) }) });
  assert.equal(result.ok, true);
  assert.equal(result.email, 'daniel@atlantafinehomes.com');
});

test('verifySuperAdmin surfaces a 401 when Okta rejects the token', async () => {
  const req = { headers: { authorization: 'Bearer bad' } } as { headers: Record<string, string> };
  const result = await verifySuperAdmin(req, { fetchImpl: fakeFetch({ status: 401, ok: false }) });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test('verifyOktaUser returns 401 with no bearer token', async () => {
  const req = { headers: {} } as { headers: Record<string, string> };
  const result = await verifyOktaUser(req, { fetchImpl: fakeFetch({ status: 200, json: async () => ({ email: 'a@atlantafinehomes.com' }) }) });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test('verifyOktaUser accepts any email in the AFH domain', async () => {
  const req = { headers: { authorization: 'Bearer ok' } } as { headers: Record<string, string> };
  const result = await verifyOktaUser(req, { fetchImpl: fakeFetch({ status: 200, json: async () => ({ email: 'sarah@atlantafinehomes.com' }) }) });
  assert.equal(result.ok, true);
  assert.equal(result.email, 'sarah@atlantafinehomes.com');
});

test('verifyOktaUser rejects emails outside the allowed domain', async () => {
  const req = { headers: { authorization: 'Bearer ok' } } as { headers: Record<string, string> };
  const result = await verifyOktaUser(req, { fetchImpl: fakeFetch({ status: 200, json: async () => ({ email: 'attacker@evil.com' }) }) });
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
});

test('verifyOktaUser honors ALLOWED_OKTA_DOMAINS override', async () => {
  process.env.ALLOWED_OKTA_DOMAINS = 'atlantafinehomes.com,partner.com';
  try {
    const req = { headers: { authorization: 'Bearer ok' } } as { headers: Record<string, string> };
    const result = await verifyOktaUser(req, { fetchImpl: fakeFetch({ status: 200, json: async () => ({ email: 'jess@partner.com' }) }) });
    assert.equal(result.ok, true);
  } finally {
    delete process.env.ALLOWED_OKTA_DOMAINS;
  }
});
