import { describe, expect, test } from "bun:test"
import { normalizeProviderSettings } from "./providerSettings"

describe("normalizeProviderSettings", () => {
  test("fills provider defaults when settings are missing", () => {
    expect(normalizeProviderSettings(null)).toEqual({
      codex: {
        enabled: true,
        binaryPath: "codex",
        homePath: "",
        customModels: [],
      },
      "claude-code": {
        enabled: true,
        binaryPath: "claude",
        launchArgs: "",
        customModels: [],
      },
      opencode: {
        enabled: true,
        binaryPath: "opencode",
        serverUrl: "",
        serverPassword: "",
        customModels: [],
      },
    })
  })

  test("preserves configured provider paths and custom models", () => {
    expect(
      normalizeProviderSettings({
        codex: {
          enabled: false,
          binaryPath: " /opt/bin/codex ",
          homePath: " /tmp/codex-home ",
          customModels: ["gpt-test", "gpt-test", ""],
        },
        opencode: {
          binaryPath: " /opt/bin/opencode ",
          serverUrl: " http://127.0.0.1:4096 ",
          serverPassword: " secret ",
          customModels: [" kimi-test "],
        },
      })
    ).toEqual({
      codex: {
        enabled: false,
        binaryPath: "/opt/bin/codex",
        homePath: "/tmp/codex-home",
        customModels: ["gpt-test"],
      },
      "claude-code": {
        enabled: true,
        binaryPath: "claude",
        launchArgs: "",
        customModels: [],
      },
      opencode: {
        enabled: true,
        binaryPath: "/opt/bin/opencode",
        serverUrl: "http://127.0.0.1:4096",
        serverPassword: "secret",
        customModels: ["kimi-test"],
      },
    })
  })
})
