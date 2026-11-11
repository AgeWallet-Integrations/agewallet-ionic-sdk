// PKCE verifier and challenge, state and nonce (src/security.ts), on Node's Web Crypto.
import { describe, expect, test, vi } from 'vitest';
import { generateChallenge, generateNonce, generateState, generateVerifier } from '../src/security';

describe('security', () => {
  test('the challenge matches the RFC 7636 Appendix B example', async () => {
    expect(await generateChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  test('a verifier is 86 Base64-URL characters with no padding, and verifiers differ', () => {
    expect(generateVerifier()).toMatch(/^[A-Za-z0-9_-]{86}$/);
    expect(generateVerifier()).not.toBe(generateVerifier());
  });

  test('state and nonce are 32 lowercase hex characters and differ each time', () => {
    expect(generateState()).toMatch(/^[0-9a-f]{32}$/);
    expect(generateNonce()).toMatch(/^[0-9a-f]{32}$/);
    expect(generateState()).not.toBe(generateState());
    expect(generateNonce()).not.toBe(generateNonce());
  });

  test('the values come from crypto.getRandomValues', () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      (array as Uint8Array).fill(0xab);
      return array;
    });

    expect(generateState()).toBe('ab'.repeat(16));
    // 64 bytes of 0xab in Base64-URL: "q6ur" for each 3 bytes, "qw" for the last one
    expect(generateVerifier()).toBe('q6ur'.repeat(21) + 'qw');
  });
});
