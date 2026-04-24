import type {
  ConcreteThemeId,
  PierreThemeName,
  ResolvedAppearance,
  ThemeDefinition,
  ThemeId,
  ThemeTokens,
} from "./types"

const DEFAULT_TERMINAL_FONT_FAMILY =
  'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'

type ThemeSeed = {
  id: ConcreteThemeId
  label: string
  appearance: ResolvedAppearance
  background: string
  surface: string
  surfaceElevated: string
  foreground: string
  mutedForeground: string
  border: string
  input: string
  ring: string
  primary: string
  primaryForeground: string
  secondary?: string
  secondaryForeground?: string
  accent?: string
  accentForeground?: string
  destructive: string
  success: string
  warning: string
  info: string
  renamed: string
  ignored: string
  cta?: string
  ctaForeground?: string
  toggleOn?: string
  skillAccent?: string
  skillSurface?: string
  chart: [string, string, string, string, string]
  chatFileAccent?: string
  chatPlanAccent?: string
  chatApprovalEmphasis?: string
  userBubble?: string
  userBubbleForeground?: string
}

function mix(color: string, weight: number, background: string): string {
  return `color-mix(in oklab, ${color} ${weight}%, ${background})`
}

function withAlpha(color: string, alpha: number): string {
  return `color-mix(in oklab, ${color} ${alpha}%, transparent)`
}

function createMonacoTheme(seed: ThemeSeed): ThemeDefinition["monaco"] {
  const isDark = seed.appearance === "dark"
  const selection = isDark ? withAlpha(seed.primary, 28) : withAlpha(seed.primary, 20)
  const lineHighlight = isDark ? withAlpha(seed.foreground, 6) : withAlpha(seed.foreground, 4)

  return {
    id: `nucleus-${seed.id}`,
    base: isDark ? "vs-dark" : "vs",
    inherit: true,
    rules: [
      { token: "", foreground: seed.foreground.replace("#", "") },
      { token: "comment", foreground: seed.mutedForeground.replace("#", ""), fontStyle: "italic" },
      { token: "keyword", foreground: seed.primary.replace("#", "") },
      { token: "string", foreground: seed.success.replace("#", "") },
      { token: "number", foreground: seed.warning.replace("#", "") },
      { token: "delimiter", foreground: seed.foreground.replace("#", "") },
      { token: "type.identifier", foreground: seed.info.replace("#", "") },
      { token: "function", foreground: seed.renamed.replace("#", "") },
    ],
    colors: {
      "editor.background": seed.surface,
      "editor.foreground": seed.foreground,
      "editorLineNumber.foreground": withAlpha(seed.mutedForeground, 80),
      "editorLineNumber.activeForeground": seed.foreground,
      "editorCursor.foreground": seed.primary,
      "editor.selectionBackground": selection,
      "editor.lineHighlightBackground": lineHighlight,
      "editor.inactiveSelectionBackground": withAlpha(seed.primary, 14),
      "editorIndentGuide.background1": withAlpha(seed.foreground, 8),
      "editorIndentGuide.activeBackground1": withAlpha(seed.primary, 32),
      "editorWhitespace.foreground": withAlpha(seed.mutedForeground, 42),
      "editorWidget.background": seed.surfaceElevated,
      "editorWidget.border": seed.border,
      "editorGutter.background": seed.surface,
      "diffEditor.insertedTextBackground": withAlpha(seed.success, 18),
      "diffEditor.removedTextBackground": withAlpha(seed.destructive, 16),
      "diffEditor.insertedLineBackground": withAlpha(seed.success, 10),
      "diffEditor.removedLineBackground": withAlpha(seed.destructive, 10),
    },
  }
}

