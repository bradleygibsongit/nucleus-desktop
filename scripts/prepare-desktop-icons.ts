import { copyFile, mkdir } from "node:fs/promises"
import { join } from "node:path"

const CHANNELS = ["dev", "prod"] as const
const ICON_FILES = ["icon.icns", "icon.ico", "icon.png", "dock.png", "128x128.png", "32x32.png"] as const
const DEFAULT_CHANNEL = "prod"
const ICONS_DIR = join(import.meta.dir, "..", "apps", "desktop", "build", "icons")

type DesktopIconChannel = (typeof CHANNELS)[number]

function parseChannel(rawChannel: string | undefined): DesktopIconChannel {
  if (rawChannel === "dev" || rawChannel === "prod") {
    return rawChannel
  }

  if (!rawChannel) {
    return DEFAULT_CHANNEL
  }

  throw new Error(
    `[desktop-icons] Unknown icon channel "${rawChannel}". Expected one of: ${CHANNELS.join(", ")}.`
  )
}

async function prepareDesktopIcons(channel = parseChannel(process.argv[2] || process.env.VFACTOR_ICON_CHANNEL)) {
  const sourceDir = join(ICONS_DIR, channel)

  await mkdir(ICONS_DIR, { recursive: true })

  for (const fileName of ICON_FILES) {
    await copyFile(join(sourceDir, fileName), join(ICONS_DIR, fileName))
  }

  console.log(`[desktop-icons] Prepared ${channel} icons in ${ICONS_DIR}.`)
}

if (import.meta.main) {
  await prepareDesktopIcons()
}
