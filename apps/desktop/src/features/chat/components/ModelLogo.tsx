import { Circle } from "@/components/icons"
import { cn } from "@/lib/utils"
import claudeColorUrl from "@/assets/brands/claude-color.svg"
import opencodeLightUrl from "@/assets/brands/opencode.svg"
import opencodeDarkUrl from "@/assets/brands/opencode-dark.svg"
import openAiSymbolLightUrl from "@/assets/brands/openai-symbol-light.svg"
import openAiSymbolDarkUrl from "@/assets/brands/openai-symbol-dark.svg"

export type ModelLogoKind = "openai" | "claude" | "codex" | "opencode" | "default"

function OpenAILogo({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} aria-hidden="true">
      <img src={openAiSymbolLightUrl} alt="" className="size-full scale-[0.82] object-contain dark:hidden" />
      <img src={openAiSymbolDarkUrl} alt="" className="hidden size-full scale-[0.82] object-contain dark:block" />
    </span>
  )
}

function ClaudeLogo({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} aria-hidden="true">
      <img src={claudeColorUrl} alt="" className="size-full scale-[0.8] object-contain" />
    </span>
  )
}

function CodexLogo({ className }: { className?: string }) {
  return <OpenAILogo className={className} />
}

function OpenCodeLogo({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} aria-hidden="true">
      <img src={opencodeLightUrl} alt="" className="size-full object-contain dark:hidden" />
      <img src={opencodeDarkUrl} alt="" className="hidden size-full object-contain dark:block" />
    </span>
  )
}

export function ModelLogo({ kind, className }: { kind: ModelLogoKind; className?: string }) {
  if (kind === "openai") {
    return <OpenAILogo className={className} />
  }

  if (kind === "claude") {
    return <ClaudeLogo className={className} />
  }

  if (kind === "codex") {
    return <CodexLogo className={className} />
  }

  if (kind === "opencode") {
    return <OpenCodeLogo className={className} />
  }

  return <Circle className={className} />
}

export function getModelLogoKind(
  value: string,
  selectedHarnessId: "codex" | "claude-code" | "opencode" | null
): ModelLogoKind {
  const normalized = value.toLowerCase()

  if (selectedHarnessId === "claude-code") {
    return "claude"
  }

  if (selectedHarnessId === "codex") {
    return "codex"
  }

  if (selectedHarnessId === "opencode") {
    return "opencode"
  }

  if (normalized.includes("claude")) {
    return "claude"
  }

  if (
    normalized.includes("gpt") ||
    normalized.includes("openai") ||
    /^o\d/.test(normalized) ||
    /^o[1-9]-/.test(normalized)
  ) {
    return "openai"
  }

  if (normalized.includes("codex")) {
    return "codex"
  }

  return "default"
}

export function getHarnessLogoKind(
  harnessId: "codex" | "claude-code" | "opencode"
): ModelLogoKind {
  if (harnessId === "claude-code") {
    return "claude"
  }

  if (harnessId === "codex") {
    return "codex"
  }

  if (harnessId === "opencode") {
    return "opencode"
  }

  return "default"
}
