import { useEffect, useRef } from "react"
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core"
import { useTree } from "@headless-tree/react"
import { Folder, FolderOpen } from "@/components/icons"
import { Tree, TreeItem, TreeItemLabel } from "@/features/shared/components/ui/tree"
import { getFileIcon } from "@/features/editor/utils/fileIcons"
import type { FileTreeItem } from "../types"

interface FileTreeViewerProps {
  data: Record<string, FileTreeItem>
  rootId?: string
  initialExpanded?: string[]
  indent?: number
  className?: string
  onFileClick?: (filePath: string, fileName: string) => void
}

export function FileTreeViewer({
  data,
  rootId = "root",
  initialExpanded = [],
  indent = 20,
  className,
  onFileClick,
}: FileTreeViewerProps) {
  // Keep a ref to the latest data for the dataLoader callbacks
  const dataRef = useRef(data)
  dataRef.current = data

  const tree = useTree<FileTreeItem>({
    initialState: {
      expandedItems: initialExpanded,
    },
    indent,
    rootItemId: rootId,
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => (item.getItemData()?.children?.length ?? 0) > 0,
    dataLoader: {
      getItem: (itemId) => dataRef.current[itemId],
      getChildren: (itemId) => dataRef.current[itemId]?.children ?? [],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  })

  // Rebuild tree when data changes
  useEffect(() => {
    tree.rebuildTree()
  }, [data, tree])

  return (
    <Tree indent={indent} tree={tree} className={className}>
      {tree.getItems().map((item) => {
          const isFolder = item.isFolder()
          const handleClick = () => {
            if (!isFolder && onFileClick) {
              onFileClick(item.getId(), item.getItemName())
            }
          }

          return (
            <TreeItem key={item.getId()} item={item}>
              <TreeItemLabel
                className="before:bg-sidebar relative before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10"
                onClick={handleClick}
              >
                <span className="flex items-center gap-2">
                  {isFolder ? (
                    item.isExpanded() ? (
                      <FolderOpen className="text-muted-foreground pointer-events-none size-4" />
                    ) : (
                      <Folder className="text-muted-foreground pointer-events-none size-4" />
                    )
                  ) : (
                    (() => {
                      const FileIcon = getFileIcon(item.getItemName())
                      return <FileIcon className="text-muted-foreground pointer-events-none size-4" />
                    })()
                  )}
                  {item.getItemName()}
                </span>
              </TreeItemLabel>
            </TreeItem>
          )
        })}
    </Tree>
  )
}
