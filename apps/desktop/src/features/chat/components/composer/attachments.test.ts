import { describe, expect, test } from "bun:test"
import { createEditor } from "lexical"
import { UploadChipNode } from "../UploadChipNode"
import { SkillChipNode } from "../SkillChipNode"
import {
  buildHarnessAttachmentText,
  buildAttachmentChipToken,
  createDraftAttachment,
  isLargeTextPaste,
} from "./attachments"
import { populateComposerFromSerializedValue, serializeComposerState } from "./composerSerialization"

describe("composer attachments", () => {
  test("round-trips skill chips and upload chips through composer serialization", () => {
    const attachment = createDraftAttachment({
      kind: "file",
      label: "notes.txt",
      worktreePath: "/tmp/project",
      fileName: "notes.txt",
      id: "attachment-1",
    })
    const editor = createEditor({
      namespace: "composer-attachments-test",
      nodes: [SkillChipNode, UploadChipNode],
      onError(error) {
        throw error
      },
    })
    let serialized = ""

    editor.update(
      () => {
        populateComposerFromSerializedValue(
          `Check $review ${buildAttachmentChipToken(attachment.id)}`,
          new Map([["review", { name: "Review", referenceName: "review" }]]),
          new Map([[attachment.id, attachment]])
        )
        serialized = serializeComposerState()
      },
      { discrete: true }
    )

    expect(serialized).toBe(`Check $review ${buildAttachmentChipToken(attachment.id)}`)
  })

  test("detects large text paste thresholds", () => {
    expect(isLargeTextPaste("short note")).toBe(false)
    expect(isLargeTextPaste("x".repeat(4001))).toBe(true)
    expect(isLargeTextPaste(Array.from({ length: 41 }, () => "line").join("\n"))).toBe(true)
  })

  test("builds harness text with relative attachment paths", () => {
    expect(
      buildHarnessAttachmentText("Please inspect this", [
        {
          id: "attachment-1",
          type: "attachment",
          kind: "pasted_text",
          label: "Pasted text",
          relativePath: ".vfactor/chat-inputs/2026-04-07/attachment-1-pasted-text.txt",
          absolutePath: "/tmp/project/.vfactor/chat-inputs/2026-04-07/attachment-1-pasted-text.txt",
        },
      ])
    ).toBe(
      [
        "Please inspect this",
        "",
        "Attached local context:",
        '- pasted text "Pasted text": .vfactor/chat-inputs/2026-04-07/attachment-1-pasted-text.txt',
        "These files are staged locally in the project and can be read directly from disk.",
        "If an attachment is an image, inspect the image file directly instead of saying no image was provided.",
      ].join("\n")
    )
  })
})
