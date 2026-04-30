import { describe, expect, test } from "bun:test"

import type { CodexTurn } from "./codexProtocol"
import { mapTurnItemsToMessages } from "./codexMessageMapper"

describe("mapTurnItemsToMessages", () => {
  test("preserves reasoning titles on runtime messages", () => {
    const turn: CodexTurn = {
      id: "turn-1",
      status: "completed",
      error: null,
      items: [
        {
          type: "reasoning",
          id: "reasoning-1",
          title: "Inspecting files",
          summary: ["Checking the likely component."],
          content: [],
        },
      ],
    }

    expect(mapTurnItemsToMessages(turn, "session-1")[0]?.info.title).toBe(
      "Inspecting files"
    )
  })

  test("does not duplicate explicit reasoning titles into message text", () => {
    const turn: CodexTurn = {
      id: "turn-1",
      status: "completed",
      error: null,
      items: [
        {
          type: "reasoning",
          id: "reasoning-1",
          title: "Finalizing story structure",
          summary: ["Finalizing story structure"],
          content: [],
        },
      ],
    }

    expect(mapTurnItemsToMessages(turn, "session-1")[0]?.parts).toEqual([
      {
        id: "reasoning-1:text",
        type: "text",
        text: "",
      },
    ])
  })
})
