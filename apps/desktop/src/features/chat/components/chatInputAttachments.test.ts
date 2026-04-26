import { describe, expect, test } from "bun:test"
import { normalizeChatInputAttachments } from "./chatInputAttachments"

describe("normalizeChatInputAttachments", () => {
  test("returns a stable empty array when callers omit attachments", () => {
    const first = normalizeChatInputAttachments()
    const second = normalizeChatInputAttachments()

    expect(first).toEqual([])
    expect(second).toBe(first)
  })

  test("preserves provided attachments", () => {
    const attachments = [
      {
        id: "att-1",
        type: "attachment" as const,
        kind: "file" as const,
        label: "notes.txt",
        relativePath: ".vfactor/chat-inputs/2026-04-07/att-1-notes.txt",
        absolutePath: "/tmp/notes.txt",
      },
    ]

    expect(normalizeChatInputAttachments(attachments)).toBe(attachments)
  })
})
