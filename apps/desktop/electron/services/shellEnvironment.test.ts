import { describe, expect, test } from "bun:test"
import { applyShellEnvironment } from "./shellEnvironment"

describe("applyShellEnvironment", () => {
  test("merges login shell paths and common CLI locations into a packaged-style PATH", () => {
    const env: NodeJS.ProcessEnv = {
      PATH: "/usr/bin:/bin",
    }

    applyShellEnvironment(env, {
      PATH: "/Users/tester/.bun/bin:/opt/homebrew/bin",
      SSH_AUTH_SOCK: "/tmp/test-ssh.sock",
    })

    expect(env.PATH?.split(":")).toContain("/Users/tester/.bun/bin")
    expect(env.PATH?.split(":")).toContain("/opt/homebrew/bin")
    expect(env.PATH?.split(":")).toContain("/usr/bin")
    expect(env.SSH_AUTH_SOCK).toBe("/tmp/test-ssh.sock")
  })
})
