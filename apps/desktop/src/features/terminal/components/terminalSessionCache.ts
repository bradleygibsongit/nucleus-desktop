import { WTerm } from "@wterm/dom"
import { desktop, type TerminalExitEvent } from "@/desktop/client"
import { shouldRecoverTerminal } from "./terminalRecovery"

export interface CachedTerminalEvent {
  type: "exit"
  event: TerminalExitEvent
}

export interface CachedTerminalSession {
  sessionId: string
  term: WTerm
  wrapper: HTMLDivElement
  initPromise: Promise<void>
  hasStartedInit: boolean
  pendingWrites: Array<string | Uint8Array>
  resizeObserver: ResizeObserver | null
  resizeRafId: number | null
  pendingResizeForce: boolean
  recoveryTimeoutIds: number[]
  cellMetrics: TerminalCellMetrics | null
  onResize: ((cols: number, rows: number) => void) | null
  lastCols: number
  lastRows: number
  scrollTop: number
  wasScrolledToBottom: boolean
  isAttached: boolean
  isReady: boolean
  isRestoringBuffer: boolean
  cwd: string | null
  listeners: Set<(event: CachedTerminalEvent) => void>
  dispose: () => void
}

const sessions = new Map<string, CachedTerminalSession>()
const MIN_RENDERABLE_TERMINAL_COLS = 10
const MIN_RENDERABLE_TERMINAL_ROWS = 2
const TERMINAL_RECOVERY_RETRY_DELAYS_MS = [50, 200]

interface TerminalCellMetrics {
  charWidth: number
  rowHeight: number
}

type WTermRowHeightShim = WTerm & { _rowHeight?: number }

interface WTermRendererShim {
  rows: number
  cols: number
  render: (bridge: NonNullable<WTerm["bridge"]>) => void
}

interface WTermSurfaceShim {
  bridge: WTerm["bridge"]
  renderer: WTermRendererShim | null
}

function resolveThemeColor(variableName: string, fallback: string) {
  const probe = document.createElement("div")
  probe.style.position = "absolute"
  probe.style.pointerEvents = "none"
  probe.style.opacity = "0"
  probe.style.backgroundColor = `var(${variableName})`
  document.body.appendChild(probe)

  const resolved = getComputedStyle(probe).backgroundColor.trim()
  probe.remove()

  return resolved || fallback
}

function resolveTerminalTheme() {
  const style = getComputedStyle(document.documentElement)

  return {
    background: resolveThemeColor("--terminal", "#111111"),
    foreground: resolveThemeColor("--terminal-foreground", "#d4d4d4"),
    cursor: resolveThemeColor("--terminal-cursor", "#f5f5f5"),
    selection: resolveThemeColor("--terminal-selection", "rgba(110, 110, 110, 0.4)"),
    fontFamily:
      style.getPropertyValue("--terminal-font-family").trim() ||
      'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    fontSize: style.getPropertyValue("--terminal-font-size").trim() || "13px",
    lineHeight: style.getPropertyValue("--terminal-line-height").trim() || "1.35",
  }
}

function applyTerminalSurfaceStyles(container: HTMLElement) {
  const theme = resolveTerminalTheme()

  container.style.backgroundColor = theme.background
  container.style.color = theme.foreground
  container.style.setProperty("--term-bg", theme.background)
  container.style.setProperty("--term-fg", theme.foreground)
  container.style.setProperty("--term-cursor", theme.cursor)
  container.style.setProperty("--term-font-family", theme.fontFamily)
  container.style.setProperty("--term-font-size", theme.fontSize)
  container.style.setProperty("--term-line-height", theme.lineHeight)
  container.style.setProperty("--nucleus-term-selection", theme.selection)
}

function waitForAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function isTerminalScrolledToBottom(container: HTMLElement) {
  return container.scrollHeight - container.scrollTop - container.clientHeight < 5
}

function scrollTerminalToBottom(container: HTMLElement) {
  const maxScrollTop = container.scrollHeight - container.clientHeight
  container.scrollTop = maxScrollTop > 0 ? maxScrollTop : 0
}

