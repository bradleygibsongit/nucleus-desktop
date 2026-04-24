import { memo, type ComponentProps } from "react"
import {
  ArrowUp02,
  CaretDown,
  CheckCircle,
  DocumentValidation,
  Paperclip,
  Plus,
  Stop,
  Zap,
} from "@/components/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/features/shared/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/features/shared/components/ui/tooltip"
import type { RuntimeReasoningEffort } from "../types"
import { ModelPicker } from "./ModelPicker"
import { cn } from "@/lib/utils"

type ModelPickerProps = ComponentProps<typeof ModelPicker>

function formatReasoningEffortLabel(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export const ComposerToolbar = memo(function ComposerToolbar({
  availableReasoningEfforts,
  canSubmit,
  fastMode,
  fastModeTooltipLabel,
  isLoadingModels,
  isPlanModeAvailable,
  isPlanModeEnabled,
  modelPickerProps,
  onAbort,
  onAttachFiles,
  onSelectReasoningEffort,
  onToggleFastMode,
  onTogglePlanMode,
  planModeShortcutLabel,
  reasoningEffort,
  shouldShowReasoningEffortSelector,
  shouldShowSendAction,
  showAtMenu,
  showControls,
  showSlashMenu,
  supportsFastMode,
}: {
  availableReasoningEfforts: RuntimeReasoningEffort[]
  canSubmit: boolean
  fastMode: boolean
  fastModeTooltipLabel: string
  isLoadingModels: boolean
  isPlanModeAvailable: boolean
  isPlanModeEnabled: boolean
  modelPickerProps: ModelPickerProps
  onAbort?: () => void
  onAttachFiles: () => void
  onSelectReasoningEffort: (effort: RuntimeReasoningEffort) => void
  onToggleFastMode: () => void
  onTogglePlanMode: () => void
  planModeShortcutLabel: string
  reasoningEffort: RuntimeReasoningEffort | null
  shouldShowReasoningEffortSelector: boolean
  shouldShowSendAction: boolean
  showAtMenu: boolean
  showControls: boolean
  showSlashMenu: boolean
  supportsFastMode: boolean
}) {
  if (!showControls) {
    return null
  }

  const reasoningEffortLabel = reasoningEffort
    ? formatReasoningEffortLabel(reasoningEffort)
    : isLoadingModels
      ? "Loading effort..."
      : "Default"

  return (
    <div className="mt-1.5 flex items-center gap-2">
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger
                aria-label="Open composer actions"
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors cursor-pointer",
                  "hover:text-foreground",
                  (fastMode || isPlanModeEnabled) && "text-foreground"
                )}
              >
                <Plus className="size-4" />
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Composer actions</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Composer</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={onAttachFiles}
                className="flex items-center gap-2"
              >
                <Paperclip className="size-4" />
                <span className="flex-1">Attach files</span>
              </DropdownMenuItem>
              {supportsFastMode || isPlanModeAvailable ? <DropdownMenuSeparator /> : null}
              {supportsFastMode ? (
                <DropdownMenuItem
                  onClick={onToggleFastMode}
                  className="flex items-center gap-2"
                >
                  <Zap weight="fill" className="size-3.5 text-[color:var(--color-warning)]" />
                  <span className="flex-1">Fast mode</span>
                  {fastMode ? <CheckCircle className="size-3.5 text-muted-foreground" /> : null}
                </DropdownMenuItem>
              ) : null}
              {supportsFastMode && isPlanModeAvailable ? <DropdownMenuSeparator /> : null}
              {isPlanModeAvailable ? (
                <DropdownMenuItem
                  onClick={onTogglePlanMode}
                  className="flex items-center gap-2"
                >
                  <DocumentValidation className="size-4 text-[var(--color-chat-plan-accent)]" />
                  <span className="flex-1">Plan mode</span>
                  <DropdownMenuShortcut>{planModeShortcutLabel}</DropdownMenuShortcut>
                  {isPlanModeEnabled ? <CheckCircle className="size-3.5 text-muted-foreground" /> : null}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
            {supportsFastMode ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="whitespace-normal text-xs leading-5 text-muted-foreground">
                  <span>{fastModeTooltipLabel}</span>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <ModelPicker {...modelPickerProps} />

        {shouldShowReasoningEffortSelector ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-7 items-center gap-2 px-1 text-sm text-muted-foreground transition-colors hover:text-foreground cursor-pointer">
              <span>{reasoningEffortLabel}</span>
              <CaretDown className="size-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {availableReasoningEfforts.length > 0 ? (
                availableReasoningEfforts.map((effort) => (
                  <DropdownMenuItem
                    key={effort}
                    onClick={() => onSelectReasoningEffort(effort)}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>{formatReasoningEffortLabel(effort)}</span>
                    {effort === reasoningEffort ? (
                      <CheckCircle className="size-3.5 text-muted-foreground" />
                    ) : null}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>
                  <span>{isLoadingModels ? "Loading effort..." : "No effort options"}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {shouldShowSendAction ? (
            <button
              type="submit"
              disabled={!canSubmit && !showSlashMenu && !showAtMenu}
              className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            >
              <ArrowUp02 weight="bold" className="size-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onAbort}
              disabled={!onAbort}
              className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            >
              <Stop weight="fill" className="size-3.5" />
            </button>
          )}
        </div>
      </div>
  )
})
