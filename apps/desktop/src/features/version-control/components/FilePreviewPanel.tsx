import { useEffect, useMemo, useState } from "react"
import Editor from "@monaco-editor/react"
import { desktop } from "@/desktop/client"
import { getFileIcon } from "@/features/editor/utils/fileIcons"
import { getLanguageFromFilename } from "@/features/editor/utils/language"
import {
  getSidebarFilePreviewMonacoThemeId,
  registerSidebarFilePreviewMonacoThemes,
  useAppearance,
} from "@/features/shared/appearance"
import { RightSidebarEmptyState } from "@/features/shared/components/layout/RightSidebarEmptyState"

interface FilePreviewPanelProps {
  fileName: string
  filePath: string
  projectPath?: string | null
}

const IMAGE_EXTENSIONS = new Set(["avif", "gif", "ico", "jpeg", "jpg", "png", "svg", "webp"])
const NON_PREVIEWABLE_FILENAMES = new Set([".ds_store", "thumbs.db", "desktop.ini"])
const NON_PREVIEWABLE_EXTENSIONS = new Set([
  "7z",
  "a",
  "app",
  "bin",
  "db",
  "dmg",
  "dylib",
  "exe",
  "gz",
  "ico",
  "jar",
  "lockb",
  "o",
  "pdf",
  "sqlite",
  "sqlite3",
  "tar",
  "wasm",
  "zip",
])

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/")
}

function getRelativePath(filePath: string, projectPath: string | null | undefined): string {
  if (!projectPath) {
    return filePath.split(/[\\/]/).filter(Boolean).at(-1) ?? filePath
  }

  const normalizedFilePath = normalizePath(filePath)
  const normalizedProjectPath = normalizePath(projectPath).replace(/\/+$/, "")

  if (normalizedFilePath === normalizedProjectPath) {
    return normalizedFilePath.split("/").filter(Boolean).at(-1) ?? normalizedFilePath
  }

  const prefix = `${normalizedProjectPath}/`
  if (normalizedFilePath.startsWith(prefix)) {
    return normalizedFilePath.slice(prefix.length)
  }

  return normalizedFilePath.split("/").filter(Boolean).at(-1) ?? normalizedFilePath
}

function isImageFile(filename: string): boolean {
  const extension = filename.split(".").pop()?.toLowerCase()
  return extension ? IMAGE_EXTENSIONS.has(extension) : false
}

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? ""
}

function isNonPreviewableFile(filename: string): boolean {
  const normalizedName = filename.trim().toLowerCase()
  const extension = getFileExtension(filename)

  return (
    NON_PREVIEWABLE_FILENAMES.has(normalizedName) ||
    (!isImageFile(filename) && NON_PREVIEWABLE_EXTENSIONS.has(extension))
  )
}

export function FilePreviewPanel({
  fileName,
  filePath,
  projectPath,
}: FilePreviewPanelProps) {
  const [content, setContent] = useState("")
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [showLoading, setShowLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { monacoThemeId, textSizePx } = useAppearance()
  const isImage = isImageFile(fileName)
  const isNonPreviewable = isNonPreviewableFile(fileName)
  const language = getLanguageFromFilename(fileName)
  const FileIcon = getFileIcon(fileName)
  const sidebarMonacoThemeId = getSidebarFilePreviewMonacoThemeId(monacoThemeId)

  const relativePath = useMemo(
    () => getRelativePath(filePath, projectPath),
    [filePath, projectPath]
  )

  useEffect(() => {
    let cancelled = false
    let loadingTimeout: ReturnType<typeof setTimeout> | null = null

    async function loadFile() {
      setError(null)
      setContent("")
      setImageDataUrl(null)

      loadingTimeout = setTimeout(() => {
        if (!cancelled) {
          setShowLoading(true)
        }
      }, 120)

      try {
        if (isNonPreviewable) {
          return
        }

        if (isImage) {
          const nextImageDataUrl = await desktop.fs.readFileAsDataUrl(filePath)
          if (!cancelled) {
            setImageDataUrl(nextImageDataUrl)
          }
        } else {
          const nextContent = await desktop.fs.readTextFile(filePath)
          if (!cancelled) {
            setContent(nextContent)
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError("This file couldn’t be previewed here.")
          setContent("")
          setImageDataUrl(null)
        }
      } finally {
        if (loadingTimeout) {
          clearTimeout(loadingTimeout)
        }
        if (!cancelled) {
          setShowLoading(false)
        }
      }
    }

    void loadFile()

    return () => {
      cancelled = true
      if (loadingTimeout) {
        clearTimeout(loadingTimeout)
      }
    }
  }, [filePath, isImage, isNonPreviewable])

  if (showLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading file...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
        {error}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-[34px] shrink-0 items-center gap-2 border-b border-sidebar-border/80 px-2 text-xs text-sidebar-foreground">
        <FileIcon size={14} className="shrink-0 text-sidebar-foreground/80" />
        <span className="truncate">{relativePath || fileName}</span>
      </div>
      <div className="app-scrollbar-sm min-h-0 flex-1 overflow-auto bg-[var(--right-sidebar-content-bg,var(--background))]">
        {isNonPreviewable ? (
          <RightSidebarEmptyState
            icon={FileIcon}
            title="Binary or system file"
            description="This file can't be previewed as text."
          />
        ) : isImage ? (
          <div className="flex h-full min-h-0 items-center justify-center p-4">
            {imageDataUrl ? (
              <img
                src={imageDataUrl}
                alt={fileName}
                className="max-h-full max-w-full object-contain"
              />
            ) : null}
          </div>
        ) : (
          <Editor
            height="100%"
            language={language}
            value={content}
            theme={sidebarMonacoThemeId}
            beforeMount={(monaco) => {
              registerSidebarFilePreviewMonacoThemes(monaco)
            }}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: textSizePx,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              folding: false,
              glyphMargin: false,
              lineDecorationsWidth: 8,
              lineNumbersMinChars: 3,
              renderWhitespace: "none",
              bracketPairColorization: { enabled: false },
              guides: {
                bracketPairs: false,
                bracketPairsHorizontal: false,
                highlightActiveBracketPair: false,
              },
              matchBrackets: "never",
              occurrencesHighlight: "off",
              overviewRulerBorder: false,
              renderLineHighlight: "none",
              selectionHighlight: false,
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
              padding: { top: 8, bottom: 8 },
            }}
          />
        )}
      </div>
    </div>
  )
}
