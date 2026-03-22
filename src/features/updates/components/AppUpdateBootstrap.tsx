import { useEffect } from "react"
import { listen } from "@tauri-apps/api/event"
import {
  APP_UPDATE_EVENT,
  type AppUpdateDownloadEvent,
  useAppUpdateStore,
} from "@/features/updates/store/updateStore"

export function AppUpdateBootstrap() {
  const initialize = useAppUpdateStore((state) => state.initialize)
  const handleDownloadEvent = useAppUpdateStore((state) => state.handleDownloadEvent)

  useEffect(() => {
    let isMounted = true
    let unlisten: (() => void) | null = null

    void initialize()

    void listen<AppUpdateDownloadEvent>(APP_UPDATE_EVENT, (event) => {
      handleDownloadEvent(event.payload)
    })
      .then((dispose) => {
        if (isMounted) {
          unlisten = dispose
          return
        }

        dispose()
      })
      .catch((error) => {
        console.error("Failed to subscribe to app update events:", error)
      })

    return () => {
      isMounted = false
      unlisten?.()
    }
  }, [handleDownloadEvent, initialize])

  return null
}
