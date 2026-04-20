import { describe, expect, test } from "bun:test"
import {
  areWindowThemeStatesEqual,
  getWindowControlsOverlayStyle,
  normalizeWindowThemeState,
  resolveWindowThemeState,
} from "./windowTheme"

describe("windowTheme", () => {
  test("resolves system themes against the current OS appearance", () => {
    expect(resolveWindowThemeState("system", false)).toEqual({
      themeSource: "system",
      resolvedAppearance: "light",
      backgroundColor: "#fcfcfd",
    })

    expect(resolveWindowThemeState("system", true)).toEqual({
      themeSource: "system",
      resolvedAppearance: "dark",
      backgroundColor: "#16171a",
    })
  })

  test("resolves concrete app themes to their native light or dark appearance", () => {
    expect(resolveWindowThemeState("catppuccin-latte", true)).toEqual({
      themeSource: "light",
      resolvedAppearance: "light",
      backgroundColor: "#eff1f5",
    })

    expect(resolveWindowThemeState("kanagawa-dragon", false)).toEqual({
      themeSource: "dark",
      resolvedAppearance: "dark",
      backgroundColor: "#181616",
    })
  })

  test("normalizes sync payloads and falls back to the resolved appearance background", () => {
    expect(
      normalizeWindowThemeState(
        {
          themeSource: "system",
          resolvedAppearance: "dark",
          backgroundColor: "",
        },
        false
      )
    ).toEqual({
      themeSource: "system",
      resolvedAppearance: "dark",
      backgroundColor: "#16171a",
    })
  })

  test("uses contrasting symbol colors for light and dark overlays", () => {
    expect(
      getWindowControlsOverlayStyle({
        backgroundColor: "#fcfcfd",
        resolvedAppearance: "light",
      })
    ).toEqual({
      color: "#fcfcfd",
      symbolColor: "#6b6d76",
      height: 44,
    })

    expect(
      getWindowControlsOverlayStyle({
        backgroundColor: "#16171a",
        resolvedAppearance: "dark",
      })
    ).toEqual({
      color: "#16171a",
      symbolColor: "#9ca3af",
      height: 44,
    })
  })

  test("detects when a window theme state is unchanged", () => {
    expect(
      areWindowThemeStatesEqual(
        {
          themeSource: "system",
          resolvedAppearance: "dark",
          backgroundColor: "#16171a",
        },
        {
          themeSource: "system",
          resolvedAppearance: "dark",
          backgroundColor: "#16171a",
        }
      )
    ).toBe(true)

    expect(
      areWindowThemeStatesEqual(
        {
          themeSource: "system",
          resolvedAppearance: "dark",
          backgroundColor: "#16171a",
        },
        {
          themeSource: "system",
          resolvedAppearance: "light",
          backgroundColor: "#fcfcfd",
        }
      )
    ).toBe(false)
  })
})
