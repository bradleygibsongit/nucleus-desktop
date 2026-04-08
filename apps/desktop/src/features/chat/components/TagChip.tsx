import type { ReactElement, ReactNode } from "react"
import { X } from "@/components/icons"
import { cn } from "@/lib/utils"

type TagChipVariant = "neutral" | "skill"

interface TagChipProps {
  icon: ReactNode
  label: string
  onRemove?: () => void
  onClick?: () => void
  title?: string
  variant?: TagChipVariant
  backgroundClassName?: string
  borderClassName?: string
  textClassName?: string
  iconClassName?: string
}

const tagChipRootClassName =
  "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-px text-xs leading-4 font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"

const tagChipVariantClassName: Record<TagChipVariant, string> = {
  neutral: "border-border bg-muted/80 text-foreground",
  skill: "border-border bg-muted/80 text-skill-accent",
}

const tagChipIconVariantClassName: Record<TagChipVariant, string> = {
  neutral: "text-muted-foreground",
  skill: "text-skill-icon",
}

export function TagChip({
  icon,
  label,
  onRemove,
  onClick,
  title,
  variant = "neutral",
  backgroundClassName,
  borderClassName,
  textClassName,
  iconClassName,
}: TagChipProps): ReactElement {
  const isClickable = typeof onClick === "function"
  const Container = isClickable ? "button" : "span"

  return (
    <Container
      type={isClickable ? "button" : undefined}
      title={title}
      onClick={onClick}
      className={cn(
        tagChipRootClassName,
        tagChipVariantClassName[variant],
        backgroundClassName,
        borderClassName,
        textClassName,
        isClickable && "transition-colors hover:bg-muted focus:outline-none"
      )}
    >
      <span
        className={cn(
          "flex size-3 shrink-0 items-center justify-center",
          tagChipIconVariantClassName[variant],
          iconClassName
        )}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {onRemove ? (
        <button
          type="button"
          className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
          onMouseDown={(event) => {
            event.preventDefault()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onRemove()
          }}
          aria-label={`Remove ${label}`}
        >
          <X className="size-2.5" />
        </button>
      ) : null}
    </Container>
  )
}