function getTerminalRenderState(container: HTMLElement) {
  const style = getComputedStyle(container)
  const bounds = container.getBoundingClientRect()

  return {
    isConnected: container.isConnected,
    display: style.display,
    visibility: style.visibility,
    width: bounds.width,
    height: bounds.height,
  }
}

function measureTerminalCell(session: CachedTerminalSession) {
  const grid = session.wrapper.querySelector(".term-grid")
  const measurementRoot = grid instanceof HTMLElement ? grid : session.wrapper
  const row = document.createElement("div")
  const probe = document.createElement("span")

  row.className = "term-row"
  row.style.visibility = "hidden"
  row.style.position = "absolute"
  row.style.pointerEvents = "none"
  probe.textContent = "W"

  row.appendChild(probe)
  measurementRoot.appendChild(row)

  const charWidth = probe.getBoundingClientRect().width
  const rowHeight = row.getBoundingClientRect().height
  row.remove()

  if (charWidth <= 0 || rowHeight <= 0) {
    return session.cellMetrics
  }

  const roundedRowHeight = Math.ceil(rowHeight)
  const metrics = { charWidth, rowHeight: roundedRowHeight }
  session.cellMetrics = metrics
  session.wrapper.style.setProperty("--term-row-height", `${roundedRowHeight}px`)
  const termWithInternals = session.term as WTermRowHeightShim
  termWithInternals._rowHeight = roundedRowHeight

  return metrics
}

function repaintTerminalSurface(session: CachedTerminalSession) {
  const terminal = session.term as unknown as WTermSurfaceShim
  if (!terminal.bridge || !terminal.renderer) {
    return
  }

  terminal.renderer.rows = 0
  terminal.renderer.cols = 0
  terminal.renderer.render(terminal.bridge)
}

function resizeTerminalToContainer(session: CachedTerminalSession, force = false) {
  if (!shouldRecoverTerminal(document.visibilityState, getTerminalRenderState(session.wrapper))) {
    return false
  }

  const metrics = measureTerminalCell(session)
  if (!metrics) {
    return false
  }

  const bounds = session.wrapper.getBoundingClientRect()
  const nextCols = Math.max(1, Math.floor(bounds.width / metrics.charWidth))
  const nextRows = Math.max(1, Math.floor(bounds.height / metrics.rowHeight))

  if (nextCols < MIN_RENDERABLE_TERMINAL_COLS || nextRows < MIN_RENDERABLE_TERMINAL_ROWS) {
    return false
  }

  if (session.term.cols === nextCols && session.term.rows === nextRows) {
    if (force) {
      const shouldStickToBottom = isTerminalScrolledToBottom(session.wrapper)
      const scrollTop = session.wrapper.scrollTop
      repaintTerminalSurface(session)
      requestAnimationFrame(() => {
        if (!session.isAttached) {
          return
        }

        if (shouldStickToBottom) {
          scrollTerminalToBottom(session.wrapper)
        } else {
          session.wrapper.scrollTop = scrollTop
        }
      })
    }
    return true
  }

  const shouldStickToBottom = isTerminalScrolledToBottom(session.wrapper)
  session.term.resize(nextCols, nextRows)
  session.lastCols = nextCols
  session.lastRows = nextRows
  session.onResize?.(nextCols, nextRows)

  if (shouldStickToBottom) {
    requestAnimationFrame(() => {
      if (session.isAttached) {
        scrollTerminalToBottom(session.wrapper)
      }
    })
  }

  return true
}

function scheduleTerminalResize(session: CachedTerminalSession, force = false) {
  if (!session.isAttached) {
    return
  }

  session.pendingResizeForce ||= force

  if (session.resizeRafId !== null) {
    return
  }

  session.resizeRafId = requestAnimationFrame(() => {
    session.resizeRafId = null
    const shouldForceResize = session.pendingResizeForce
    session.pendingResizeForce = false
    resizeTerminalToContainer(session, shouldForceResize)
  })
}

