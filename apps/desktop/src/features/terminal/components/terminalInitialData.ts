export interface TerminalInitialDataRestoreState {
  initialData: string
  hasReadyCachedSessionForCwd: boolean
}

export function shouldRestoreTerminalInitialData({
  initialData,
  hasReadyCachedSessionForCwd,
}: TerminalInitialDataRestoreState) {
  if (initialData.length === 0) {
    return false
  }

  return !hasReadyCachedSessionForCwd
}
