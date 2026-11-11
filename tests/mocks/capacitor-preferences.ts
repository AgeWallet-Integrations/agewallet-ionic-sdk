/**
 * Stand-in for @capacitor/preferences: get, set and remove on preferences.values, a Map by key.
 */
export const preferences = {
  values: new Map<string, string>(),
  reset(): void {
    this.values.clear();
  },
};

export const Preferences = {
  async get({ key }: { key: string }): Promise<{ value: string | null }> {
    return { value: preferences.values.get(key) ?? null };
  },
  async set({ key, value }: { key: string; value: string }): Promise<void> {
    preferences.values.set(key, value);
  },
  async remove({ key }: { key: string }): Promise<void> {
    preferences.values.delete(key);
  },
};
