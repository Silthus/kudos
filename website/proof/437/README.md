# Settings on the website (#437)

`/settings`, from a disposable local backend on `127.0.0.1:10210`/`10211` and the mock Slack issuer on `10212` (`testing/handshake/`), never a cloud deployment. Juno signed in through the real Convex Auth handshake.

## The flag override

On that local backend only, the mock served `everyone-board`, `message-settings`, `xp-levels` and `groups` on for everyone (`MOCK_FLAGS_ON`), beside `website`. Unlocks didn't apply, so the board was open by `everyone-board`. No PostHog project was read or written.

## The data

Two user groups, `Gardeners` and `Zebras`, were imported into `userGroups` and `userGroupMembers` with Juno in both, and a `memberGroups` row made `Zebras` Juno's primary group. Every change went through the page.

## Screenshots

| State | Light | Dark |
|---|---|---|
| Before any change: Messages (three kinds that apply: a choice of three places for two of them, a switch for Public celebrations), Leaderboards and Your group | [1-settings-light.png](1-settings-light.png) | |
| After choosing `None` for Level ups and `Gardeners` as the group: `Level ups: off.` and `You count for Gardeners.`, each control at its read position | [2-changed-light.png](2-changed-light.png) | [3-changed-dark.png](3-changed-dark.png) |
| 390 px: controls under their text, Settings current in the scrolling nav, no horizontal overflow (`scrollWidth` 390) | [5-changed-390-light.png](5-changed-390-light.png) | [4-changed-390-dark.png](4-changed-390-dark.png) |

## In the browser

- Each change was one `POST /api/mutation` over HTTP (sent once, never resent by the socket).
- After the change, the mock's `GET /control/home?user=U_JUNO` answered a published App Home view: the republish ran.

## Tests

- **Red:** [red-backend.txt](red-backend.txt) (23 failing: no `getSettings`, `setMessageSetting` or `pickPrimaryGroup`), [red-website.txt](red-website.txt) (no `/settings`).
- **Refutation, "a website command never launches unlocks":** [refutation.txt](refutation.txt): with the launch check dropped from both gates, both P77 tests fail.
- **Red, review findings:** [red-review-stale-group.txt](red-review-stale-group.txt), [red-review-stale-refusal.txt](red-review-stale-refusal.txt).
- **Green:** [green-backend.txt](green-backend.txt), [green-website.txt](green-website.txt).
- **Gate:** [gate.txt](gate.txt), `pnpm gate` through `fleet heavy` on the tree merged with `main`.

## Review

New public functions that write in production are a merge-risk danger area, so two GPT-6.1 Sol (high) reviewers ran read-only, one on the backend's guards and one on the website: [review-gpt-6.1-sol-backend.md](review-gpt-6.1-sol-backend.md), [review-gpt-6.1-sol-website.md](review-gpt-6.1-sol-website.md).

1. **Fixed (medium):** a group Slack had removed the member from, before reconciling caught up, passed the gate, and D17's reconcile wrote before the refusal. The gate now also checks Slack's current membership.
2. **Rejected (medium):** "the refusal checks run after the website exposure is written". That exposure is `memberMutation`'s admission for every web command (WS61, "website commands pass one guard"); a refusal writes none of the command's own effects (d-7f97022c).
3. **Fixed (low):** `getMyProfile` read every setting to answer one boolean. It short-circuits on the open board, then the flag.
4. **Fixed (low):** a refusal line could come back after another tab moved the read twice.

## Design spot check (Fable 5.1, once)

On the light, dark and 390 px screenshots:

1. **Rejected:** "render the three places in one fixed order across rows". The conductor's contract on #437 shows each kind's `places` with its default first, the order Slack's picker uses.
2. **Fixed:** at 390 px a two-place row's switch dropped under its text. It stays beside it at every width.
3. **Fixed:** `Show me on the leaderboards` was larger and lighter than every other row title. On `/settings` it reads `text-sm font-semibold`; the leaderboard page is unchanged.
4. **Fixed:** unchecked radio rings were faint in dark mode (V24). They carry the muted-foreground border the switches use.

After: [6-design-fixes-390-dark.png](6-design-fixes-390-dark.png).
