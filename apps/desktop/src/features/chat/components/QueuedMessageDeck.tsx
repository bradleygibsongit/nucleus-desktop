import { memo } from "react"
import { ArrowElbowDownLeft, PencilSimple, Trash } from "@/components/icons"
import type { QueuedChatMessage } from "../types"
import { getDraftAttachmentLabel } from "./composer/attachments"
import { cn } from "@/lib/utils"

function getQueuedMessagePreview(message: QueuedChatMessage): string {
  const normalizedText = message.text.trim().replace(/\s+/g, " ")
  if (normalizedText) {
    return normalizedText
  }

  if (message.attachments.length === 1) {
    return getDraftAttachmentLabel(message.attachments[0]!)
  }

  if (message.attachments.length > 1) {
    return message.attachments.map((attachment) => getDraftAttachmentLabel(attachment)).join(", ")
  }

  return "Queued message"
}

function getQueuedAttachmentSummary(message: QueuedChatMessage): string | null {
  if (message.attachments.length === 0) {
    return null
  }

  if (message.attachments.length === 1) {
    return getDraftAttachmentLabel(message.attachments[0]!)
  }

  return `${message.attachments.length} attachments`
}

export const QueuedMessageDeck = memo(function QueuedMessageDeck({
  placement,
  queuedMessages,
  onEditQueuedMessage,
  onRemoveQueuedMessage,
}: {
  placement: "docked" | "intro"
  queuedMessages: QueuedChatMessage[]
  onEditQueuedMessage?: (queuedMessageId: string) => void
  onRemoveQueuedMessage?: (queuedMessageId: string) => void
}) {
  return (
    <div
      className={cn(
        "pointer-events-none relative z-0 px-2",
        placement === "intro" ? "pb-1.5" : "pb-1.5"
      )}
    >
      <div
        className={cn(
          "chat-composer-queue-deck pointer-events-auto overflow-hidden border px-2.5 pt-1",
          placement === "intro"
            ? "mx-1 rounded-t-[22px] rounded-b-none pb-1"
            : "mx-5 rounded-t-[24px] rounded-b-none pb-1"
        )}
      >
        {queuedMessages.map((queuedMessage) => {
          const attachmentSummary = getQueuedAttachmentSummary(queuedMessage)

          return (
            <div
              key={queuedMessage.id}
              className="chat-composer-queue-row group flex min-h-9 items-center gap-2.5 px-1"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 py-1.5">
                <div className="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground/54">
                  <ArrowElbowDownLeft className="size-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-[13px] font-medium text-foreground/78">
                      {getQueuedMessagePreview(queuedMessage)}
                    </p>
                    {attachmentSummary ? (
                      <span className="shrink-0 truncate text-[10px] text-muted-foreground/50">
                        {attachmentSummary}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 py-1.5">
                <button
                  type="button"
                  onClick={() => onEditQueuedMessage?.(queuedMessage.id)}
                  disabled={!onEditQueuedMessage}
                  className="chat-composer-queue-action inline-flex h-6 items-center gap-1 rounded-full px-1.5 text-[11px] text-muted-foreground/74 hover:bg-white/5 hover:text-foreground disabled:opacity-40"
                  aria-label="Edit queued message"
                  title="Edit queued message"
                >
                  <PencilSimple className="size-2.5" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveQueuedMessage?.(queuedMessage.id)}
                  disabled={!onRemoveQueuedMessage}
                  className="chat-composer-queue-action inline-flex size-6 items-center justify-center rounded-full text-muted-foreground/68 hover:bg-white/5 hover:text-foreground disabled:opacity-40"
                  aria-label="Remove queued message"
                  title="Remove queued message"
                >
                  <Trash className="size-2.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})
