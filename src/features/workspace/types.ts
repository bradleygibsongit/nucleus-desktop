export interface Workspace {
  id: string
  branchName: string
  name: string
  lastActive: Date
  diffCount?: number
  isLoading?: boolean
  needsAttention?: boolean
}

export interface Repository {
  id: string
  name: string
  path: string
  collapsed: boolean
  workspaces: Workspace[]
}

export interface Project {
  id: string
  name: string       // Folder name (derived from path)
  path: string       // Full filesystem path
  addedAt: number    // Timestamp when added (for ordering)
}
