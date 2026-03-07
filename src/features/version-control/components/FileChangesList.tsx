import { cn } from "@/lib/utils"
import type { FileChange, FileStatus } from "../types"

interface FileChangesListProps {
  changes: FileChange[]
  onFileClick?: (file: FileChange) => void
}

const statusColors: Record<FileStatus, string> = {
  modified: "text-amber-500",
  added: "text-green-500",
  deleted: "text-red-500",
  untracked: "text-green-500",
  renamed: "text-purple-500",
  copied: "text-green-500",
  ignored: "text-zinc-500",
}

const statusIndicators: Record<FileStatus, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  untracked: "U",
  renamed: "R",
  copied: "C",
  ignored: "!",
}

export function FileChangesList({ changes, onFileClick }: FileChangesListProps) {
  return (
    <div className="flex flex-col">
      {changes.map((file) => (
        <button
          key={file.path}
          type="button"
          onClick={() => onFileClick?.(file)}
          className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm hover:bg-muted/50 rounded-sm text-left"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className={cn("shrink-0 w-4 text-center font-medium", statusColors[file.status])}>
              {statusIndicators[file.status]}
            </span>
            <span className="truncate text-muted-foreground">{file.path}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {file.additions !== undefined && file.additions > 0 && (
              <span className="text-green-500 font-medium">+{file.additions}</span>
            )}
            {file.deletions !== undefined && file.deletions > 0 && (
              <span className="text-red-500 font-medium">-{file.deletions}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
