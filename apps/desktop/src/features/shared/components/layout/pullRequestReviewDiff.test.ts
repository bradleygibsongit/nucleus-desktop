import { describe, expect, test } from "bun:test"
import {
  buildReviewPatch,
  formatReviewLineLabel,
  getReviewDiffLineRange,
  getReviewDiffSelectedLines,
} from "./pullRequestReviewDiff"

describe("pullRequestReviewDiff", () => {
  test("formats single-line and range review locations", () => {
    expect(getReviewDiffLineRange(null, 10)).toEqual({ start: 10, end: 10 })
    expect(getReviewDiffLineRange(934, 937)).toEqual({ start: 934, end: 937 })
    expect(formatReviewLineLabel(null, 10)).toBe("L10")
    expect(formatReviewLineLabel(934, 937)).toBe("L934-937")
  })

  test("creates Pierre selected lines on the additions side", () => {
    expect(getReviewDiffSelectedLines({ start: 934, end: 937 })).toEqual({
      start: 934,
      side: "additions",
      end: 937,
      endSide: "additions",
    })
  })

  test("trims large review hunks down to the commented range and nearby context", () => {
    const patch = buildReviewPatch(
      "lib/features/inventory/actions.ts",
      [
        "@@ -20,3 +20,10 @@ export async function moveLpn() {",
        "   const before = true",
        "   const stillBefore = true",
        "+  const line22 = true",
        "+  const line23 = true",
        "+  const line24 = true",
        "+  const line25 = true",
        "+  const line26 = true",
        "+  const line27 = true",
        "+  const line28 = true",
        "   const after = true",
      ].join("\n"),
      { start: 25, end: 26 }
    )

    expect(patch).toContain("--- a/lib/features/inventory/actions.ts")
    expect(patch).toContain("+++ b/lib/features/inventory/actions.ts")
    expect(patch).toContain("@@ -22,0 +23,6 @@ export async function moveLpn() {")
    expect(patch).toContain("+  const line23 = true")
    expect(patch).toContain("+  const line26 = true")
    expect(patch).toContain("+  const line28 = true")
    expect(patch).not.toContain("+  const line22 = true")
    expect(patch).not.toContain("   const before = true")
    expect(patch).not.toContain("   const after = true")
  })
})
