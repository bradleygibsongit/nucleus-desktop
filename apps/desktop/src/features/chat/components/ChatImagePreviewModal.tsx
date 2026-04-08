import { useEffect, useState } from "react"
import { desktop } from "@/desktop/client"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/features/shared/components/ui/dialog"

export interface ChatImagePreview {
  absolutePath: string
  label: string
  mediaType?: string
}

interface ChatImagePreviewModalProps {
  image: ChatImagePreview | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChatImagePreviewModal({
  image,
  open,
  onOpenChange,
}: ChatImagePreviewModalProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !image) {
      setSrc(null)
      setError(null)
      return
    }

    let isActive = true
    setSrc(null)
    setError(null)

    void desktop.fs
      .readFileAsDataUrl(image.absolutePath, {
        mimeType: image.mediaType,
      })
      .then((nextSrc) => {
        if (isActive) {
          setSrc(nextSrc)
        }
      })
      .catch((nextError) => {
        if (!isActive) {
          return
        }

        const message =
          nextError instanceof Error && nextError.message.trim().length > 0
            ? nextError.message
            : "Failed to load the selected image."
        setError(message)
      })

    return () => {
      isActive = false
    }
  }, [image, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(94vw,980px)] max-w-[980px] gap-0 overflow-hidden p-0 sm:max-w-[980px]"
      >
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="truncate text-sm font-medium">
            {image?.label ?? "Image preview"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex min-h-[320px] items-center justify-center bg-muted/35 p-5">
          {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-600 dark:text-red-300">
              {error}
            </div>
          ) : src ? (
            <img
              alt={image?.label ?? "Image preview"}
              src={src}
              className="max-h-[78vh] w-auto max-w-full rounded-xl border border-border bg-background object-contain shadow-sm"
            />
          ) : (
            <div className="text-sm text-muted-foreground">Loading image…</div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
