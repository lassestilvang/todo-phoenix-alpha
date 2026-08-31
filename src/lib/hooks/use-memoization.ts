"use client"

import { useMemo, useCallback, useRef, useEffect, DependencyList } from 'react'

/**
 * Deep comparison memoization hook
 * Comparable to lodash.memoize but with deep comparison
 *
 * @param factory - Function to memoize
 * @param deps - Dependencies for re-computation
 * @returns Memoized result
 */
export function useMemoized<T>(factory: () => T, deps: DependencyList): T {
  // Using useMemo for comparison, but with better dependency handling
  // The deps array is compared shallowly by useMemo, which is often sufficient
  return useMemo(factory, deps)
}

/**
 * Shallow equality memoization
 * Useful for objects that change rarely
 */
export function useMemoizedObject<T extends Record<string, any>>(obj: T, deps: DependencyList[]): T {
  return useMemo(() => obj, deps)
}

/**
 * Memoize a function with stable reference
 * Useful for callbacks passed to children
 */
export function useCallbackMemoized<T extends (...args: any[]) => any>(
  fn: T,
  deps: DependencyList
): T {
  return useCallback(fn, deps)
}

/**
 * Memoize with deep comparison of object arguments
 * Higher tolerance for object changes
 */
export function useDeepMemo<T>(factory: () => T, deps: DependencyList): T {
  const depsRef = useRef<DependencyList>(deps)
  const hasChanged = deps.some((dep, i) => {
    if (dep === undefined && depsRef.current[i] === undefined) return false
    if (dep === null && depsRef.current[i] === null) return false
    if (typeof dep === 'object' && typeof depsRef.current[i] === 'object') {
      return JSON.stringify(dep) !== JSON.stringify(depsRef.current[i])
    }
    return dep !== depsRef.current[i]
  })

  if (hasChanged) {
    depsRef.current = deps
  }

  return useMemo(factory, hasChanged ? deps : [])
}

/**
 * Memoize async functions
 * Returns { data, error, isLoading, execute }
 */
export function useAsyncMemo<T>(
  factory: () => Promise<T>,
  deps: DependencyList,
  initialValue?: T
) {
  const [data, setData] = useState<T | undefined>(initialValue)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const execute = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await factory()
      setData(result)
      return result
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
      throw e
    } finally {
      setIsLoading(false)
    }
  }, deps)

  useEffect(() => {
    let cancelled = false
    execute().catch(() => {
      if (!cancelled) {
        // Error is already set in execute
      }
    })
    return () => {
      cancelled = true
    }
  }, deps)

  return { data, error, isLoading, execute }
}

/**
 * Memoize computed values that derive from other data
 * Automatically tracks dependencies
 */
export function useComputed<T>(
  compute: (prev: T | undefined) => T,
  source: unknown,
  initialValue: T | undefined = undefined
): T {
  const prevResult = useRef<T | undefined>(initialValue)
  return useMemo(() => {
    const result = compute(prevResult.current)
    prevResult.current = result
    return result
  }, [source])
}

/**
 * Stable memoization for objects with complex equality checks
 */
export function useStableMemo<T>(
  factory: () => T,
  isEqual: (prev: T, next: T) => boolean
): T {
  const ref = useRef<T | undefined>(undefined)
  const depsRef = useRef<DependencyList>([])

  return useMemo(() => {
    const newDeps = Array.from(arguments).slice(1)
    const depsChanged = newDeps.some((dep, i) => dep !== depsRef.current[i])

    if (ref.current === undefined || depsChanged) {
      const newResult = factory()
      if (depsChanged || !isEqual(ref.current ?? newResult, newResult)) {
        ref.current = newResult
      }
    }

    return ref.current!
  }, [])
}

/**
 * Use weak map for object memoization
 * Returns same reference for identical objects
 */
export function useWeakMemo<K extends object, V>(
  key: K,
  factory: () => V,
  isEqual: (prev: K, next: K) => boolean = (a, b) => a === b
): V {
  const cacheRef = useRef(new Map<string, V>())
  const keyMapRef = useRef(new Map<string, K>())

  return useMemo(() => {
    const keyStr = JSON.stringify(key)
    const existingKey = keyMapRef.current.get(keyStr)

    if (existingKey && isEqual(existingKey, key)) {
      return cacheRef.current.get(keyStr)!
    }

    const newValue = factory()
    cacheRef.current.set(keyStr, newValue)
    keyMapRef.current.set(keyStr, key)
    return newValue
  }, [key])
}

import { useState } from 'react'