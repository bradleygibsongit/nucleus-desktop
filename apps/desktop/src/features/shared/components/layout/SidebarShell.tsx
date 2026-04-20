import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useResizablePanel } from "./useResizablePanel"
import { SIDEBAR_CLOSE_DURATION_S, SIDEBAR_OPEN_DURATION_S } from "./layoutSizing"

interface SidebarShellProps {
  width: number
  setWidth: (width: number) => void
  persistWidth?: () => void
  isCollapsed: boolean
  side: "left" | "right"
  sizeConstraintClass: string
  collapsedWidth?: number
  animateWidth?: boolean
  children: React.ReactNode | ((state: { isResizing: boolean }) => React.ReactNode)
  className?: string
}

export function SidebarShell({
  width,
  setWidth,
  persistWidth,
  isCollapsed,
  side,
  sizeConstraintClass,
  collapsedWidth = 0,
  animateWidth = true,
  children,
  className,
}: SidebarShellProps) {
  const { handleResizeStart, isResizing } = useResizablePanel({
    width,
    setWidth,
    persistWidth,
    isCollapsed,
    side,
  })
  const content = typeof children === "function" ? children({ isResizing }) : children
  const isLeftSidebar = side === "left"
  const sidebarDirection = isLeftSidebar ? -10 : 10
  const sidebarWidthOpenTransition = { duration: SIDEBAR_OPEN_DURATION_S, ease: [0.22, 1, 0.36, 1] as const }
  const sidebarWidthCloseTransition = { duration: SIDEBAR_CLOSE_DURATION_S, ease: [0.23, 1, 0.32, 1] as const }
  const sidebarTransition = isResizing
    ? { duration: 0 }
    : isCollapsed
      ? sidebarWidthCloseTransition
      : sidebarWidthOpenTransition
  const sidebarContentTransition = isResizing
    ? { duration: 0 }
    : isCollapsed
      ? { duration: 0.18, ease: [0.4, 0, 1, 1] as const }
      : { duration: 0 }
  const sidebarBorderTransition = isResizing
    ? { duration: 0 }
    : isCollapsed
      ? {
          duration: 0.12,
          delay: Math.max(0, SIDEBAR_CLOSE_DURATION_S - 0.12),
          ease: [0.4, 0, 1, 1] as const,
        }
      : { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const }

  return (
    <motion.aside
      initial={false}
      animate={animateWidth ? { width: isCollapsed ? collapsedWidth : width } : undefined}
      transition={animateWidth ? sidebarTransition : undefined}
      data-resizing={isResizing ? "true" : "false"}
      style={animateWidth ? undefined : { width: "100%" }}
      className={cn(
        "relative flex h-full min-h-0 shrink-0 self-stretch flex-col overflow-hidden bg-sidebar text-sidebar-foreground will-change-transform",
        !isCollapsed && sizeConstraintClass,
        className,
      )}
    >
      <motion.div
        initial={false}
        animate={{
          opacity: isCollapsed ? 0 : 1,
          filter: isCollapsed ? "blur(2px)" : "blur(0px)",
          transform: isCollapsed ? `translateX(${sidebarDirection}px)` : "translateX(0px)",
        }}
        transition={sidebarContentTransition}
        style={{ width }}
        className="flex h-full min-h-0 flex-1 shrink-0 flex-col"
      >
        {content}
      </motion.div>
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{ opacity: isCollapsed ? 0 : 1 }}
        transition={sidebarBorderTransition}
        className={cn(
          "pointer-events-none absolute inset-y-0 w-px bg-sidebar-border/70",
          isLeftSidebar ? "right-0" : "left-0"
        )}
      />
      {!isCollapsed ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${side} sidebar`}
          onPointerDown={handleResizeStart}
          className={cn(
            "absolute inset-y-0 z-10 w-2 cursor-col-resize",
            side === "left" ? "right-0 translate-x-1/2" : "left-0 -translate-x-1/2",
          )}
        >
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent hover:bg-sidebar-border/90" />
        </div>
      ) : null}
    </motion.aside>
  )
}
