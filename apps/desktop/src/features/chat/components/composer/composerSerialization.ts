import { $createLineBreakNode, $createParagraphNode, $createTextNode, $getRoot, $isElementNode, $isLineBreakNode, $isTextNode, type LexicalNode } from "lexical"
import type { NormalizedCommand } from "../../hooks/useCommands"
import type { DraftChatAttachment } from "./attachments"
import { ATTACHMENT_CHIP_PATTERN, buildAttachmentChipToken } from "./attachments"
import { $createSkillChipNode, $isSkillChipNode } from "../SkillChipNode"
import { $createUploadChipNode, $isUploadChipNode } from "../UploadChipNode"

export const SKILL_REFERENCE_PATTERN = /\$([a-z0-9][a-z0-9-]*)/gi
const COMPOSER_TOKEN_PATTERN = /\[\[vfactor-upload:[A-Za-z0-9_-]+\]\]|\$([a-z0-9][a-z0-9-]*)/gi

function appendTextNodesToParagraph(
  text: string,
  paragraph: ReturnType<typeof $createParagraphNode>
) {
  const segments = text.split("\n")

  segments.forEach((segment, index) => {
    if (segment.length > 0) {
      paragraph.append($createTextNode(segment))
    }

    if (index < segments.length - 1) {
      paragraph.append($createLineBreakNode())
    }
  })
}

export function populateComposerFromSerializedValue(
  value: string,
  commandsByReference: Map<string, NormalizedCommand>,
  attachmentsById: Map<string, DraftChatAttachment> = new Map()
) {
  const root = $getRoot()
  const paragraph = $createParagraphNode()
  let lastIndex = 0

  root.clear()

  for (const match of value.matchAll(COMPOSER_TOKEN_PATTERN)) {
    const fullMatch = match[0]
    const matchIndex = match.index ?? -1

    if (matchIndex < 0) {
      continue
    }

    const textBefore = value.slice(lastIndex, matchIndex)
    if (textBefore.length > 0) {
      appendTextNodesToParagraph(textBefore, paragraph)
    }

    const attachmentMatch = fullMatch.match(ATTACHMENT_CHIP_PATTERN)
    const attachmentId = attachmentMatch?.[0]
      ? fullMatch.slice("[[vfactor-upload:".length, -"]]".length)
      : null

    if (attachmentId) {
      const attachment = attachmentsById.get(attachmentId)

      if (attachment) {
        paragraph.append(
          $createUploadChipNode(attachment.id, attachment.kind, attachment.label)
        )
      } else {
        appendTextNodesToParagraph(fullMatch, paragraph)
      }

      lastIndex = matchIndex + fullMatch.length
      continue
    }

    const rawReference = match[1]
    const referenceName = rawReference?.toLowerCase() ?? ""
    const command = commandsByReference.get(referenceName)

    if (command?.referenceName) {
      paragraph.append($createSkillChipNode(command.referenceName, command.name))
    } else {
      appendTextNodesToParagraph(fullMatch, paragraph)
    }

    lastIndex = matchIndex + fullMatch.length
  }

  const remainingText = value.slice(lastIndex)
  if (remainingText.length > 0) {
    appendTextNodesToParagraph(remainingText, paragraph)
  }

  root.append(paragraph)
  root.selectEnd()
}

function serializeComposerNode(node: LexicalNode): string {
  if ($isSkillChipNode(node)) {
    return `$${node.getReferenceName()}`
  }

  if ($isUploadChipNode(node)) {
    return buildAttachmentChipToken(node.getAttachmentId())
  }

  if ($isLineBreakNode(node)) {
    return "\n"
  }

  if ($isTextNode(node)) {
    return node.getTextContent()
  }

  if ($isElementNode(node)) {
    return node.getChildren().map((child) => serializeComposerNode(child)).join("")
  }

  return ""
}

export function serializeComposerState(): string {
  return $getRoot()
    .getChildren()
    .map((child) => serializeComposerNode(child))
    .join("\n")
}
