import { useCallback, useRef, type Dispatch, type KeyboardEvent, type SetStateAction } from "react"
import { THEME_OPTIONS } from "@/features/shared/appearance"
import type { NormalizedAgent } from "../../hooks/useAgents"
import type { NormalizedCommand } from "../../hooks/useCommands"
import type { FileItem } from "../AtMentionMenu"

interface UseComposerKeyboardNavigationArgs {
  atMenuTotalItems: number
  closeAtMenu: () => void
  closeSlashMenu: () => void
  commitComposerInput: (value: string, options?: { deferParent?: boolean }) => void
  deleteAdjacentChip: () => boolean
  filteredAgents: NormalizedAgent[]
  filteredCommands: NormalizedCommand[]
  filteredFiles: FileItem[]
  finalizeThemeSlashMenu: () => void
  handleSelectCommand: (command: NormalizedCommand) => void
  handleSubmit: () => void
  isComposerLocked: boolean
  isImeComposing: boolean
  isPromptActive: boolean
  selectedIndex: number
  setSelectedIndex: Dispatch<SetStateAction<number>>
  showAtMenu: boolean
  showSlashMenu: boolean
  slashMenuPage: "commands" | "themes"
}

export function useComposerKeyboardNavigation({
  atMenuTotalItems,
  closeAtMenu,
  closeSlashMenu,
  commitComposerInput,
  deleteAdjacentChip,
  filteredAgents,
  filteredCommands,
  filteredFiles,
  finalizeThemeSlashMenu,
  handleSelectCommand,
  handleSubmit,
  isComposerLocked,
  isImeComposing,
  isPromptActive,
  selectedIndex,
  setSelectedIndex,
  showAtMenu,
  showSlashMenu,
  slashMenuPage,
}: UseComposerKeyboardNavigationArgs) {
  const keyDownStateRef = useRef({
    atMenuTotalItems,
    closeAtMenu,
    closeSlashMenu,
    commitComposerInput,
    deleteAdjacentChip,
    filteredAgents,
    filteredCommands,
    filteredFiles,
    finalizeThemeSlashMenu,
    handleSelectCommand,
    handleSubmit,
    isComposerLocked,
    isImeComposing,
    isPromptActive,
    selectedIndex,
    showAtMenu,
    showSlashMenu,
    slashMenuPage,
  })

  keyDownStateRef.current = {
    atMenuTotalItems,
    closeAtMenu,
    closeSlashMenu,
    commitComposerInput,
    deleteAdjacentChip,
    filteredAgents,
    filteredCommands,
    filteredFiles,
    finalizeThemeSlashMenu,
    handleSelectCommand,
    handleSubmit,
    isComposerLocked,
    isImeComposing,
    isPromptActive,
    selectedIndex,
    showAtMenu,
    showSlashMenu,
    slashMenuPage,
  }

  return useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const {
        atMenuTotalItems,
        closeAtMenu,
        closeSlashMenu,
        commitComposerInput,
        deleteAdjacentChip,
        filteredAgents,
        filteredCommands,
        filteredFiles,
        finalizeThemeSlashMenu,
        handleSelectCommand,
        handleSubmit,
        isComposerLocked,
        isImeComposing,
        isPromptActive,
        selectedIndex,
        showAtMenu,
        showSlashMenu,
        slashMenuPage,
      } = keyDownStateRef.current

      if (isComposerLocked) {
        event.preventDefault()
        return
      }

      if (isPromptActive) {
        return
      }

      if (
        event.key === "Backspace" &&
        !showSlashMenu &&
        !showAtMenu &&
        deleteAdjacentChip()
      ) {
        event.preventDefault()
        return
      }

      if (showSlashMenu) {
        const slashMenuItemsCount =
          slashMenuPage === "themes" ? THEME_OPTIONS.length : filteredCommands.length

        if (event.key === "ArrowDown") {
          event.preventDefault()
          setSelectedIndex((previousIndex) =>
            previousIndex < slashMenuItemsCount - 1 ? previousIndex + 1 : 0
          )
          return
        }

        if (event.key === "ArrowUp") {
          event.preventDefault()
          setSelectedIndex((previousIndex) =>
            previousIndex > 0 ? previousIndex - 1 : slashMenuItemsCount - 1
          )
          return
        }

        if (event.key === "Escape") {
          event.preventDefault()
          closeSlashMenu()
          return
        }

        if (slashMenuPage === "themes") {
          if (event.key === "Tab") {
            event.preventDefault()
            event.stopPropagation()
            return
          }

          if (event.key === "Enter" && !event.shiftKey && !isImeComposing) {
            event.preventDefault()
            event.stopPropagation()
            finalizeThemeSlashMenu()
            return
          }
        }

        if (event.key === "Tab") {
          event.preventDefault()
          const selectedCommand = filteredCommands[selectedIndex]
          if (selectedCommand) {
            handleSelectCommand(selectedCommand)
          }
          return
        }

        if (event.key === "Enter" && !event.shiftKey && !isImeComposing) {
          event.preventDefault()
          event.stopPropagation()
          const selectedCommand = filteredCommands[selectedIndex]
          if (selectedCommand) {
            handleSelectCommand(selectedCommand)
          }
          return
        }
      }

      if (showAtMenu && atMenuTotalItems > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault()
          setSelectedIndex((previousIndex) =>
            previousIndex < atMenuTotalItems - 1 ? previousIndex + 1 : 0
          )
          return
        }

        if (event.key === "ArrowUp") {
          event.preventDefault()
          setSelectedIndex((previousIndex) =>
            previousIndex > 0 ? previousIndex - 1 : atMenuTotalItems - 1
          )
          return
        }

        if (event.key === "Escape") {
          event.preventDefault()
          closeAtMenu()
          return
        }

        if (event.key === "Tab") {
          event.preventDefault()
          if (selectedIndex < filteredAgents.length) {
            commitComposerInput(`@${filteredAgents[selectedIndex].name} `)
          } else {
            commitComposerInput(`${filteredFiles[selectedIndex - filteredAgents.length].path} `)
          }
          return
        }
      }

      if (event.key === "Enter" && !event.shiftKey && !isImeComposing) {
        event.preventDefault()
        handleSubmit()
      }
    },
    [setSelectedIndex]
  )
}
