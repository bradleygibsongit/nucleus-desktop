import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import type { NormalizedCommand } from "../hooks/useCommands"

export interface SlashCommandMenuProps {
  commands: NormalizedCommand[]
  query: string
  isLoading: boolean
  onSelect: (command: NormalizedCommand) => void
  onClose: () => void
  selectedIndex: number
  className?: string
}

export function SlashCommandMenu({
  commands,
  query: _query,
  isLoading,
  onSelect,
  onClose,
  selectedIndex,
  className,
}: SlashCommandMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLDivElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "nearest" })
    }
  }, [selectedIndex])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose])

  if (isLoading) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "absolute bottom-full left-0 right-0 mb-2 rounded-[6px] border border-border bg-card shadow-lg",
          className
        )}
      >
        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
          Loading commands...
        </div>
      </div>
    )
  }

  if (commands.length === 0) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "absolute bottom-full left-0 right-0 mb-2 rounded-[6px] border border-border bg-card shadow-lg",
          className
        )}
      >
        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
          No commands found
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute bottom-full left-0 right-0 mb-2 rounded-[6px] border border-border bg-card shadow-lg overflow-hidden",
        className
      )}
    >
      <div className="max-h-64 overflow-y-auto p-2">
        {commands.map((cmd, index) => {
          const isSelected = selectedIndex === index
          return (
            <div
              key={cmd.name}
              ref={isSelected ? selectedRef : undefined}
              onClick={() => onSelect(cmd)}
              className={cn(
                "flex items-center gap-2 cursor-pointer rounded-[6px] px-2 py-2 text-sm mb-1 last:mb-0",
                isSelected
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
            >
              <span className="font-medium text-foreground">/{cmd.name}</span>
              {cmd.description && (
                <span className="text-muted-foreground truncate">
                  {cmd.description}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
