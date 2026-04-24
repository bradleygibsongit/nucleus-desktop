import { memo } from "react"
import { CheckCircle, CaretDown, FileLock, PencilSimple, ShieldWarning } from "@/components/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/features/shared/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/features/shared/components/ui/tooltip"
import type { RuntimeModeKind } from "../types"

const runtimeModeOptions: Array<{
  id: RuntimeModeKind
  label: string
  description: string
  Icon: typeof FileLock
}> = [
  {
    id: "approval-required",
    label: "Supervised",
    description: "Ask before commands and file changes.",
    Icon: FileLock,
  },
  {
    id: "auto-accept-edits",
    label: "Auto-accept edits",
    description: "Auto-approve edits, ask before other actions.",
    Icon: PencilSimple,
  },
  {
    id: "full-access",
    label: "Full access",
    description: "Allow commands and edits without prompts.",
    Icon: ShieldWarning,
  },
]

function getRuntimeModeOption(runtimeMode: RuntimeModeKind) {
  return (
    runtimeModeOptions.find((option) => option.id === runtimeMode) ??
    runtimeModeOptions[runtimeModeOptions.length - 1]
  )
}

export const RuntimeModePicker = memo(function RuntimeModePicker({
  runtimeMode,
  onSelectRuntimeMode,
}: {
  runtimeMode: RuntimeModeKind
  onSelectRuntimeMode: (runtimeMode: RuntimeModeKind) => void
}) {
  const selectedRuntimeModeOption = getRuntimeModeOption(runtimeMode)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-[var(--sidebar-item-hover)] hover:text-foreground cursor-pointer"
        aria-label={selectedRuntimeModeOption.label}
      >
        <selectedRuntimeModeOption.Icon className="size-3.5 shrink-0" />
        <span>{selectedRuntimeModeOption.label}</span>
        <CaretDown className="size-2.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {runtimeModeOptions.map((option) => (
          <Tooltip key={option.id}>
            <TooltipTrigger asChild>
              <DropdownMenuItem
                onClick={() => onSelectRuntimeMode(option.id)}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <option.Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{option.label}</span>
                </span>
                {option.id === runtimeMode ? (
                  <CheckCircle className="size-3.5 shrink-0 text-muted-foreground" />
                ) : null}
              </DropdownMenuItem>
            </TooltipTrigger>
            <TooltipContent side="right" align="center" className="max-w-64 text-xs leading-5">
              {option.description}
            </TooltipContent>
          </Tooltip>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
