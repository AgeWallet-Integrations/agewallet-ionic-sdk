// AgeWallet.handleCallback(): the callback checks, the token exchange, userinfo, the saved verification and expiry.
import { describe, expect, test, vi } from 'vitest';
import { preferences } from './mocks/capacitor-preferences';
import { OIDC_KEY, REDIRECT_URI, VERIFICATION_KEY, fakeServer, json, makeWallet, saveOidcState, saved } from './helpers';

const callback = (state: string) => `${REDIRECT_URI}?code=c1&state=${encodeURIComponent(state)}`;

// These install no fake server, so tests/setup.ts fails them if they send any request.
describe('rejected before any request', () => {
  test('a denied request returns denied and clears the saved state', async () => {
    saveOidcState();
    expect(await makeWallet().handleCallback(`${REDIRECT_URI}?error=access_denied&error_description=The%20user%20denied%20the%20request`)).toBe('denied');
    expect(saved(OIDC_KEY)).toBeNull();
  });

  test('any other error returns failed and clears the saved state', async () => {
    saveOidcState();
    expect(await makeWallet().handleCallback(`${REDIRECT_URI}?error=server_error&error_description=Oops`)).toBe('failed');
    expect(saved(OIDC_KEY)).toBeNull();
  });

  test('a missing code or state returns failed', async () => {
    const state = saveOidcState();
    expect(await makeWallet().handleCallback(`${REDIRECT_URI}?state=${state}`)).toBe('failed');
    expect(await makeWallet().handleCallback(`${REDIRECT_URI}?code=c1`)).toBe('failed');
  });

  test('a state that does not match returns failed and clears the saved state', async () => {
    saveOidcState('ionic:abc');
    expect(await makeWallet().handleCallback(callback('ionic:other'))).toBe('failed');
    expect(saved(OIDC_KEY)).toBeNull();
  });

  test('no saved state returns failed', async () => {
    expect(await makeWallet().handleCallback(callback('ionic:abc'))).toBe('failed');
  });
});

describe('a valid callback', () => {
  test('exchanges the code with the saved verifier, calls userinfo and saves the verification', async () => {
    const state = saveOidcState();
    const server = fakeServer();
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const wallet = makeWallet();

    expect(await wallet.handleCallback(callback(state))).toBe('success');

    expect(server.requests.map((r) => `${r.init.method ?? 'GET'} ${r.url}`)).toEqual([
      'POST https://app.agewallet.io/user/token',
      'GET https://app.agewallet.io/user/userinfo',
    ]);
    const token = server.requests[0];
    expect((token.init.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(Object.fromEntries(new URLSearchParams(String(token.init.body)).entries())).toEqual({
      grant_type: 'authorization_code',
      client_id: 'cid',
      redirect_uri: REDIRECT_URI,
      code: 'c1',
      code_verifier: 'v1',
    });
    expect((server.requests[1].init.headers as Record<string, string>).Authorization).toBe('Bearer tok');

    expect(saved(VERIFICATION_KEY)).toEqual({ accessToken: 'tok', expiresAt: 1_800_000_000_000 + 3600 * 1000, isVerified: true, metadata: 'm1' });
    expect(saved(OIDC_KEY)).toBeNull();
    expect(await wallet.isVerified()).toBe(true);
    expect(await wallet.getMetadata()).toBe('m1');
  });

  test('expires an hour after a token with no expires_in', async () => {
    const state = saveOidcState();
    fakeServer({ token: () => json({ access_token: 'tok' }) });
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);

    await makeWallet().handleCallback(callback(state));

    expect(saved(VERIFICATION_KEY).expiresAt).toBe(1_800_000_000_000 + 3600 * 1000);
  });

  test('stays verified until expires_in has passed, then the record is deleted', async () => {
    const state = saveOidcState();
    fakeServer({ token: () => json({ access_token: 'tok', expires_in: 60 }) });
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const wallet = makeWallet();

    await wallet.handleCallback(callback(state));

    now.mockReturnValue(1_800_000_000_000 + 59_999);
    expect(await wallet.isVerified()).toBe(true);
    now.mockReturnValue(1_800_000_000_000 + 60_000);
    expect(await wallet.isVerified()).toBe(false);
    expect(preferences.values.has(VERIFICATION_KEY)).toBe(false);
  });

  test('with no metadata in userinfo saves none', async () => {
    const state = saveOidcState();
    fakeServer({ userinfo: () => json({ sub: 'u1', age_verified: true }) });
    const wallet = makeWallet();

    await wallet.handleCallback(callback(state));

    expect(saved(VERIFICATION_KEY)).not.toHaveProperty('metadata');
    expect(await wallet.getMetadata()).toBeNull();
  });

  test('uses custom token and userinfo endpoints', async () => {
    const state = saveOidcState();
    const server = fakeServer();

    await makeWallet({ endpoints: { token: 'https://aw.test/x/token', userinfo: 'https://aw.test/x/userinfo' } }).handleCallback(callback(state));

    expect(server.requests.map((r) => r.url)).toEqual(['https://aw.test/x/token', 'https://aw.test/x/userinfo']);
  });

  test('cannot be used twice', async () => {
    const state = saveOidcState();
    const server = fakeServer();
    const wallet = makeWallet();

    expect(await wallet.handleCallback(callback(state))).toBe('success');
    expect(await wallet.handleCallback(callback(state))).toBe('failed');
    expect(server.requests).toHaveLength(2);
  });

  test('clearVerification removes the verification and the OIDC state', async () => {
    const state = saveOidcState();
    fakeServer();
    const wallet = makeWallet();
    await wallet.handleCallback(callback(state));
    saveOidcState();

    await wallet.clearVerification();

    expect(await wallet.isVerified()).toBe(false);
    expect(preferences.values.size).toBe(0);
  });
});

describe('fails and saves nothing', () => {
  async function expectFailure(replies: Parameters<typeof fakeServer>[0], requests: number) {
    const state = saveOidcState();
    const server = fakeServer(replies);
    const wallet = makeWallet();

    expect(await wallet.handleCallback(callback(state))).toBe('failed');
    expect(server.requests).toHaveLength(requests);
    expect(await wallet.isVerified()).toBe(false);
    expect(saved(VERIFICATION_KEY)).toBeNull();
    expect(saved(OIDC_KEY)).toBeNull();
  }

  test('when the token request is refused', async () => {
    await expectFailure({ token: () => json({ error: 'invalid_grant' }, 400) }, 1);
  });

  test('when the token reply is not JSON', async () => {
    await expectFailure({ token: () => new Response('<html>error</html>', { status: 200 }) }, 1);
  });

  test('when the token request cannot connect', async () => {
    await expectFailure({ token: () => Promise.reject(new TypeError('fetch failed')) }, 1);
  });

  test('when userinfo is refused', async () => {
    await expectFailure({ userinfo: () => json({ error: 'invalid_token' }, 401) }, 2);
  });

  test('when age_verified is false', async () => {
    await expectFailure({ userinfo: () => json({ sub: 'u1', age_verified: false }) }, 2);
  });

  test('when age_verified is missing', async () => {
    await expectFailure({ userinfo: () => json({ sub: 'u1' }) }, 2);
  });
});
