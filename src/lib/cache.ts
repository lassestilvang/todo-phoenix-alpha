import db from './db/schema';

// Simple in-memory cache for frequently accessed data
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class DataCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL = 60000; // 1 minute default TTL
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton cache instance
export const dataCache = new DataCache();

// Cache keys for different data types
export const CacheKeys = {
  lists: 'lists',
  labels: 'labels',
  tasks: 'tasks',
  taskById: (id: number) => `task:${id}`,
  tasksByList: (listId: number) => `tasks:list:${listId}`,
  tasksByDate: (date: string) => `tasks:date:${date}`,
  upcomingTasks: (date: string) => `tasks:upcoming:${date}`,
  overdueTasks: (date: string) => `tasks:overdue:${date}`,
  attachments: (taskId: number) => `attachments:${taskId}`,
  reminders: 'reminders:pending',
  stats: 'stats'
} as const;

// Helper functions for common cached queries
export function getCachedLists(): any[] | null {
  return dataCache.get(CacheKeys.lists);
}

export function setCachedLists(lists: any[]): void {
  dataCache.set(CacheKeys.lists, lists, 30000); // 30 second TTL for lists
}

export function getCachedTaskById(id: number): any | null {
  return dataCache.get(CacheKeys.taskById(id));
}

export function setCachedTaskById(id: number, task: any): void {
  dataCache.set(CacheKeys.taskById(id), task, 30000);
}

export function invalidateTaskCache(taskId: number): void {
  dataCache.invalidate(CacheKeys.taskById(taskId));
  dataCache.invalidatePattern('tasks:*');
}
