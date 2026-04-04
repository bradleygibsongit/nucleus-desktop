import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { getHarnessAdapter } from "@/features/chat/runtime/harnesses"
import { ChevronDownIcon } from "@/components/icons"
import type { RuntimeModel } from "@/features/chat/types"
import type { SettingsSectionId } from "@/features/settings/config"
import { useSettingsStore } from "@/features/settings/store/settingsStore"
import { Button } from "@/features/shared/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/features/shared/components/ui/collapsible"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/features/shared/components/ui/field"
import { SearchableSelect } from "@/features/shared/components/ui/searchable-select"
import { Textarea } from "@/features/shared/components/ui/textarea"
import { UpdatesSection } from "@/features/updates/components/UpdatesSection"
import {
  GIT_RESOLVE_REASONS,
  GIT_RESOLVE_TEMPLATE_VARIABLES,
} from "@/features/shared/components/layout/gitResolve"
import type { GitPullRequestResolveReason } from "@/desktop/contracts"

interface SettingsPageProps {
  activeSection: SettingsSectionId
}

const SECTION_COPY: Record<SettingsSectionId, { title: string }> = {
  git: { title: "Git" },
  updates: { title: "Updates" },
}

const RESOLVE_REASON_LABELS: Record<GitPullRequestResolveReason, string> = {
  conflicts: "Conflicts",
  behind: "Behind base branch",
  failed_checks: "Failed checks",
  blocked: "Blocked",
  draft: "Draft PR",
  unknown: "Unknown reason",
}

