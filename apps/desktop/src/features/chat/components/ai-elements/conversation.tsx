"use client";

import { Button } from "@/features/shared/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowDown } from "@/components/icons";
import type { ComponentProps, RefObject } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CONVERSATION_BOTTOM_THRESHOLD_PX,
  getConversationDistanceFromBottom,
  getPreservedViewportScrollTop,
  isConversationNearBottom,
  shouldShowConversationScrollButton,
} from "./conversationScroll";

type ConversationScrollBehavior = "auto" | "instant" | "smooth"

interface ConversationScrollContextValue {
  scrollRef: RefObject<HTMLDivElement | null>
  handleViewportScroll: () => void
  scrollToBottom: (behavior?: ConversationScrollBehavior) => void
  forceScrollToBottom: (behavior?: ConversationScrollBehavior) => void
  preserveViewport: (anchor: HTMLElement | null, update: () => void) => void
  setScrollElement: (node: HTMLDivElement | null) => void
  setContentElement: (node: HTMLDivElement | null) => void
}

interface ConversationScrollStateValue {
  isAtBottom: boolean
  userDetached: boolean
  distanceFromBottom: number
}

const ConversationScrollContext = createContext<ConversationScrollContextValue | null>(null)
const ConversationScrollStateContext = createContext<ConversationScrollStateValue | null>(null)

const PROGRAMMATIC_SCROLL_WINDOW_MS = 1500
const PROGRAMMATIC_SCROLL_LEEWAY_PX = 2

function useConversationScrollContextInternal() {
  const context = useContext(ConversationScrollContext)

  if (context == null) {
    throw new Error("Conversation scroll components must be used inside <Conversation>.")
  }

  return context
}

function useConversationScrollStateContextInternal() {
  const context = useContext(ConversationScrollStateContext)

  if (context == null) {
    throw new Error("Conversation scroll components must be used inside <Conversation>.")
  }

  return context
}

export function useConversationScrollContext() {
  return useConversationScrollContextInternal()
}

export function useConversationScrollState() {
  return useConversationScrollStateContextInternal()
}

export type ConversationProps = ComponentProps<"div">