function clearTerminalRecoveryTimeouts(session: CachedTerminalSession) {
  for (const timeoutId of session.recoveryTimeoutIds) {
    window.clearTimeout(timeoutId)
  }

  session.recoveryTimeoutIds = []
}

function scheduleTerminalRecovery(session: CachedTerminalSession) {
  if (!session.isAttached) {
    return
  }

  clearTerminalRecoveryTimeouts(session)
  scheduleTerminalResize(session, true)

  session.recoveryTimeoutIds = TERMINAL_RECOVERY_RETRY_DELAYS_MS.map((delay) =>
    window.setTimeout(() => {
      scheduleTerminalResize(session, true)
    }, delay)
  )
}

function ensureTerminalResizeObserver(session: CachedTerminalSession) {
  if (session.resizeObserver) {
    return
  }

  session.resizeObserver = new ResizeObserver(() => {
    scheduleTerminalResize(session)
  })
  session.resizeObserver.observe(session.wrapper)
}

function writeToSession(session: CachedTerminalSession, data: string | Uint8Array) {
  if (!session.term.bridge) {
    session.pendingWrites.push(data)
    return
  }

  session.term.write(data)
}

function flushPendingWrites(session: CachedTerminalSession) {
  if (!session.term.bridge || session.pendingWrites.length === 0) {
    return
  }

  for (const chunk of session.pendingWrites) {
    session.term.write(chunk)
  }

  session.pendingWrites = []
}

function ensureTerminalInitialized(session: CachedTerminalSession) {
  if (session.hasStartedInit) {
    return session.initPromise
  }

  session.hasStartedInit = true
  session.initPromise = session.term.init().then(() => {
    session.wrapper.style.height = ""
    ensureTerminalResizeObserver(session)
    flushPendingWrites(session)
  })

  return session.initPromise
}

function createCachedTerminalSession(sessionId: string): CachedTerminalSession {
  const wrapper = document.createElement("div")
  wrapper.className = "nucleus-wterm-shell h-full min-h-0 w-full overflow-hidden bg-terminal"

  const listeners = new Set<(event: CachedTerminalEvent) => void>()

  const term = new WTerm(wrapper, {
    autoResize: false,
    cursorBlink: true,
    onData(data) {
      const current = sessions.get(sessionId)
      if (!current || current.isRestoringBuffer) {
        return
      }

      void desktop.terminal.write(sessionId, data).catch((error) => {
        console.error("Failed to write to terminal session:", error)
      })
    },
  })

  applyTerminalSurfaceStyles(wrapper)

  const dataCleanup = desktop.terminal.onData((event) => {
    if (event.sessionId !== sessionId) {
      return
    }

    const current = sessions.get(sessionId)
    if (!current) {
      return
    }

    writeToSession(current, event.data)
  })

  const exitCleanup = desktop.terminal.onExit((event) => {
    if (event.sessionId !== sessionId) {
      return
    }

    const current = sessions.get(sessionId)
    if (!current) {
      return
    }

    current.isReady = false
    current.isRestoringBuffer = false
    writeToSession(current, "\r\n\x1b[90mTerminal session ended. Reopen the project terminal to start a new shell.\x1b[0m\r\n")

    for (const listener of current.listeners) {
      listener({ type: "exit", event })
    }
  })

  const recoverTerminalSize = () => {
    if (document.visibilityState === "hidden") {
      return
    }

    const current = sessions.get(sessionId)
    if (current) {
      scheduleTerminalRecovery(current)
    }
  }

  window.addEventListener("focus", recoverTerminalSize)
  window.addEventListener("resize", recoverTerminalSize)
  document.addEventListener("visibilitychange", recoverTerminalSize)

  const dispose = () => {
    const current = sessions.get(sessionId)
    if (!current) {
      return
    }

    current.listeners.clear()
    if (current.resizeRafId !== null) {
      cancelAnimationFrame(current.resizeRafId)
      current.resizeRafId = null
    }
    current.pendingResizeForce = false
    clearTerminalRecoveryTimeouts(current)
    current.resizeObserver?.disconnect()
    current.resizeObserver = null
    window.removeEventListener("focus", recoverTerminalSize)
    window.removeEventListener("resize", recoverTerminalSize)
    document.removeEventListener("visibilitychange", recoverTerminalSize)
    dataCleanup()
    exitCleanup()
    current.wrapper.remove()
    current.term.destroy()
    sessions.delete(sessionId)
  }

  const session: CachedTerminalSession = {
    sessionId,
    term,
    wrapper,
    initPromise: Promise.resolve(),
    hasStartedInit: false,
    pendingWrites: [],
    resizeObserver: null,
    resizeRafId: null,
    pendingResizeForce: false,
    recoveryTimeoutIds: [],
    cellMetrics: null,
    onResize: null,
    lastCols: term.cols,
    lastRows: term.rows,
    scrollTop: 0,
    wasScrolledToBottom: true,
    isAttached: false,
    isReady: false,
    isRestoringBuffer: false,
    cwd: null,
    listeners,
    dispose,
  }

  sessions.set(sessionId, session)
  return session
}

