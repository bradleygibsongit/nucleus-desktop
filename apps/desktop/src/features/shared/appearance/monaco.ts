import type * as Monaco from "monaco-editor"
import { CONCRETE_THEMES } from "./themeRegistry"

let hasRegisteredMonacoThemes = false
let hasRegisteredSidebarFilePreviewMonacoThemes = false

const SIDEBAR_FILE_PREVIEW_THEME_SUFFIX = "-sidebar-file-preview"

export function getSidebarFilePreviewMonacoThemeId(monacoThemeId: string): string {
  return `${monacoThemeId}${SIDEBAR_FILE_PREVIEW_THEME_SUFFIX}`
}

function parseHexColor(color: string): [number, number, number] | null {
  const normalized = color.trim().replace("#", "")

  if (/^[0-9a-fA-F]{3}$/.test(normalized)) {
    return normalized.split("").map((part) => Number.parseInt(`${part}${part}`, 16)) as [
      number,
      number,
      number,
    ]
  }

  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return [
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16),
    ]
  }

  return null
}

function toHexChannel(value: number): string {
  return Math.round(value).toString(16).padStart(2, "0")
}

function withHexAlpha(color: string, alpha: number): string {
  const rgb = parseHexColor(color)

  if (!rgb) {
    return color
  }

  return `#${rgb.map(toHexChannel).join("")}${toHexChannel(alpha * 255)}`
}

function mixHexColor(foreground: string, background: string, foregroundWeight: number): string {
  const foregroundRgb = parseHexColor(foreground)
  const backgroundRgb = parseHexColor(background)

  if (!foregroundRgb || !backgroundRgb) {
    return foreground
  }

  const backgroundWeight = 1 - foregroundWeight
  const [red, green, blue] = foregroundRgb.map(
    (channel, index) => channel * foregroundWeight + backgroundRgb[index] * backgroundWeight
  )

  return `#${toHexChannel(red)}${toHexChannel(green)}${toHexChannel(blue)}`
}

export function registerMonacoThemes(monaco: typeof Monaco): void {
  if (hasRegisteredMonacoThemes) {
    return
  }

  for (const theme of CONCRETE_THEMES) {
    monaco.editor.defineTheme(theme.monaco.id, {
      base: theme.monaco.base,
      inherit: theme.monaco.inherit,
      rules: theme.monaco.rules,
      colors: theme.monaco.colors,
    })
  }

  hasRegisteredMonacoThemes = true
}

export function registerSidebarFilePreviewMonacoThemes(monaco: typeof Monaco): void {
  if (hasRegisteredSidebarFilePreviewMonacoThemes) {
    return
  }

  registerMonacoThemes(monaco)

  for (const theme of CONCRETE_THEMES) {
    const background = theme.tokens.background
    const foreground = theme.tokens["sidebar-foreground"]
    const lineNumberForeground = mixHexColor(foreground, background, 0.48)
    const activeLineNumberForeground = mixHexColor(foreground, background, 0.76)
    const guideForeground = mixHexColor(foreground, background, 0.16)
    const activeGuideForeground = mixHexColor(foreground, background, 0.28)
    const subtleHighlight = withHexAlpha(foreground, theme.appearance === "dark" ? 0.08 : 0.06)
    const strongerHighlight = withHexAlpha(foreground, theme.appearance === "dark" ? 0.12 : 0.1)
    const selectionBackground = withHexAlpha(foreground, theme.appearance === "dark" ? 0.22 : 0.16)
    const inactiveSelectionBackground = withHexAlpha(
      foreground,
      theme.appearance === "dark" ? 0.14 : 0.1
    )
    const transparent = "#00000000"

    monaco.editor.defineTheme(getSidebarFilePreviewMonacoThemeId(theme.monaco.id), {
      base: theme.monaco.base,
      inherit: theme.monaco.inherit,
      rules: theme.monaco.rules,
      colors: {
        ...theme.monaco.colors,
        "editor.background": background,
        "editorGutter.background": background,
        "editorWidget.background": background,
        "editor.selectionBackground": selectionBackground,
        "editor.inactiveSelectionBackground": inactiveSelectionBackground,
        "editor.selectionHighlightBackground": subtleHighlight,
        "editor.selectionHighlightBorder": transparent,
        "editor.lineHighlightBackground": subtleHighlight,
        "editor.lineHighlightBorder": transparent,
        "editor.rangeHighlightBackground": subtleHighlight,
        "editor.rangeHighlightBorder": transparent,
        "editor.symbolHighlightBackground": subtleHighlight,
        "editor.symbolHighlightBorder": transparent,
        "editor.wordHighlightBackground": subtleHighlight,
        "editor.wordHighlightStrongBackground": strongerHighlight,
        "editor.wordHighlightTextBackground": subtleHighlight,
        "editor.wordHighlightBorder": transparent,
        "editor.wordHighlightStrongBorder": transparent,
        "editor.wordHighlightTextBorder": transparent,
        "editorBracketMatch.background": subtleHighlight,
        "editorBracketMatch.border": transparent,
        "editorBracketHighlight.foreground1": foreground,
        "editorBracketHighlight.foreground2": foreground,
        "editorBracketHighlight.foreground3": foreground,
        "editorBracketHighlight.foreground4": foreground,
        "editorBracketHighlight.foreground5": foreground,
        "editorBracketHighlight.foreground6": foreground,
        "editorBracketHighlight.unexpectedBracket.foreground": foreground,
        "editorLineNumber.foreground": lineNumberForeground,
        "editorLineNumber.activeForeground": activeLineNumberForeground,
        "editorWhitespace.foreground": guideForeground,
        "editorIndentGuide.background1": guideForeground,
        "editorIndentGuide.activeBackground1": activeGuideForeground,
        "editorBracketPairGuide.background1": guideForeground,
        "editorBracketPairGuide.background2": guideForeground,
        "editorBracketPairGuide.background3": guideForeground,
        "editorBracketPairGuide.background4": guideForeground,
        "editorBracketPairGuide.background5": guideForeground,
        "editorBracketPairGuide.background6": guideForeground,
        "editorBracketPairGuide.activeBackground1": activeGuideForeground,
        "editorBracketPairGuide.activeBackground2": activeGuideForeground,
        "editorBracketPairGuide.activeBackground3": activeGuideForeground,
        "editorBracketPairGuide.activeBackground4": activeGuideForeground,
        "editorBracketPairGuide.activeBackground5": activeGuideForeground,
        "editorBracketPairGuide.activeBackground6": activeGuideForeground,
      },
    })
  }

  hasRegisteredSidebarFilePreviewMonacoThemes = true
}