export const Conversation = ({ className, children, ...props }: ConversationProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const preserveFrameRef = useRef<number | null>(null)
  const autoScrollMarkRef = useRef<{
    targetScrollTop: number
    expiresAt: number
  } | null>(null)
  const userDetachedRef = useRef(false)
  const [scrollElement, setScrollElementState] = useState<HTMLDivElement | null>(null)
  const [contentElement, setContentElementState] = useState<HTMLDivElement | null>(null)
  const [distanceFromBottom, setDistanceFromBottom] = useState(0)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [userDetached, setUserDetached] = useState(false)

  const setDetached = useCallback((next: boolean) => {
    userDetachedRef.current = next
    setUserDetached((previousValue) => (previousValue === next ? previousValue : next))
  }, [])

  const updateOverflowAnchor = useCallback(
    (element: HTMLDivElement) => {
      element.style.overflowAnchor = userDetachedRef.current ? "auto" : "none"
    },
    []
  )

  const syncScrollState = useCallback(
    (element: HTMLDivElement) => {
      const nextDistanceFromBottom = getConversationDistanceFromBottom({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollTop: element.scrollTop,
      })
      const nextIsAtBottom = isConversationNearBottom(
        nextDistanceFromBottom,
        CONVERSATION_BOTTOM_THRESHOLD_PX
      )

      setDistanceFromBottom((previousValue) =>
        Math.abs(previousValue - nextDistanceFromBottom) < 0.5
          ? previousValue
          : nextDistanceFromBottom
      )
      setIsAtBottom((previousValue) =>
        previousValue === nextIsAtBottom ? previousValue : nextIsAtBottom
      )

      if (nextIsAtBottom && userDetachedRef.current) {
        setDetached(false)
      }

      updateOverflowAnchor(element)
    },
    [setDetached, updateOverflowAnchor]
  )

  const markProgrammaticScroll = useCallback((element: HTMLDivElement) => {
    autoScrollMarkRef.current = {
      targetScrollTop: Math.max(0, element.scrollHeight - element.clientHeight),
      expiresAt: Date.now() + PROGRAMMATIC_SCROLL_WINDOW_MS,
    }
  }, [])

  const isProgrammaticScroll = useCallback((element: HTMLDivElement) => {
    const mark = autoScrollMarkRef.current

    if (mark == null) {
      return false
    }

    if (Date.now() > mark.expiresAt) {
      autoScrollMarkRef.current = null
      return false
    }

    return Math.abs(element.scrollTop - mark.targetScrollTop) <= PROGRAMMATIC_SCROLL_LEEWAY_PX
  }, [])

  const scrollToBottomInternal = useCallback(
    (force: boolean, behavior: ConversationScrollBehavior = "auto") => {
      const element = scrollRef.current
      if (element == null) {
        return
      }

      if (!force && userDetachedRef.current) {
        syncScrollState(element)
        return
      }

      const nextDistanceFromBottom = getConversationDistanceFromBottom({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollTop: element.scrollTop,
      })

      setDetached(false)
      updateOverflowAnchor(element)

      if (isConversationNearBottom(nextDistanceFromBottom, CONVERSATION_BOTTOM_THRESHOLD_PX)) {
        markProgrammaticScroll(element)
        syncScrollState(element)
        return
      }

      markProgrammaticScroll(element)

      if (behavior === "smooth") {
        element.scrollTo({
          top: element.scrollHeight,
          behavior: "smooth",
        })
      } else {
        element.scrollTop = element.scrollHeight
      }

      syncScrollState(element)
    },
    [markProgrammaticScroll, setDetached, syncScrollState, updateOverflowAnchor]
  )

  const handleViewportScroll = useCallback(() => {
    const element = scrollRef.current
    if (element == null) {
      return
    }

    const nextDistanceFromBottom = getConversationDistanceFromBottom({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      scrollTop: element.scrollTop,
    })

    if (isConversationNearBottom(nextDistanceFromBottom, CONVERSATION_BOTTOM_THRESHOLD_PX)) {
      syncScrollState(element)
      return
    }

    if (!userDetachedRef.current && isProgrammaticScroll(element)) {
      syncScrollState(element)

      if (
        !isConversationNearBottom(nextDistanceFromBottom, CONVERSATION_BOTTOM_THRESHOLD_PX)
      ) {
        scrollToBottomInternal(false, "auto")
      }

      return
    }

    setDetached(true)
    syncScrollState(element)
  }, [isProgrammaticScroll, scrollToBottomInternal, setDetached, syncScrollState])

  const preserveViewport = useCallback(
    (anchor: HTMLElement | null, update: () => void) => {
      const element = scrollRef.current
      if (element == null) {
        update()
        return
      }

      const nextDistanceFromBottom = getConversationDistanceFromBottom({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollTop: element.scrollTop,
      })

      if (isConversationNearBottom(nextDistanceFromBottom, CONVERSATION_BOTTOM_THRESHOLD_PX)) {
        update()
        return
      }

      const scrollTopBefore = element.scrollTop
      const scrollRectBefore = element.getBoundingClientRect()
      const anchorOffsetBefore =
        anchor == null ? null : anchor.getBoundingClientRect().top - scrollRectBefore.top

      setDetached(true)
      update()

      if (preserveFrameRef.current != null) {
        window.cancelAnimationFrame(preserveFrameRef.current)
        preserveFrameRef.current = null
      }

      preserveFrameRef.current = window.requestAnimationFrame(() => {
        preserveFrameRef.current = null

        const currentElement = scrollRef.current
        if (currentElement == null) {
          return
        }

        if (anchorOffsetBefore == null || anchor == null || !anchor.isConnected) {
          currentElement.scrollTop = scrollTopBefore
          syncScrollState(currentElement)
          return
        }

        const scrollRectAfter = currentElement.getBoundingClientRect()
        const anchorOffsetAfter = anchor.getBoundingClientRect().top - scrollRectAfter.top
        currentElement.scrollTop = getPreservedViewportScrollTop({
          currentScrollTop: currentElement.scrollTop,
          anchorOffsetBefore,
          anchorOffsetAfter,
        })
        syncScrollState(currentElement)
      })
    },
    [setDetached, syncScrollState]
  )

  const setScrollElement = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node
      setScrollElementState(node)

      if (node != null) {
        updateOverflowAnchor(node)
        syncScrollState(node)
      }
    },
    [syncScrollState, updateOverflowAnchor]
  )

  const setContentElement = useCallback((node: HTMLDivElement | null) => {
    setContentElementState(node)
  }, [])

  useLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return
    }

    const targets = [scrollElement, contentElement].filter(
      (value): value is HTMLDivElement => value != null
    )

    if (targets.length === 0) {
      return
    }

    const observer = new ResizeObserver(() => {
      const element = scrollRef.current
      if (element == null) {
        return
      }

      if (userDetachedRef.current) {
        syncScrollState(element)
        return
      }

      scrollToBottomInternal(false, "auto")
    })

    targets.forEach((target) => observer.observe(target))

    return () => {
      observer.disconnect()
    }
  }, [contentElement, scrollElement, scrollToBottomInternal, syncScrollState])

  useLayoutEffect(() => {
    return () => {
      if (preserveFrameRef.current != null) {
        window.cancelAnimationFrame(preserveFrameRef.current)
      }
    }
  }, [])

  const scrollToBottom = useCallback(
    (behavior: ConversationScrollBehavior = "auto") => {
      scrollToBottomInternal(false, behavior)
    },
    [scrollToBottomInternal]
  )

  const forceScrollToBottom = useCallback(
    (behavior: ConversationScrollBehavior = "auto") => {
      scrollToBottomInternal(true, behavior)
    },
    [scrollToBottomInternal]
  )

  const contextValue = useMemo<ConversationScrollContextValue>(
    () => ({
      scrollRef,
      handleViewportScroll,
      scrollToBottom,
      forceScrollToBottom,
      preserveViewport,
      setScrollElement,
      setContentElement,
    }),
    [
      forceScrollToBottom,
      handleViewportScroll,
      preserveViewport,
      scrollToBottom,
      setContentElement,
      setScrollElement,
    ]
  )

  const stateValue = useMemo<ConversationScrollStateValue>(
    () => ({
      isAtBottom,
      userDetached,
      distanceFromBottom,
    }),
    [distanceFromBottom, isAtBottom, userDetached]
  )

  return (
    <ConversationScrollContext.Provider value={contextValue}>
      <ConversationScrollStateContext.Provider value={stateValue}>
        <div
          className={cn("relative flex min-h-0 flex-1 overflow-hidden", className)}
          role="log"
          {...props}
        >
          {children}
        </div>
      </ConversationScrollStateContext.Provider>
    </ConversationScrollContext.Provider>
  )
}