function GitSettingsSection() {
  const gitGenerationModel = useSettingsStore((state) => state.gitGenerationModel)
  const gitResolvePrompts = useSettingsStore((state) => state.gitResolvePrompts)
  const workspaceSetupModel = useSettingsStore((state) => state.workspaceSetupModel)
  const hasLoaded = useSettingsStore((state) => state.hasLoaded)
  const initialize = useSettingsStore((state) => state.initialize)
  const setGitGenerationModel = useSettingsStore((state) => state.setGitGenerationModel)
  const setGitResolvePrompt = useSettingsStore((state) => state.setGitResolvePrompt)
  const resetGitResolvePrompts = useSettingsStore((state) => state.resetGitResolvePrompts)
  const resetGitGenerationModel = useSettingsStore((state) => state.resetGitGenerationModel)
  const setWorkspaceSetupModel = useSettingsStore((state) => state.setWorkspaceSetupModel)
  const resetWorkspaceSetupModel = useSettingsStore((state) => state.resetWorkspaceSetupModel)
  const [availableModels, setAvailableModels] = useState<RuntimeModel[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [openResolvePrompts, setOpenResolvePrompts] = useState<
    Partial<Record<GitPullRequestResolveReason, boolean>>
  >({})
  const isSettingsLoading = !hasLoaded

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setIsLoadingModels(true)
      setLoadError(null)

      try {
        const models = await getHarnessAdapter("codex").listModels()
        if (!cancelled) {
          setAvailableModels(models)
        }
      } catch (error) {
        console.error("[SettingsPage] Failed to load Codex models:", error)
        if (!cancelled) {
          setAvailableModels([])
          setLoadError(error instanceof Error ? error.message : "Unable to load models")
        }
      } finally {
        if (!cancelled) {
          setIsLoadingModels(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const defaultModel = useMemo(
    () => availableModels.find((model) => model.isDefault) ?? null,
    [availableModels]
  )

  const modelOptions = useMemo(() => {
    const opts = availableModels.map((m) => ({ value: m.id, label: m.id }))

    if (gitGenerationModel && !opts.some((o) => o.value === gitGenerationModel)) {
      opts.unshift({ value: gitGenerationModel, label: gitGenerationModel })
    }

    if (workspaceSetupModel && !opts.some((o) => o.value === workspaceSetupModel)) {
      opts.unshift({ value: workspaceSetupModel, label: workspaceSetupModel })
    }

    return opts
  }, [availableModels, gitGenerationModel, workspaceSetupModel])

  return (
    <section className="rounded-xl border border-border/80 bg-card text-card-foreground shadow-sm">
      <div className="px-4 py-4">
        <FieldGroup className="gap-3">
          <Field>
            <FieldTitle>Workspace setup model</FieldTitle>
            <SearchableSelect
              value={workspaceSetupModel || null}
              onValueChange={setWorkspaceSetupModel}
              options={modelOptions}
              placeholder={defaultModel ? defaultModel.id : "Select a model"}
              searchPlaceholder="Search models"
              emptyMessage="No matching models found."
              disabled={isSettingsLoading || isLoadingModels}
              className="mt-2"
              errorMessage={loadError}
              statusMessage={
                isSettingsLoading ? "Loading saved settings…" : isLoadingModels ? "Loading models…" : null
              }
            />
          </Field>

          <Field>
            <FieldTitle>Generation model</FieldTitle>
            <SearchableSelect
              value={gitGenerationModel || null}
              onValueChange={setGitGenerationModel}
              options={modelOptions}
              placeholder={defaultModel ? defaultModel.id : "Select a model"}
              searchPlaceholder="Search models"
              emptyMessage="No matching models found."
              disabled={isSettingsLoading || isLoadingModels}
              className="mt-2"
              errorMessage={loadError}
              statusMessage={
                isSettingsLoading ? "Loading saved settings…" : isLoadingModels ? "Loading models…" : null
              }
            />
          </Field>
        </FieldGroup>

        <div className="mt-6 space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-card-foreground">Resolve prompts</h2>
            <p className="text-sm text-muted-foreground">
              These prompts are used when the header shows <span className="font-medium text-card-foreground">Resolve</span> for a blocked PR state.
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              Variables:{" "}
              {GIT_RESOLVE_TEMPLATE_VARIABLES.map((variable, index) => (
                <span key={variable}>
                  <code>{`{{${variable}}}`}</code>
                  {index < GIT_RESOLVE_TEMPLATE_VARIABLES.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          </div>

          <FieldGroup className="gap-4">
            {GIT_RESOLVE_REASONS.map((reason) => (
              <Collapsible
                key={reason}
                open={openResolvePrompts[reason] === true}
                onOpenChange={(open) =>
                  setOpenResolvePrompts((current) => ({
                    ...current,
                    [reason]: open,
                  }))
                }
              >
                <div className="rounded-lg border border-border/70 bg-background/40">
                  <CollapsibleTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-between rounded-lg px-3 py-3 text-left"
                      />
                    }
                  >
                    <span className="flex flex-col items-start gap-1">
                      <span className="text-sm font-medium text-card-foreground">
                        {RESOLVE_REASON_LABELS[reason]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Edit the prompt sent when GitHub reports this Resolve state.
                      </span>
                    </span>
                    <ChevronDownIcon className="size-4 shrink-0 transition-transform in-aria-[expanded=false]:-rotate-90" />
                  </CollapsibleTrigger>

                  <CollapsibleContent className="border-t border-border/70 px-3 py-3">
                    <Field>
                      <FieldDescription>
                        This prompt will be sent when GitHub reports this PR as needing the matching Resolve flow.
                      </FieldDescription>
                      <Textarea
                        className="mt-2 min-h-32 font-mono text-xs leading-5"
                        value={gitResolvePrompts[reason]}
                        onChange={(event) => setGitResolvePrompt(reason, event.target.value)}
                        disabled={isSettingsLoading}
                        spellCheck={false}
                      />
                    </Field>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </FieldGroup>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={resetGitResolvePrompts} disabled={isSettingsLoading}>
            Reset resolve prompts
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={resetWorkspaceSetupModel} disabled={isSettingsLoading}>
            Reset setup model
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={resetGitGenerationModel} disabled={isSettingsLoading}>
            Reset generation model
          </Button>
        </div>
      </div>
    </section>
  )
}

export function SettingsPage({ activeSection }: SettingsPageProps) {
  const section = SECTION_COPY[activeSection]

  return (
    <section className="h-full overflow-y-auto bg-main-content px-4 py-4 text-main-content-foreground sm:px-5">
      <div className="mx-auto flex max-w-[860px] flex-col gap-4 pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            <h1 className="px-1 pt-1 text-2xl font-medium tracking-tight text-main-content-foreground">
              {section.title}
            </h1>

            {activeSection === "git" ? <GitSettingsSection /> : <UpdatesSection />}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
