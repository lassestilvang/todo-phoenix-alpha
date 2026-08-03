import { useEffect, useRef } from "react"

export function useKeyboardShortcuts(
  shortcuts: Record<string, () => void>,
  options: { enabled?: boolean; preventDefault?: boolean } = {}
) {
  const { enabled = true, preventDefault = false } = options
  const shortcutsRef = useRef(shortcuts)

  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if typing in an input/textarea/select
      const target = event.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return
      }

      const { ctrlKey, shiftKey, altKey, metaKey, key } = event

      for (const [combo, handler] of Object.entries(shortcutsRef.current)) {
        const parts = combo.toLowerCase().split("+")
        const expectedKey = parts[parts.length - 1]
        const expectsCtrl = parts.includes("ctrl")
        const expectsShift = parts.includes("shift")
        const expectsAlt = parts.includes("alt")
        const expectsMeta = parts.includes("cmd") || parts.includes("meta")

        if (
          key === expectedKey &&
          ctrlKey === expectsCtrl &&
          shiftKey === expectsShift &&
          altKey === expectsAlt &&
          metaKey === expectsMeta
        ) {
          if (preventDefault) event.preventDefault()
          handler()
          return
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [enabled, preventDefault])
}