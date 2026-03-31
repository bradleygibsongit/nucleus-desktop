import type { TerminalCreateSessionEnvironment } from "@/desktop/client"
import type { Project, ProjectWorktree } from "@/features/workspace/types"
import { getSelectedWorktree } from "./worktrees"

export const SETUP_SCRIPT_VARIABLES = [
  {
    key: "NUCLEUS_PROJECT_ROOT",
    description: "Repository root for the project.",
  },
  {
    key: "NUCLEUS_WORKSPACE_PATH",
    description: "Path to the new workspace being created.",
  },
  {
    key: "NUCLEUS_WORKSPACE_NAME",
    description: "Display name of the new workspace.",
  },
  {
    key: "NUCLEUS_SOURCE_WORKSPACE_PATH",
    description: "Path of the currently selected source workspace for this project.",
  },
  {
    key: "NUCLEUS_SOURCE_WORKSPACE_NAME",
    description: "Display name of the source workspace.",
  },
] as const

export const LEGACY_COPY_ALL_ENV_FILES_SETUP_SNIPPET =
  'find "$NUCLEUS_SOURCE_WORKSPACE_PATH" -maxdepth 1 -type f -name \'.env*\' -exec cp -n {} "$NUCLEUS_WORKSPACE_PATH"/ \\;'

export const COPY_ALL_ENV_FILES_SETUP_SNIPPET = `found_env_file=0
for source_file in "$NUCLEUS_SOURCE_WORKSPACE_PATH"/.env*; do
  [ -f "$source_file" ] || continue
  found_env_file=1
  target_file="$NUCLEUS_WORKSPACE_PATH/$(basename "$source_file")"
  if [ -e "$target_file" ]; then
    echo "Skipping $(basename "$source_file") (already exists)"
  else
    cp "$source_file" "$target_file"
    echo "Copied $(basename "$source_file")"
  fi
done

if [ "$found_env_file" -eq 0 ]; then
  echo "No .env* files found in $NUCLEUS_SOURCE_WORKSPACE_PATH"
fi`

export function buildWorkspaceSetupScriptEnvironment(
  project: Pick<Project, "name" | "repoRootPath" | "selectedWorktreeId" | "rootWorktreeId" | "worktrees">,
  workspace: Pick<ProjectWorktree, "name" | "path">,
): TerminalCreateSessionEnvironment {
  const sourceWorkspace = getSelectedWorktree(project)

  return {
    NUCLEUS_PROJECT_ROOT: project.repoRootPath,
    NUCLEUS_WORKSPACE_PATH: workspace.path,
    NUCLEUS_WORKSPACE_NAME: workspace.name,
    NUCLEUS_SOURCE_WORKSPACE_PATH: sourceWorkspace?.path ?? project.repoRootPath,
    NUCLEUS_SOURCE_WORKSPACE_NAME: sourceWorkspace?.name ?? project.name,
  }
}

export function insertSetupSnippet(currentScript: string, snippet: string): string {
  const trimmedScript = currentScript.trimEnd().replace(
    LEGACY_COPY_ALL_ENV_FILES_SETUP_SNIPPET,
    COPY_ALL_ENV_FILES_SETUP_SNIPPET,
  )
  const trimmedSnippet = snippet.trim()

  if (!trimmedSnippet || trimmedScript.includes(trimmedSnippet)) {
    return trimmedScript
  }

  if (!trimmedScript) {
    return trimmedSnippet
  }

  return `${trimmedScript}\n\n${trimmedSnippet}`
}
