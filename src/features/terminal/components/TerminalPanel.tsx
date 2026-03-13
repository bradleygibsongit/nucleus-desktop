import { CaretUp } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Terminal } from "./Terminal"

interface TerminalPanelProps {
  isOpen: boolean
  onToggle: () => void
  className?: string
}

export function TerminalPanel({ isOpen, onToggle, className }: TerminalPanelProps) {
  return (
    <div className={cn("border-t border-border flex flex-col", isOpen ? "h-1/2" : "", className)}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2 px-4 h-10 hover:bg-muted/50 shrink-0",
          isOpen && "border-b border-border"
        )}
      >
        <CaretUp
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
        <span className="text-sm">Terminal</span>
      </button>
      {isOpen && <Terminal className="flex-1" />}
    </div>
  )
}
