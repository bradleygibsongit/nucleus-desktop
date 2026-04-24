import { useCallback, useEffect, useMemo, useState } from "react"
import {
  createRuntimeApprovalResponse,
  createRuntimePromptResponse,
  isRuntimeApprovalPrompt,
  isRuntimePromptQuestionAnswered,
  isRuntimeQuestionPrompt,
} from "../../domain/runtimePrompts"
import type {
  RuntimeApprovalPrompt,
  RuntimePrompt,
  RuntimePromptQuestion,
  RuntimePromptResponse,
  RuntimeQuestionPrompt,
} from "../../types"

interface UseRuntimePromptStateArgs {
  prompt?: RuntimePrompt | null
  onAnswerPrompt?: (response: RuntimePromptResponse) => void
  onDismissPrompt?: () => void
}

interface RuntimePromptStateResult {
  activeApprovalPrompt: RuntimeApprovalPrompt | null
  activeQuestionPrompt: RuntimeQuestionPrompt | null
  currentPromptQuestion: RuntimePromptQuestion | null
  currentPromptQuestionAnswered: boolean
  currentPromptQuestionIndex: number
  handleApprovePrompt: () => void
  handleDenyPrompt: () => void
  handleDismissPrompt: () => void
  handleGoToNextPromptQuestion: () => void
  handleGoToPreviousPromptQuestion: () => void
  handlePromptAnswerChange: (questionId: string, value: string | string[]) => void
  handlePromptCustomAnswerChange: (questionId: string, value: string) => void
  handlePromptCustomAnswerFocus: (questionId: string) => void
  isFirstPromptQuestion: boolean
  isLastPromptQuestion: boolean
  isPromptActive: boolean
  promptAnswers: Record<string, string | string[]>
  promptCtaLabel: string
  promptCustomAnswers: Record<string, string>
  promptProgressLabel: string | null
  submitActivePrompt: () => boolean
}

