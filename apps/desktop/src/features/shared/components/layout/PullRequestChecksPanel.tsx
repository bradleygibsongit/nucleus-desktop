import { CaretRight, CheckCircle, CircleNotch, Clock, InformationCircle, X } from "@/components/icons"
import type { GitPullRequest as DesktopGitPullRequest, GitPullRequestCheck } from "@/desktop/client"
import { MessageResponse } from "@/features/chat/components/ai-elements/message"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/features/shared/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { sortPullRequestChecks } from "./pullRequestChecks"

interface PullRequestChecksPanelProps {
  pullRequest: DesktopGitPullRequest | null
  checks: GitPullRequestCheck[]
  isLoading: boolean
  loadError: string | null
}

function getCheckTone(status: GitPullRequestCheck["status"]): string {
  switch (status) {
    case "pending":
      return "text-amber-600"
    case "failed":
      return "text-destructive"
    case "passed":
      return "text-emerald-600"
    case "cancelled":
      return "text-muted-foreground"
    case "skipped":
      return "text-muted-foreground"
    default:
      return "text-muted-foreground"
  }
}

function getCheckStatusLabel(status: GitPullRequestCheck["status"]): string {
  switch (status) {
    case "pending":
      return "Pending"
    case "failed":
      return "Failed"
    case "passed":
      return "Passed"
    case "cancelled":
      return "Cancelled"
    case "skipped":
      return "Skipped"
    default:
      return "Unknown"
  }
}

function CheckStatusIcon({ status }: { status: GitPullRequestCheck["status"] }) {
  const className = cn("size-4 shrink-0", getCheckTone(status))

  switch (status) {
    case "pending":
      return <CircleNotch size={15} className={cn(className, "animate-spin")} />
    case "failed":
      return <X size={15} className={className} />
    case "passed":
      return <CheckCircle size={15} className={className} />
    case "cancelled":
      return <Clock size={15} className={className} />
    case "skipped":
      return <InformationCircle size={15} className={className} />
    default:
      return <InformationCircle size={15} className={className} />
  }
}

export function PullRequestChecksPanel({
  pullRequest,
  checks,
  isLoading,
  loadError,
}: PullRequestChecksPanelProps) {
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false)

  if (!pullRequest || pullRequest.state !== "open") {
    return (
      <div className="px-3 py-3 text-sm text-muted-foreground">
        Open a pull request on this branch to view checks.
      </div>
    )
  }

  const sortedChecks = sortPullRequestChecks(checks)

  return (
    <div className="space-y-4 px-3 py-3">
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">{pullRequest.title}</h2>
        {pullRequest.description ? (
          <Collapsible open={isDescriptionOpen} onOpenChange={setIsDescriptionOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
              <CaretRight
                size={12}
                className={cn("shrink-0 transition-transform", isDescriptionOpen && "rotate-90")}
              />
              <span>Description</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-1">
              <div className="text-xs text-muted-foreground">
                <MessageResponse
                  className={cn(
                    "leading-5 [&>*]:text-inherit",
                    "[&_h1]:!text-sm [&_h1]:font-semibold [&_h1]:!leading-5 [&_h1]:mt-0 [&_h1]:mb-1.5",
                    "[&_h2]:!text-sm [&_h2]:font-semibold [&_h2]:!leading-5 [&_h2]:mt-0 [&_h2]:mb-1.5",
                    "[&_h3]:!text-xs [&_h3]:font-semibold [&_h3]:!leading-5 [&_h3]:mt-0 [&_h3]:mb-1",
                    "[&_h4]:!text-xs [&_h4]:font-medium [&_h4]:!leading-5 [&_h4]:mt-0 [&_h4]:mb-1",
                    "[&_h5]:!text-xs [&_h5]:font-medium [&_h5]:!leading-5 [&_h5]:mt-0 [&_h5]:mb-1",
                    "[&_h6]:!text-xs [&_h6]:font-medium [&_h6]:!leading-5 [&_h6]:mt-0 [&_h6]:mb-1",
                    "[&_p]:text-xs [&_p]:leading-5 [&_p]:my-0 [&_p+p]:mt-1.5",
                    "[&_ul]:my-1 [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:pl-4",
                    "[&_li]:text-xs [&_li]:leading-5 [&_li+li]:mt-0.5",
                    "[&_blockquote]:my-1.5 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3",
                    "[&_pre]:my-1.5 [&_pre]:text-[11px] [&_pre]:leading-4",
                    "[&_code]:text-[11px]"
                  )}
                >
                  {pullRequest.description}
                </MessageResponse>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>

      {loadError ? (
        <div className="text-sm text-destructive">{loadError}</div>
      ) : null}

      {isLoading && sortedChecks.length === 0 ? (
        <div className="text-sm text-muted-foreground">Waiting for checks to report back...</div>
      ) : null}

      {!isLoading && sortedChecks.length === 0 && !loadError ? (
        <div className="text-sm text-muted-foreground">No checks reported yet.</div>
      ) : null}

      {sortedChecks.length > 0 ? (
        <div className="space-y-2">
          {sortedChecks.map((check) => (
            <div key={check.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <CheckStatusIcon status={check.status} />
                <span className="truncate text-foreground">{check.name}</span>
              </div>
              <span className={cn("shrink-0", getCheckTone(check.status))}>
                {getCheckStatusLabel(check.status)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
