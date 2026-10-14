# Review: GPT-6.1 Sol (high), read-only, one round

Run: `codex exec -m gpt-6.1-sol -c model_reasoning_effort=high --sandbox read-only` on a frozen copy of `273c748`, over `git diff origin/spec/website-4...HEAD`, with spec/website-4.md (WS87–WS89, WS61–WS64, V13, V24) and the ticket as the oracle.

## Its answer, verbatim

1. **Launches / denial writes — blocker** — [commands.ts:69](convex/website/commands.ts:69). The launch checks protect the purchase transaction, but its queued republish calls launch-capable `shownHomeOf` without those checks. **Scenario:** buy with Quests and Achievements off, then enable both before republish executes. Reproduced: Journey and Book launches each changed from zero to one, and `joinJourneyPage` was scheduled. **Fix:** carry a website-origin restriction through publication and retries; check launch records inside the rendering mutation before calling launch-capable slices. The sibling commands share this gap. No separate denial or gate-refusal write found.

2. **Retries / keys — no findings.** No second-spend path, stored gate refusal, Slack-key collision, or cross-member collision found.

3. **WS87–WS89 — major** — [SkillTreePage.tsx:21](website/src/pages/SkillTreePage.tsx:21), [SkillTreePage.tsx:48](website/src/pages/SkillTreePage.tsx:48). A bought answer selects the purchased perk but leaves its drawer closed. The announcement exists only inside the details. **Scenario:** on a narrow screen, press Buy, close the drawer with Escape, then receive `bought`. Reproduced: no accessible status, no details heading, and focus remains on the tree node. Refusal/error announcements also disappear while closed. **Fix:** reopen the purchased perk’s drawer before focusing its heading; provide an accessible announcement destination while the drawer is closed. No other copy, answer-shape, pending-pair, confirmation, crate, or primary-action mismatch found.

4. **React correctness — no additional findings.** No unstable mutation/query input, stale-selection announcement, or purchase state retained across a supported member change found.

5. **Test claims — minor** — [accessibility.test.tsx:171](website/src/accessibility.test.tsx:171), [accessibility.test.tsx:187](website/src/accessibility.test.tsx:187). “Every purchase state” omits bought and unreachable states in the drawer. Its bought case also keeps the read permanently available. **Scenario:** an accessibility defect confined to the bought drawer or purchase-to-owned transition leaves this suite green. **Fix:** include those drawer states and advance the bought fixture to the owned read before running axe.

Ran the requested diff and both reproductions in memory. No files modified.

## Responses

1. **Rejected.** WS88 requires `republish(ctx, member)` after `bought`, as WS62 and WS74 do for `openFeature` and `openQuestCrate`. The website mutation itself refuses before D17 unless every launch that applies is recorded, and it runs none (refutations in the README). The scheduled App Home publication runs as Slack's own. If the product owner switches `quests` or `achievements` on in the milliseconds between the commit and that job, it launches the Journey or the Book exactly as the next `xpRecorded` republish or App Home open would. That launch is Slack's, which P77 and P91 leave to the switch. Carrying a website origin through App Home's publication would change map #1's App Home module, beyond this ticket. Recorded with `coherence decide` and raised for the ship ticket #193.
2. No finding.
3. **Fixed.** On a narrow screen, `bought` now reopens the bought perk's drawer and focuses its heading first (`initialFocus` only for a purchase). While the drawer is closed, a page-level status says a refusal or an unreachable server. Red: [`red-review-drawer.txt`](red-review-drawer.txt). Green: [`green-review-drawer.txt`](green-review-drawer.txt).
4. No finding.
5. **Fixed.** axe now also covers bought and unreachable in the drawer, and the bought states move the read to owned before axe runs. They passed at once, so this was coverage, not a defect.