function createTheme(seed: ThemeSeed): ThemeDefinition {
  const isDark = seed.appearance === "dark"
  const border = mix(seed.foreground, isDark ? 18 : 14, seed.border)
  const input = mix(seed.foreground, isDark ? 18 : 12, seed.background)
  const secondary = seed.secondary ?? mix(seed.foreground, isDark ? 18 : 10, seed.background)
  const accent = seed.accent ?? mix(seed.primary, isDark ? 34 : 26, seed.surfaceElevated)
  const muted = mix(seed.foreground, isDark ? 14 : 10, seed.surface)
  const cta = seed.cta ?? seed.primary
  const skillAccent = seed.skillAccent ?? seed.primary
  const chatPlanAccent = seed.chatPlanAccent ?? seed.primary
  const chatApprovalEmphasis = seed.chatApprovalEmphasis ?? seed.warning
  const sidebar = mix(seed.foreground, isDark ? 5 : 2, seed.background)
  const sidebarAccent = mix(seed.foreground, isDark ? 13 : 7, seed.background)
  const mainContent = seed.background
  const terminal = mix(seed.foreground, isDark ? 4 : 1.8, seed.background)
  const userBubble = seed.userBubble ?? seed.primary
  const pierreTheme: PierreThemeName = isDark ? "pierre-dark" : "pierre-light"

  const tokens: ThemeTokens = {
    background: seed.background,
    foreground: seed.foreground,
    card: seed.surface,
    "card-foreground": seed.foreground,
    popover: seed.surfaceElevated,
    "popover-foreground": seed.foreground,
    primary: seed.primary,
    "primary-foreground": seed.primaryForeground,
    secondary,
    "secondary-foreground": seed.secondaryForeground ?? seed.foreground,
    muted,
    "muted-foreground": seed.mutedForeground,
    accent,
    "accent-foreground": seed.accentForeground ?? seed.foreground,
    destructive: seed.destructive,
    "destructive-foreground": isDark ? "#1a1114" : "#fff7f9",
    "destructive-surface": mix(seed.destructive, isDark ? 18 : 13, seed.background),
    "destructive-surface-foreground": isDark
      ? mix(seed.destructive, 86, "#ffffff")
      : mix(seed.destructive, 72, "#0f0a0b"),
    "destructive-border": mix(seed.destructive, isDark ? 34 : 22, seed.background),
    border,
    input,
    ring: seed.ring,
    cta,
    "cta-foreground": seed.ctaForeground ?? seed.primaryForeground,
    "toggle-on": seed.toggleOn ?? seed.primary,
    "skill-accent": skillAccent,
    "skill-icon": skillAccent,
    "skill-surface": seed.skillSurface ?? mix(skillAccent, isDark ? 20 : 14, seed.background),
    "chart-1": seed.chart[0],
    "chart-2": seed.chart[1],
    "chart-3": seed.chart[2],
    "chart-4": seed.chart[3],
    "chart-5": seed.chart[4],
    sidebar,
    "sidebar-foreground": seed.foreground,
    "sidebar-primary": seed.primary,
    "sidebar-primary-foreground": seed.primaryForeground,
    "sidebar-accent": sidebarAccent,
    "sidebar-accent-foreground": seed.foreground,
    "sidebar-glass": withAlpha(sidebar, isDark ? 84 : 70),
    "sidebar-glass-strong": withAlpha(sidebar, isDark ? 92 : 82),
    "sidebar-item-hover": mix(seed.foreground, isDark ? 16 : 10, seed.background),
    "sidebar-item-active": mix(seed.primary, isDark ? 34 : 24, seed.background),
    "sidebar-border": border,
    "sidebar-ring": seed.ring,
    "main-content": mainContent,
    "main-content-foreground": seed.foreground,
    "terminal-font-family": DEFAULT_TERMINAL_FONT_FAMILY,
    terminal,
    "terminal-foreground": seed.foreground,
    "terminal-cursor": seed.primary,
    "terminal-selection": withAlpha(seed.primary, isDark ? 24 : 20),
    "terminal-border": border,
    "chat-file-accent": seed.chatFileAccent ?? seed.info,
    "chat-plan-surface": mix(chatPlanAccent, isDark ? 16 : 10, seed.background),
    "chat-plan-border": mix(chatPlanAccent, isDark ? 34 : 24, seed.background),
    "chat-plan-accent": chatPlanAccent,
    "chat-plan-accent-foreground": isDark ? "#0f1118" : "#ffffff",
    "chat-approval-surface": mix(chatApprovalEmphasis, isDark ? 12 : 8, seed.background),
    "chat-approval-surface-strong": mix(chatApprovalEmphasis, isDark ? 18 : 12, seed.background),
    "chat-approval-border": mix(chatApprovalEmphasis, isDark ? 30 : 20, seed.background),
    "chat-approval-badge": mix(chatApprovalEmphasis, isDark ? 24 : 14, seed.background),
    "chat-approval-emphasis": chatApprovalEmphasis,
    "chat-approval-emphasis-foreground": isDark ? "#17120b" : "#fffaf2",
    "scrollbar-thumb": withAlpha(seed.mutedForeground, isDark ? 88 : 72),
    "message-user-bubble": userBubble,
    "message-user-bubble-foreground": seed.userBubbleForeground ?? seed.primaryForeground,
    success: seed.success,
    "success-foreground": isDark ? "#07170d" : "#f7fff9",
    "success-surface": mix(seed.success, isDark ? 20 : 14, seed.background),
    "success-surface-foreground": isDark
      ? mix(seed.success, 84, "#ffffff")
      : mix(seed.success, 70, "#0a100c"),
    "success-border": mix(seed.success, isDark ? 36 : 24, seed.background),
    warning: seed.warning,
    "warning-foreground": isDark ? "#191107" : "#fffaf2",
    "warning-surface": mix(seed.warning, isDark ? 18 : 12, seed.background),
    "warning-surface-foreground": isDark
      ? mix(seed.warning, 82, "#ffffff")
      : mix(seed.warning, 70, "#110d07"),
    "warning-border": mix(seed.warning, isDark ? 34 : 22, seed.background),
    info: seed.info,
    "info-foreground": isDark ? "#09131b" : "#f5fbff",
    "info-surface": mix(seed.info, isDark ? 18 : 12, seed.background),
    "info-surface-foreground": isDark
      ? mix(seed.info, 82, "#ffffff")
      : mix(seed.info, 70, "#071117"),
    "info-border": mix(seed.info, isDark ? 34 : 22, seed.background),
    "vcs-added": seed.success,
    "vcs-added-surface": mix(seed.success, isDark ? 18 : 12, seed.background),
    "vcs-modified": seed.warning,
    "vcs-modified-surface": mix(seed.warning, isDark ? 16 : 10, seed.background),
    "vcs-deleted": seed.destructive,
    "vcs-deleted-surface": mix(seed.destructive, isDark ? 16 : 10, seed.background),
    "vcs-renamed": seed.renamed,
    "vcs-renamed-surface": mix(seed.renamed, isDark ? 18 : 12, seed.background),
    "vcs-ignored": seed.ignored,
    "vcs-ignored-surface": mix(seed.ignored, isDark ? 18 : 12, seed.background),
    "vcs-ahead": seed.success,
    "vcs-behind": seed.info,
    "vcs-diverged": seed.destructive,
    "vcs-merged": seed.renamed,
    "vcs-pr-open": seed.success,
    "vcs-pr-closed": seed.ignored,
  }

  return {
    id: seed.id,
    label: seed.label,
    appearance: seed.appearance,
    tokens,
    monaco: createMonacoTheme(seed),
    adapters: {
      terminal: {
        usesCssVariables: true,
        backgroundVariable: "--terminal",
        foregroundVariable: "--terminal-foreground",
        cursorVariable: "--terminal-cursor",
      },
      diff: {
        pierreTheme,
      },
    },
  }
}

