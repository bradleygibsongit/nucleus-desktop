import { nanoid } from "nanoid"
import type {
  MessageWithParts,
  RuntimeAttachmentPart,
  RuntimeMessagePart,
  RuntimeSession,
} from "../types"

export function createTextMessage(
  sessionId: string,
  role: "user" | "assistant",
  text: string
): MessageWithParts {
  const messageId = nanoid()

  return {
    info: {
      id: messageId,
      sessionId,
      role,
      createdAt: Date.now(),
      finishReason: role === "assistant" ? "end_turn" : undefined,
    },
    parts: [
      {
        id: nanoid(),
        type: "text",
        text,
      },
    ],
  }
}

export function createUserMessage(
  sessionId: string,
  text: string,
  attachments: RuntimeAttachmentPart[] = []
): MessageWithParts {
  const messageId = nanoid()
  const trimmedText = text.trim()
  const parts: RuntimeMessagePart[] = []

  if (trimmedText) {
    parts.push({
      id: nanoid(),
      type: "text",
      text: trimmedText,
    })
  }

  parts.push(...attachments)

  return {
    info: {
      id: messageId,
      sessionId,
      role: "user",
      createdAt: Date.now(),
    },
    parts,
  }
}

export function getMessageTextContent(parts: RuntimeMessagePart[]): string {
  return parts
    .filter((part): part is Extract<RuntimeMessagePart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("")
}

export function getMessageAttachmentParts(parts: RuntimeMessagePart[]): RuntimeAttachmentPart[] {
  return parts.filter(
    (part): part is RuntimeAttachmentPart => part.type === "attachment"
  )
}

export function remapMessagesToSession(
  messages: MessageWithParts[],
  sessionId: string
): MessageWithParts[] {
  return messages.map((message) => ({
    ...message,
    info: {
      ...message.info,
      sessionId,
    },
    parts: message.parts.map((part) =>
      part.type === "tool"
        ? {
            ...part,
            sessionId,
          }
        : part
    ),
  }))
}

export function preserveExistingMessageMetadata(
  previousMessages: MessageWithParts[],
  nextMessages: MessageWithParts[]
): MessageWithParts[] {
  const previousMessageById = new Map(
    previousMessages.map((message) => [message.info.id, message] as const)
  )

  return nextMessages.map((message) => {
    const previousMessage = previousMessageById.get(message.info.id)
    if (!previousMessage) {
      return message
    }

    return {
      ...message,
      info: {
        ...message.info,
        createdAt: previousMessage.info.createdAt,
      },
    }
  })
}

function getMessagePartsSignature(message: MessageWithParts): string {
  return message.parts
    .map((part) => {
      if (part.type === "text") {
        return `text:${part.text}`
      }

      if (part.type === "attachment") {
        return `attachment:${part.kind}:${part.relativePath}:${part.label}`
      }

      return `tool:${part.tool}:${JSON.stringify(part.state)}`
    })
    .join("|")
}

function isProvisionalMessageId(messageId: string): boolean {
  return /^item-\d+:message$/.test(messageId)
}

export function dedupeMessages(messages: MessageWithParts[]): MessageWithParts[] {
  const dedupedById: MessageWithParts[] = []
  const indexById = new Map<string, number>()

  for (const message of messages) {
    const existingIndex = indexById.get(message.info.id)

    if (existingIndex == null) {
      indexById.set(message.info.id, dedupedById.length)
      dedupedById.push(message)
      continue
    }

    dedupedById[existingIndex] = message
  }

  const deduped: MessageWithParts[] = []

  for (const message of dedupedById) {
    if (message.info.role !== "assistant") {
      deduped.push(message)
      continue
    }

    const semanticKey = [
      message.info.role,
      message.info.itemType ?? "",
      message.info.phase ?? "",
      getMessagePartsSignature(message),
    ].join("::")

    const existingIndex = deduped.findIndex((candidate) => {
      const candidateKey = [
        candidate.info.role,
        candidate.info.itemType ?? "",
        candidate.info.phase ?? "",
        getMessagePartsSignature(candidate),
      ].join("::")

      return candidateKey === semanticKey
    })

    if (existingIndex === -1) {
      deduped.push(message)
      continue
    }

    const existing = deduped[existingIndex]
    const existingIsProvisional = isProvisionalMessageId(existing.info.id)
    const messageIsProvisional = isProvisionalMessageId(message.info.id)

    if (existingIsProvisional && !messageIsProvisional) {
      deduped[existingIndex] = message
      continue
    }

    if (!existingIsProvisional && messageIsProvisional) {
      continue
    }

    deduped.push(message)
  }

  return deduped
}

export function getSessionTitleFallback(session: RuntimeSession): string {
  if (session.title?.trim()) {
    return session.title
  }

  return `Session ${session.id.slice(0, 8)}`
}
