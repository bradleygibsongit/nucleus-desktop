import { useEffect, useState } from "react"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/features/shared/components/ui/dialog"
import { Button } from "@/features/shared/components/ui/button"
import { Input } from "@/features/shared/components/ui/input"
import { Label } from "@/features/shared/components/ui/label"
import type { Project } from "@/features/workspace/types"
import { useProjectStore } from "@/features/workspace/store"

interface ProjectSettingsModalProps {
  open: boolean
  project: Project | null
  onOpenChange: (open: boolean) => void
}

export function ProjectSettingsModal({
  open,
  project,
  onOpenChange,
}: ProjectSettingsModalProps) {
  const { updateProject } = useProjectStore()
  const [name, setName] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open || !project) {
      return
    }

    setName(project.name)
  }, [open, project])

  const isValid = name.trim().length > 0

  const handleSave = async () => {
    if (!project || !isValid) {
      return
    }

    setIsSaving(true)

    try {
      await updateProject(project.id, {
        name,
      })
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>
            Update the name for {project?.name ?? "this project"}.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="min-w-0 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="project-name" className="sr-only">
                Project name
              </Label>
              <Input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Project name"
                autoFocus
                className="h-auto border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="break-all text-sm text-muted-foreground">
              {project?.path ?? "No folder selected"}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={!isValid || isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
