import { beforeEach, describe, expect, mock, test } from "bun:test"

const checkForUpdatesMock = mock(async () => null)
const installUpdateMock = mock(async () => {})

mock.module("zustand", () => ({
  create: <T>(
    initializer: (
      set: (partial: Partial<T> | ((state: T) => Partial<T>)) => void,
      get: () => T
    ) => T
  ) => {
    let state!: T

    const getState = () => state
    const setState = (partial: Partial<T> | ((currentState: T) => Partial<T>)) => {
      const nextState = typeof partial === "function" ? partial(state) : partial
      state = {
        ...state,
        ...nextState,
      }
    }

    state = initializer(setState, getState)

    const store = ((selector?: (currentState: T) => unknown) =>
      selector ? selector(state) : state) as ((selector?: (currentState: T) => unknown) => unknown) & {
      getState: () => T
      setState: (partial: Partial<T>) => void
    }

    store.getState = getState
    store.setState = (partial: Partial<T>) => {
      state = {
        ...state,
        ...partial,
      }
    }

    return store
  },
}))

mock.module("@/desktop/client", () => ({
  desktop: {
    app: {
      checkForUpdates: checkForUpdatesMock,
      installUpdate: installUpdateMock,
      onUpdateEvent: () => () => {},
    },
  },
}))

const { useAppUpdateStore } = await import("./updateStore")

function resetUpdateStore() {
  useAppUpdateStore.setState({
    phase: "idle",
    availableUpdate: null,
    lastCheckedAt: null,
    error: null,
    hasInitialized: false,
    dismissedVersion: null,
    downloadedBytes: 0,
    contentLength: null,
  })
}

describe("useAppUpdateStore.checkForUpdates", () => {
  beforeEach(() => {
    checkForUpdatesMock.mockReset()
    checkForUpdatesMock.mockResolvedValue(null)
    installUpdateMock.mockReset()
    resetUpdateStore()
  })

  test("keeps silent startup failures out of the visible error state", async () => {
    checkForUpdatesMock.mockRejectedValue(
      new Error(
        "In-app updates are unavailable in this build. Install Nucleus from a packaged release build to use the updater."
      )
    )

    const result = await useAppUpdateStore.getState().checkForUpdates({ silent: true })

    expect(result).toBeNull()
    expect(useAppUpdateStore.getState().phase).toBe("idle")
    expect(useAppUpdateStore.getState().error).toBeNull()
  })

  test("surfaces explicit update-check failures to the user", async () => {
    checkForUpdatesMock.mockRejectedValue(
      new Error(
        "In-app updates are unavailable in this build. Install Nucleus from a packaged release build to use the updater."
      )
    )

    const result = await useAppUpdateStore.getState().checkForUpdates()

    expect(result).toBeNull()
    expect(useAppUpdateStore.getState().phase).toBe("error")
    expect(useAppUpdateStore.getState().error).toContain("In-app updates are unavailable in this build")
  })
})
