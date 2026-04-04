import { describe, expect, test } from "bun:test"

import { resolveDeleteFromSystemDefault } from "./removeWorktreeModalLogic"

describe("resolveDeleteFromSystemDefault", () => {
  test("defaults archive removal to delete from disk for managed worktrees", () => {
    expect(resolveDeleteFromSystemDefault(true, true)).toBe(true)
  })

  test("never defaults delete from disk for the root workspace", () => {
    expect(resolveDeleteFromSystemDefault(false, true)).toBe(false)
  })
})
