import { describe, expect, test } from "bun:test"

import {
  deriveWorkspaceSetupFallback,
  parseWorkspaceSetupSuggestion,
} from "./workspaceSetup"

describe("workspaceSetup", () => {
  test("parses strict json suggestions", () => {
    expect(
      parseWorkspaceSetupSuggestion(
        '{"branchName":"feature/fix-chat-scroll","workspaceName":"Fix chat scroll"}'
      )
    ).toEqual({
      branchName: "feature/fix-chat-scroll",
      workspaceName: "Fix chat scroll",
    })
  })

  test("parses fenced json suggestions", () => {
    expect(
      parseWorkspaceSetupSuggestion(
        '```json\n{"branchName":"Fix Chat Scroll","workspaceName":"  fix chat scroll  "}\n```'
      )
    ).toEqual({
      branchName: "fix-chat-scroll",
      workspaceName: "fix chat scroll",
    })
  })

  test("falls back to a readable local suggestion", () => {
    expect(deriveWorkspaceSetupFallback("Please fix the composer flicker on first send")).toEqual({
      branchName: "fix-composer-flicker-first-send",
      workspaceName: "Fix Composer Flicker First Send",
    })
  })
})
