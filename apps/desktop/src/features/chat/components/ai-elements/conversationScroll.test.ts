import { describe, expect, test } from "bun:test"
import {
  CONVERSATION_BOTTOM_THRESHOLD_PX,
  getConversationDistanceFromBottom,
  getPreservedViewportScrollTop,
  isConversationNearBottom,
  shouldShowConversationScrollButton,
} from "./conversationScroll"

describe("getConversationDistanceFromBottom", () => {
  test("returns zero when the scroll position would overshoot the content end", () => {
    expect(
      getConversationDistanceFromBottom({
        scrollHeight: 400,
        clientHeight: 200,
        scrollTop: 250,
      })
    ).toBe(0)
  })

  test("returns the remaining scroll distance above the bottom", () => {
    expect(
      getConversationDistanceFromBottom({
        scrollHeight: 1200,
        clientHeight: 500,
        scrollTop: 620,
      })
    ).toBe(80)
  })
})

describe("isConversationNearBottom", () => {
  test("treats positions within the bottom threshold as pinned", () => {
    expect(isConversationNearBottom(CONVERSATION_BOTTOM_THRESHOLD_PX - 1)).toBe(true)
    expect(isConversationNearBottom(CONVERSATION_BOTTOM_THRESHOLD_PX)).toBe(true)
    expect(isConversationNearBottom(CONVERSATION_BOTTOM_THRESHOLD_PX + 1)).toBe(false)
  })
})

describe("shouldShowConversationScrollButton", () => {
  test("only shows the button once the user has detached and moved a meaningful distance", () => {
    expect(
      shouldShowConversationScrollButton({
        userDetached: false,
        distanceFromBottom: 240,
      })
    ).toBe(false)

    expect(
      shouldShowConversationScrollButton({
        userDetached: true,
        distanceFromBottom: 24,
      })
    ).toBe(false)

    expect(
      shouldShowConversationScrollButton({
        userDetached: true,
        distanceFromBottom: 160,
      })
    ).toBe(true)
  })
})

describe("getPreservedViewportScrollTop", () => {
  test("offsets scrollTop by the anchor movement delta", () => {
    expect(
      getPreservedViewportScrollTop({
        currentScrollTop: 300,
        anchorOffsetBefore: 160,
        anchorOffsetAfter: 220,
      })
    ).toBe(360)
  })
})
