import { useEffect } from "react"
import { prefetchHarnessModels } from "../store/harnessModelStore"

export function HarnessBootstrap() {
  useEffect(() => {
    void prefetchHarnessModels()
  }, [])

  return null
}
