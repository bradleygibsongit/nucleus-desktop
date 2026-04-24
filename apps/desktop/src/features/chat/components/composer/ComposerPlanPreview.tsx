import { memo } from "react"
import { Brain, CheckCircle, Circle } from "@/components/icons"
import { cn } from "@/lib/utils"
import type { ComposerPlan } from "./types"

interface ComposerPlanPreviewProps {
  isPlanModeEnabled: boolean
  plan: ComposerPlan
}

export const ComposerPlanPreview = memo(function ComposerPlanPreview({
  isPlanModeEnabled,
  plan,
}: ComposerPlanPreviewProps) {
  return (
    <div
      className={cn(
        "relative border-b",
        isPlanModeEnabled ? "border-[var(--color-chat-plan-border)]" : "border-border"
      )}
    >
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
            <Brain className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{plan.title}</p>
                {plan.summary ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{plan.summary}</p>
                ) : null}
              </div>
              <span className="rounded-full border border-border bg-muted px-2 py-1 text-sm text-muted-foreground">
                {plan.steps.length} steps
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {plan.steps.map((step, index) => {
                const StepIcon = step.status === "completed" ? CheckCircle : Circle

                return (
                  <div key={step.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <StepIcon
                      className={
                        step.status === "completed"
                          ? "size-3.5 text-foreground"
                          : "size-3.5 text-muted-foreground/60"
                      }
                    />
                    <span className="text-sm text-muted-foreground/70">{index + 1}.</span>
                    <span className={step.status === "completed" ? "text-foreground" : ""}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
