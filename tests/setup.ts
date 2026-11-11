/**
 * Runs around every test: resets the Capacitor stand-ins in tests/mocks/, silences the SDK's console.error, and
 * replaces fetch with a guard that fails the test if it sent a request without installing a stub (fakeServer()).
 */
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { app } from './mocks/capacitor-app';
import { browser } from './mocks/capacitor-browser';
import { preferences } from './mocks/capacitor-preferences';

let unstubbedRequests: string[] = [];

beforeEach(() => {
  app.reset();
  browser.reset();
  preferences.reset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  unstubbedRequests = [];
  vi.stubGlobal('fetch', async (input: unknown) => {
    unstubbedRequests.push(String(input));
    throw new Error('unexpected fetch');
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  expect(unstubbedRequests).toEqual([]);
});
