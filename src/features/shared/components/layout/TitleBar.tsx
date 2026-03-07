import { Sidebar } from "@/components/icons"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { useSidebar } from "./useSidebar"
import { useRightSidebar } from "./useRightSidebar"
import { cn } from "@/lib/utils"

interface TitleBarProps {
  activeView?: "chat" | "settings"
}

export function TitleBar({ activeView = "chat" }: TitleBarProps) {
  const { toggle: toggleLeft } = useSidebar()
  const { toggle: toggleRight } = useRightSidebar()

  const handleMouseDown = async (_e: React.MouseEvent) => {
    await getCurrentWindow().startDragging()
  }

  const handleDoubleClick = async (_e: React.MouseEvent) => {
    await getCurrentWindow().toggleMaximize()
  }

  return (
    <header
      data-tauri-drag-region
      className={cn(
        "h-10 flex items-center shrink-0 select-none bg-sidebar",
        activeView === "chat" && "border-b border-sidebar-border",
      )}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* Left - Space for macOS traffic lights */}
      <div className="w-20 shrink-0 pointer-events-none" data-tauri-drag-region />

      {/* Center - App title */}
      <div className="flex-1 flex items-center justify-center pointer-events-none" data-tauri-drag-region>
        <span className="text-sm font-medium text-foreground">Nucleus</span>
      </div>

      {/* Right - Sidebar toggle buttons */}
      <div className="w-20 shrink-0 flex items-center justify-end gap-1 pr-2">
        <button
          type="button"
          onClick={toggleLeft}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          aria-label="Toggle left sidebar"
        >
          <Sidebar size={14} />
        </button>
        <button
          type="button"
          onClick={toggleRight}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          aria-label="Toggle right sidebar"
        >
          <Sidebar size={14} className="scale-x-[-1]" />
        </button>
      </div>
    </header>
  )
}
