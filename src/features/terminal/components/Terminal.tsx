import { useEffect, useRef, useCallback } from "react"
import { Terminal as XTerm } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { cn } from "@/lib/utils"
import "@xterm/xterm/css/xterm.css"

interface TerminalProps {
  className?: string
}

function getTerminalTheme() {
  const style = getComputedStyle(document.documentElement)
  return {
    background: style.getPropertyValue("--terminal").trim() || "#09090b",
    foreground: style.getPropertyValue("--terminal-foreground").trim() || "#a1a1aa",
    cursor: style.getPropertyValue("--terminal-cursor").trim() || "#a1a1aa",
    cursorAccent: style.getPropertyValue("--terminal").trim() || "#09090b",
    selectionBackground: style.getPropertyValue("--terminal-selection").trim() || "#3f3f46",
  }
}

export function Terminal({ className }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  const updateTheme = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = getTerminalTheme()
    }
  }, [])

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return

    const term = new XTerm({
      theme: getTerminalTheme(),
      fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "block",
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    term.open(terminalRef.current)
    fitAddon.fit()

    // Write some demo content
    term.writeln("\x1b[90m$ \x1b[0mbun run dev")
    term.writeln("\x1b[32m✓\x1b[0m Started development server")
    term.writeln("\x1b[90m  Local:   \x1b[36mhttp://localhost:1420/\x1b[0m")
    term.writeln("")
    term.write("\x1b[90m$ \x1b[0m")

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
    })
    resizeObserver.observe(terminalRef.current)

    return () => {
      resizeObserver.disconnect()
      term.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [])

  // Listen for theme changes (class or style attribute changes on <html>)
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === "class" || mutation.attributeName === "style") {
          updateTheme()
        }
      }
    })

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] })

    return () => observer.disconnect()
  }, [updateTheme])

  return (
    <div className={cn("bg-terminal p-3", className)}>
      <div ref={terminalRef} className="h-full" />
    </div>
  )
}
