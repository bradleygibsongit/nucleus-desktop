import type { ReactElement, ReactNode } from "react"
import { File, FileImage, FileText } from "@/components/icons"
import type { RuntimeAttachmentKind } from "../types"
import { TagChip } from "./TagChip"

interface UploadChipProps {
  kind: RuntimeAttachmentKind
  label: string
  onRemove?: () => void
  onClick?: () => void
  title?: string
  leadingVisual?: ReactNode
}

export function UploadChip({
  kind,
  label,
  onRemove,
  onClick,
  title,
  leadingVisual,
}: UploadChipProps): ReactElement {
  const Icon = kind === "image" ? FileImage : kind === "pasted_text" ? FileText : File

  return (
    <TagChip
      icon={leadingVisual ?? <Icon className="size-3" />}
      label={label}
      title={title}
      onClick={onClick}
      onRemove={onRemove}
      variant="neutral"
    />
  )
}
