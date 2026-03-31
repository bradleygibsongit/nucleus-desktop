import { describe, expect, test } from "bun:test"

import type { MessageWithParts } from "../types"
import { dedupeMessages } from "./runtimeMessages"

function createAssistantTextMessage(id: string, text: string): MessageWithParts {
  return {
    info: {
      id,
      sessionId: "session-1",
      role: "assistant",
      createdAt: 1,
      itemType: "agentMessage",
    },
    parts: [
      {
        id: `${id}:text`,
        type: "text",
        text,
      },
    ],
  }
}

function createUserTextMessage(id: string, text: string): MessageWithParts {
  return {
    info: {
      id,
      sessionId: "session-1",
      role: "user",
      createdAt: 1,
    },
    parts: [
      {
        id: `${id}:text`,
        type: "text",
        text,
      },
    ],
  }
}

describe("dedupeMessages", () => {
  test("replaces earlier streamed chunks when the same message id grows", () => {
    const messages = dedupeMessages([
      createAssistantTextMessage("msg-1", "I"),
      createAssistantTextMessage("msg-1", "I'm"),
      createAssistantTextMessage("msg-1", "I'm creating"),
    ])

    expect(messages).toHaveLength(1)
    expect(messages[0]?.parts).toEqual([
      expect.objectContaining({
        type: "text",
        text: "I'm creating",
      }),
    ])
  })

  test("still prefers canonical messages over provisional duplicates with the same content", () => {
    const messages = dedupeMessages([
      createAssistantTextMessage("item-12:message", "Done"),
      createAssistantTextMessage("msg_abc123", "Done"),
    ])

    expect(messages).toHaveLength(1)
    expect(messages[0]?.info.id).toBe("msg_abc123")
  })

  test("keeps repeated user messages even when the text is identical", () => {
    const messages = dedupeMessages([
      createUserTextMessage("msg-user-1", "test"),
      createUserTextMessage("msg-user-2", "test"),
    ])

    expect(messages).toHaveLength(2)
    expect(messages.map((message) => message.info.id)).toEqual([
      "msg-user-1",
      "msg-user-2",
    ])
  })
})
