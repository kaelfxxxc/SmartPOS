import { useEffect, useState } from "react"

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let deferredPrompt: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

if (typeof window !== "undefined") {
  installed = window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault()
    deferredPrompt = event as InstallPromptEvent
    notify()
  })

  window.addEventListener("appinstalled", () => {
    installed = true
    deferredPrompt = null
    notify()
  })
}

export function usePwaInstall() {
  const [, refresh] = useState(0)

  useEffect(() => {
    const listener = () => refresh((value) => value + 1)
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, [])

  async function requestInstall() {
    if (!deferredPrompt) return false
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    deferredPrompt = null
    if (choice.outcome === "accepted") installed = true
    notify()
    return choice.outcome === "accepted"
  }

  return {
    canPrompt: Boolean(deferredPrompt),
    installed,
    requestInstall,
  }
}
