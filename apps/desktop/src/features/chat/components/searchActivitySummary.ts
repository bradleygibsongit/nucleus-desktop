const PATH_KEYS = new Set([
  "absolutePath",
  "file",
  "filePath",
  "filename",
  "path",
  "relativePath",
])

const COUNT_KEYS = new Set([
  "count",
  "fileCount",
  "files",
  "filesSearched",
  "matchCount",
  "resultCount",
  "resultsCount",
  "total",
])

const QUERY_KEYS = new Set(["directory", "dir", "pattern", "q", "query", "search"])

function getBaseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}

function looksLikePath(value: string): boolean {
  const trimmed = value.trim()
  return Boolean(
    trimmed &&
      !trimmed.includes("\n") &&
      (trimmed.includes("/") ||
        trimmed.includes("\\") ||
        /\.[a-z0-9]{1,8}$/i.test(trimmed))
  )
}

function addUniquePath(paths: string[], value: string): void {
  const trimmed = value.trim().replace(/^['"](.+)['"]$/, "$1")

  if (!trimmed || !looksLikePath(trimmed) || paths.includes(trimmed)) {
    return
  }

  paths.push(trimmed)
}

function collectPaths(value: unknown, paths: string[] = []): string[] {
  if (typeof value === "string") {
    for (const line of value.split(/\r?\n/)) {
      const match = line.match(/^([^:\s]+(?:[\\/][^:\s]+|\.[a-z0-9]{1,8})(?::\d+)?)[:\s]/i)
      if (match?.[1]) {
        addUniquePath(paths, match[1].replace(/:\d+$/, ""))
      } else {
        addUniquePath(paths, line)
      }
    }

    return paths
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectPaths(entry, paths)
    }

    return paths
  }

  if (!value || typeof value !== "object") {
    return paths
  }

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && PATH_KEYS.has(key)) {
      addUniquePath(paths, entry)
      continue
    }

    collectPaths(entry, paths)
  }

  return paths
}

function getCount(value: unknown): number | null {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.length : null
  }

  if (!value || typeof value !== "object") {
    return null
  }

  for (const [key, entry] of Object.entries(value)) {
    if (!COUNT_KEYS.has(key)) {
      continue
    }

    if (typeof entry === "number" && Number.isFinite(entry) && entry > 0) {
      return entry
    }

    if (Array.isArray(entry) && entry.length > 0) {
      return entry.length
    }
  }

  return null
}

function getQueryTarget(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  for (const [key, entry] of Object.entries(value)) {
    if (!QUERY_KEYS.has(key) || typeof entry !== "string" || !entry.trim()) {
      continue
    }

    return looksLikePath(entry) ? getBaseName(entry) : entry.trim()
  }

  return null
}

export function getSearchActivityTarget(input: unknown, output?: unknown): string | null {
  const paths = collectPaths([input, output])
  if (paths.length > 0) {
    const first = getBaseName(paths[0])
    return paths.length === 1 ? first : `${first} + ${paths.length - 1} more`
  }

  const count = getCount(output) ?? getCount(input)
  if (count) {
    return `${count} ${count === 1 ? "file" : "files"}`
  }

  return getQueryTarget(input)
}
