import { useState } from "react"
import { CaretDown, CloudUpload, GitCommit, GitPullRequest } from "@/components/icons"
import { Button, buttonVariants } from "@/features/shared/components/ui/button"
import { ButtonGroup, ButtonGroupSeparator } from "@/features/shared/components/ui/button-group"
import { CommitChangesDialog } from "./CommitChangesDialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/features/shared/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/features/shared/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function SourceControlActionGroup({
  className,
  projectPath = null,
}: {
  className?: string
  projectPath?: string | null
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false)
  const splitButtonClass = cn(
    "h-6 border-transparent bg-transparent text-sidebar-foreground shadow-none",
    "hover:bg-sidebar-accent/60 hover:text-foreground",
  )

  const handlePrimaryAction = () => {
    setIsCommitDialogOpen(true)
  }

  const handleMenuAction = (action: "push" | "create-pr") => {
    console.info("[AppHeader] Source control action selected:", action)
  }

  const menuActions = [
    {
      id: "push" as const,
      label: "Push",
      icon: CloudUpload,
      disabledReason: "There are no active changes to push yet.",
    },
    {
      id: "create-pr" as const,
      label: "Create PR",
      icon: GitPullRequest,
      disabledReason: "Create PR becomes available once you're working from a non-main branch.",
    },
  ]

  return (
    <>
      <ButtonGroup className={cn("shrink-0 rounded-lg border border-sidebar-border/90 bg-card", className)}>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrimaryAction}
          className={cn(
            splitButtonClass,
            "gap-1.5 px-1.5",
          )}
        >
          <GitCommit size={18} />
          Commit
        </Button>

        <ButtonGroupSeparator className="bg-sidebar-border/90" />

        <DropdownMenu onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              splitButtonClass,
              "min-w-0 rounded-l-none px-1.5",
              isMenuOpen && "bg-sidebar-accent/70 text-foreground",
            )}
            aria-label="More source control actions"
          >
            <CaretDown size={16} />
          </DropdownMenuTrigger>

          <TooltipProvider delay={150}>
            <DropdownMenuContent side="bottom" align="end" className="w-56">
              {menuActions.map(({ id, label, icon: Icon, disabledReason }) => {
                const isDisabled = Boolean(disabledReason)

                const item = (
                  <DropdownMenuItem
                    onClick={(event) => {
                      if (isDisabled) {
                        event.preventDefault()
                        return
                      }

                      handleMenuAction(id)
                    }}
                    className={cn(
                      isDisabled && [
                        "cursor-not-allowed text-muted-foreground/80",
                        "hover:bg-transparent hover:text-muted-foreground/80",
                        "focus:bg-transparent focus:text-muted-foreground/80",
                        "data-highlighted:bg-transparent data-highlighted:text-muted-foreground/80",
                      ],
                    )}
                    aria-disabled={isDisabled}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </DropdownMenuItem>
                )

                if (!isDisabled) {
                  return <div key={id}>{item}</div>
                }

                return (
                  <Tooltip key={id}>
                    <TooltipTrigger asChild>{item}</TooltipTrigger>
                    <TooltipContent side="left" align="center" className="max-w-56">
                      {disabledReason}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </DropdownMenuContent>
          </TooltipProvider>
        </DropdownMenu>
      </ButtonGroup>

      <CommitChangesDialog
        open={isCommitDialogOpen}
        onOpenChange={setIsCommitDialogOpen}
        projectPath={projectPath}
      />
    </>
  )
}
