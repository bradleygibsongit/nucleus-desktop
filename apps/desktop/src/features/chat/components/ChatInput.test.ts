import { describe, expect, test } from "bun:test"
import { getChatInputPlaceholder } from "./chatInputConfig"
import { resolveSessionSelectedModelId } from "./chatInputModelSelection"

describe("getChatInputPlaceholder", () => {
  test("uses the intro placeholder for the first-prompt empty state", () => {
    expect(getChatInputPlaceholder("intro")).toBe("Describe the feature, fix, or idea...")
  })

  test("keeps the existing docked placeholder for the standard composer", () => {
    expect(getChatInputPlaceholder("docked")).toBe("Ask anything")
  })
})

describe("resolveSessionSelectedModelId", () => {
  test("clears the local composer selection when the active session has no explicit model", () => {
    expect(resolveSessionSelectedModelId(null, ["gpt-5", "gpt-5-mini"])).toBeNull()
    expect(resolveSessionSelectedModelId("   ", ["gpt-5", "gpt-5-mini"])).toBeNull()
  })

  test("keeps the active session model when it is available", () => {
    expect(resolveSessionSelectedModelId(" gpt-5-mini ", ["gpt-5", "gpt-5-mini"])).toBe("gpt-5-mini")
  })

  test("drops unavailable session overrides instead of carrying stale state forward", () => {
    expect(resolveSessionSelectedModelId("gpt-4.1", ["gpt-5", "gpt-5-mini"])).toBeNull()
  })
})
