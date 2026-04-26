import { type FormEvent, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowSquareOut, CaretLeft, CaretRight, Globe, Refresh } from "@/components/icons"
import { desktop } from "@/desktop/client"
import { RightSidebarEmptyState } from "@/features/shared/components/layout/RightSidebarEmptyState"
import { Button } from "@/features/shared/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/features/shared/components/ui/input-group"
import { useCurrentProjectWorktree } from "@/features/shared/hooks"
import {
  getBrowserUrlForWorktree,
  useBrowserSidebarStore,
} from "../store/browserSidebarStore"

type BrowserWebviewElement = HTMLElement & {
  canGoBack: () => boolean
  canGoForward: () => boolean
  getTitle: () => string
  getURL: () => string
  goBack: () => void
  goForward: () => void
  isLoading: () => boolean
  reload: () => void
}

function isInteractiveWebview(value: HTMLElement | null): value is BrowserWebviewElement {
  if (!value) {
    return false
  }

  return (
    typeof (value as BrowserWebviewElement).getURL === "function" &&
    typeof (value as BrowserWebviewElement).getTitle === "function" &&
    typeof (value as BrowserWebviewElement).canGoBack === "function" &&
    typeof (value as BrowserWebviewElement).canGoForward === "function" &&
    typeof (value as BrowserWebviewElement).goBack === "function" &&
    typeof (value as BrowserWebviewElement).goForward === "function" &&
    typeof (value as BrowserWebviewElement).reload === "function"
  )
}

function resolveBrowserDestination(value: string): string | null {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  if (trimmedValue === "about:blank") {
    return trimmedValue
  }

  if (/\s/.test(trimmedValue)) {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmedValue)}`
  }

  try {
    const parsed = new URL(trimmedValue)
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString()
    }
    return null
  } catch {
    try {
      return new URL(`https://${trimmedValue}`).toString()
    } catch {
      return null
    }
  }
}

function resolveExternalBrowserUrl(value: string): string | null {
  const destination = resolveBrowserDestination(value)

  if (!destination || destination === "about:blank") {
    return null
  }

  try {
    const parsed = new URL(destination)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null
  } catch {
    return null
  }
}

interface BrowserSidebarProps {
  toolbarContainer?: HTMLElement | null
}

