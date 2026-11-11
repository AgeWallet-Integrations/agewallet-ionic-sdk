/**
 * Stand-in for @capacitor/app: addListener() records each listener in app.listeners and resolves to a handle whose
 * remove() takes it out again; app.openUrl(url) sends an appUrlOpen event to every appUrlOpen listener.
 */
type Listener = (event: { url: string }) => void | Promise<void>;

export const app = {
  listeners: [] as Array<{ eventName: string; listener: Listener }>,
  reset(): void {
    this.listeners.length = 0;
  },
  async openUrl(url: string): Promise<void> {
    for (const entry of [...this.listeners]) {
      if (entry.eventName === 'appUrlOpen') await entry.listener({ url });
    }
  },
};

export const App = {
  addListener(eventName: string, listener: Listener): Promise<{ remove: () => void }> {
    const entry = { eventName, listener };
    app.listeners.push(entry);
    return Promise.resolve({
      remove: () => {
        const index = app.listeners.indexOf(entry);
        if (index >= 0) app.listeners.splice(index, 1);
      },
    });
  },
};
