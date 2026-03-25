export type FileStatus = "modified" | "added" | "deleted" | "untracked" | "renamed" | "copied" | "ignored"

export interface FileChange {
  path: string
  status: FileStatus
  additions?: number
  deletions?: number
}

export interface FileTreeItem {
  name: string
  isDirectory?: boolean
  children?: string[]
}
