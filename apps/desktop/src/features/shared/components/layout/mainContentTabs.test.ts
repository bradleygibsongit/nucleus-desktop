import { describe, expect, test } from "bun:test"
import { getVisibleTab } from "./mainContentTabs"

describe("getVisibleTab", () => {
  const tabs = [
    { id: "terminal-1", type: "terminal", title: "Terminal" },
    { id: "chat-1", type: "chat-session", title: "Chat", sessionId: "session-1" },
  ] as const

  test("does not treat the first tab as active when no tab is selected", () => {
    expect(getVisibleTab([...tabs], null)).toBeUndefined()
  })

  test("falls back to the first tab when the selected id is stale", () => {
    expect(getVisibleTab([...tabs], "missing")?.id).toBe("terminal-1")
  })
})
