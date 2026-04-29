import { describe, expect, test } from "bun:test"
import { shouldRestoreTerminalInitialData } from "./terminalInitialData"

describe("shouldRestoreTerminalInitialData", () => {
  test("restores scrollback for a cold renderer cache", () => {
    expect(
      shouldRestoreTerminalInitialData({
        initialData: "previous terminal output",
        hasReadyCachedSessionForCwd: false,
      })
    ).toBe(true)
  })

  test("skips scrollback replay when the cached terminal already has the same live buffer", () => {
    expect(
      shouldRestoreTerminalInitialData({
        initialData: "previous terminal output",
        hasReadyCachedSessionForCwd: true,
      })
    ).toBe(false)
  })

  test("skips empty startup data", () => {
    expect(
      shouldRestoreTerminalInitialData({
        initialData: "",
        hasReadyCachedSessionForCwd: false,
      })
    ).toBe(false)
  })
})
