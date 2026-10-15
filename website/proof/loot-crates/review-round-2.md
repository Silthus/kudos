# Review round 2: GPT-6.1 Sol over PR #482 (the brand follow-ups)

1. **Low — [RewardTokens.tsx:92](/home/coder/dev/kudos-wt/loot-crates/website/src/crates/RewardTokens.tsx:92), [crates.css:646](/home/coder/dev/kudos-wt/loot-crates/website/src/crates/crates.css:646):** Finished reward chips and default flying chips still request weight 600, outside V5’s 400/500/700/800 scale. The new 800 override fixes only the flying chip’s token appearance.
2. **Low — [Crate.tsx:19](/home/coder/dev/kudos-wt/loot-crates/website/src/crates/Crate.tsx:19):** Crate headings still use `font-medium` (500), whereas V5 specifies 700 for headings.
Verdict: The diff is correct: `--radius-lg` resolves globally, `font-extrabold` exists and maps to 800, and no panel-radius conflicts remain; the weight inconsistencies above predate this PR.
1. **Low — [RewardTokens.tsx:92](/home/coder/dev/kudos-wt/loot-crates/website/src/crates/RewardTokens.tsx:92), [crates.css:646](/home/coder/dev/kudos-wt/loot-crates/website/src/crates/crates.css:646):** Finished reward chips and default flying chips still request weight 600, outside V5’s 400/500/700/800 scale. The new 800 override fixes only the flying chip’s token appearance.
2. **Low — [Crate.tsx:19](/home/coder/dev/kudos-wt/loot-crates/website/src/crates/Crate.tsx:19):** Crate headings still use `font-medium` (500), whereas V5 specifies 700 for headings.
Verdict: The diff is correct: `--radius-lg` resolves globally, `font-extrabold` exists and maps to 800, and no panel-radius conflicts remain; the weight inconsistencies above predate this PR.

## Outcomes

1. **Fixed.** The finish's reward chips and the flying chip go from 600 to 700, inside the brand's 400/500/700/800 scale that #457 set for every word.
2. **Rejected.** A crate's heading sits at 500 like every panel heading on the site (the Journey panel, the quest cards); #453 set that convention, and the crate follows it rather than diverging.
