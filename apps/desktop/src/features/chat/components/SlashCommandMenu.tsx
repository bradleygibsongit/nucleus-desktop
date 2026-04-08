import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { BookOpen, InformationCircle, PencilSimple } from "@/components/icons"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/features/shared/components/ui/tooltip"
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
  query,
  isLoading,
  onSelect,
  onClose,
  selectedIndex,
  className,
}: SlashCommandMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLDivElement>(null)
  const sections = [
    {
      key: "system",
      label: "System",
      commands: commands.filter((command) => command.section === "system"),
    },
    {
      key: "skills",
      label: "Skills",
      commands: commands.filter((command) => command.section === "skills"),
    },
  ].filter((section) => section.commands.length > 0)

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

  if (isLoading && commands.length === 0) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm",
          className
        )}
      >
        <div className="px-3 py-2.5 text-center text-xs text-muted-foreground">
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
          "w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm",
          className
        )}
      >
        <div className="px-3 py-2.5 text-center text-xs text-muted-foreground">
          No commands found
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm",
        className
      )}
    >
      <div className="app-scrollbar max-h-64 overflow-y-auto p-1">
        {sections.map((section, sectionIndex) => {
          let runningIndex = 0
          for (let i = 0; i < sectionIndex; i += 1) {
            runningIndex += sections[i]?.commands.length ?? 0
          }

          return (
            <div key={section.key} className={cn(sectionIndex > 0 && "mt-1.5")}>
              <div className="px-2 pt-1.5 pb-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/70">
                {section.label}
                {sectionIndex === 0 && query ? (
                  <span className="ml-1.5 normal-case tracking-normal">
                    — <span className="font-mono text-foreground/70">/{query}</span>
                  </span>
                ) : null}
              </div>

              {section.commands.map((cmd, index) => {
                const flatIndex = runningIndex + index
                const isSelected = selectedIndex === flatIndex
                const Icon = cmd.icon === "new-chat" ? PencilSimple : BookOpen

                return (
                  <div
                    key={cmd.id}
                    ref={isSelected ? selectedRef : undefined}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onSelect(cmd)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                      isSelected
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <Icon size={14} className="shrink-0 text-muted-foreground" />

                    <span className="min-w-0 truncate font-medium text-foreground">
                      {cmd.name}
                    </span>

                    {cmd.description ? (
                      <InfoTooltip description={cmd.description} />
                    ) : null}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InfoTooltip({ description }: { description: string }) {
  const [open, setOpen] = useState(false)

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((prev) => !prev)
          }}
          tabIndex={-1}
        >
          <InformationCircle size={14} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        className="max-w-64 text-xs"
      >
        {description}
      </TooltipContent>
    </Tooltip>
  )
}
