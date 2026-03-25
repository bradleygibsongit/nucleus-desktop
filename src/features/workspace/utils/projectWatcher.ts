import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"

export const PROJECT_FS_EVENT = "project-fs:event"

export interface ProjectFileSystemEvent {
  rootPath: string
  kind: "add" | "modify" | "unlink" | "rename" | "rescan"
  path: string
  oldPath?: string | null
  isDirectory: boolean
  requiresRescan: boolean
}

export async function startProjectFileWatcher(projectPath: string): Promise<void> {
  await invoke("start_project_file_watcher", { projectPath })
}

export async function stopProjectFileWatcher(): Promise<void> {
  await invoke("stop_project_file_watcher")
}

export function listenToProjectFileEvents(
  listener: (event: ProjectFileSystemEvent) => void
): Promise<UnlistenFn> {
  return listen<ProjectFileSystemEvent>(PROJECT_FS_EVENT, (event) => {
    listener(event.payload)
  })
}
