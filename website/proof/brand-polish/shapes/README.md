# #453 PR 3: posthog.com's corners and a smaller fallback face

Audit items 3 and 5 of [`../audit/README.md`](../audit/README.md).

## Tests

- [red.txt](red.txt): `brandShapes.test.tsx` (every panel and card on the home at `rounded-lg`, never `rounded-xl`; the palette, skill point and coins chips at `rounded-md` with the avatar still round) and the hero portrait at `size-28` in `HomePage.test.tsx`, on the tree before the change: 4 failing.
- [green.txt](green.txt): the same passing beside the header, nav, quests, Book, feature panel and Journey suites: 240 tests.

## In the browser

Chromium through the T3 preview, the `member-with-every-feature-open` fixture build on `vite preview`.

| | Before (PR 2) | After |
|---|---|---|
| Home, 1280, light | [before](before-home-1280-light.png) | [after](after-home-1280-light.png) |
| Home, 390, light | [before](before-home-390-light.png) (audit, Inter) | [after](after-home-390-light.png) |
| Quests, 1280, dark | [before](before-quests-1280-dark.png) (audit, Inter) | [after](after-quests-1280-dark.png) |
