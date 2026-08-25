import { expect, describe, it, vi, beforeEach } from 'vitest'
import pwaManager from '../pwa'

// Mock localStorage before tests
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString() },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('PWAManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  describe('Cache Management', () => {
    it('should cache data successfully', async () => {
      await expect(
        pwaManager.cacheData('test-key', { name: 'test' })
      ).resolves.toBeUndefined()

      const result = await pwaManager.getCachedData<{ name: string }>('test-key')
      expect(result).toEqual({ name: 'test' })
    })

    it('should return null for uncached data', async () => {
      const result = await pwaManager.getCachedData('nonexistent-key')
      expect(result).toBeNull()
    })
  })

  describe('Sync Queue Operations', () => {
    it('should get sync queue status', () => {
      const status = pwaManager.getSyncQueueStatus()
      expect(status).toHaveProperty('pending')
      expect(status).toHaveProperty('syncing')
      expect(status).toHaveProperty('failed')
    })

    it('should clear sync queue', async () => {
      await expect(pwaManager.clearSyncQueue()).resolves.toBeUndefined()
      const status = pwaManager.getSyncQueueStatus()
      expect(status.pending).toBe(0)
    })
  })

  describe('Database Operations', () => {
    it('should check online status', () => {
      const isOnline = pwaManager.isOnlineNow()
      expect(typeof isOnline).toBe('boolean')
    })

    it('should be installable', () => {
      const isInstallable = pwaManager.isInstallable()
      expect(typeof isInstallable).toBe('boolean')
    })
  })

  describe('Types', () => {
    it('should have correct types defined', () => {
      // Verify that the exported types are available
      expect(pwaManager).toBeDefined()
      expect(typeof pwaManager.cacheData).toBe('function')
      expect(typeof pwaManager.getCachedData).toBe('function')
      expect(typeof pwaManager.addToSyncQueue).toBe('function')
      expect(typeof pwaManager.isOnlineNow).toBe('function')
      expect(typeof pwaManager.getSyncQueueStatus).toBe('function')
      expect(typeof pwaManager.clearSyncQueue).toBe('function')
      expect(typeof pwaManager.isInstallable).toBe('function')
    })
  })
})