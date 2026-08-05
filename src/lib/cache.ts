/**
 * Simple LRU (Least Recently Used) cache implementation for server-side query caching.
 * This helps optimize frequently accessed data like user task statistics,
 * upcoming deadlines, and productivity insights.
 */
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove oldest item if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// Cache instances with TTL-like behavior (cleared manually for simplicity)
export const cacheRegistry = {
  taskStats: new LRUCache<number, any>(500), // Cache per task ID
  upcomingTasks: new LRUCache<string, any>(10), // Cache per date string
  productivityInsights: new LRUCache<string, any>(5), // Cache per user
  aiSuggestions: new LRUCache<number, any>(100), // Cache per task suggestion
};

// Helper function to invalidate cache entries
export function invalidateCache(pattern?: RegExp): void {
  if (pattern) {
    // Invalidate cache keys matching the pattern
    for (const cache of Object.values(cacheRegistry)) {
      for (const key of Array.from(cache.keys())) {
        if (pattern.test(String(key))) {
          cache.delete(key);
        }
      }
    }
  } else {
    // Clear all caches
    for (const cache of Object.values(cacheRegistry)) {
      cache.clear();
    }
  }
}

// Helper function to get or set cache value
export function getOrCreateCache<K, V>(
  cache: LRUCache<K, V>,
  key: K,
  factory: () => V
): V {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const value = factory();
  cache.set(key, value);
  return value;
}

export default LRUCache;