export const THEME_REGISTRY: Record<ConcreteThemeId, ThemeDefinition> = {
  "nucleus-light": createTheme({
    id: "nucleus-light",
    label: "Nucleus Light",
    appearance: "light",
    background: "#fcfcfd",
    surface: "#f7f7f8",
    surfaceElevated: "#ffffff",
    foreground: "#1c1d20",
    mutedForeground: "#6b6d76",
    border: "#dedfe3",
    input: "#f2f3f5",
    ring: "#7a7d88",
    primary: "#2f3f7f",
    primaryForeground: "#f8f9ff",
    destructive: "#c34a64",
    success: "#2d8a57",
    warning: "#bf7a2e",
    info: "#2f6ca8",
    renamed: "#7760c9",
    ignored: "#818491",
    skillAccent: "#6d53cf",
    skillSurface: "#ede8ff",
    chart: ["#6c8fe5", "#7f5af0", "#48a7a0", "#f29f67", "#a87ae8"],
    chatFileAccent: "#4a73c9",
    chatPlanAccent: "#5369d9",
    chatApprovalEmphasis: "#b67a20",
    userBubble: "#24262d",
    userBubbleForeground: "#f5f6f8",
  }),
  "nucleus-dark": createTheme({
    id: "nucleus-dark",
    label: "Nucleus Dark",
    appearance: "dark",
    background: "#16171a",
    surface: "#1c1d22",
    surfaceElevated: "#23252b",
    foreground: "#f4f5f8",
    mutedForeground: "#9b9faa",
    border: "#2f3138",
    input: "#23252b",
    ring: "#777c88",
    primary: "#b8c4ff",
    primaryForeground: "#14161d",
    destructive: "#ef6f8a",
    success: "#64c18d",
    warning: "#d7a35b",
    info: "#6fb1ff",
    renamed: "#b493ff",
    ignored: "#8a8f99",
    skillAccent: "#c3b1ff",
    skillSurface: "#2a2241",
    chart: ["#7ea2ff", "#8b6dff", "#5ec8bf", "#f4a96b", "#c398ff"],
    chatFileAccent: "#8db3ff",
    chatPlanAccent: "#8ba0ff",
    chatApprovalEmphasis: "#f0b95d",
    userBubble: "#2a2d36",
    userBubbleForeground: "#f5f6fb",
  }),
  "catppuccin-latte": createTheme({
    id: "catppuccin-latte",
    label: "Catppuccin Latte",
    appearance: "light",
    background: "#eff1f5",
    surface: "#e6e9ef",
    surfaceElevated: "#ffffff",
    foreground: "#4c4f69",
    mutedForeground: "#6c6f85",
    border: "#ccd0da",
    input: "#dce0e8",
    ring: "#7287fd",
    primary: "#7287fd",
    primaryForeground: "#eff1f5",
    destructive: "#d20f39",
    success: "#40a02b",
    warning: "#df8e1d",
    info: "#1e66f5",
    renamed: "#8839ef",
    ignored: "#8c8fa1",
    skillAccent: "#8839ef",
    skillSurface: "#efe3ff",
    chart: ["#7287fd", "#ea76cb", "#179299", "#df8e1d", "#8839ef"],
    chatFileAccent: "#1e66f5",
    chatPlanAccent: "#7287fd",
    chatApprovalEmphasis: "#df8e1d",
    userBubble: "#4c4f69",
    userBubbleForeground: "#eff1f5",
  }),
  "catppuccin-mocha": createTheme({
    id: "catppuccin-mocha",
    label: "Catppuccin Mocha",
    appearance: "dark",
    background: "#1e1e2e",
    surface: "#181825",
    surfaceElevated: "#313244",
    foreground: "#cdd6f4",
    mutedForeground: "#a6adc8",
    border: "#45475a",
    input: "#313244",
    ring: "#89b4fa",
    primary: "#89b4fa",
    primaryForeground: "#11111b",
    destructive: "#f38ba8",
    success: "#a6e3a1",
    warning: "#f9e2af",
    info: "#74c7ec",
    renamed: "#cba6f7",
    ignored: "#7f849c",
    skillAccent: "#cba6f7",
    skillSurface: "#332a4a",
    chart: ["#89b4fa", "#f5c2e7", "#94e2d5", "#fab387", "#cba6f7"],
    chatFileAccent: "#89dceb",
    chatPlanAccent: "#89b4fa",
    chatApprovalEmphasis: "#f9e2af",
    userBubble: "#313244",
    userBubbleForeground: "#eef4ff",
  }),
  "rose-pine-dawn": createTheme({
    id: "rose-pine-dawn",
    label: "Rosé Pine Dawn",
    appearance: "light",
    background: "#faf4ed",
    surface: "#fffaf3",
    surfaceElevated: "#fffefd",
    foreground: "#575279",
    mutedForeground: "#797593",
    border: "#dfdad9",
    input: "#f2e9e1",
    ring: "#907aa9",
    primary: "#907aa9",
    primaryForeground: "#faf4ed",
    destructive: "#b4637a",
    success: "#56949f",
    warning: "#ea9d34",
    info: "#286983",
    renamed: "#907aa9",
    ignored: "#9893a5",
    skillAccent: "#907aa9",
    skillSurface: "#efe6f7",
    chart: ["#56949f", "#907aa9", "#286983", "#ea9d34", "#d7827e"],
    chatFileAccent: "#286983",
    chatPlanAccent: "#907aa9",
    chatApprovalEmphasis: "#ea9d34",
    userBubble: "#575279",
    userBubbleForeground: "#faf4ed",
  }),
  "rose-pine-main": createTheme({
    id: "rose-pine-main",
    label: "Rosé Pine Main",
    appearance: "dark",
    background: "#191724",
    surface: "#1f1d2e",
    surfaceElevated: "#26233a",
    foreground: "#e0def4",
    mutedForeground: "#908caa",
    border: "#403d52",
    input: "#26233a",
    ring: "#c4a7e7",
    primary: "#c4a7e7",
    primaryForeground: "#191724",
    destructive: "#eb6f92",
    success: "#9ccfd8",
    warning: "#f6c177",
    info: "#31748f",
    renamed: "#c4a7e7",
    ignored: "#6e6a86",
    skillAccent: "#c4a7e7",
    skillSurface: "#312b45",
    chart: ["#9ccfd8", "#c4a7e7", "#31748f", "#f6c177", "#ebbcba"],
    chatFileAccent: "#9ccfd8",
    chatPlanAccent: "#c4a7e7",
    chatApprovalEmphasis: "#f6c177",
    userBubble: "#2a2440",
    userBubbleForeground: "#f6f3ff",
  }),
  "tokyo-night-day": createTheme({
    id: "tokyo-night-day",
    label: "Tokyo Night Day",
    appearance: "light",
    background: "#d5d6db",
    surface: "#e9e9ec",
    surfaceElevated: "#f9f9fb",
    foreground: "#3760bf",
    mutedForeground: "#6172b0",
    border: "#b7c5df",
    input: "#dfe3ea",
    ring: "#2e7de9",
    primary: "#2e7de9",
    primaryForeground: "#f9f9fb",
    destructive: "#f52a65",
    success: "#587539",
    warning: "#8c6c3e",
    info: "#2e7de9",
    renamed: "#9854f1",
    ignored: "#848cb5",
    skillAccent: "#9854f1",
    skillSurface: "#ece5ff",
    chart: ["#2e7de9", "#9854f1", "#007197", "#8c6c3e", "#f52a65"],
    chatFileAccent: "#2e7de9",
    chatPlanAccent: "#2e7de9",
    chatApprovalEmphasis: "#8c6c3e",
    userBubble: "#3760bf",
    userBubbleForeground: "#f8fbff",
  }),
  "tokyo-night-storm": createTheme({
    id: "tokyo-night-storm",
    label: "Tokyo Night Storm",
    appearance: "dark",
    background: "#1f2335",
    surface: "#24283b",
    surfaceElevated: "#292e42",
    foreground: "#c0caf5",
    mutedForeground: "#9aa5ce",
    border: "#3b4261",
    input: "#292e42",
    ring: "#7aa2f7",
    primary: "#7aa2f7",
    primaryForeground: "#1f2335",
    destructive: "#f7768e",
    success: "#9ece6a",
    warning: "#e0af68",
    info: "#7dcfff",
    renamed: "#bb9af7",
    ignored: "#565f89",
    skillAccent: "#bb9af7",
    skillSurface: "#322b4c",
    chart: ["#7aa2f7", "#bb9af7", "#7dcfff", "#e0af68", "#f7768e"],
    chatFileAccent: "#7dcfff",
    chatPlanAccent: "#7aa2f7",
    chatApprovalEmphasis: "#e0af68",
    userBubble: "#313758",
    userBubbleForeground: "#eef3ff",
  }),
  nord: createTheme({
    id: "nord",
    label: "Nord",
    appearance: "dark",
    background: "#2e3440",
    surface: "#3b4252",
    surfaceElevated: "#434c5e",
    foreground: "#eceff4",
    mutedForeground: "#d8dee9",
    border: "#4c566a",
    input: "#434c5e",
    ring: "#88c0d0",
    primary: "#88c0d0",
    primaryForeground: "#2e3440",
    destructive: "#bf616a",
    success: "#a3be8c",
    warning: "#ebcb8b",
    info: "#81a1c1",
    renamed: "#b48ead",
    ignored: "#616e88",
    skillAccent: "#b48ead",
    skillSurface: "#41384d",
    chart: ["#88c0d0", "#b48ead", "#81a1c1", "#ebcb8b", "#bf616a"],
    chatFileAccent: "#81a1c1",
    chatPlanAccent: "#88c0d0",
    chatApprovalEmphasis: "#ebcb8b",
    userBubble: "#4c566a",
    userBubbleForeground: "#f5f8fc",
  }),
  dracula: createTheme({
    id: "dracula",
    label: "Dracula",
    appearance: "dark",
    background: "#282a36",
    surface: "#2f3342",
    surfaceElevated: "#343746",
    foreground: "#f8f8f2",
    mutedForeground: "#9aa3cf",
    border: "#44475a",
    input: "#343746",
    ring: "#8be9fd",
    primary: "#bd93f9",
    primaryForeground: "#282a36",
    destructive: "#ff5555",
    success: "#50fa7b",
    warning: "#f1fa8c",
    info: "#8be9fd",
    renamed: "#ff79c6",
    ignored: "#6272a4",
    skillAccent: "#ff79c6",
    skillSurface: "#422c49",
    chart: ["#bd93f9", "#ff79c6", "#8be9fd", "#f1fa8c", "#50fa7b"],
    chatFileAccent: "#8be9fd",
    chatPlanAccent: "#bd93f9",
    chatApprovalEmphasis: "#f1fa8c",
    userBubble: "#44475a",
    userBubbleForeground: "#f8f8f2",
  }),
  "ayu-light": createTheme({
    id: "ayu-light",
    label: "Ayu Light",
    appearance: "light",
    background: "#f8f9fa",
    surface: "#fcfcfc",
    surfaceElevated: "#ffffff",
    foreground: "#5c6166",
    mutedForeground: "#828e9f",
    border: "#ebeef0",
    input: "#fcfcfc",
    ring: "#f29718",
    primary: "#f29718",
    primaryForeground: "#fffaf2",
    destructive: "#f07171",
    success: "#86b300",
    warning: "#fa8d3e",
    info: "#399ee6",
    renamed: "#a37acc",
    ignored: "#a0a6ac",
    skillAccent: "#a37acc",
    skillSurface: "#f1ebfb",
    chart: ["#399ee6", "#a37acc", "#4cbf99", "#fa8d3e", "#f07171"],
    chatFileAccent: "#399ee6",
    chatPlanAccent: "#f29718",
    chatApprovalEmphasis: "#fa8d3e",
    userBubble: "#5c6166",
    userBubbleForeground: "#fcfcfc",
  }),
  "ayu-mirage": createTheme({
    id: "ayu-mirage",
    label: "Ayu Mirage",
    appearance: "dark",
    background: "#1f2430",
    surface: "#242936",
    surfaceElevated: "#282e3b",
    foreground: "#cccac2",
    mutedForeground: "#707a8c",
    border: "#303744",
    input: "#282e3b",
    ring: "#ffcc66",
    primary: "#ffcc66",
    primaryForeground: "#1f2430",
    destructive: "#ff6666",
    success: "#87d96c",
    warning: "#ffcd66",
    info: "#73d0ff",
    renamed: "#dfbfff",
    ignored: "#6e7c8f",
    skillAccent: "#dfbfff",
    skillSurface: "#312b46",
    chart: ["#73d0ff", "#dfbfff", "#95e6cb", "#ffa659", "#f28779"],
    chatFileAccent: "#73d0ff",
    chatPlanAccent: "#ffcc66",
    chatApprovalEmphasis: "#ffa659",
    userBubble: "#303744",
    userBubbleForeground: "#fff8e6",
  }),
  "kanagawa-lotus": createTheme({
    id: "kanagawa-lotus",
    label: "Kanagawa Lotus",
    appearance: "light",
    background: "#f2ecbc",
    surface: "#e7dba0",
    surfaceElevated: "#d5cea3",
    foreground: "#545464",
    mutedForeground: "#716e61",
    border: "#dcd7ba",
    input: "#f4f1d0",
    ring: "#4d699b",
    primary: "#4d699b",
    primaryForeground: "#f9f7ec",
    destructive: "#c84053",
    success: "#6f894e",
    warning: "#e98a00",
    info: "#5a7785",
    renamed: "#624c83",
    ignored: "#8a8980",
    skillAccent: "#624c83",
    skillSurface: "#ece7f3",
    chart: ["#4d699b", "#624c83", "#597b75", "#e98a00", "#c84053"],
    chatFileAccent: "#4d699b",
    chatPlanAccent: "#624c83",
    chatApprovalEmphasis: "#e98a00",
    userBubble: "#545464",
    userBubbleForeground: "#f7f3e8",
  }),
  "kanagawa-dragon": createTheme({
    id: "kanagawa-dragon",
    label: "Kanagawa Dragon",
    appearance: "dark",
    background: "#181616",
    surface: "#282727",
    surfaceElevated: "#393836",
    foreground: "#c5c9c5",
    mutedForeground: "#a6a69c",
    border: "#625e5a",
    input: "#393836",
    ring: "#8ba4b0",
    primary: "#8ba4b0",
    primaryForeground: "#181616",
    destructive: "#c4746e",
    success: "#87a987",
    warning: "#c4b28a",
    info: "#658594",
    renamed: "#a292a3",
    ignored: "#9e9b93",
    skillAccent: "#a292a3",
    skillSurface: "#352f35",
    chart: ["#8ba4b0", "#a292a3", "#8ea4a2", "#c4b28a", "#c4746e"],
    chatFileAccent: "#8ba4b0",
    chatPlanAccent: "#a292a3",
    chatApprovalEmphasis: "#c4b28a",
    userBubble: "#393836",
    userBubbleForeground: "#f3f1ea",
  }),
}

export const CONCRETE_THEMES = Object.values(THEME_REGISTRY)

export const THEME_OPTIONS: Array<{ id: ThemeId; label: string }> = [
  { id: "system", label: "System" },
  ...CONCRETE_THEMES.map((theme) => ({ id: theme.id, label: theme.label })),
]

export const DEFAULT_THEME_ID: ThemeId = "system"
export const DEFAULT_TEXT_SIZE_PX = 13
export const MIN_TEXT_SIZE_PX = 12
export const MAX_TEXT_SIZE_PX = 16
export const TEXT_SIZE_STEP_PX = 1

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value === "system" || value in THEME_REGISTRY
}

export function clampTextSizePx(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_TEXT_SIZE_PX
  }

  return Math.min(MAX_TEXT_SIZE_PX, Math.max(MIN_TEXT_SIZE_PX, Math.round(value)))
}

export function resolveThemeIdForAppearance(appearance: ResolvedAppearance): ConcreteThemeId {
  return appearance === "dark" ? "nucleus-dark" : "nucleus-light"
}

export function getThemeDefinition(themeId: ConcreteThemeId): ThemeDefinition {
  return THEME_REGISTRY[themeId]
}
