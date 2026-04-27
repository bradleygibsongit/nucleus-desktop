import type { Icon } from "@/components/icons"
import { cn } from "@/lib/utils"

interface RightSidebarEmptyStateProps {
  title: string
  description: string
  icon?: Icon
  className?: string
}

export function RightSidebarEmptyState({
  title,
  description,
  icon: Icon,
  className,
}: RightSidebarEmptyStateProps) {
  return (
    <div className={cn("flex h-full min-h-[240px] flex-1 items-center justify-center px-4 py-8", className)}>
      <div className="flex max-w-64 flex-col items-center gap-2 text-center">
        {Icon ? <Icon size={22} className="text-muted-foreground/72" /> : null}
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <p className="text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}
