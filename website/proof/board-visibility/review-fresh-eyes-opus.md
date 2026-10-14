# Fresh-eyes review (Claude Opus 5.5, high), round 1 on e0e18b5

Backend: no finding. The gate reads through `queryOnly`, `leaderboardStateOf` covers the board while unlocks don't apply, `noLaunchWaitsFor` refuses while unlocks', the Journey's or the Book's launch is due or the Journey hasn't started, the answer is the stored setting, and the republish runs only after a change. The Quill switch inside a label toggles once per click and keeps focus while pending.

FINDINGS:
- website/src/leaderboard/VisibilitySwitch.tsx:31 | major | UI (live region, WCAG 4.1.3) | `empty:hidden` sets `display:none` on the empty `role="status"` line, and `choose` clears it before every call -> screen readers can miss the line that arrives | keep the region in the tree while empty (`sr-only`, the repo's pattern)
- website/src/leaderboard/VisibilitySwitch.tsx:11 | minor | UI (reactive position) | switched off here, then on in another tab or Slack -> the switch follows the read, but the line still says "You're off the leaderboards." | show the set line only while its setting equals the read
- website/src/leaderboard/VisibilitySwitch.tsx:29 | minor | UI (WS339 V24 non-text contrast) | Quill's unchecked track measures about 1.6:1 (light) and 1.2:1 (dark) on the card -> the off position is hard to read | outline it at 3:1 and test it from the tokens
- website/src/leaderboard/VisibilitySwitch.tsx:29 | nit | UI (reduced motion) | Quill's switch and thumb still slide under prefers-reduced-motion | add motion-reduce:transition-none to both
