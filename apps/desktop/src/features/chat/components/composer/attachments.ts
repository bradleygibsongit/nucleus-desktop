import { nanoid } from "nanoid"
import type { RuntimeAttachmentKind, RuntimeAttachmentPart } from "../../types"

export const CHAT_INPUTS_RELATIVE_ROOT = ".vfactor/chat-inputs"
export const ATTACHMENT_CHIP_PREFIX = "[[vfactor-upload:"
export const ATTACHMENT_CHIP_SUFFIX = "]]"
export const ATTACHMENT_CHIP_PATTERN = /\[\[vfactor-upload:([A-Za-z0-9_-]+)\]\]/g
export const LARGE_TEXT_PASTE_CHARACTER_THRESHOLD = 4000
export const LARGE_TEXT_PASTE_LINE_THRESHOLD = 40

export type DraftChatAttachment = RuntimeAttachmentPart

function getPathSeparator(path: string): "/" | "\\" {
  return path.includes("\\") ? "\\" : "/"
}

function trimTrailingSeparators(path: string): string {
  return path.replace(/[\\/]+$/, "")
}

function joinPathSegments(basePath: string, ...segments: string[]): string {
  const separator = getPathSeparator(basePath)
  const normalizedSegments = segments
    .map((segment) => segment.replace(/[\\/]+/g, separator))
    .map((segment) => segment.replace(new RegExp(`^\\${separator}+|\\${separator}+$`, "g"), ""))
    .filter(Boolean)

  return [trimTrailingSeparators(basePath), ...normalizedSegments].join(separator)
}

function toPortableRelativePath(path: string): string {
  return path.replace(/\\/g, "/")
}

function sanitizeBaseName(value: string, fallbackBaseName: string): string {
  const trimmed = value.trim().replace(/\s+/g, "-")
  const sanitized = trimmed.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-")
  const normalized = sanitized.replace(/^[-.]+|[-.]+$/g, "")

  return normalized || fallbackBaseName
}

export function sanitizeAttachmentFileName(
  fileName: string,
  fallbackBaseName = "upload"
): string {
  const normalizedFileName = fileName.replace(/[\\/]+/g, "/").split("/").at(-1) ?? fileName
  const extensionMatch = normalizedFileName.match(/(\.[A-Za-z0-9]+)$/)
  const extension = extensionMatch?.[1] ?? ""
  const baseName = extension ? normalizedFileName.slice(0, -extension.length) : normalizedFileName

  return `${sanitizeBaseName(baseName, fallbackBaseName)}${extension.toLowerCase()}`
}

export function buildAttachmentChipToken(attachmentId: string): string {
  return `${ATTACHMENT_CHIP_PREFIX}${attachmentId}${ATTACHMENT_CHIP_SUFFIX}`
}

export function collectAttachmentIdsFromComposerValue(value: string): string[] {
  return Array.from(value.matchAll(ATTACHMENT_CHIP_PATTERN), (match) => match[1] ?? "")
}

export function stripAttachmentTokens(value: string): string {
  return value.replace(ATTACHMENT_CHIP_PATTERN, "").replace(/[ \t]+\n/g, "\n")
}

export function getComposerTextInput(value: string): string {
  return stripAttachmentTokens(value).replace(/\n{3,}/g, "\n\n")
}

export function isLargeTextPaste(text: string): boolean {
  const lineCount = text.split(/\r?\n/).length
  return (
    text.length > LARGE_TEXT_PASTE_CHARACTER_THRESHOLD ||
    lineCount > LARGE_TEXT_PASTE_LINE_THRESHOLD
  )
}

export function formatAttachmentDirectoryDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function createDraftAttachment({
  kind,
  label,
  worktreePath,
  fileName,
  mediaType,
  sizeBytes,
  date = new Date(),
  id = nanoid(),
}: {
  kind: RuntimeAttachmentKind
  label: string
  worktreePath: string
  fileName: string
  mediaType?: string
  sizeBytes?: number
  date?: Date
  id?: string
}): DraftChatAttachment {
  const safeFileName = sanitizeAttachmentFileName(fileName, kind === "pasted_text" ? "pasted-text" : "upload")
  const relativePath = toPortableRelativePath(
    `${CHAT_INPUTS_RELATIVE_ROOT}/${formatAttachmentDirectoryDate(date)}/${id}-${safeFileName}`
  )

  return {
    id,
    type: "attachment",
    kind,
    label,
    relativePath,
    absolutePath: joinPathSegments(worktreePath, relativePath),
    mediaType,
    sizeBytes,
  }
}

export function getAttachmentTransportLabel(kind: RuntimeAttachmentKind): string {
  switch (kind) {
    case "image":
      return "image"
    case "pasted_text":
      return "pasted text"
    default:
      return "file"
  }
}

export function buildHarnessAttachmentText(
  text: string,
  attachments: RuntimeAttachmentPart[]
): string {
  const trimmedText = text.trim()

  if (attachments.length === 0) {
    return trimmedText
  }

  const attachmentLines = attachments.map(
    (attachment) =>
      `- ${getAttachmentTransportLabel(attachment.kind)} "${attachment.label}": ${attachment.relativePath}`
  )
  const attachmentSection = [
    "Attached local context:",
    ...attachmentLines,
    "These files are staged locally in the project and can be read directly from disk.",
    "If an attachment is an image, inspect the image file directly instead of saying no image was provided.",
  ].join("\n")

  return trimmedText ? `${trimmedText}\n\n${attachmentSection}` : attachmentSection
}

export function getDraftAttachmentLabel(attachment: DraftChatAttachment): string {
  return attachment.label.trim() || attachment.relativePath.split("/").at(-1) || "Attachment"
}
