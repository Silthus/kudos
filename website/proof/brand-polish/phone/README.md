# #453 PR 5: the phone follow-ups from #434

The three visual follow-ups the earlier Fable pass left on #434 (its skill-tree item is skipped: the skill tree is hidden).

## Tests

- [red.txt](red.txt): `phonePolish.test.tsx` on the tree before the change: 3 failing (the second visible eyebrow, the centred hero, and the podium name's accessible text; the last fails only on the assertion shape, see below).
- [green.txt](green.txt): the same passing beside the home, Book, leaderboard and accessibility suites (470 tests; one home test timed out at 5 s while five gates ran and passes alone).

## The three calls

1. **One eyebrow on the Book at 390 px.** The page picker's visible "Book page" label is gone; the select keeps that accessible name through `aria-label`, and the page's own "Book" eyebrow stays.
2. **One alignment on the home at 390 px: left.** The hero, its column and the kudos-left row are left-aligned at every width, like the panels under them and like posthog.com. The `sm:` row layout is unchanged.
3. **Podium names truncate with an ellipsis and keep the full name.** The rule already existed (`truncate` plus `title`), so the test pins it: a 43-character name on the podium carries `truncate`, its `title` is the full name and the list item's text is the full name. In the browser at 390 px, the name box is 103 px wide, `text-overflow` computes to `ellipsis` and `scrollWidth` exceeds `clientWidth`, so the ellipsis shows.

## In the browser

Chromium through the T3 preview, the `member-with-every-feature-open` fixture build on `vite preview`, 390 × 844.

| | Before (main) | After |
|---|---|---|
| Home, light | [before](before-home-390-light.png) | [after](after-home-390-light.png) |
| Book, dark | [before](before-book-390-dark.png) | [after](after-book-390-dark.png) |
| Podium with a long name, light | | [after](after-podium-long-name-390-light.png) (the name set in the DOM) |
| Podium with a long name, dark | | [after](after-podium-long-name-390-dark.png) |

## Review

[review-gpt-6.1-sol.md](review-gpt-6.1-sol.md): GPT-6.1 Sol, round 1, no high findings. The one low finding, that the podium test's title claimed an ellipsis it can't see in jsdom, is **fixed**: the test is titled as the DOM check it is, and the browser measurement above carries the ellipsis.

## Gate

[gate.txt](gate.txt): `fleet heavy -- pnpm gate` green on this tree.
