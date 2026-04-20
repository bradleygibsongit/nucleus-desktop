import { useCallback } from "react"
import { useConversationScrollContext } from "./ai-elements/conversation"

export function useViewportAnchorToggle() {
  const { preserveViewport } = useConversationScrollContext()

  return useCallback(
    (anchor: HTMLElement | null, toggle: () => void) => {
      preserveViewport(anchor, toggle)
    },
    [preserveViewport]
  )
}
