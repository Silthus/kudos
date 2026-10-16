1. **Minor — finding 2 resolved**, [CrateStore.tsx:23](/home/coder/dev/kudos-wt/crate-store/website/src/book/CrateStore.tsx:23). The empty status region stays mounted while buying, including when the offer disappears, so the reply updates an existing live region.

2. **Minor — finding 3 resolved**, [routes.ts:44](/home/coder/dev/kudos-wt/crate-store/convex/website/routes.ts:44). Serialization and parsing now share safe-positive-integer validation, rejecting `1e21` consistently.

3. **None — no store-target defect found**, [routes.ts:9](/home/coder/dev/kudos-wt/crate-store/convex/website/routes.ts:9), [route.ts:115](/home/coder/dev/kudos-wt/crate-store/website/src/route.ts:115), [linkTarget.ts:26](/home/coder/dev/kudos-wt/crate-store/website/src/linkTarget.ts:26). Validation and parsing agree on `store`. Landing only scrolls and focuses; it cannot send `buyCrate`. The Buy button remains focusable when held, with `aria-disabled` and a described shortfall.

**Verdict:** Both remaining findings are resolved; no new defects found in this commit by inspection. No tests or builds run.
