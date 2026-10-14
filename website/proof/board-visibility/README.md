# Show me on the leaderboards (#289)

WS321, WS322 and WS335, from a disposable local backend on `127.0.0.1:7710`/`7711` and the mock Slack issuer on `7712` (`testing/handshake/`), never a cloud deployment. Juno signed in through the real Convex Auth handshake.

## The flag override

`everyone-board` was on only on that local backend: the mock served it on for everyone with `MOCK_FLAGS_ON=everyone-board`, beside `website`, which the mock serves on. Unlocks didn't apply, so the board was open by the everyone-board flag (WS321's "including while unlocks don't apply"). No PostHog project was read or written.

## The data

Seven synthetic teammates in `Europe/Berlin` were imported into `members` and `givenTotals`, and Juno got 11 kudos given this week. Every change of Juno's setting went through the page's switch.

## Screenshots

| State | Light | Dark |
|---|---|---|
| On the board: the switch on, `You're #5` | [1-on-light.png](1-on-light.png) | [1-on-dark.png](1-on-dark.png) |
| Variant E (`3409ade`, from #275's proof) at the same state: the switch in `How it counts` | [variant-e-on-light.png](variant-e-on-light.png) | [variant-e-on-dark.png](variant-e-on-dark.png) |
| Switched off by a click on the final build (`ea8bb6e`): the outlined track with the foreground thumb, `You're off the leaderboards.`, `Off the board`, the deck's `off the board by choice`, and the new line in place of Juno's row | [2-off-light.png](2-off-light.png) | [2-off-dark.png](2-off-dark.png) |
| Keyboard focus on the switched-off switch: the 2 px foreground outline | | [9-off-focused-dark.png](9-off-focused-dark.png) |
| Switched back on by Tab and Space: `You're on the leaderboards.` | [3-back-on-light.png](3-back-on-light.png) | |
| In flight, with the backend paused (`kill -STOP`): the switch disabled at its read position | [4-pending-light.png](4-pending-light.png) | |
| No answer within 10 s: `Couldn't reach HedgeHug. Try again.`, the switch enabled and where the read has it | [5-unreachable-light.png](5-unreachable-light.png) | [7-unreachable-390-dark.png](7-unreachable-390-dark.png) (390 px) |
| 390 px, after `kill -CONT`: the paused request ran once, the switch followed the read to on, and the failure line went | [8-landed-390-light.png](8-landed-390-light.png) | [8-landed-390-dark.png](8-landed-390-dark.png) |

Variant E's off state wasn't captured: its source (`HiddenLine` in `variants/e/Leaderboard.tsx` at `3409ade`) reads `You're off the board by choice. Switch on “Show me on the leaderboards” to come back.`, the line this change ships with straight quotes.

## In the browser

- After the website switch, the mock's `GET /control/home?user=U_JUNO` answered a published App Home view where there was none before: the republish ran.
- The status line is `display: block` with `sr-only` while empty, so the live region is in the accessibility tree before it speaks.
- The switched-off track's border computed to the muted-foreground token (`oklch(0.709 0 0)` in dark, `oklch(0.446 0.03 257)` in light), and its thumb to the foreground (`oklch(0.13 0.028 262)` in light).
- Tab onto the switched-off switch: `:focus-visible`, outline `solid 2px` in the foreground colour.
- At 390 px, `document.documentElement.scrollWidth` read 390: no horizontal overflow.

## V24's manual pass

- **Focus order:** the HUD, the period switch, `Show 4 more below`, `Show the whole board`, then the switch. The side panel follows the board in the DOM, as before.
- **Focus visibility:** Tab onto the switch matches `:focus-visible` and shows a 2 px foreground outline, measured at 3:1 on the card in both modes. After Space the focus stays on the switch, still visible, while the call is pending and after it.
- **Reduced motion:** the switch and its thumb carry `motion-reduce:transition-none`. The preview can't emulate the media query, so this is unverified in a browser.
- **Screen-reader wording:** the switch is named `Show me on the leaderboards` by its label, with `aria-checked` from the read, and `aria-disabled` while pending. The polite status says one of WS321's four lines.

## Tests

- **Red, backend:** [red-backend-no-command.txt](red-backend-no-command.txt) (no `setBoardVisibility`), [red-backend-republish.txt](red-backend-republish.txt) (no republish after a change), [red-backend-gate.txt](red-backend-gate.txt) (six gate conditions answering `set` without a gate).
- **Red, website:** [red-website.txt](red-website.txt): the switch tests against `main`'s read-only status.
- **Red, review findings:** [red-review-replay.txt](red-review-replay.txt), [red-review-stale-line.txt](red-review-stale-line.txt), [red-review-contrast.txt](red-review-contrast.txt), [red-stale-failure-line.txt](red-stale-failure-line.txt).
- **Green:** [green-backend.txt](green-backend.txt) (15 command tests and WS10's surface), [green-website.txt](green-website.txt) (311 tests in the four website files, none skipped).
- **Gate:** [gate.txt](gate.txt): `pnpm gate` on the tree merged with `main` (`e5c2311`), 2668 tests, through `fleet heavy`.

## Review (qa-swarm, two rounds)

A new public mutation that writes in production is a merge-risk danger area, so the change ran the qa-swarm: a GPT-6.1 Sol (high) review lane and a Claude Opus 5.5 (high) fresh-eyes lane, each read-only.

**Round 1** on `e0e18b5`: [review-gpt-6.1-sol.md](review-gpt-6.1-sol.md), [review-fresh-eyes-opus.md](review-fresh-eyes-opus.md). No backend finding.

1. **Fixed (high):** Convex's socket client resends every unconfirmed mutation after a reconnect, so a timed-out switch could later overwrite a newer change from another tab. The live site sends the call once over HTTP with the session's token. Red: [red-review-replay.txt](red-review-replay.txt).
2. **Fixed (both lanes):** `empty:hidden` dropped the live region from the accessibility tree. It is `sr-only` while empty.
3. **Fixed:** the set line could contradict the switch after another tab's change. Red: [red-review-stale-line.txt](red-review-stale-line.txt), [red-stale-failure-line.txt](red-stale-failure-line.txt).
4. **Fixed:** the switched-off track was 1.6:1. It has a 3:1 outline. Red: [red-review-contrast.txt](red-review-contrast.txt).
5. **Fixed (nit):** the switch slid under reduced motion.

**Round 2** on the fix diff (`e0e18b5..9ec188f`): [review-round-2-gpt-6.1-sol.md](review-round-2-gpt-6.1-sol.md) and the fresh-eyes lane. Red for the fixes: [red-review-round-2.txt](red-review-round-2.txt).

1. **Fixed:** the contrast test read Quill's dark thumb rule in both modes; the light off thumb was 1.6:1 on its track. The thumb is the foreground, and the test resolves each mode's rule.
2. **Fixed (both lanes):** a hidden line came back when another tab flipped the setting back. Lines retire once the read moves past them.
3. **Fixed:** the off outline took Quill's ring colour, so focus barely showed. A foreground focus outline, measured at 3:1.
4. **Rejected:** keep the switch pending until the read catches up. WS321 puts the position on the read and disables only while the call is pending (Coherence `d-a9822fcc`).
5. **Rejected:** abort the fetch at the 10 s budget. Aborting drops only the response; a request that arrived still runs (`d-c06ad53d`).
6. **Known limit:** an expired token after a long sleep reads as `Couldn't reach HedgeHug` once; the next toggle uses the refreshed token (`d-bb9c17a4`).
