import { useEffect, useState } from "react"

export default function PwaUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return
    let refreshing = false
    const reloadOnUpdate = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener("controllerchange", reloadOnUpdate)
    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
        if (registration.waiting && navigator.serviceWorker.controller) setWaitingWorker(registration.waiting)
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setWaitingWorker(worker)
          })
        })
      } catch (error) {
        console.error("SmartPOS service worker registration failed:", error)
      }
    }
    if (document.readyState === "complete") registerServiceWorker()
    else window.addEventListener("load", registerServiceWorker, { once: true })
    return () => {
      window.removeEventListener("load", registerServiceWorker)
      navigator.serviceWorker.removeEventListener("controllerchange", reloadOnUpdate)
    }
  }, [])

  if (!waitingWorker) return null
  return (
    <aside className="pwa-update-prompt" role="status" aria-live="polite">
      <span>New version available</span>
      <button type="button" onClick={() => waitingWorker.postMessage({ type: "SKIP_WAITING" })}>Refresh</button>
    </aside>
  )
}
