import { useEffect } from "react"

export function useKeyboardShortcuts(
  shortcuts: Record<string, () => void>,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle modifier keys (Ctrl/Cmd)
      const modifier = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      // Check for matching shortcut
      for (const [shortcutKey, handler] of Object.entries(shortcuts)) {
        const [expectedModifier, expectedKey] = shortcutKey.split("+")
        const isModifierMatch =
          (expectedModifier === "ctrl" && modifier) ||
          (expectedModifier === "cmd" && modifier) ||
          !expectedModifier

        if (isModifierMatch && expectedKey === key) {
          event.preventDefault()
          handler()
          return
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [shortcuts, enabled])
}