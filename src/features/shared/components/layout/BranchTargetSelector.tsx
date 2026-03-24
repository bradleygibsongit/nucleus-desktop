import { invoke } from "@tauri-apps/api/core"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  CaretDown,
  CaretRight,
  CheckCircle,
  GitBranch,
  MagnifyingGlass,
} from "@/components/icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/features/shared/components/ui"
import { cn } from "@/lib/utils"

interface BranchTargetSelectorProps {
  projectPath: string | null
}

interface GitBranchesResponse {
  currentBranch: string
  upstreamBranch: string | null
  branches: string[]
}

function resolveDefaultTargetBranch(data: GitBranchesResponse): string | null {
  const candidates = data.branches.filter((branch) => branch !== data.currentBranch)
  if (candidates.length === 0) {
    return null
  }

  if (data.upstreamBranch && candidates.includes(data.upstreamBranch)) {
    return data.upstreamBranch
  }

  const preferredBranches = ["origin/main", "main", "origin/master", "master"]
  const preferredMatch = preferredBranches.find((branch) => candidates.includes(branch))
  if (preferredMatch) {
    return preferredMatch
  }

  return candidates[0] ?? null
}

export function BranchTargetSelector({ projectPath }: BranchTargetSelectorProps) {
  const [branchData, setBranchData] = useState<GitBranchesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [targetBranch, setTargetBranch] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!projectPath) {
      setBranchData(null)
      setTargetBranch(null)
      setIsOpen(false)
      setSearchQuery("")
      return
    }

    setIsLoading(true)

    invoke<GitBranchesResponse>("get_git_branches", { projectPath })
      .then((data) => {
        if (cancelled) {
          return
        }

        setBranchData(data)
        setTargetBranch((current) => {
          if (current && data.branches.includes(current)) {
            return current
          }

          return resolveDefaultTargetBranch(data)
        })
      })
      .catch((error) => {
        if (cancelled) {
          return
        }

        console.warn("[BranchTargetSelector] Failed to load git branches:", error)
        setBranchData(null)
        setTargetBranch(null)
        setIsOpen(false)
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [projectPath])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }, 0)

    window.addEventListener("pointerdown", handlePointerDown)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  const availableTargetBranches = useMemo(() => {
    if (!branchData) {
      return []
    }

    const filtered = branchData.branches.filter((branch) => branch !== branchData.currentBranch)
    const normalizedQuery = searchQuery.trim().toLowerCase()

    if (!normalizedQuery) {
      return filtered
    }

    return filtered.filter((branch) => branch.toLowerCase().includes(normalizedQuery))
  }, [branchData, searchQuery])

  if (!projectPath) {
    return null
  }

  const currentBranchLabel = branchData?.currentBranch ?? "Loading branch..."
  const targetBranchLabel = targetBranch ?? (isLoading ? "Loading targets..." : "Select target branch")
  const canOpenTargetMenu = !isLoading && availableTargetBranches.length > 0

  return (
    <div ref={dropdownRef} className="relative hidden h-full min-w-0 items-center gap-3 md:flex">
      <div className="flex h-7 min-w-0 items-center gap-2 text-sm font-medium text-foreground">
        <GitBranch size={15} className="shrink-0 text-muted-foreground" />
        <span className="truncate">{currentBranchLabel}</span>
      </div>

      <CaretRight size={14} className="shrink-0 text-muted-foreground/80" />

      <button
        type="button"
        onClick={() => {
          if (!canOpenTargetMenu) {
            return
          }

          setSearchQuery("")
          setIsOpen((current) => !current)
        }}
        disabled={!canOpenTargetMenu}
        className={cn(
          "inline-flex h-7 max-w-[240px] items-center gap-1.5 rounded-lg px-2 text-sm transition-colors",
          canOpenTargetMenu
            ? "text-muted-foreground hover:bg-muted hover:text-foreground"
            : "cursor-default text-muted-foreground/70",
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="truncate">{targetBranchLabel}</span>
        {canOpenTargetMenu ? <CaretDown size={14} className="shrink-0" /> : null}
      </button>

      {isOpen ? (
        <div className="absolute top-[calc(100%+6px)] left-0 z-50 w-[300px] overflow-hidden rounded-xl border border-sidebar-border bg-popover shadow-md ring-1 ring-foreground/10">
          <div className="border-b border-sidebar-border p-2">
            <InputGroup className="h-8 rounded-lg border-input/80 bg-input/30">
              <InputGroupAddon className="pl-2 text-muted-foreground">
                <MagnifyingGlass size={16} />
              </InputGroupAddon>
              <InputGroupInput
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Select target branch..."
                className="h-full px-0 text-sm"
              />
            </InputGroup>
          </div>

          <div className="max-h-72 overflow-y-auto p-1">
            {availableTargetBranches.length > 0 ? (
              <div className="space-y-0.5">
                {availableTargetBranches.map((branch) => {
                  const isSelected = branch === targetBranch

                  return (
                    <button
                      key={branch}
                      type="button"
                      onClick={() => {
                        setTargetBranch(branch)
                        setIsOpen(false)
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                        isSelected
                          ? "bg-muted text-foreground"
                          : "text-foreground/92 hover:bg-muted/70",
                      )}
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center">
                        {isSelected ? (
                          <CheckCircle size={14} className="text-foreground" />
                        ) : null}
                      </span>
                      <span className="truncate">{branch}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No matching branches found.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
