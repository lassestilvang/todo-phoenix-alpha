"use client"

// Progressive Web App (PWA) Implementation
// Offline-first functionality, service worker, and sync capabilities

interface CacheEntry {
  key: string
  value: any
  timestamp: number
  expiresAt?: number
}

interface SyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  table: string
  data: any
  attemptedAt: number
  retries: number
  maxRetries: number
  status: 'pending' | 'syncing' | 'completed' | 'failed'
}

class PWAManager {
  private cache = new Map<string, CacheEntry>()
  private syncQueue: SyncOperation[] = []
  private isOnline = typeof window !== 'undefined' && window.navigator.onLine
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null
  private syncInterval: number | null = null
  private cacheExpiry = 30 * 60 * 1000 // 30 minutes in milliseconds

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupEventListeners()
      this.initServiceWorker()
    }
  }

  private setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.processSyncQueue()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })

    // Listen for beforeinstallprompt for PWA installation
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      this.promptInstall = e
    })
  }

  private promptInstall: any = null

  private async initServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js')
        console.log('Service worker registered successfully')
      } catch (error) {
        console.error('Service worker registration failed:', error)
      }
    }
  }

  // Cache management
  async cacheData(key: string, value: any, ttl?: number): Promise<void> {
    const entry: CacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : undefined
    }

    this.cache.set(key, entry)

    // Store in localStorage for persistence across sessions
    try {
      const cached = Array.from(this.cache.entries()).map(([key, entry]) => ({ key, entry }))
      localStorage.setItem('pwa_cache', JSON.stringify(cached))
    } catch (error) {
      console.error('Failed to cache data:', error)
    }
  }

  async getCachedData<T>(key: string): Promise<T | null> {
    let entry = this.cache.get(key)

    if (!entry && typeof window !== 'undefined') {
      // Try to load from localStorage
      try {
        const cached = localStorage.getItem('pwa_cache')
        if (cached) {
          const cachedData = JSON.parse(cached) as Array<{ key: string, entry: CacheEntry }>
          const found = cachedData.find(item => item.key === key)
          if (found) {
            entry = found.entry
            this.cache.set(key, entry)
          }
        }
      } catch (error) {
        console.error('Failed to load cached data:', error)
      }
    }

    if (!entry) return null

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.value as T
  }

  // Sync operations
  async addToSyncQueue(operation: SyncOperation): Promise<void> {
    this.syncQueue.push(operation)
    await this.saveSyncQueue()

    if (this.isOnline) {
      this.processSyncQueue()
    }
  }

  private async saveSyncQueue() {
    try {
      const queue = this.syncQueue.map(op => ({
        id: op.id,
        type: op.type,
        table: op.table,
        data: op.data,
        attemptedAt: op.attemptedAt,
        retries: op.retries,
        maxRetries: op.maxRetries,
        status: op.status
      }))
      localStorage.setItem('pwa_sync_queue', JSON.stringify(queue))
    } catch (error) {
      console.error('Failed to save sync queue:', error)
    }
  }

  private async loadSyncQueue() {
    if (typeof window === 'undefined') return

    try {
      const saved = localStorage.getItem('pwa_sync_queue')
      if (saved) {
        const queue = JSON.parse(saved) as Array<any>
        this.syncQueue = queue.map(op => ({
          ...op,
          attemptedAt: new Date(op.attemptedAt).getTime()
        }))
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error)
    }
  }

  private async processSyncQueue() {
    if (this.syncQueue.length === 0) return

    const pending = this.syncQueue.filter(op => op.status === 'pending')
    if (pending.length === 0) return

    const operation = pending[0]
    operation.status = 'syncing'
    await this.saveSyncQueue()

    try {
      await this.executeSyncOperation(operation)
      operation.status = 'completed'
      this.syncQueue = this.syncQueue.filter(op => op.id !== operation.id)
      await this.saveSyncQueue()
    } catch (error) {
      operation.retries++
      operation.attemptedAt = Date.now()

      if (operation.retries >= operation.maxRetries) {
        operation.status = 'failed'
      } else {
        operation.status = 'pending'
      }

      await this.saveSyncQueue()

      if (operation.status === 'failed') {
        console.error(`Sync operation ${operation.id} failed after ${operation.retries} retries`)
      }
    }
  }

  private async executeSyncOperation(operation: SyncOperation): Promise<void> {
    // Implementation would depend on the specific database ORM used
    // This is a mock implementation

    switch (operation.table) {
      case 'tasks':
        await this.syncTask(operation)
        break
      case 'time_entries':
        await this.syncTimeEntry(operation)
        break
      case 'attachments':
        await this.syncAttachment(operation)
        break
      default:
        throw new Error(`Unknown table for sync: ${operation.table}`)
    }
  }

  private async syncTask(operation: SyncOperation): Promise<void> {
    // Mock implementation - in real app would use actual database
    console.log(`Syncing task: ${JSON.stringify(operation.data)}`)
    await new Promise(resolve => setTimeout(resolve, 100)) // Simulate network delay
  }

  private async syncTimeEntry(operation: SyncOperation): Promise<void> {
    // Mock implementation - in real app would use actual database
    console.log(`Syncing time entry: ${JSON.stringify(operation.data)}`)
    await new Promise(resolve => setTimeout(resolve, 100)) // Simulate network delay
  }

  private async syncAttachment(operation: SyncOperation): Promise<void> {
    // Mock implementation - in real app would upload file to cloud storage
    console.log(`Syncing attachment: ${JSON.stringify(operation.data)}`)
    await new Promise(resolve => setTimeout(resolve, 500)) // Simulate file upload delay
  }

  // Database operations with offline support
  async getItem<T>(table: string, id: number): Promise<T | null> {
    const cacheKey = `${table}_${id}`
    let item = await this.getCachedData<T>(cacheKey)

    if (!item && this.isOnline) {
      item = await this.fetchFromServer<T>(table, id)
      await this.cacheData(cacheKey, item)
    }

    return item
  }

  async getList<T>(table: string, filters?: any): Promise<T[]> {
    const cacheKey = `${table}_${JSON.stringify(filters)}`
    let list = await this.getCachedData<T[]>(cacheKey)

    if (!list && this.isOnline) {
      list = await this.fetchFromServer<T[]>(table, filters)
      await this.cacheData(cacheKey, list)
    }

    return list || []
  }

  async saveItem(table: string, id: number, data: any): Promise<void> {
    const cacheKey = `${table}_${id}`

    if (this.isOnline) {
      // Save to server
      await this.saveToServer(table, id, data)
      await this.cacheData(cacheKey, data)
    } else {
      // Queue for later sync
      await this.addToSyncQueue({
        id: `${table}_${id}_${Date.now()}`,
        type: 'update',
        table,
        data,
        attemptedAt: Date.now(),
        retries: 0,
        maxRetries: 3,
        status: 'pending'
      })
    }
  }

  async createItem(table: string, data: any): Promise<number> {
    if (this.isOnline) {
      // Create on server
      const id = await this.createOnServer(table, data)
      await this.cacheData(`${table}_${id}`, data)
      return id
    } else {
      // Queue for later sync
      const id = Date.now() // Mock ID
      await this.addToSyncQueue({
        id: `${table}_${id}_${Date.now()}`,
        type: 'create',
        table,
        data: { ...data, id },
        attemptedAt: Date.now(),
        retries: 0,
        maxRetries: 3,
        status: 'pending'
      })
      return id
    }
  }

  async deleteItem(table: string, id: number): Promise<void> {
    if (this.isOnline) {
      // Delete from server
      await this.deleteFromServer(table, id)
      this.cache.delete(`${table}_${id}`)
    } else {
      // Queue for later sync
      await this.addToSyncQueue({
        id: `${table}_${id}_${Date.now()}`,
        type: 'delete',
        table,
        data: { id },
        attemptedAt: Date.now(),
        retries: 0,
        maxRetries: 3,
        status: 'pending'
      })
    }
  }

  private async fetchFromServer<T>(table: string, id?: number | any): Promise<T> {
    // Mock implementation - would use actual API calls
    await new Promise(resolve => setTimeout(resolve, 50))
    return {} as T
  }

  private async saveToServer(table: string, id: number, data: any): Promise<void> {
    // Mock implementation - would use actual API calls
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  private async createOnServer(table: string, data: any): Promise<number> {
    // Mock implementation - would use actual API calls
    await new Promise(resolve => setTimeout(resolve, 50))
    return Date.now()
  }

  private async deleteFromServer(table: string, id: number): Promise<void> {
    // Mock implementation - would use actual API calls
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  // Utility methods
  isOnlineNow(): boolean {
    return this.isOnline
  }

  getSyncQueueStatus(): { pending: number; syncing: number; failed: number } {
    const pending = this.syncQueue.filter(op => op.status === 'pending').length
    const syncing = this.syncQueue.filter(op => op.status === 'syncing').length
    const failed = this.syncQueue.filter(op => op.status === 'failed').length

    return { pending, syncing, failed }
  }

  async clearSyncQueue(): Promise<void> {
    this.syncQueue = []
    await this.saveSyncQueue()
  }

  // PWA installation prompt
  async installPWA(): Promise<void> {
    if (this.promptInstall) {
      this.promptInstall.prompt()
      await this.promptInstall.userChoice()
      this.promptInstall = null
    }
  }

  isInstallable(): boolean {
    return this.promptInstall !== null
  }
}

// Singleton instance
const pwaManager = new PWAManager()
export default pwaManager

// Export types for use in components
export type { CacheEntry, SyncOperation }