export type ConversationContentProps = ComponentProps<"div">

export const ConversationContent = ({ className, ...props }: ConversationContentProps) => {
  const { handleViewportScroll, setContentElement, setScrollElement } =
    useConversationScrollContextInternal()

  return (
    <div
      ref={setScrollElement}
      onScroll={handleViewportScroll}
      className="app-scrollbar h-full min-h-0 flex-1 overflow-y-auto overscroll-none"
    >
      <div
        ref={setContentElement}
        className={cn("flex min-h-full flex-col gap-3 p-4", className)}
        {...props}
      />
    </div>
  )
}

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
      className
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </>
    )}
  </div>
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { forceScrollToBottom } = useConversationScrollContextInternal()
  const { distanceFromBottom, userDetached } = useConversationScrollStateContextInternal()

  const handleScrollToBottom = useCallback(() => {
    forceScrollToBottom("instant")
  }, [forceScrollToBottom])

  if (
    !shouldShowConversationScrollButton({
      userDetached,
      distanceFromBottom,
    })
  ) {
    return null
  }

  return (
    <Button
      className={cn(
        "absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full",
        className
      )}
      onClick={handleScrollToBottom}
      size="icon"
      variant="outline"
      {...props}
    >
      <ArrowDown className="size-4" />
    </Button>
  )
}
