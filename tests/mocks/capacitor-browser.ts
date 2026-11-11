/**
 * Stand-in for @capacitor/browser: open() records the URL in browser.opened (or rejects with browser.openError when
 * set), close() counts in browser.closed.
 */
export const browser = {
  opened: [] as string[],
  closed: 0,
  openError: null as Error | null,
  reset(): void {
    this.opened.length = 0;
    this.closed = 0;
    this.openError = null;
  },
};

export const Browser = {
  async open({ url }: { url: string }): Promise<void> {
    if (browser.openError) throw browser.openError;
    browser.opened.push(url);
  },
  async close(): Promise<void> {
    browser.closed++;
  },
};
