import { useEffect, useRef } from "react"
import { DiffEditor } from "@monaco-editor/react"
import type { editor } from "monaco-editor"
import { getLanguageFromFilename } from "../utils/language"
import { useTheme } from "@/features/shared/hooks"

interface DiffViewerProps {
  filename: string
  original: string
  modified: string
  modelKey?: string
}

export function DiffViewer({ filename, original, modified, modelKey }: DiffViewerProps) {
  const language = getLanguageFromFilename(filename)
  const theme = useTheme()
  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null)
  const effectiveModelKey = modelKey ?? filename

  useEffect(() => {
    return () => {
      const diffEditor = editorRef.current
      if (!diffEditor) {
        return
      }

      const model = diffEditor.getModel()
      diffEditor.setModel(null)
      model?.original.dispose()
      model?.modified.dispose()
      editorRef.current = null
    }
  }, [])

  return (
    <DiffEditor
      height="100%"
      language={language}
      original={original}
      modified={modified}
      originalModelPath={`inmemory://diff/${encodeURIComponent(effectiveModelKey)}.original`}
      modifiedModelPath={`inmemory://diff/${encodeURIComponent(effectiveModelKey)}.modified`}
      keepCurrentOriginalModel
      keepCurrentModifiedModel
      theme={theme}
      onMount={(editorInstance) => {
        editorRef.current = editorInstance
      }}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        padding: { top: 16 },
        renderSideBySide: true,
      }}
    />
  )
}
