import { beforeEach, describe, expect, mock, test } from "bun:test"

const createOpencodeServerMock = mock()
const providerListMock = mock()
const createOpencodeClientMock = mock(() => ({
  provider: {
    list: providerListMock,
  },
}))

mock.module("@opencode-ai/sdk/v2/server", () => ({
  createOpencodeServer: createOpencodeServerMock,
}))

mock.module("@opencode-ai/sdk/v2/client", () => ({
  createOpencodeClient: createOpencodeClientMock,
}))

const { OpenCodeServerService } = await import("./opencodeServer")

describe("OpenCodeServerService", () => {
  beforeEach(() => {
    createOpencodeServerMock.mockReset()
    providerListMock.mockReset()
    createOpencodeClientMock.mockClear()
  })

  test("reuses an already running local OpenCode server when the default port is occupied", async () => {
    createOpencodeServerMock.mockRejectedValueOnce(
      new Error("Server exited with code 1\nFailed to start server on port 4096")
    )
    providerListMock.mockResolvedValueOnce({ data: { all: [], connected: [], default: {} } })

    const service = new OpenCodeServerService()

    await expect(service.getBaseUrl()).resolves.toBe("http://127.0.0.1:4096")
    expect(createOpencodeClientMock).toHaveBeenCalledWith({
      baseUrl: "http://127.0.0.1:4096",
    })
  })

  test("clears failed startup state so later attempts can retry cleanly", async () => {
    createOpencodeServerMock
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        url: "http://127.0.0.1:4101",
        close() {},
      })

    const service = new OpenCodeServerService()

    await expect(service.getBaseUrl()).rejects.toThrow("boom")
    await expect(service.getBaseUrl()).resolves.toBe("http://127.0.0.1:4101")
    expect(createOpencodeServerMock).toHaveBeenCalledTimes(2)
  })
})
