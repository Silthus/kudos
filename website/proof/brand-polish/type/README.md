# #453 PR 1: RoundHog sets every word

Audit item 1 and 4 of [`../audit/README.md`](../audit/README.md).

## Tests

- [red.txt](red.txt): `brandType.test.tsx` (the stylesheet seam: the four brand faces, `--font-sans`, no Inter, the display tracking and the label metrics) and `displayTitles.test.tsx` (page titles at the brand's Bold, 800) on the tree before the change: 7 failing.
- [green.txt](green.txt): the same 7 passing after it, every assertion intact.

## In the browser

Chromium through the T3 preview, the `member-with-every-feature-open` fixture build on `vite preview`, after the change: `document.fonts` holds RoundHog at 400, 500, 700 and 800, all `loaded`; `body` computes to `RoundHog, -apple-system, …`; the page title computes to weight 800 with −0.9 px tracking at 36 px, which is what posthog.com's `h1` computes to. RoundHog's tabular figures hold: `1111` and `8888` both measure 40 px under `tabular-nums` (24 and 40 px without), so V5's table rule still holds.

| | Before | After |
|---|---|---|
| Home, 1280, light | [before](before-home-1280-light.png) | [after](after-home-1280-light.png) |
| Home, 1280, dark | [before](before-home-1280-dark.png) | [after](after-home-1280-dark.png) |
| Leaderboard, 390, light | [before](before-leaderboard-390-light.png) | [after](after-leaderboard-390-light.png) |
