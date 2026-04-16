export type ReviewDiffLineRange = {
  start: number
  end: number
}

export type ReviewDiffSelectedLines = {
  start: number
  side: "additions"
  end: number
  endSide: "additions"
}

type ParsedUnifiedDiffRow = {
  raw: string
  prefix: string
  oldLine: number | null
  newLine: number | null
  oldCursor: number
  newCursor: number
  isNoNewlineMarker: boolean
}

type ParsedUnifiedDiffHunk = {
  oldStart: number
  newStart: number
  suffix: string
  rows: ParsedUnifiedDiffRow[]
}

const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/

function isPositiveInteger(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
}

function parseUnifiedDiffHunk(diffHunk: string): ParsedUnifiedDiffHunk | null {
  const lines = diffHunk.trim().split("\n")
  const header = lines[0]
  if (!header) {
    return null
  }

  const headerMatch = header.match(HUNK_HEADER_PATTERN)
  if (!headerMatch) {
    return null
  }

  let oldCursor = Number.parseInt(headerMatch[1] ?? "", 10)
  let newCursor = Number.parseInt(headerMatch[3] ?? "", 10)
  if (!Number.isFinite(oldCursor) || !Number.isFinite(newCursor)) {
    return null
  }

  const rows: ParsedUnifiedDiffRow[] = []
  for (const rawLine of lines.slice(1)) {
    if (rawLine.startsWith("\\")) {
      rows.push({
        raw: rawLine,
        prefix: "\\",
        oldLine: null,
        newLine: null,
        oldCursor,
        newCursor,
        isNoNewlineMarker: true,
      })
      continue
    }

    const prefix = rawLine[0] ?? ""
    if (prefix !== " " && prefix !== "+" && prefix !== "-") {
      return null
    }

    const row: ParsedUnifiedDiffRow = {
      raw: rawLine,
      prefix,
      oldLine: null,
      newLine: null,
      oldCursor,
      newCursor,
      isNoNewlineMarker: false,
    }

    if (prefix === " ") {
      row.oldLine = oldCursor
      row.newLine = newCursor
      oldCursor += 1
      newCursor += 1
    } else if (prefix === "+") {
      row.newLine = newCursor
      newCursor += 1
    } else {
      row.oldLine = oldCursor
      oldCursor += 1
    }

    rows.push(row)
  }

  return {
    oldStart: Number.parseInt(headerMatch[1] ?? "", 10),
    newStart: Number.parseInt(headerMatch[3] ?? "", 10),
    suffix: headerMatch[5] ?? "",
    rows,
  }
}

function buildUnifiedDiffHeader(
  oldStart: number,
  oldCount: number,
  newStart: number,
  newCount: number,
  suffix: string
): string {
  return `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@${suffix}`
}

function trimUnifiedDiffHunk(
  diffHunk: string,
  lineRange: ReviewDiffLineRange | null,
  contextLineCount = 2
): string {
  if (!lineRange) {
    return diffHunk.trim()
  }

  const parsed = parseUnifiedDiffHunk(diffHunk)
  if (!parsed) {
    return diffHunk.trim()
  }

  const windowStart = Math.max(parsed.newStart, lineRange.start - contextLineCount)
  const windowEnd = lineRange.end + contextLineCount
  const keptIndexes = parsed.rows.reduce<number[]>((indexes, row, index) => {
    if (row.isNoNewlineMarker) {
      return indexes
    }

    if (row.newLine !== null) {
      if (row.newLine >= windowStart && row.newLine <= windowEnd) {
        indexes.push(index)
      }
      return indexes
    }

    if (row.prefix === "-" && row.newCursor >= windowStart && row.newCursor <= windowEnd + 1) {
      indexes.push(index)
    }

    return indexes
  }, [])

  if (keptIndexes.length === 0) {
    return diffHunk.trim()
  }

  let firstIndex = keptIndexes[0] ?? 0
  let lastIndex = keptIndexes[keptIndexes.length - 1] ?? parsed.rows.length - 1

  if (parsed.rows[firstIndex - 1]?.isNoNewlineMarker) {
    firstIndex -= 1
  }
  if (parsed.rows[lastIndex + 1]?.isNoNewlineMarker) {
    lastIndex += 1
  }

  const keptRows = parsed.rows.slice(firstIndex, lastIndex + 1)
  const contentRows = keptRows.filter((row) => !row.isNoNewlineMarker)
  const firstContentRow = contentRows[0]
  if (!firstContentRow) {
    return diffHunk.trim()
  }

  const oldStart = firstContentRow.oldLine ?? firstContentRow.oldCursor
  const newStart = firstContentRow.newLine ?? firstContentRow.newCursor
  const oldCount = contentRows.filter((row) => row.oldLine !== null).length
  const newCount = contentRows.filter((row) => row.newLine !== null).length

  return [
    buildUnifiedDiffHeader(oldStart, oldCount, newStart, newCount, parsed.suffix),
    ...keptRows.map((row) => row.raw),
  ].join("\n")
}

export function getReviewDiffLineRange(
  startLine: number | null | undefined,
  line: number | null | undefined
): ReviewDiffLineRange | null {
  if (isPositiveInteger(startLine) && isPositiveInteger(line)) {
    return {
      start: Math.min(startLine, line),
      end: Math.max(startLine, line),
    }
  }

  if (isPositiveInteger(line)) {
    return { start: line, end: line }
  }

  return null
}

export function formatReviewLineLabel(
  startLine: number | null | undefined,
  line: number | null | undefined
): string | null {
  const range = getReviewDiffLineRange(startLine, line)
  if (!range) {
    return null
  }

  if (range.start === range.end) {
    return `L${range.start}`
  }

  return `L${range.start}-${range.end}`
}

export function getReviewDiffSelectedLines(
  lineRange: ReviewDiffLineRange | null
): ReviewDiffSelectedLines | null {
  if (!lineRange) {
    return null
  }

  return {
    start: lineRange.start,
    side: "additions",
    end: lineRange.end,
    endSide: "additions",
  }
}

export function buildReviewPatch(
  path: string | null | undefined,
  diffHunk: string | null | undefined,
  lineRange: ReviewDiffLineRange | null
): string | null {
  const normalizedHunk = diffHunk?.trim()
  if (!normalizedHunk) {
    return null
  }

  const normalizedPath = path?.trim() || "review.ts"
  if (normalizedHunk.startsWith("---") || normalizedHunk.startsWith("diff --git")) {
    return normalizedHunk
  }

  const trimmedHunk = trimUnifiedDiffHunk(normalizedHunk, lineRange)
  return `--- a/${normalizedPath}\n+++ b/${normalizedPath}\n${trimmedHunk}\n`
}
