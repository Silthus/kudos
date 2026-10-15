# GPT-6.1 Sol review of PR #472, round 1

`codex exec -m gpt-6.1-sol -c model_reasoning_effort=high --sandbox read-only` over the diff against website/brand-shapes at bc1b1feb.

1. **Medium — website/src/index.css:155–156:** The unlayered `.hud-panel` rule overrides Tailwind’s layered `lg:sticky` on `skills/PerkDetails.tsx:17`. Desktop perk details become relative, and `lg:top-24` shifts them down by 6rem, potentially overlapping “How perks work.” Put the default positioning in `@layer components` so positioning utilities can override it.

2. **Low — website/src/index.css:155–156:** Anchoring the marks exposes a paint-order problem: `::before` sits beneath ReadyPage’s opaque, isolated `.night-band` (`pages/ReadyPage.tsx:12`), hiding the top-left mark. EarnedPage’s `.lemon-band` does the same (`book/EarnedPage.tsx:28`). Give the corner pseudo-elements an explicit stacking level above the bands.

3. **Low — website/src/hudPanelCorners.test.tsx:15–16:** The test claims every panel is positioned correctly but only matches text in one CSS rule. It cannot detect cascade overrides or hidden marks, including the problems above. Rename it to describe the declaration check; use browser assertions for computed positioning and visible corners if retaining the behavioral claim.

No high findings.
