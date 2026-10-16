1. **Minor — resolved**, [moments.ts:89](/home/coder/dev/kudos-wt/crate-store/website/src/crates/moments.ts:89). Bought crates bypass stored seen flags and no longer write them, preventing cross-member reveal suppression.

2. **Minor — partially resolved**, [CrateStore.tsx:23](/home/coder/dev/kudos-wt/crate-store/website/src/book/CrateStore.tsx:23). Feedback now appears after the offer disappears. However, while the purchase is pending with no waiting crates, this guard removes the live region. The answer mounts an already-populated `role="status"`, which screen readers do not reliably announce. Preserve the empty status region while buying.

3. **Minor — partially resolved**, [routes.ts:30](/home/coder/dev/kudos-wt/crate-store/convex/website/routes.ts:30). Fractions, zero, negatives, and NaN now lose their targets consistently in both link writers. The round-trip gap remains for `n: 1e21`: `Number.isInteger` accepts it, serialization produces `bought:1e+21`, and the browser parser rejects it. Apply matching safe-positive-integer validation to serialization and parsing.

4. **Minor — resolved by inspection**, [crateStore.test.tsx:366](/home/coder/dev/kudos-wt/crate-store/website/src/crateStore.test.tsx:366). Added cases cover both themes, axe, keyboard opening/skipping/closing, focus restoration, and announcement text. No additional state or accessibility defect found in the fixes.

**Verdict:** Changes requested for the remaining announcement and numeric round-trip gaps; no other new defects found. No tests or builds run.
