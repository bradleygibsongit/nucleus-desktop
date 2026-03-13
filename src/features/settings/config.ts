import type { Icon } from "@/components/icons"
import {
  Archive,
  CaretLeft,
  Command,
  FolderOpen,
  GearSix,
  GitBranch,
  Globe,
  Lightbulb,
  Terminal,
} from "@/components/icons"

export type SettingsSectionId =
  | "general"
  | "configuration"
  | "personalization"
  | "mcp-servers"
  | "git"
  | "environments"
  | "worktrees"
  | "archived-threads"

export interface SettingsSectionDefinition {
  id: SettingsSectionId
  label: string
  icon: Icon
}

export const SETTINGS_BACK_ICON = CaretLeft

export const SETTINGS_SECTIONS: SettingsSectionDefinition[] = [
  { id: "general", label: "General", icon: GearSix },
  { id: "configuration", label: "Configuration", icon: Command },
  { id: "personalization", label: "Personalization", icon: Lightbulb },
  { id: "mcp-servers", label: "MCP servers", icon: Globe },
  { id: "git", label: "Git", icon: GitBranch },
  { id: "environments", label: "Environments", icon: Terminal },
  { id: "worktrees", label: "Worktrees", icon: FolderOpen },
  { id: "archived-threads", label: "Archived threads", icon: Archive },
]
