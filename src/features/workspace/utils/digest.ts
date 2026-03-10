import { readTextFile } from "@tauri-apps/plugin-fs"

const AGENT_DIGEST_DIRECTORY = ".nucleus"
const AGENT_DIGEST_FILENAME = "digest.md"

export function getAgentDigestPath(agentPath: string): string {
  return `${agentPath.replace(/\/$/, "")}/${AGENT_DIGEST_DIRECTORY}/${AGENT_DIGEST_FILENAME}`
}

export function extractLatestDigestEntry(markdown: string): string {
  const normalized = markdown.trim()
  if (!normalized) {
    return ""
  }

  const entries = normalized
    .split(/\n(?:---|\*\*\*)\n/g)
    .map((entry) => entry.trim())
    .filter(Boolean)

  return entries.at(-1) ?? normalized
}

export async function readLatestAgentDigest(agentPath: string): Promise<string | null> {
  const digestPath = getAgentDigestPath(agentPath)

  const markdown = await readTextFile(digestPath)
  const latestEntry = extractLatestDigestEntry(markdown)

  return latestEntry || null
}
