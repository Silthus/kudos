# Level and XP on the home (#135)

WS47–WS51, from a disposable local backend on `127.0.0.1:4010`/`4011` and the mock Slack issuer on `4012` (`testing/handshake/`), never a cloud deployment. Juno signed in through the real Convex Auth handshake.

## The flag override

`xp-levels` was on only on that local backend: the mock served it on for everyone with `MOCK_FLAGS_ON=xp-levels`, beside `website`. Restarting the mock without it, followed by `lib:refreshFlagDefinitions`, switched it off. No PostHog project was read or written.

## Screenshots

| State | Light | Dark |
|---|---|---|
| Level 1, no XP yet: ring `1`, `Level 1 · 20 XP to level 2`, an empty neutral bar, `Level 1` on the profile card | [level-1-light.png](level-1-light.png) | [level-1-dark.png](level-1-dark.png) |
| 1600 XP, level 7: `Level 7 · 500 XP to level 8`, the bar a sixth of the way from 1500 to 2100, no skill points | [level-7-light.png](level-7-light.png) | [level-7-dark.png](level-7-dark.png) |
| `xp-levels` switched off under the open page: the first slice's home, no ring, line or level | [xp-levels-off-light.png](xp-levels-off-light.png) | |

The XP was seeded with `convex import` into `memberProgress` on that backend. The open page followed each change through its subscription, without a reload.

## Tests

- [red-convex.txt](red-convex.txt) and [green-convex.txt](green-convex.txt): `convex/website/profile.test.ts`, `progression` off and on at level 1, on a threshold and past level 5.
- [red-website.txt](red-website.txt) and [green-website.txt](green-website.txt): the home's ring, level line, bar and profile card level, and axe in light and dark.
- The gate: [gate.txt](gate.txt).

## V24's manual pass

- **Focus order:** unchanged. The ring, the line and the bar add no focusable element (an `img`, a paragraph and a `progressbar`, none with a tabindex), as the accessibility trees in the run show.
- **Focus visibility:** not changed by this ticket. The avatar menu's trigger keeps its own focus style; the ring sits inside it.
- **Reduced motion:** nothing moves. The ring and the bar render at their values (V8, V9).
- **Screen-reader wording:** the hero's ring reads `Level 7`, the avatar menu reads `Account menu for Juno Whitlock` described as `Level 7`, and the bar reads `Level 7 · 500 XP to level 8` as a progressbar from 1500 to 2100 at 1600.
- **Contrast:** the ring uses the muted foreground token (text contrast). The first bar track (`bg-muted`) was invisible in dark at 0 XP, so the track is `foreground/15` now, as level-1-dark.png shows.