export function BrowserSidebar({ toolbarContainer }: BrowserSidebarProps) {
  const { selectedWorktreeId } = useCurrentProjectWorktree()
  const worktreeId = selectedWorktreeId ?? null
  const browserUrl = useBrowserSidebarStore((state) =>
    getBrowserUrlForWorktree(state.entriesByWorktreeId, worktreeId)
  )
  const setBrowserUrl = useBrowserSidebarStore((state) => state.setUrl)
  const webviewRef = useRef<HTMLElement | null>(null)
  const [addressValue, setAddressValue] = useState(browserUrl ?? "")
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isWebviewReady, setIsWebviewReady] = useState(false)

  useEffect(() => {
    setAddressValue(browserUrl ?? "")
  }, [browserUrl])

  useEffect(() => {
    if (!browserUrl) {
      setIsWebviewReady(false)
      setIsLoading(false)
      return
    }

    const element = webviewRef.current
    if (!element) {
      return
    }

    if (!isInteractiveWebview(element)) {
      setIsWebviewReady(false)
      setIsLoading(false)
      setLoadError(
        "The embedded browser is not ready yet. Fully restart the vFactor desktop app to enable this panel."
      )
      return
    }

    const webview = element

    const syncNavigationState = () => {
      try {
        const nextUrl = webview.getURL() || browserUrl
        setCanGoBack(webview.canGoBack())
        setCanGoForward(webview.canGoForward())
        setIsLoading(webview.isLoading())
        setAddressValue(nextUrl)
      } catch (error) {
        console.debug("[BrowserSidebar] webview state unavailable before dom-ready", error)
      }
    }

    const handleStartLoading = () => {
      setIsLoading(true)
      setLoadError(null)
      syncNavigationState()
    }

    const handleStopLoading = () => {
      setIsLoading(false)
      syncNavigationState()
    }

    const handleDidNavigate = () => {
      setLoadError(null)
      syncNavigationState()
    }

    const handleDomReady = () => {
      setIsWebviewReady(true)
      setLoadError(null)
      syncNavigationState()
    }

    const handlePageTitleUpdated = () => {
      syncNavigationState()
    }

    const handleLoadFailure = (event: Event & { errorCode?: number; errorDescription?: string }) => {
      if (event.errorCode === -3) {
        return
      }

      setIsLoading(false)
      setLoadError(event.errorDescription ?? "The page couldn't be loaded.")
      syncNavigationState()
    }

    setIsWebviewReady(false)
    setIsLoading(true)
    webview.addEventListener("dom-ready", handleDomReady)
    webview.addEventListener("did-start-loading", handleStartLoading)
    webview.addEventListener("did-stop-loading", handleStopLoading)
    webview.addEventListener("did-navigate", handleDidNavigate)
    webview.addEventListener("did-navigate-in-page", handleDidNavigate)
    webview.addEventListener("page-title-updated", handlePageTitleUpdated)
    webview.addEventListener("did-fail-load", handleLoadFailure as EventListener)

    return () => {
      webview.removeEventListener("dom-ready", handleDomReady)
      webview.removeEventListener("did-start-loading", handleStartLoading)
      webview.removeEventListener("did-stop-loading", handleStopLoading)
      webview.removeEventListener("did-navigate", handleDidNavigate)
      webview.removeEventListener("did-navigate-in-page", handleDidNavigate)
      webview.removeEventListener("page-title-updated", handlePageTitleUpdated)
      webview.removeEventListener("did-fail-load", handleLoadFailure as EventListener)
    }
  }, [browserUrl])

  if (!worktreeId) {
    return (
      <RightSidebarEmptyState
        title="No project selected"
        description="Choose a worktree to open the browser panel."
      />
    )
  }

  const navigate = (value: string) => {
    const destination = resolveBrowserDestination(value)

    if (!destination) {
      setLoadError("Enter a valid http(s) URL or search phrase.")
      return
    }

    setLoadError(null)
    setAddressValue(destination)
    setBrowserUrl(worktreeId, destination)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    navigate(addressValue)
  }
  const externalBrowserUrl = resolveExternalBrowserUrl(addressValue || browserUrl || "")

  const handleOpenExternal = async () => {
    if (!externalBrowserUrl) {
      return
    }

    try {
      await desktop.shell.openExternal(externalBrowserUrl)
    } catch (error) {
      console.error("[BrowserSidebar] Failed to open URL externally:", error)
      setLoadError("Unable to open this page in your default browser.")
    }
  }

  const browserToolbarButtonClassName =
    "size-8 border-sidebar-border bg-background text-foreground shadow-none hover:bg-[var(--sidebar-item-hover)] hover:text-foreground disabled:border-sidebar-border/80 disabled:bg-background disabled:text-foreground/72 disabled:opacity-100"
  const browserAddressButtonClassName =
    "text-foreground hover:bg-[var(--sidebar-item-hover)] hover:text-foreground disabled:text-foreground/68 disabled:opacity-100"

  const toolbar = (
    <form
      onSubmit={handleSubmit}
      className={toolbarContainer ? "h-8 min-w-0 flex-1" : "min-w-0 shrink-0 px-3"}
    >
      <div className="flex h-8 min-w-0 items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={browserToolbarButtonClassName}
          onClick={() => (webviewRef.current as BrowserWebviewElement | null)?.goBack()}
          disabled={!isWebviewReady || !canGoBack}
          aria-label="Go back"
        >
          <CaretLeft size={14} />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={browserToolbarButtonClassName}
          onClick={() => (webviewRef.current as BrowserWebviewElement | null)?.goForward()}
          disabled={!isWebviewReady || !canGoForward}
          aria-label="Go forward"
        >
          <CaretRight size={14} />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={browserToolbarButtonClassName}
          onClick={() => (webviewRef.current as BrowserWebviewElement | null)?.reload()}
          disabled={!isWebviewReady}
          aria-label="Refresh page"
        >
          <Refresh size={14} className={isLoading ? "animate-spin" : undefined} />
        </Button>
        <InputGroup className="h-8 min-w-0 flex-1 rounded-md border-sidebar-border bg-background text-foreground shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_5%,transparent)]">
          <InputGroupAddon align="inline-start" className="py-0 pl-2 pr-0 text-foreground">
            <InputGroupText className="text-foreground [&_svg:not([class*='size-'])]:size-3.5">
              <Globe size={14} />
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            className="h-8 px-1.5 py-0 text-sm text-foreground placeholder:text-foreground/62"
            value={addressValue}
            onChange={(event) => setAddressValue(event.target.value)}
            placeholder="Enter a URL or search the web"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <InputGroupAddon align="inline-end" className="gap-0.5 py-0 pr-1">
            <InputGroupButton
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Open in default browser"
              disabled={!externalBrowserUrl}
              onClick={() => void handleOpenExternal()}
              className={browserAddressButtonClassName}
            >
              <ArrowSquareOut size={14} />
            </InputGroupButton>
            <InputGroupButton
              type="submit"
              size="icon-xs"
              variant="ghost"
              aria-label="Go to address"
              className={browserAddressButtonClassName}
            >
              <CaretRight size={14} />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </form>
  )

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
      {toolbarContainer ? createPortal(toolbar, toolbarContainer) : toolbar}

      {loadError ? (
        <div className="mx-1.5 mt-1.5 shrink-0 rounded-xl border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-xs leading-5 text-destructive">
          {loadError}
        </div>
      ) : null}

      {browserUrl ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden border-t border-sidebar-border/70 bg-background shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <webview
            ref={webviewRef}
            src={browserUrl}
            partition="persist:vfactor-browser"
            className="h-full min-w-0 w-full bg-white"
          />
        </div>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 border-t border-sidebar-border/70 bg-background">
          <RightSidebarEmptyState
            title="Open a page"
            description="Enter a URL above to load a site in the browser panel."
          />
        </div>
      )}
    </div>
  )
}
