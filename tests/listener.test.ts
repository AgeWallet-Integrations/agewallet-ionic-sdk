// startVerification() waits for the app to be opened with the redirect URI (Capacitor's appUrlOpen), then closes
// the browser, removes its listener and resolves with the callback's result.
import { describe, expect, test } from 'vitest';
import { app } from './mocks/capacitor-app';
import { browser } from './mocks/capacitor-browser';
import { REDIRECT_URI, begin, fakeServer, makeWallet } from './helpers';

const callbackFor = (url: URL) => `${REDIRECT_URI}?code=c1&state=${encodeURIComponent(url.searchParams.get('state')!)}`;

/** Tracks whether a promise has settled, and with what. */
function track<T>(promise: Promise<T>) {
  const state: { settled: boolean; value?: T } = { settled: false };
  promise.then((value) => Object.assign(state, { settled: true, value }));
  return state;
}

describe('the appUrlOpen listener', () => {
  test('is registered when the browser opens', async () => {
    await begin(makeWallet());
    expect(app.listeners.map((l) => l.eventName)).toEqual(['appUrlOpen']);
  });

  test('a callback to the redirect URI closes the browser, removes the listener and resolves with the result', async () => {
    const wallet = makeWallet();
    const { result, url } = await begin(wallet);
    fakeServer();

    await app.openUrl(callbackFor(url));

    expect(await result).toBe('success');
    expect(browser.closed).toBe(1);
    expect(app.listeners).toEqual([]);
    expect(await wallet.isVerified()).toBe(true);
  });

  test('a URL on another path is ignored and the listener stays', async () => {
    const { result, url } = await begin(makeWallet());
    const pending = track(result);

    await app.openUrl(`https://shop.example/other?code=c1&state=${encodeURIComponent(url.searchParams.get('state')!)}`);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(pending.settled).toBe(false);
    expect(browser.closed).toBe(0);
    expect(app.listeners).toHaveLength(1);

    fakeServer();
    await app.openUrl(callbackFor(url));
    expect(await result).toBe('success');
  });

  test('a denied callback resolves with denied', async () => {
    const { result } = await begin(makeWallet());

    await app.openUrl(`${REDIRECT_URI}?error=access_denied&error_description=The%20user%20denied%20the%20request`);

    expect(await result).toBe('denied');
  });
});
