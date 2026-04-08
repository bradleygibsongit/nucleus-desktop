import type { ReactElement } from "react"
import {
  $applyNodeReplacement,
  $create,
  $getNodeByKey,
  DecoratorNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical"
import type { RuntimeAttachmentKind } from "../types"
import { UploadChip } from "./UploadChip"

export type SerializedUploadChipNode = Spread<
  {
    attachmentId: string
    kind: RuntimeAttachmentKind
    label: string
    type: "upload-chip"
    version: 1
  },
  SerializedLexicalNode
>

export class UploadChipNode extends DecoratorNode<ReactElement> {
  __attachmentId: string
  __kind: RuntimeAttachmentKind
  __label: string

  static getType(): string {
    return "upload-chip"
  }

  static clone(node: UploadChipNode): UploadChipNode {
    return new UploadChipNode(node.__attachmentId, node.__kind, node.__label, node.__key)
  }

  static importJSON(serializedNode: SerializedUploadChipNode): UploadChipNode {
    return $createUploadChipNode(
      serializedNode.attachmentId,
      serializedNode.kind,
      serializedNode.label
    )
  }

  constructor(
    attachmentId = "",
    kind: RuntimeAttachmentKind = "file",
    label = "",
    key?: NodeKey
  ) {
    super(key)
    this.__attachmentId = attachmentId
    this.__kind = kind
    this.__label = label
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("span")
    dom.className = "inline-block max-w-full align-middle"
    return dom
  }

  updateDOM(): false {
    return false
  }

  exportJSON(): SerializedUploadChipNode {
    return {
      ...super.exportJSON(),
      attachmentId: this.getAttachmentId(),
      kind: this.getKind(),
      label: this.getLabel(),
      type: "upload-chip",
      version: 1,
    }
  }

  getTextContent(): string {
    return this.getLabel()
  }

  isInline(): true {
    return true
  }

  isIsolated(): true {
    return true
  }

  isKeyboardSelectable(): false {
    return false
  }

  decorate(editor: Parameters<DecoratorNode<ReactElement>["decorate"]>[0]): ReactElement {
    return (
      <UploadChip
        kind={this.getKind()}
        label={this.getLabel()}
        onRemove={() => {
          editor.update(() => {
            const node = $getNodeByKey(this.getKey())
            if (node) {
              node.remove()
            }
          })
        }}
      />
    )
  }

  getAttachmentId(): string {
    return this.getLatest().__attachmentId
  }

  getKind(): RuntimeAttachmentKind {
    return this.getLatest().__kind
  }

  getLabel(): string {
    return this.getLatest().__label
  }
}

export function $createUploadChipNode(
  attachmentId: string,
  kind: RuntimeAttachmentKind,
  label: string
): UploadChipNode {
  const node = $create(UploadChipNode)
  const writableNode = node.getWritable() as UploadChipNode
  writableNode.__attachmentId = attachmentId
  writableNode.__kind = kind
  writableNode.__label = label
  return $applyNodeReplacement(node)
}

export function $isUploadChipNode(
  node: LexicalNode | null | undefined
): node is UploadChipNode {
  return node instanceof UploadChipNode
}
