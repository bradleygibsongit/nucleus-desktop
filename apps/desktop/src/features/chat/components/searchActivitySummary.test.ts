import { describe, expect, test } from "bun:test"

import { getSearchActivityTarget } from "./searchActivitySummary"

describe("getSearchActivityTarget", () => {
  test("shows one searched file with a compact overflow count", () => {
    expect(
      getSearchActivityTarget(
        { query: "reasoning" },
        {
          results: [
            { path: "apps/desktop/src/features/chat/components/ChatTimelineItem.tsx" },
            { path: "apps/desktop/src/features/chat/runtime/codexMessageMapper.ts" },
            { path: "apps/desktop/src/features/chat/types.ts" },
          ],
        }
      )
    ).toBe("ChatTimelineItem.tsx + 2 more")
  })

  test("falls back to a result count when paths are not available", () => {
    expect(getSearchActivityTarget({ query: "reasoning" }, { resultCount: 14 })).toBe(
      "14 files"
    )
  })

  test("uses the query when there is no result metadata", () => {
    expect(getSearchActivityTarget({ query: "reasoning title" })).toBe("reasoning title")
  })
})
