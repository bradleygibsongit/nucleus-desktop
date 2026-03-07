import { Eye, GitPullRequest } from "@/components/icons"
import { Button } from "@/features/shared/components/ui/button"
import { ButtonGroup } from "@/features/shared/components/ui/button-group"
import { useRightSidebar } from "./useRightSidebar"

interface AppHeaderProps {
  onReview?: () => void
  onCreatePR?: () => void
}

export function AppHeader({ onReview, onCreatePR }: AppHeaderProps) {
  const { isCollapsed: isRightCollapsed } = useRightSidebar()

  if (isRightCollapsed) {
    return null
  }

  return (
    <header className="h-12 flex shrink-0 select-none">
      {/* Right sidebar header portion */}
      <div className="w-[400px] max-w-[400px] min-w-48 shrink bg-sidebar border-l border-b border-sidebar-border flex items-center justify-between px-4 ml-auto">
        <span className="text-sm text-sidebar-foreground">Version control</span>
        <ButtonGroup>
          <Button variant="outline" size="sm" onClick={onReview}>
            <Eye size={14} />
            Review
          </Button>
          <Button variant="outline" size="sm" onClick={onCreatePR}>
            <GitPullRequest size={14} />
            Create PR
          </Button>
        </ButtonGroup>
      </div>
    </header>
  )
}
