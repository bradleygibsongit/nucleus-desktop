import { cn } from "@/lib/utils"

interface RightSidebarEmptyStateProps {
  title: string
  description: string
  className?: string
}

export function RightSidebarEmptyState({
  title,
  description,
  className,
}: RightSidebarEmptyStateProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 items-center justify-center px-4 py-8", className)}>
      <div className="flex max-w-64 flex-col items-center gap-1 text-center">
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <p className="text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}
