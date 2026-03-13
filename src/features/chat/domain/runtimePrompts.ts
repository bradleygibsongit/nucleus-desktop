import type {
  RuntimePrompt,
  RuntimePromptQuestion,
  RuntimePromptResponse,
  RuntimePromptState,
} from "../types"

export function isRuntimePromptQuestionAnswered(
  question: RuntimePromptQuestion,
  value: string | string[] | undefined,
  customValue?: string
): boolean {
  const normalizedCustomValue = customValue?.trim() ?? ""
  if (normalizedCustomValue.length > 0) {
    return true
  }

  if (!question.required) {
    return true
  }

  if (question.kind === "multi_select") {
    return Array.isArray(value) && value.length > 0
  }

  return typeof value === "string" && value.trim().length > 0
}

export function serializeRuntimePromptResponse(
  prompt: RuntimePrompt,
  answers: Record<string, string | string[]>,
  customAnswers: Record<string, string>
): string {
  const lines: string[] = []

  for (const question of prompt.questions) {
    const value = answers[question.id]
    const customValue = customAnswers[question.id]?.trim() ?? ""

  if (question.kind === "multi_select") {
    const selected = Array.isArray(value) ? value : []
    const parts = [...selected]
    if (customValue) {
      parts.push(customValue)
      }
      lines.push(`${question.label}: ${parts.length > 0 ? parts.join(", ") : "No response"}`)
      continue
    }

    const selectedText =
      typeof value === "string" && value.trim().length > 0 ? value.trim() : ""
    const text =
      question.kind === "text"
        ? customValue
        : selectedText && customValue
          ? `${selectedText}, note: ${customValue}`
          : selectedText || customValue

    lines.push(`${question.label}: ${text || "No response"}`)
  }

  return lines.join("\n")
}

export function createRuntimePromptResponse(
  prompt: RuntimePrompt,
  answers: Record<string, string | string[]>,
  customAnswers: Record<string, string>
): RuntimePromptResponse {
  return {
    promptId: prompt.id,
    answers,
    customAnswers,
    text: serializeRuntimePromptResponse(prompt, answers, customAnswers),
  }
}

export function createActiveRuntimePromptState(prompt: RuntimePrompt): RuntimePromptState {
  const now = Date.now()

  return {
    prompt,
    status: "active",
    createdAt: now,
    updatedAt: now,
  }
}

export function normalizeRuntimePrompt(prompt: RuntimePrompt | null | undefined): RuntimePrompt | null {
  if (!prompt || !prompt.id || !prompt.title || !Array.isArray(prompt.questions)) {
    return null
  }

  return {
    ...prompt,
    body: prompt.body ?? undefined,
    questions: prompt.questions.map((question) => ({
      ...question,
      description: question.description ?? undefined,
      allowOther: question.allowOther ?? undefined,
      isSecret: question.isSecret ?? undefined,
      options: question.options?.map((option) => ({
        ...option,
        description: option.description ?? undefined,
      })),
    })),
  }
}
