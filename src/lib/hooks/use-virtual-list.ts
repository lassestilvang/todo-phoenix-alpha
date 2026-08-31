"use client"

import { useMemo, useCallback, useState, useEffect, useRef } from 'react'

/**
 * Hook for virtualized list rendering
 * Only renders items that are currently visible in the viewport
 *
 * @param items - The full array of items to virtualize
 * @param itemHeight - Height of each item in pixels (can be number or function)
 * @param containerHeight - Height of the visible container in pixels
 * @param overscan - Number of items to render above/below visible area (default: 5)
 * @returns Object with virtualItems, totalHeight, and scroll handler
 */
export function useVirtualList<T>(
  items: T[],
  itemHeight: number | ((index: number, item: T) => number),
  containerHeight: number,
  overscan = 5
) {
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const getItemHeight = useCallback(
    (index: number, item: T): number => {
      return typeof itemHeight === 'function' ? itemHeight(index, item) : itemHeight
    },
    [itemHeight]
  )

  const totalHeight = useMemo(() => {
    return items.reduce((sum, item, index) => sum + getItemHeight(index, item), 0)
  }, [items, getItemHeight])

  // Calculate visible range
  const { startIndex, endIndex } = useMemo(() => {
    let accumulatedHeight = 0
    let startIndex = 0

    // Find start index
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i, items[i])
      if (accumulatedHeight + height >= scrollTop) {
        startIndex = Math.max(0, i - overscan)
        break
      }
      accumulatedHeight += height
    }

    // Find end index
    accumulatedHeight = 0
    let endIndex = items.length - 1
    for (let i = startIndex; i < items.length; i++) {
      accumulatedHeight += getItemHeight(i, items[i])
      if (accumulatedHeight >= containerHeight + overscan * getItemHeight(i, items[i])) {
        endIndex = i + overscan
        break
      }
    }

    return { startIndex, endIndex: Math.min(endIndex, items.length - 1) }
  }, [items, scrollTop, containerHeight, overscan, getItemHeight])

  const virtualItems = useMemo(() => {
    const result: Array<{
      index: number
      item: T
      offsetTop: number
      height: number
    }> = []

    let offsetTop = 0
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i, items[i])
      if (i >= startIndex && i <= endIndex) {
        result.push({ index: i, item: items[i], offsetTop, height })
      }
      offsetTop += height
      if (i > endIndex) break
    }

    return result
  }, [items, startIndex, endIndex, getItemHeight])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
    setScrollLeft(e.currentTarget.scrollLeft)
  }, [])

  const scrollToIndex = useCallback(
    (index: number) => {
      if (!containerRef.current || index < 0 || index >= items.length) return

      let offsetTop = 0
      for (let i = 0; i < index; i++) {
        offsetTop += getItemHeight(i, items[i])
      }
      containerRef.current.scrollTop = offsetTop
    },
    [items, getItemHeight]
  )

  const scrollToTop = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = totalHeight
    }
  }, [totalHeight])

  return {
    containerRef,
    virtualItems,
    totalHeight,
    handleScroll,
    scrollToIndex,
    scrollToTop,
    scrollToBottom,
    scrollTop,
    scrollLeft,
    visibleRange: { startIndex, endIndex },
  }
}

/**
 * Hook for windowed list with dynamic item heights
 * Uses a cache to store measured heights
 */
export function useWindowedList<T>(
  items: T[],
  estimateItemHeight: number,
  containerHeight: number,
  overscan = 5
) {
  const [itemHeights, setItemHeights] = useState<Map<number, number>>(new Map())
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const getItemHeight = useCallback(
    (index: number): number => {
      return itemHeights.get(index) ?? estimateItemHeight
    },
    [itemHeights, estimateItemHeight]
  )

  const setItemHeight = useCallback((index: number, height: number) => {
    setItemHeights((prev) => {
      const next = new Map(prev)
      next.set(index, height)
      return next
    })
  }, [])

  const totalHeight = useMemo(() => {
    return items.reduce((sum, _, index) => sum + getItemHeight(index), 0)
  }, [items, getItemHeight])

  const { startIndex, endIndex } = useMemo(() => {
    let accumulatedHeight = 0
    let startIndex = 0

    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i)
      if (accumulatedHeight + height >= scrollTop) {
        startIndex = Math.max(0, i - overscan)
        break
      }
      accumulatedHeight += height
    }

    accumulatedHeight = 0
    let endIndex = items.length - 1
    for (let i = startIndex; i < items.length; i++) {
      accumulatedHeight += getItemHeight(i)
      if (accumulatedHeight >= containerHeight + overscan * getItemHeight(i)) {
        endIndex = i + overscan
        break
      }
    }

    return { startIndex, endIndex: Math.min(endIndex, items.length - 1) }
  }, [items, scrollTop, containerHeight, overscan, getItemHeight])

  const virtualItems = useMemo(() => {
    const result: Array<{
      index: number
      item: T
      offsetTop: number
      height: number
    }> = []

    let offsetTop = 0
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i)
      if (i >= startIndex && i <= endIndex) {
        result.push({ index: i, item: items[i], offsetTop, height })
      }
      offsetTop += height
      if (i > endIndex) break
    }

    return result
  }, [items, startIndex, endIndex, getItemHeight])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const measureItem = useCallback((index: number, element: HTMLElement | null) => {
    if (element) {
      setItemHeight(index, element.offsetHeight)
    }
  }, [setItemHeight])

  return {
    containerRef,
    virtualItems,
    totalHeight,
    handleScroll,
    measureItem,
    scrollTop,
    visibleRange: { startIndex, endIndex },
  }
}

/**
 * Hook for virtualized grid rendering
 */
export function useVirtualGrid<T>(
  items: T[],
  columns: number,
  itemHeight: number,
  containerHeight: number,
  overscan = 1
) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const rowCount = Math.ceil(items.length / columns)
  const totalHeight = rowCount * itemHeight

  const { startIndex, endIndex } = useMemo(() => {
    const startRow = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endRow = Math.min(rowCount - 1, Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan)

    return {
      startIndex: startRow * columns,
      endIndex: Math.min((endRow + 1) * columns - 1, items.length - 1),
    }
  }, [scrollTop, containerHeight, itemHeight, columns, rowCount, overscan])

  const virtualItems = useMemo(() => {
    const result: Array<{
      index: number
      item: T
      offsetTop: number
      offsetLeft: number
      width: number
      height: number
    }> = []

    for (let i = startIndex; i <= endIndex; i++) {
      const row = Math.floor(i / columns)
      const col = i % columns
      result.push({
        index: i,
        item: items[i],
        offsetTop: row * itemHeight,
        offsetLeft: (100 / columns) * col,
        width: 100 / columns,
        height: itemHeight,
      })
    }

    return result
  }, [items, startIndex, endIndex, columns, itemHeight])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return {
    containerRef,
    virtualItems,
    totalHeight,
    handleScroll,
    scrollTop,
    visibleRange: { startIndex, endIndex },
  }
}