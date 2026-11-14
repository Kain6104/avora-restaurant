export type ChatbotCacheScope = 'ALL' | 'MENU' | 'CATEGORY' | 'BRANCH' | 'PRODUCT';

export type ChatbotCacheInvalidationListener = (
  scope: ChatbotCacheScope,
  entityId?: string,
) => void;

class ChatbotCacheRegistryManager {
  private readonly listeners = new Set<ChatbotCacheInvalidationListener>();
  private version = 1;
  private lastInvalidatedAt = 0;

  public register(listener: ChatbotCacheInvalidationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public invalidate(scope: ChatbotCacheScope = 'ALL', entityId?: string): number {
    this.version += 1;
    this.lastInvalidatedAt = Date.now();
    for (const listener of this.listeners) {
      try {
        listener(scope, entityId);
      } catch {
        // Ignore listener errors to prevent cascading failures during invalidation
      }
    }
    return this.version;
  }

  public getVersion(): number {
    return this.version;
  }

  public getLastInvalidatedAt(): number {
    return this.lastInvalidatedAt;
  }
}

export const ChatbotCacheRegistry = new ChatbotCacheRegistryManager();

export function invalidateChatbotCaches(
  scope: ChatbotCacheScope = 'ALL',
  entityId?: string,
): number {
  return ChatbotCacheRegistry.invalidate(scope, entityId);
}

