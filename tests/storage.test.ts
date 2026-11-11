// src/storage.ts over the Capacitor Preferences stand-in.
import { describe, expect, test } from 'vitest';
import { clearOidcState, getOidcState, getVerification, setOidcState, setVerification } from '../src/storage';
import { preferences } from './mocks/capacitor-preferences';
import { OIDC_KEY, VERIFICATION_KEY, makeWallet } from './helpers';

const inAnHour = () => Date.now() + 3600 * 1000;

describe('storage', () => {
  test('saves a verification under io.agewallet.sdk.verification and reads it back', async () => {
    const verification = { accessToken: 'tok', expiresAt: inAnHour(), isVerified: true, metadata: 'm1' };
    await setVerification(verification);

    expect(JSON.parse(preferences.values.get(VERIFICATION_KEY)!)).toEqual(verification);
    expect(await getVerification()).toEqual(verification);
  });

  test('saves OIDC state under io.agewallet.sdk.oidc, apart from the verification', async () => {
    await setVerification({ accessToken: 'tok', expiresAt: inAnHour(), isVerified: true });
    await setOidcState({ state: 's', verifier: 'v', nonce: 'n' });

    expect(JSON.parse(preferences.values.get(OIDC_KEY)!)).toEqual({ state: 's', verifier: 'v', nonce: 'n' });
    await clearOidcState();
    expect(await getOidcState()).toBeNull();
    expect(await getVerification()).not.toBeNull();
  });

  test('a verification that has reached its expiry reads as none and is deleted', async () => {
    const now = Date.now();
    await setVerification({ accessToken: 'tok', expiresAt: now, isVerified: true });

    expect(await getVerification()).toBeNull();
    expect(preferences.values.has(VERIFICATION_KEY)).toBe(false);
  });

  test('corrupt JSON reads as none and is deleted', async () => {
    preferences.values.set(VERIFICATION_KEY, '{not json');
    preferences.values.set(OIDC_KEY, '{not json');

    expect(await getVerification()).toBeNull();
    expect(await getOidcState()).toBeNull();
    expect(preferences.values.size).toBe(0);
  });

  test('not verified when nothing is saved', async () => {
    const wallet = makeWallet();
    expect(await wallet.isVerified()).toBe(false);
    expect(await wallet.getMetadata()).toBeNull();
  });
});