export function getOrCreateCachedTerminalSession(sessionId: string): CachedTerminalSession {
  return sessions.get(sessionId) ?? createCachedTerminalSession(sessionId)
}

export async function attachCachedTerminalSession(
  sessionId: string,
  container: HTMLDivElement,
  onResize?: (cols: number, rows: number) => void
) {
  const session = getOrCreateCachedTerminalSession(sessionId)
  session.isAttached = true
  session.onResize = onResize ?? null
  container.appendChild(session.wrapper)
  applyTerminalSurfaceStyles(session.wrapper)
  await ensureTerminalInitialized(session)
  ensureTerminalResizeObserver(session)

  await waitForAnimationFrame()
  resizeTerminalToContainer(session, true)
  await waitForAnimationFrame()

  if (session.wasScrolledToBottom) {
    scrollTerminalToBottom(session.wrapper)
  } else {
    session.wrapper.scrollTop = session.scrollTop
  }
  session.wasScrolledToBottom = isTerminalScrolledToBottom(session.wrapper)

  session.term.focus()

  return session
}

export function recreateCachedTerminalSession(sessionId: string) {
  sessions.get(sessionId)?.dispose()
  return createCachedTerminalSession(sessionId)
}

export function getCachedTerminalSession(sessionId: string) {
  return sessions.get(sessionId) ?? null
}

export function updateCachedTerminalTheme(sessionId: string) {
  const session = sessions.get(sessionId)
  if (!session) {
    return
  }

  session.cellMetrics = null
  applyTerminalSurfaceStyles(session.wrapper)
  scheduleTerminalResize(session, true)
}

export function detachCachedTerminalSession(sessionId: string) {
  const session = sessions.get(sessionId)
  if (!session) {
    return
  }

  session.onResize = null
  session.isAttached = false
  if (session.resizeRafId !== null) {
    cancelAnimationFrame(session.resizeRafId)
    session.resizeRafId = null
  }
  session.pendingResizeForce = false
  clearTerminalRecoveryTimeouts(session)
  session.wasScrolledToBottom = isTerminalScrolledToBottom(session.wrapper)
  session.scrollTop = session.wrapper.scrollTop
  session.wrapper.remove()
}

export function subscribeCachedTerminalSession(
  sessionId: string,
  listener: (event: CachedTerminalEvent) => void
) {
  const session = getOrCreateCachedTerminalSession(sessionId)
  session.listeners.add(listener)

  return () => {
    session.listeners.delete(listener)
  }
}

export function writeCachedTerminalData(sessionId: string, data: string | Uint8Array) {
  const session = getOrCreateCachedTerminalSession(sessionId)
  writeToSession(session, data)
}

export function disposeCachedTerminalSession(sessionId: string) {
  sessions.get(sessionId)?.dispose()
}
