import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"
import { createOpencodeServer, type ServerOptions } from "@opencode-ai/sdk/v2/server"

const DEFAULT_HOSTNAME = "127.0.0.1"
const DEFAULT_PORT = 4096

type RunningOpenCodeServer = {
  url: string
  close(): void
}

export class OpenCodeServerService {
  private serverPromise:
    | Promise<RunningOpenCodeServer>
    | null = null

  async ensureServer(options?: ServerOptions): Promise<string> {
    const server = await this.getServer(options)
    return server.url
  }

  async getBaseUrl(): Promise<string> {
    const server = await this.getServer()
    return server.url
  }

  async dispose(): Promise<void> {
    const serverPromise = this.serverPromise
    this.serverPromise = null

    if (!serverPromise) {
      return
    }

    const server = await serverPromise
    server.close()
  }

  private getServer(options?: ServerOptions) {
    if (!this.serverPromise) {
      this.serverPromise = this.createOrReuseServer(options).catch((error) => {
        this.serverPromise = null
        throw error
      })
    }

    return this.serverPromise
  }

  private async createOrReuseServer(options?: ServerOptions): Promise<RunningOpenCodeServer> {
    try {
      return await createOpencodeServer(options)
    } catch (error) {
      if (!(await this.shouldReuseExistingServer(error, options))) {
        throw error
      }

      const hostname = options?.hostname ?? DEFAULT_HOSTNAME
      const port = options?.port ?? DEFAULT_PORT
      return {
        url: `http://${hostname}:${port}`,
        close() {},
      }
    }
  }

  private async shouldReuseExistingServer(
    error: unknown,
    options?: ServerOptions
  ): Promise<boolean> {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes("Failed to start server on port")) {
      return false
    }

    const hostname = options?.hostname ?? DEFAULT_HOSTNAME
    const port = options?.port ?? DEFAULT_PORT
    const baseUrl = `http://${hostname}:${port}`

    try {
      const client = createOpencodeClient({ baseUrl })
      await client.provider.list()
      return true
    } catch {
      return false
    }
  }
}
