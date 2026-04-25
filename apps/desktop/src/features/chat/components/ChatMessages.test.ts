import { describe, expect, test } from "bun:test"

import type { MessageWithParts, RuntimeMessage } from "../types"
import { getTurnCollapsedMessagesByFooterId } from "./chatTimelineCollapse"

function createMessage(input: {
  id: string
  role?: RuntimeMessage["role"]
  itemType?: RuntimeMessage["itemType"]
  text?: string
}): MessageWithParts {
  return {
    info: {
      id: input.id,
      sessionId: "session-1",
      role: input.role ?? "assistant",
      createdAt: 1,
      itemType: input.itemType,
    },
    parts: [
      {
        id: `${input.id}:text`,
        type: "text",
        text: input.text ?? "message",
      },
    ],
  }
}

describe("getTurnCollapsedMessagesByFooterId", () => {
  test("keeps provider notices visible instead of folding them into completed turn steps", () => {
    const footer = createMessage({
      id: "assistant-final",
      itemType: "agentMessage",
      text: "Done",
    })
    const collapsedMessages = getTurnCollapsedMessagesByFooterId(
      [
        createMessage({
          id: "user-1",
          role: "user",
          text: "Ping",
        }),
        createMessage({
          id: "notice-1",
          itemType: "providerNotice",
          text: "Codex could not authenticate one MCP connector.",
        }),
        createMessage({
          id: "plan-1",
          itemType: "plan",
          text: "Plan",
        }),
        footer,
      ],
      "idle"
    )

    expect(collapsedMessages.get(footer.info.id)?.map((message) => message.info.id)).toEqual([
      "plan-1",
    ])
  })
})
