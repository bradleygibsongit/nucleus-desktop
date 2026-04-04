import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/features/shared/components/ui/dialog"
import { ChatInput } from "@/features/chat/components"
import { ProjectIcon } from "@/features/workspace/components/ProjectIcon"
import type { Project } from "@/features/workspace/types"

interface NewWorkspaceModalProps {
  open: boolean
  project: Project | null
  onOpenChange: (open: boolean) => void
  onContinue: (input: { prompt: string }) => Promise<void> | void
}

export function NewWorkspaceModal({
  open,
  project,
  onOpenChange,
  onContinue,
}: NewWorkspaceModalProps) {
  const [prompt, setPrompt] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const canContinue = prompt.trim().length > 0 && !isSubmitting

  useEffect(() => {
    if (!open) {
      return
    }

    setPrompt("")
    setIsSubmitting(false)
  }, [open, project?.id])

  const handleContinue = async (nextPrompt = prompt) => {
    const trimmedPrompt = nextPrompt.trim()
    if (!trimmedPrompt || isSubmitting) {
      return
    }

    setIsSubmitting(true)

    try {
      await onContinue({
        prompt: trimmedPrompt,
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-lg sm:max-w-[760px]">
        <DialogHeader className="gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden">
              <ProjectIcon project={project} size={40} className="block h-10 w-10 rounded-lg" />
            </div>
            <DialogTitle className="text-lg font-medium">
              What should we work on?
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="min-w-0">
          <ChatInput
            placement="intro"
            allowSlashCommands={false}
            input={prompt}
            setInput={setPrompt}
            isLocked={isSubmitting}
            onSubmit={async (text) => {
              await handleContinue(text)
            }}
            status="idle"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
