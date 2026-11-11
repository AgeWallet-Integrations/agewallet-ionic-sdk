// AgeWallet.startVerification(): the authorize URL, the OIDC state it saves, metadata and the config checks.
import { describe, expect, test } from 'vitest';
import { AgeWallet } from '../src/agewallet';
import { generateChallenge } from '../src/security';
import { browser } from './mocks/capacitor-browser';
import { OIDC_KEY, REDIRECT_URI, begin, makeWallet, saved } from './helpers';

describe('authorize URL', () => {
  test('carries the OIDC parameters', async () => {
    const { url } = await begin(makeWallet());
    const params = Object.fromEntries(url.searchParams.entries());

    expect(url.origin + url.pathname).toBe('https://app.agewallet.io/user/authorize');
    expect(Object.keys(params).sort()).toEqual(['client_id', 'code_challenge', 'code_challenge_method', 'nonce', 'redirect_uri', 'response_type', 'scope', 'state']);
    expect(params.response_type).toBe('code');
    expect(params.client_id).toBe('cid');
    expect(params.redirect_uri).toBe(REDIRECT_URI);
    expect(params.scope).toBe('openid age');
    expect(params.code_challenge_method).toBe('S256');
  });

  test('the saved state, verifier and nonce match the URL', async () => {
    const { url } = await begin(makeWallet());
    const oidc = saved(OIDC_KEY);

    expect(url.searchParams.get('state')).toMatch(/^ionic:[0-9a-f]{32}$/);
    expect(oidc.state).toBe(url.searchParams.get('state'));
    expect(oidc.nonce).toBe(url.searchParams.get('nonce'));
    expect(url.searchParams.get('code_challenge')).toBe(await generateChallenge(oidc.verifier));
  });

  test('each start has its own state, nonce and challenge', async () => {
    const wallet = makeWallet();
    const first = (await begin(wallet)).url.searchParams;
    const second = (await begin(wallet)).url.searchParams;

    for (const name of ['state', 'nonce', 'code_challenge']) {
      expect(second.get(name)).not.toBe(first.get(name));
    }
  });

  test('a custom auth endpoint is used', async () => {
    const { url } = await begin(makeWallet({ endpoints: { auth: 'https://dev3.agewallet.io/user/authorize' } }));
    expect(url.origin + url.pathname).toBe('https://dev3.agewallet.io/user/authorize');
  });

  test('a browser that fails to open rejects', async () => {
    browser.openError = new Error('no browser');
    await expect(makeWallet().startVerification()).rejects.toThrow('no browser');
  });

  test('an empty client ID or redirect URI is rejected', () => {
    expect(() => new AgeWallet({ clientId: '', redirectUri: REDIRECT_URI })).toThrow('Missing clientId');
    expect(() => new AgeWallet({ clientId: 'cid', redirectUri: '' })).toThrow('Missing redirectUri');
  });
});

describe('metadata', () => {
  const sent = async (wallet: AgeWallet, options?: { metadata?: string }) => (await begin(wallet, options)).url.searchParams.get('metadata');

  test('is left out when none is set', async () => {
    expect(await sent(makeWallet())).toBeNull();
  });

  test('the config default is sent', async () => {
    expect(await sent(makeWallet({ metadata: 'tenant-1' }))).toBe('tenant-1');
  });

  test('a per-call value wins without changing the default', async () => {
    const wallet = makeWallet({ metadata: 'tenant-1' });
    expect(await sent(wallet, { metadata: 'order:42 & co' })).toBe('order:42 & co');
    expect(await sent(wallet)).toBe('tenant-1');
  });

  test('a per-call empty value sends none', async () => {
    expect(await sent(makeWallet({ metadata: 'tenant-1' }), { metadata: '' })).toBeNull();
  });

  test('setMetadata changes the default, and null or undefined clears it', async () => {
    const wallet = makeWallet({ metadata: 'tenant-1' });
    wallet.setMetadata('tenant-2');
    expect(await sent(wallet)).toBe('tenant-2');
    wallet.setMetadata(null);
    expect(await sent(wallet)).toBeNull();
    wallet.setMetadata('tenant-3');
    wallet.setMetadata(undefined);
    expect(await sent(wallet)).toBeNull();
  });

  test('the 4096 limit counts UTF-8 bytes', async () => {
    const atLimit = 'é'.repeat(2048); // 2 bytes each in UTF-8
    const overByOneByte = atLimit + 'a';
    const wallet = makeWallet();

    expect(await sent(wallet, { metadata: atLimit })).toBe(atLimit);
    expect(() => makeWallet({ metadata: overByOneByte })).toThrow('4096-byte limit');
    expect(() => wallet.setMetadata(overByOneByte)).toThrow('4096-byte limit');
    await expect(wallet.startVerification({ metadata: overByOneByte })).rejects.toThrow('4096-byte limit');
    expect(() => wallet.setMetadata('a'.repeat(4096))).not.toThrow();
  });
});
