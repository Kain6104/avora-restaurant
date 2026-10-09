type EventCallback = (...args: any[]) => void;

class FarmEventBus {
  private events: Map<string, EventCallback[]> = new Map();

  on(event: string, callback: EventCallback) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: EventCallback) {
    if (!this.events.has(event)) return;
    const callbacks = this.events.get(event)!.filter((cb) => cb !== callback);
    this.events.set(event, callbacks);
  }

  emit(event: string, ...args: any[]) {
    if (!this.events.has(event)) return;
    for (const callback of this.events.get(event)!) {
      try {
        callback(...args);
      } catch (err) {
        console.error(`[FarmEventBus] Error in listener for ${event}:`, err);
      }
    }
  }

  clear() {
    this.events.clear();
  }
}

export const farmEventBus = new FarmEventBus();
