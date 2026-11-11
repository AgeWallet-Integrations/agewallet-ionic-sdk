/**
 * Shared test helpers: the SDK made with client ID "cid", the saved OIDC state, and fakeServer(), which replaces
 * fetch with a fake AgeWallet server for one test.
 */
import { vi } from 'vitest';
import { AgeWallet } from '../src/agewallet';
import type { AgeWalletConfig } from '../src/types';
import { browser } from './mocks/capacitor-browser';
import { preferences } from './mocks/capacitor-preferences';

export const REDIRECT_URI = 'https://shop.example/callback';
export const OIDC_KEY = 'io.agewallet.sdk.oidc';
export const VERIFICATION_KEY = 'io.agewallet.sdk.verification';

export function makeWallet(config: Partial<AgeWalletConfig> = {}): AgeWallet {
  return new AgeWallet({ clientId: 'cid', redirectUri: REDIRECT_URI, ...config });
}

/** The JSON saved under [key], or null. */
export function saved(key: string): any {
  const value = preferences.values.get(key);
  return value === undefined ? null : JSON.parse(value);
}

/** Saves OIDC state as startVerification() would: [state], verifier "v1", nonce "n1". */
export function saveOidcState(state = 'ionic:abc'): string {
  preferences.values.set(OIDC_KEY, JSON.stringify({ state, verifier: 'v1', nonce: 'n1' }));
  return state;
}

/**
 * Calls startVerification() and waits until it has opened the browser. Returns the pending result and the
 * authorize URL it opened.
 */
export async function begin(wallet: AgeWallet, options?: { metadata?: string }) {
  const opened = browser.opened.length;
  const result = wallet.startVerification(options);
  await vi.waitFor(() => {
    if (browser.opened.length <= opened) throw new Error('browser not opened yet');
  });
  return { result, url: new URL(browser.opened[browser.opened.length - 1]) };
}

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * Replaces fetch for this test: records every request, answers URLs ending in /token and /userinfo with
 * replies.token() and replies.userinfo() (by default a 1-hour token "tok" and a verified user with metadata "m1"),
 * and anything else with 404.
 */
export function fakeServer(replies: { token?: () => Response | Promise<Response>; userinfo?: () => Response | Promise<Response> } = {}) {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal('fetch', async (input: unknown, init: RequestInit = {}) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith('/token')) return (replies.token ?? (() => json({ access_token: 'tok', expires_in: 3600 })))();
    if (url.endsWith('/userinfo')) return (replies.userinfo ?? (() => json({ sub: 'u1', age_verified: true, metadata: 'm1' })))();
    return new Response('not found', { status: 404 });
  });
  return { requests };
}
