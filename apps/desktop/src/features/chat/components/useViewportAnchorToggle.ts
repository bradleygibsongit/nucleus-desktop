import { useCallback, useRef } from "react"
import { useStickToBottomContext } from "use-stick-to-bottom"

export function useViewportAnchorToggle() {
  const stickToBottom = useStickToBottomContext()
  const settleFrameRef = useRef<number | null>(null)

  return useCallback(
    (_anchor: HTMLElement | null, toggle: () => void) => {
      const scrollElement = stickToBottom.scrollRef.current
      if (!scrollElement) {
        toggle()
        return
      }

      const scrollTopBefore = scrollElement.scrollTop

      if (settleFrameRef.current != null) {
        window.cancelAnimationFrame(settleFrameRef.current)
        settleFrameRef.current = null
      }

      // User-triggered expansion should keep the current viewport stable,
      // not remain locked to the chat bottom during the resulting resize.
      stickToBottom.stopScroll()
      stickToBottom.state.animation = undefined

      toggle()

      settleFrameRef.current = window.requestAnimationFrame(() => {
        settleFrameRef.current = null

        stickToBottom.state.scrollTop = scrollTopBefore
        stickToBottom.state.lastScrollTop = stickToBottom.state.scrollTop
      })
    },
    [stickToBottom]
  )
}
