import { useEffect, useState } from "react"
import { InformationCircle, Trash } from "@/components/icons"
import { desktop } from "@/desktop/client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/features/shared/components/ui/alert-dialog"
import { useChatStore } from "@/features/chat/store"
import { useTabStore } from "@/features/editor/store"
import { Switch } from "@/features/shared/components/ui/switch"
import { useProjectGitChanges } from "@/features/shared/hooks/useProjectGitChanges"
import { getTerminalSessionId, isTerminalTab } from "@/features/terminal/utils/terminalTabs"
import { useProjectStore } from "@/features/workspace/store"
import type { Project, ProjectWorktree } from "@/features/workspace/types"

interface RemoveWorktreeModalProps {
  open: boolean
  project: Project | null
  worktree: ProjectWorktree | null
  onOpenChange: (open: boolean) => void
}

export function RemoveWorktreeModal({
  open,
  project,
  worktree,
  onOpenChange,
}: RemoveWorktreeModalProps) {
  const removeWorktree = useProjectStore((state) => state.removeWorktree)
  const removeWorktreeData = useChatStore((state) => state.removeWorktreeData)
  const removeWorktreeTabs = useTabStore((state) => state.removeWorktreeTabs)
  const tabsByWorktree = useTabStore((state) => state.tabsByWorktree)
  const [isRemoving, setIsRemoving] = useState(false)
  const [deleteFromSystem, setDeleteFromSystem] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { changes, isLoading } = useProjectGitChanges(open ? (worktree?.path ?? null) : null)
  const hasUncommittedChanges = changes.length > 0
  const canDeleteFromSystem = worktree?.source === "managed"
  const deleteIsBlocked = deleteFromSystem && (isLoading || hasUncommittedChanges)
  const actionLabel = deleteFromSystem ? "Remove and delete" : "Remove from app"

  useEffect(() => {
    if (!open) {
      setDeleteFromSystem(false)
      setErrorMessage(null)
    }
  }, [open])

  useEffect(() => {
    if (!canDeleteFromSystem) {
      setDeleteFromSystem(false)
    }
  }, [canDeleteFromSystem, worktree?.id])

  const handleRemove = async () => {
    if (!project || !worktree) {
      return
    }

    setIsRemoving(true)
    setErrorMessage(null)

    try {
      await removeWorktree(project.id, worktree.id, {
        deleteFromDisk: deleteFromSystem,
      })

      const terminalTabs = (tabsByWorktree[worktree.id]?.tabs ?? []).filter(isTerminalTab)
      await Promise.allSettled(
        terminalTabs.map((tab) => desktop.terminal.closeSession(getTerminalSessionId(tab.id)))
      )
      removeWorktreeTabs(worktree.id)

      try {
        await removeWorktreeData(worktree.id)
      } catch (cleanupError) {
        console.warn("Failed to clean up removed worktree chat state:", cleanupError)
      }

      onOpenChange(false)
    } catch (error) {
      console.error("Failed to remove worktree:", error)
      setErrorMessage(error instanceof Error ? error.message : "Couldn't remove this workspace.")
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash />
          </AlertDialogMedia>
          <AlertDialogTitle>Remove workspace?</AlertDialogTitle>
          <AlertDialogDescription>
            {worktree?.name ?? "This workspace"} will be removed from Nucleus.
            {errorMessage ? ` ${errorMessage}` : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Also delete from system</p>
              {!canDeleteFromSystem ? (
                <p className="text-xs text-muted-foreground">Not available for the root workspace</p>
              ) : null}
            </div>
            <Switch
              checked={deleteFromSystem}
              disabled={!canDeleteFromSystem || isRemoving}
              size="sm"
              aria-label="Also delete workspace from system"
              onCheckedChange={setDeleteFromSystem}
              className="mt-0.5 shrink-0 disabled:opacity-100"
            />
          </div>

          {hasUncommittedChanges ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-left">
              <InformationCircle className="mt-0.5 size-4 shrink-0 text-amber-700" />
              <p className="text-xs leading-5 text-amber-900 dark:text-amber-200">
                {deleteIsBlocked
                  ? "Can't delete from system while this workspace has uncommitted changes."
                  : "This workspace has uncommitted changes."}
              </p>
            </div>
          ) : null}

          {deleteFromSystem && isLoading ? (
            <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5 text-left">
              <InformationCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-5 text-muted-foreground">
                Checking for uncommitted changes before deleting this workspace from disk.
              </p>
            </div>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            onClick={() => void handleRemove()}
            disabled={!project || !worktree || isRemoving || deleteIsBlocked}
          >
            {isRemoving ? "Removing..." : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
