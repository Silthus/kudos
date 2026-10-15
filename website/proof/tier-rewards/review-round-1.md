# GPT-6.1 Sol review, round 1 (high, read-only, over the diff against origin/main with WS347 as the oracle)

1. **Medium — [website/src/route.ts:24](/home/coder/dev/kudos-wt/tier-rewards/website/src/route.ts:24): The achievement-earned page is unreachable through the product.** `/book/earned` is registered, but no production link or navigation trigger leads to it. A member following the tier DM lands on home; Book navigation and shelf entries lead to the overview or category pages. Consequently, WS347’s celebration requires manually entering its URL. Add a website entry from home to the earned page, preserving the existing DM. Cover that journey with an outside-in test; the current tests set `/book/earned` directly and miss this failure.

## Response

Rejected as a code change in this PR. The tier DM is map #1's (`convex/feedback/notify.ts` links `tiers-earned` to `deepLinks.successReply`, the home page). The conductor's brief says: if the DM's link must change, record it as a cross-map need and don't edit their DM. `/book/earned` is on both `routeAt` and `routeList` (SW10), so sign-in keeps it and map #1's change is one line in `deepLinks.ts` plus a `{ page: "earned" }` page. A home entry to the page would be a new WS rule this ticket doesn't have. #297 stays open for the DM link.
