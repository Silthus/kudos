# Review round 1: GPT-6.1 Sol (codex exec, read-only) over the diff against main at cf07875b..09f625bb

## Findings

1. **should-fix — [CrateRewardFlight.tsx:83](/home/coder/dev/kudos-wt/loot-crates/website/src/crates/CrateRewardFlight.tsx:83): Live updates can strand a flight and its held values.** The inline `source` function changes on every parent render, causing `RewardFlight` to recalculate its course and reset its animation-end counter. Reproduce by receiving a profile update about 800 ms into a flight, after some particles finish. The remaining events cannot reach seven; the reveal stays `flying` and rewards remain held until skipped.

2. **should-fix — [crates.css:360](/home/coder/dev/kudos-wt/loot-crates/website/src/crates/crates.css:360): Departing tokens remain visible on stage.** The pop animation uses fill mode `both`, retaining `opacity: 1` and `transform: none`, which override the normal `[data-flown]` declarations. Open a reward crate with motion enabled: each flying token leaves a stationary duplicate behind until the reveal ends.

3. **should-fix — [RevealDialog.tsx:75](/home/coder/dev/kudos-wt/loot-crates/website/src/crates/RevealDialog.tsx:75): Replay omits the reward flights.** Once the original flight lands—or is skipped—`moments.land` removes it. Replay resets only the phase and token visibility, so the burst transitions directly to `ended` because `flying` is undefined. Reproduce by opening a quest crate, finishing it, then pressing Replay. The advertised replay cannot reproduce the full moment.

4. **should-fix — [RewardTokens.tsx:88](/home/coder/dev/kudos-wt/loot-crates/website/src/crates/RewardTokens.tsx:88): The static finish omits skill-point rewards.** `RewardChips` explicitly filters them out, while their animated tokens are `aria-hidden` and disappear at the end. Open a quest crate that earns a skill point, then skip or use reduced motion: the Rewards list contains only XP and coins. This contradicts the spec’s “one chip per reward kind.”

5. **should-fix — [crates.css:327](/home/coder/dev/kudos-wt/loot-crates/website/src/crates/crates.css:327): Rare and epic labels fail text contrast.** Their small text uses `#0070dd` or `#a335ee` against `#141414`, approximately 3.8:1 instead of V24’s required 4.5:1. Reproduce with a rare or epic fixture drop; the end-state card retains the insufficient contrast.

6. **nit — [visual-language.md:43](/home/coder/dev/kudos-wt/loot-crates/docs/website/visual-language.md:43): The documented rules still contradict this change.** V13 requires contents on closed-crate labels, while this implementation deliberately hides them. V3 also says “There are no rarity colours,” despite the new rarity palette. Comparing a closed Journey crate and an epic fixture drop against those rules demonstrates both conflicts; update the rules to match the accepted product contract.

Verdict: **Should-fix before merge.** Code review only; no tests or builds run.
158,134
1. **should-fix — [CrateRewardFlight.tsx:83](/home/coder/dev/kudos-wt/loot-crates/website/src/crates/CrateRewardFlight.tsx:83): Live updates can strand a flight and its held values.** The inline `source` function changes on every parent render, causing `RewardFlight` to recalculate its course and reset its animation-end counter. Reproduce by receiving a profile update about 800 ms into a flight, after some particles finish. The remaining events cannot reach seven; the reveal stays `flying` and rewards remain held until skipped.

2. **should-fix — [crates.css:360](/home/coder/dev/kudos-wt/loot-crates/website/src/crates/crates.css:360): Departing tokens remain visible on stage.** The pop animation uses fill mode `both`, retaining `opacity: 1` and `transform: none`, which override the normal `[data-flown]` declarations. Open a reward crate with motion enabled: each flying token leaves a stationary duplicate behind until the reveal ends.

3. **should-fix — [RevealDialog.tsx:75](/home/coder/dev/kudos-wt/loot-crates/website/src/crates/RevealDialog.tsx:75): Replay omits the reward flights.** Once the original flight lands—or is skipped—`moments.land` removes it. Replay resets only the phase and token visibility, so the burst transitions directly to `ended` because `flying` is undefined. Reproduce by opening a quest crate, finishing it, then pressing Replay. The advertised replay cannot reproduce the full moment.

4. **should-fix — [RewardTokens.tsx:88](/home/coder/dev/kudos-wt/loot-crates/website/src/crates/RewardTokens.tsx:88): The static finish omits skill-point rewards.** `RewardChips` explicitly filters them out, while their animated tokens are `aria-hidden` and disappear at the end. Open a quest crate that earns a skill point, then skip or use reduced motion: the Rewards list contains only XP and coins. This contradicts the spec’s “one chip per reward kind.”

5. **should-fix — [crates.css:327](/home/coder/dev/kudos-wt/loot-crates/website/src/crates/crates.css:327): Rare and epic labels fail text contrast.** Their small text uses `#0070dd` or `#a335ee` against `#141414`, approximately 3.8:1 instead of V24’s required 4.5:1. Reproduce with a rare or epic fixture drop; the end-state card retains the insufficient contrast.

6. **nit — [visual-language.md:43](/home/coder/dev/kudos-wt/loot-crates/docs/website/visual-language.md:43): The documented rules still contradict this change.** V13 requires contents on closed-crate labels, while this implementation deliberately hides them. V3 also says “There are no rarity colours,” despite the new rarity palette. Comparing a closed Journey crate and an epic fixture drop against those rules demonstrates both conflicts; update the rules to match the accepted product contract.

Verdict: **Should-fix before merge.** Code review only; no tests or builds run.

## Outcomes

1. **Fixed.** Each hop carries its own `source` function (built once in `hopsOf`), so a parent re-render no longer re-charts the flight or resets its landing count. Test: "keeps a flight's course and its count of landings when the member's read changes mid-flight", red without the fix.
2. **Fixed.** A flown token gets its own `reward-token-leave` animation, which replaces the pop animation's held end frame, so it fades and shrinks away.
3. **Fixed.** Replay rehearses the whole moment: the burst and the flights run again from a local flight with the pinned reward, with no hold, fill or level turnover on the HUD, which already holds the values. Test: "replays the burst and the flights from the finish without touching the HUD".
4. **Fixed.** The finish lists one chip per reward kind, the skill point included, in flight order.
5. **Fixed.** The rarity label mixes its rarity colour 60/40 with white, so rare (#0070dd) and epic (#a335ee) read above 4.5:1 on night.
6. **Taken for V13, rejected for V3.** V13 now says a closed crate names only its kind and the opening flies each reward home. V3's "no rarity colours" line is #467's to amend with the real drop, by the conductor's instruction on this task; the glow colours ship only in the fixture-only card today.
