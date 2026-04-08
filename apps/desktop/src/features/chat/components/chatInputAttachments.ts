import type { DraftChatAttachment } from "./composer/attachments"

const EMPTY_CHAT_INPUT_ATTACHMENTS: DraftChatAttachment[] = []

export function normalizeChatInputAttachments(
  attachments?: DraftChatAttachment[]
): DraftChatAttachment[] {
  return attachments ?? EMPTY_CHAT_INPUT_ATTACHMENTS
}

export function noopSetChatInputAttachments(_attachments: DraftChatAttachment[]): void {}
