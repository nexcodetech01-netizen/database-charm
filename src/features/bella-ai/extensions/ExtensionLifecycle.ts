/**
 * ExtensionLifecycle — dispatcher de eventos de ciclo de vida e runtime.
 * Sem singleton por extensão — o Manager mantém as inscrições e delega.
 */
import type { ExtensionHookHandler, ExtensionLifecycleEvent } from "./types";

interface HookEntry {
  extensionId: string;
  handler: ExtensionHookHandler;
}

export class ExtensionLifecycleBus {
  private hooks = new Map<string, HookEntry[]>();

  on(event: ExtensionLifecycleEvent | string, extensionId: string, handler: ExtensionHookHandler): void {
    const list = this.hooks.get(event) ?? [];
    list.push({ extensionId, handler });
    this.hooks.set(event, list);
  }

  offAll(extensionId: string): void {
    for (const [event, list] of this.hooks) {
      this.hooks.set(event, list.filter((e) => e.extensionId !== extensionId));
    }
  }

  async emit(event: ExtensionLifecycleEvent | string, payload?: unknown): Promise<void> {
    const list = this.hooks.get(event) ?? [];
    for (const { handler } of list) {
      try {
        await handler(payload);
      } catch (err) {
        // Um handler defeituoso não deve quebrar os demais.
        // eslint-disable-next-line no-console
        console.error(`[ExtensionLifecycle] handler falhou em "${event}":`, err);
      }
    }
  }
}
