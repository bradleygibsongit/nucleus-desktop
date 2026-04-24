import { useCallback, useEffect, useRef, useState } from "react"

const PARENT_INPUT_SYNC_DELAY_MS = 50

export function useDeferredComposerInput({
  input,
  resetKey,
  setInput,
}: {
  input: string
  resetKey: string
  setInput: (value: string) => void
}) {
  const [liveInput, setLiveInput] = useState(input)
  const liveInputRef = useRef(input)
  const pendingLocalInputRef = useRef<string | null>(null)
  const deferredParentInputTimeoutRef = useRef<number | null>(null)

  const clearDeferredParentSync = useCallback(() => {
    if (deferredParentInputTimeoutRef.current === null) {
      return
    }

    window.clearTimeout(deferredParentInputTimeoutRef.current)
    deferredParentInputTimeoutRef.current = null
  }, [])

  const flushDeferredParentSync = useCallback(() => {
    if (deferredParentInputTimeoutRef.current === null) {
      return
    }

    clearDeferredParentSync()
    setInput(liveInputRef.current)
  }, [clearDeferredParentSync, setInput])

  const commitComposerInput = useCallback(
    (nextInput: string, options?: { deferParent?: boolean }) => {
      liveInputRef.current = nextInput
      pendingLocalInputRef.current = nextInput
      setLiveInput(nextInput)

      if (options?.deferParent) {
        clearDeferredParentSync()
        deferredParentInputTimeoutRef.current = window.setTimeout(() => {
          deferredParentInputTimeoutRef.current = null
          setInput(nextInput)
        }, PARENT_INPUT_SYNC_DELAY_MS)
        return
      }

      clearDeferredParentSync()
      setInput(nextInput)
    },
    [clearDeferredParentSync, setInput]
  )

  useEffect(
    () => () => {
      flushDeferredParentSync()
    },
    [flushDeferredParentSync]
  )

  useEffect(() => {
    pendingLocalInputRef.current = null
    clearDeferredParentSync()
    liveInputRef.current = input
    setLiveInput(input)
  }, [clearDeferredParentSync, input, resetKey])

  useEffect(() => {
    if (pendingLocalInputRef.current === input) {
      pendingLocalInputRef.current = null
      return
    }

    if (pendingLocalInputRef.current !== null) {
      return
    }

    if (input === liveInputRef.current) {
      return
    }

    liveInputRef.current = input
    setLiveInput(input)
  }, [input])

  return {
    commitComposerInput,
    liveInput,
    liveInputRef,
    pendingLocalInputRef,
  }
}