export function useRuntimePromptState({
  prompt,
  onAnswerPrompt,
  onDismissPrompt,
}: UseRuntimePromptStateArgs): RuntimePromptStateResult {
  const [promptAnswers, setPromptAnswers] = useState<Record<string, string | string[]>>({})
  const [promptCustomAnswers, setPromptCustomAnswers] = useState<Record<string, string>>({})
  const [currentPromptQuestionIndex, setCurrentPromptQuestionIndex] = useState(0)

  const activeQuestionPrompt = isRuntimeQuestionPrompt(prompt) ? prompt : null
  const activeApprovalPrompt = isRuntimeApprovalPrompt(prompt) ? prompt : null
  const isPromptActive = !!prompt
  const currentPromptQuestion = activeQuestionPrompt?.questions[currentPromptQuestionIndex] ?? null
  const currentPromptQuestionAnswered = currentPromptQuestion
    ? isRuntimePromptQuestionAnswered(
        currentPromptQuestion,
        promptAnswers[currentPromptQuestion.id],
        promptCustomAnswers[currentPromptQuestion.id]
      )
    : false
  const isLastPromptQuestion = activeQuestionPrompt
    ? currentPromptQuestionIndex === activeQuestionPrompt.questions.length - 1
    : false
  const isFirstPromptQuestion = currentPromptQuestionIndex === 0
  const promptProgressLabel = activeQuestionPrompt
    ? `${currentPromptQuestionIndex + 1} of ${activeQuestionPrompt.questions.length}`
    : null
  const promptCtaLabel = isLastPromptQuestion ? "Submit" : "Continue"

  useEffect(() => {
    setPromptAnswers({})
    setPromptCustomAnswers({})
    setCurrentPromptQuestionIndex(0)
  }, [prompt?.id])

  useEffect(() => {
    if (
      !currentPromptQuestion ||
      currentPromptQuestion.kind !== "single_select" ||
      !currentPromptQuestion.options?.length
    ) {
      return
    }

    const existingAnswer = promptAnswers[currentPromptQuestion.id]
    const existingCustomAnswer = promptCustomAnswers[currentPromptQuestion.id]?.trim()
    if (
      (typeof existingAnswer === "string" && existingAnswer.trim().length > 0) ||
      (Array.isArray(existingAnswer) && existingAnswer.length > 0) ||
      existingCustomAnswer
    ) {
      return
    }

    setPromptAnswers((current) => ({
      ...current,
      [currentPromptQuestion.id]: currentPromptQuestion.options?.[0]?.label ?? "",
    }))
  }, [currentPromptQuestion, promptAnswers, promptCustomAnswers])

  const handlePromptAnswerChange = useCallback(
    (questionId: string, value: string | string[]) => {
      setPromptAnswers((current) => ({
        ...current,
        [questionId]: value,
      }))

      if (
        activeQuestionPrompt &&
        currentPromptQuestion &&
        currentPromptQuestion.id === questionId &&
        currentPromptQuestion.kind === "single_select" &&
        !currentPromptQuestion.allowOther &&
        isRuntimePromptQuestionAnswered(
          currentPromptQuestion,
          value,
          promptCustomAnswers[currentPromptQuestion.id]
        ) &&
        !isLastPromptQuestion
      ) {
        setCurrentPromptQuestionIndex((index) =>
          Math.min(index + 1, activeQuestionPrompt.questions.length - 1)
        )
      }
    },
    [activeQuestionPrompt, currentPromptQuestion, isLastPromptQuestion, promptCustomAnswers]
  )

  const handlePromptCustomAnswerChange = useCallback(
    (questionId: string, value: string) => {
      const question = activeQuestionPrompt?.questions.find(
        (candidate) => candidate.id === questionId
      )

      setPromptCustomAnswers((current) => ({
        ...current,
        [questionId]: value,
      }))

      if (question?.kind === "single_select" && question.allowOther) {
        setPromptAnswers((current) => ({
          ...current,
          [questionId]: "",
        }))
      }
    },
    [activeQuestionPrompt]
  )

  const handlePromptCustomAnswerFocus = useCallback(
    (questionId: string) => {
      const question = activeQuestionPrompt?.questions.find(
        (candidate) => candidate.id === questionId
      )

      if (!question?.allowOther) {
        return
      }

      setPromptAnswers((current) => {
        if (question.kind === "multi_select") {
          return {
            ...current,
            [questionId]: [],
          }
        }

        return {
          ...current,
          [questionId]: "",
        }
      })
    },
    [activeQuestionPrompt]
  )

  const handleDismissPrompt = useCallback(() => {
    onDismissPrompt?.()
  }, [onDismissPrompt])

  const handleApprovePrompt = useCallback(() => {
    if (!activeApprovalPrompt) {
      return
    }

    onAnswerPrompt?.(createRuntimeApprovalResponse(activeApprovalPrompt, "approve"))
  }, [activeApprovalPrompt, onAnswerPrompt])

  const handleDenyPrompt = useCallback(() => {
    if (!activeApprovalPrompt) {
      handleDismissPrompt()
      return
    }

    onAnswerPrompt?.(createRuntimeApprovalResponse(activeApprovalPrompt, "deny"))
  }, [activeApprovalPrompt, handleDismissPrompt, onAnswerPrompt])

  const handleGoToPreviousPromptQuestion = useCallback(() => {
    setCurrentPromptQuestionIndex((index) => Math.max(index - 1, 0))
  }, [])

  const handleGoToNextPromptQuestion = useCallback(() => {
    if (!activeQuestionPrompt) {
      return
    }

    setCurrentPromptQuestionIndex((index) =>
      Math.min(index + 1, activeQuestionPrompt.questions.length - 1)
    )
  }, [activeQuestionPrompt])

  const submitActivePrompt = useCallback(() => {
    if (activeApprovalPrompt) {
      return true
    }

    if (!activeQuestionPrompt) {
      return false
    }

    if (!currentPromptQuestion || !currentPromptQuestionAnswered) {
      return true
    }

    if (!isLastPromptQuestion) {
      setCurrentPromptQuestionIndex((index) =>
        Math.min(index + 1, activeQuestionPrompt.questions.length - 1)
      )
      return true
    }

    onAnswerPrompt?.(
      createRuntimePromptResponse(activeQuestionPrompt, promptAnswers, promptCustomAnswers)
    )
    setCurrentPromptQuestionIndex(0)
    setPromptAnswers({})
    setPromptCustomAnswers({})
    return true
  }, [
    activeApprovalPrompt,
    activeQuestionPrompt,
    currentPromptQuestion,
    currentPromptQuestionAnswered,
    isLastPromptQuestion,
    onAnswerPrompt,
    promptAnswers,
    promptCustomAnswers,
  ])

  useEffect(() => {
    if (!isPromptActive) {
      return
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.repeat || event.isComposing) {
        return
      }

      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        activeApprovalPrompt
      ) {
        event.preventDefault()
        handleApprovePrompt()
        return
      }

      if (event.key === "Escape") {
        event.preventDefault()
        if (activeApprovalPrompt) {
          handleDenyPrompt()
          return
        }

        handleDismissPrompt()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    activeApprovalPrompt,
    handleApprovePrompt,
    handleDenyPrompt,
    handleDismissPrompt,
    isPromptActive,
  ])

  return useMemo(
    () => ({
      activeApprovalPrompt,
      activeQuestionPrompt,
      currentPromptQuestion,
      currentPromptQuestionAnswered,
      currentPromptQuestionIndex,
      handleApprovePrompt,
      handleDenyPrompt,
      handleDismissPrompt,
      handleGoToNextPromptQuestion,
      handleGoToPreviousPromptQuestion,
      handlePromptAnswerChange,
      handlePromptCustomAnswerChange,
      handlePromptCustomAnswerFocus,
      isFirstPromptQuestion,
      isLastPromptQuestion,
      isPromptActive,
      promptAnswers,
      promptCtaLabel,
      promptCustomAnswers,
      promptProgressLabel,
      submitActivePrompt,
    }),
    [
      activeApprovalPrompt,
      activeQuestionPrompt,
      currentPromptQuestion,
      currentPromptQuestionAnswered,
      currentPromptQuestionIndex,
      handleApprovePrompt,
      handleDenyPrompt,
      handleDismissPrompt,
      handleGoToNextPromptQuestion,
      handleGoToPreviousPromptQuestion,
      handlePromptAnswerChange,
      handlePromptCustomAnswerChange,
      handlePromptCustomAnswerFocus,
      isFirstPromptQuestion,
      isLastPromptQuestion,
      isPromptActive,
      promptAnswers,
      promptCtaLabel,
      promptCustomAnswers,
      promptProgressLabel,
      submitActivePrompt,
    ]
  )
}
