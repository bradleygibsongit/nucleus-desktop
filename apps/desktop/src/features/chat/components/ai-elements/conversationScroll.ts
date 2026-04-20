export const CONVERSATION_BOTTOM_THRESHOLD_PX = 24
export const CONVERSATION_SCROLL_BUTTON_THRESHOLD_PX = 96

export interface ConversationScrollMetrics {
  scrollHeight: number
  clientHeight: number
  scrollTop: number
}

export function getConversationDistanceFromBottom({
  scrollHeight,
  clientHeight,
  scrollTop,
}: ConversationScrollMetrics): number {
  return Math.max(0, scrollHeight - clientHeight - scrollTop)
}

export function isConversationNearBottom(
  distanceFromBottom: number,
  threshold = CONVERSATION_BOTTOM_THRESHOLD_PX
): boolean {
  return distanceFromBottom <= threshold
}

export function shouldShowConversationScrollButton({
  userDetached,
  distanceFromBottom,
  threshold = CONVERSATION_SCROLL_BUTTON_THRESHOLD_PX,
}: {
  userDetached: boolean
  distanceFromBottom: number
  threshold?: number
}): boolean {
  return userDetached && distanceFromBottom > threshold
}

export function getPreservedViewportScrollTop({
  currentScrollTop,
  anchorOffsetBefore,
  anchorOffsetAfter,
}: {
  currentScrollTop: number
  anchorOffsetBefore: number
  anchorOffsetAfter: number
}): number {
  return currentScrollTop + (anchorOffsetAfter - anchorOffsetBefore)
}
