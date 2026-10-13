# Spec: the website's second slice, the leaderboard page and level and XP on the home

> **Accepted on 2026-10-13 under the product owner's autonomous directive** (map [#57](https://github.com/Silthus/kudos/issues/57) Notes: "ship as much as you can of this autonomously proofing each step and deploying dark and safely behind feature flags"), with every open call at its recommendation (listed under "Further Notes"). Ticket [#132](https://github.com/Silthus/kudos/issues/132). This file lives on the branch `docs/spec-website-2` and is never merged. It is the target design of the second slice; its implementation tickets are listed under "Slices". Its rules continue the first slice's: `WS1`–`WS28` are in [`spec/website.md`](https://github.com/Silthus/kudos/blob/docs/spec-website/spec/website.md) on `docs/spec-website`, and still hold.
>
> Sources: the first slice (#65, its spec, and its code on `main` at `05d07ea`: `website/`, `convex/website/`), the visual language ([`docs/website/visual-language.md`](https://github.com/Silthus/kudos/blob/main/docs/website/visual-language.md), V1–V24), the accepted UI prototype #62 (variant E's leaderboard, `prototype/website-ui` at `3409ade`), the groups spec (`spec/groups.md` on `docs/spec-groups`, G13–G24 and G45), the progression spec of record (`spec/progression.md` on `docs/spec-progression-v2`, P65–P67, P76–P79 and its changes to the groups spec, which already give the website the whole ranked board under G17), map #1's leaderboard on `main` (`convex/leaderboard/`, `convex/feedback/leaderboard.ts`, flag `everyone-board`), map #1's XP and levels on `main` (`convex/progression/`, flag `xp-levels`), the unlocks lane (`spec/unlocks`, ship #105, not on `main`), and the Octalysis findings #85.

## Problem Statement

The website's first slice shows a member their own kudos: what they have left, gave and received. Map #1 has since shipped two things to `main`, dark behind their flags: the Everyone board (kudos given this week, this month and all time, with a private improvement line) and XP and levels. Today a member sees them only in App Home and `/hedgehug leaderboard`, which Block Kit limits to a ten-row window and plain text fields. The website's home still shows the leaderboard as a locked card and says nothing of the member's level, although both exist.

## Solution

The website gains a **leaderboard page** at `/leaderboard`: the Everyone board for one period, with a headline that names the lead, a neutral podium for the top three, the rows around the member in G17's window, and the whole ranked board one click away with "Jump to me". The member's own improvement line sits in a panel marked "Only you see these". The page reads one new signed-in query, `getLeaderboard`, which composes the leaderboard module's facts and computes no rule. It exists only while both `website` and `everyone-board` are on for the workspace; otherwise `/leaderboard` is the not-found page and the home keeps its locked card.

The **home** gains the member's **level and XP**: a level ring on their avatar in the HUD and the hero, and one quiet line under the allowance with a neutral bar to the next level. The profile card panel adds `Level {n}`, because a level is public (P65). Everything comes from progression's own read, composed into `getMyProfile`, and only while `xp-levels` is on. Thanking still leads the hero (#85).

Both pieces are read-only. Changing `Show me on the leaderboards` stays in Slack's Settings until the website's first command.

## User Stories

**The leaderboard page**
1. As a member, I want to see this week's Everyone board on the website, so that I can see who is thanking colleagues the most.
2. As a member, I want to switch between this week, this month and all time, so that I can see the board I care about.
3. As a member, I want to see where I stand without scrolling, so that the board is about me first.
4. As a member, I want to see the whole board when I ask, and jump back to my own row, so that I can browse a long board without losing myself.
5. As a member, I want my improvement line to be visible only to me and never to state a loss, so that the board encourages me.
6. As a member who left the boards, I want to stay off every board on the website too, my own view included, so that my choice holds everywhere.
7. As a member who gave nothing this period, I want one clear pointer back to Slack, so that I know how to join the board.
8. As a member, I want the page to say what counts and what never ranks anyone, so that I trust it isn't a performance measure.
9. As a member, I want the board to update as kudos land, so that I never reload.

**Level and XP on the home**
10. As a member, I want to see my level and how much XP I need for the next one, so that I can follow my progress.
11. As a member, I want my profile card panel to show my level, so that I know what my teammates see.
12. As a member, I want the home to keep leading with thanking, so that the level doesn't become the point.

**Running it**
13. As the product owner, I want the leaderboard page to exist only while both the website and the Everyone board are on, so that a flag I haven't switched shows nothing.
14. As the product owner, I want level and XP on the website only while `xp-levels` is on, so that the website never shows more than Slack does.
15. As a developer, I want every new public function on WS10's exact list and behind `memberQuery`, so that the new entrance is a reviewed change.

## Rules

Rules continue the first slice's numbering, from `WS29`.

### The leaderboard read

- **WS29. One more signed-in query.** `getLeaderboard` in `convex/website/leaderboard.ts` is built on `memberQuery` (WS11) and takes one argument, `period`: `week`, `month` or `all`. `memberQuery` gains an optional argument validator for this; the member still comes only from the session, and an argument never names a member. WS10's exact list adds `./website/leaderboard.ts:getLeaderboard`, and WS10's rule text is unchanged, since it already covers the website's signed-in functions.
- **WS30. Only while the Everyone board is on.** After `memberQuery`'s guard, `getLeaderboard` reads the `everyone-board` flag for the workspace through the seam (O33). While it is off (no flags key, no flag, a failed evaluation, or production while the flag is sandbox-only) it answers `{ kind: "not-found" }`, and the page renders the not-found page (WS1), so the website shows nothing of a board Slack doesn't show. `getMyProfile` carries the same reading as `leaderboard: boolean`, which decides the HUD nav item (WS37) and the home's leaderboard card (WS38). Neither read sends an exposure: queries can't write, and the flag is a workspace surface gate here, as WS4 reads O36 for `website` (cross-map need 5).
- **WS31. Facts, never rules.** The board answer is composed from the leaderboard module only: the same totals, ranking (G16), windowing (G17), visibility (G22) and improvement line (G18) that App Home renders, for the viewer and the period in the viewer's own time zone. The website never ranks, windows, compares periods or filters a member itself. The module gains one additive export, `rankedBoardOf`, which returns the whole ranked board beside G17's window (WS32); App Home and the command keep their output byte for byte.
- **WS32. The whole board, with G17's window as the default view.** The progression spec's change to G17 gives the website the whole ranked board, with G17's window as its default view. The answer carries `rows`, every ranked member of the board in order, each with its `position` (1, 2, 3 …), its G16 `rank` (ties repeat it, and a tied row is marked), its display name, its face and its kudos given, and `window`, the positions G17's window shows. Members who left the boards (G22) and people who are no longer members (G15) are absent from `rows` for every viewer.
- **WS33. A row carries only what a board shows.** A board row holds exactly: position, rank, tied, name, face, kudos given, and `you` for the viewer's own row. It never holds a Slack user ID, a member ID, kudos received, XP, a level or a group (G13, G45, P66). Rows are keyed by position in the browser.
- **WS34. Names and faces of other members.** A row's name is the directory's display name. A member without one shows as "A teammate". Until the directory carries each member's Slack real name and picture (cross-map need 3), another member's face is their initials on a muted tile, the last step of V19's chain; the viewer's own row uses their own face (WS21). Initials come from the server, never from the browser splitting a name.
- **WS35. The viewer's standing.** The answer says where the viewer stands: `ranked` with their position and rank, `not-ranked` (they gave nothing this period, G17), or `left` (they left the boards, G22). The improvement line is G18's, passed through as data (`{ gain, places? }` or `{ best }`, or none), and is `null` for all time. For a viewer who left, it keeps the gain without places, as the module already answers.
- **WS36. Reactive, across the period's turn.** The page is one subscription to `getLeaderboard` for its period. It updates when any kudos lands, and like `getMyProfile` it reads the `websiteClock` (WS15), so an open board turns over to the new week or month at the viewer's local midnight without another kudos.

### The leaderboard page

- **WS37. Where it lives.** The page is `/leaderboard`, with the period in the query string: `/leaderboard` is this week, `/leaderboard?period=month` and `/leaderboard?period=all` the others, and any other value reads as this week. The tab reads `HedgeHug · Leaderboard`. While `getMyProfile.leaderboard` is true, the HUD's screen nav (WS16) shows `Home` and `Leaderboard`, with `aria-current="page"` on the current one.
- **WS38. The home's leaderboard card.** While `leaderboard` is true, the home's leaderboard card (WS19) is no longer locked: it is a plain card that links to `/leaderboard`, with the feature's name and one sentence, "See who's thanking colleagues this week." It never shows the member's rank or a count, so the home keeps leading with gratitude (#85). The other cards stay locked.
- **WS39. The board card and the periods.** The page opens with a panel label `Leaderboard · kudos given` and a period switch (`This week`, `This month`, `All time`, a Quill toggle group with `aria-pressed`, V24) that rewrites the URL without a reload. One board card, **Everyone**, "The whole company on one board", shows the viewer's standing: `You're #{rank}` (`You're tied at #{rank}` for a tie), `Not ranked yet`, or `Off the board`. The card is the selected board (V4's primary marks the selection) and is a heading, not a tab: the Groups and My group cards arrive with map #1's groups and become a tab list then.
- **WS40. The headline.** A panel labelled `Everyone · {period}` holds a RoundHog headline (V5) and one deck line, from the rows only:
  - one leader: `{name} leads {phrase}.`, or `You lead {phrase}.`;
  - several at rank 1: `{names} share the lead.`, naming the viewer as "You";
  - nobody ranked: the empty state (WS44) instead.
  The deck reads `{n} kudos given.`, the leader's total, followed by ` You're No. {rank} with {n}.` when the viewer is ranked below 1, `, tied with {names}` when they share it, or ` You're off the board by choice.` when they left. `{phrase}` is "the week", "the month" or "all time".
- **WS41. The podium.** The positions 1–3 of `window` stand on three neutral stepped pedestals, second, first and third from left to right, each with the face, name, kudos given and its rank (with "=" for a tie), and a crown icon over the first. Only the viewer's spot carries the primary ring and a "You" label (V4, V20). The pedestals and metals are neutral: no medal colours (V16 is achievements only) and no rarity colour. With fewer than three ranked, the empty pedestals are left out. The podium is a game object without corner marks (V2: the leaderboard is a reading surface), and it is static (V8, V9).
- **WS42. The list.** Below the podium, a plain Quill list (V2) labelled `No. · member` and `Kudos given` shows the rest of `window`, in order, with one `…` line where positions are skipped (G17). Each line shows the rank in RoundHog with tabular figures (V5), the face, the name, and the kudos given. The viewer's line has the primary ring, a left primary edge, and a "You" label (V20, V24). A viewer who isn't ranked sees `Give kudos this week to join the board.` (`this month`; all time: `Give kudos to join the board.`, G17) with one action that opens the workspace in Slack. A viewer who left sees `You're not on the leaderboards. You can change that in Settings in Slack.` in place of their row (G22).
- **WS43. The whole board and "Jump to me".** When `rows` holds more than `window` shows, a footer says `No. {first}–{last} of {total}` with the button `Show the whole board`. It replaces the list with every row of `rows` in a focusable scroll area of fixed height, scrolled so the viewer's row is centred. When the viewer's row scrolls out of view, a copy of it stays pinned to the top or bottom edge with the button `Jump to me`, which scrolls it back to the centre (instantly under reduced motion, V11) and moves focus to it. The footer's button then reads `Back to my spot` (or `Show fewer` for a viewer not on the board), which restores the window. There is no "show 5 more" stepping.
- **WS44. Empty, and errors.** A board with nobody ranked shows one hedgehog, one sentence from Max ("Nobody has given kudos this {week|month} yet." or, for all time, "Nobody has given kudos yet."), and one action that opens the workspace in Slack to thank someone (V23). It never points to a reward. Every denial answers as on the home (WS12, WS20).
- **WS45. Only you see these.** Beside the board (below it on narrow screens), a panel labelled with a lock icon and `Only you see these` holds the improvement line in G18's words: `▲ {gain} more kudos than this time last {period}`, plus ` · ▲ {places} places` when present, or `Your best {period} so far: {n} kudos.`. With no line, the panel isn't shown. It never states a loss (G18) and never names another member.
- **WS46. How it counts.** A second panel, `How it counts`, says: "Only kudos given count. Kudos received, XP and levels never rank anyone." (G13, P66). It shows the viewer's `Show me on the leaderboards` setting as a read-only status ("You're on the leaderboards." or "You're off the leaderboards.") and says it can be changed in Settings in Slack's App Home. It has no switch: the first web command comes later.

### Level and XP on the home

- **WS47. Only while `xp-levels` is on.** `getMyProfile`'s member answer gains `progression`: `null` while `xp-levels` is off for the workspace (read through `xpLevelsShownIn`, no exposure, WS30's reading), and otherwise `{ level, xp, levelStartsAt, nextLevelAt, xpToNextLevel }`. They come from progression's own read (`progressionHomeOf` and `xpToReach` in `convex/progression/`), composed in `getMyProfile`; the website never derives a level or a threshold from XP (WS13, P79). While `progression` is `null`, the home is the first slice's, unchanged.
- **WS48. The level on the avatar.** While `progression` is present, the member's avatar in the HUD (V1) and in the hero carries a level ring: a neutral ring with the level number in RoundHog on a small badge (V5). The ring is not filled by XP and never animates (V8, V9). Its accessible name is `Level {n}`. The avatar is still the member's face (WS21) until hedgehog facts exist.
- **WS49. One quiet line, after thanking.** In the hero, after the action and the allowance line (WS17), one line reads `Level {n} · {xpToNextLevel} XP to level {n + 1}`, with a neutral bar (V4) from `levelStartsAt` to `nextLevelAt` at `xp`, exposed as a progressbar with that text as its label. It is never a big stat, never primary, and never leads the hero (#85). Max's insight line is unchanged: it never forecasts a level-up.
- **WS50. The profile card shows the level.** While `progression` is present, the "Your profile card" panel (WS18) adds `Level {n}` beside the name, because a level is public (P65, G28 as the progression spec amends it). It still never shows a received count.
- **WS51. No skill points yet.** The home shows no skill points, coins, ready pill or crates. Skill points wait for the skill tree to be opened (#102, on `spec/unlocks`), so the website shows them with the unlocks slice, never before Slack does.

### Unlocks, when they reach `main`

- **WS52. The leaderboard page follows its unlock.** Once map #1's unlocks ship (#105) and the `unlocks` flag is on, the leaderboard page, its nav item and the home's leaderboard card follow P76 for the viewer, as App Home does after #103: before the member opens the leaderboard, `/leaderboard` shows "Leaderboard opens at level 3." or "Leaderboard is ready for you. Open it in Slack's App Home." with no board, and the home's card stays locked with that sentence. Opening on the website itself waits for the website's first command. A member's row on other members' boards never depends on their own unlocks (#103). This rule is built by ticket 5 once #105 is on `main`.

### Look, accessibility and proof

- **WS53. The look and the checks.** WS23–WS24 hold for every new screen: V1–V7 and V16–V24 on Quill, ported fresh from variant E with its count-ups (`CountUp`) and its `hud-rise` stagger dropped (V8, V9). Every state is checked with axe in light and dark. The keyboard path covers the nav, the period switch, `Show the whole board`, the scroll area, `Jump to me` and `Back to my spot`. Rank and tie are read out ("Rank 2, tied"), "you" is a ring plus a label, and the selection is a primary border plus `aria-pressed` (V24).

## Implementation Decisions

### Modules

- **Leaderboard module (extended, `convex/leaderboard/`, map #1's)**: one additive export, `rankedBoardOf(ctx, workspace, viewer, period)`, beside `everyoneBoardOf`, returning the whole ranked rows with positions and ties, G17's window as positions, the viewer's standing and the improvement line. It reuses the module's own `board`, `positionOf`, `improvement` and visibility code; `board.ts` exports what it needs (the ranked rows), and App Home's and the command's output don't change. Its tests run beside the module's.
- **Website module (extended, `convex/website/`)**: `memberQuery` takes an optional argument validator; `getLeaderboard` (new, `leaderboard.ts`), which maps the module's rows to WS33's shape with faces (WS34); `getMyProfile` gains `leaderboard` and `progression`. The `faceOf` and initials code moves to one place both queries use.
- **Progression module (unchanged, map #1's)**: the website reads `progressionHomeOf`, `xpToReach` and `xpLevelsShownIn`.
- **Website package (extended, `website/`)**: a small path router for `/` and `/leaderboard` (the not-found page for every other path, WS1), the leaderboard page and its parts (board card, period switch, headline, podium, list, whole board, the two side panels), the level ring and level line on the home, and `Level {n}` on the profile card panel.

### Contracts

```ts
// convex/website/memberQuery.ts (extended)
export function memberQuery<Result>(handler: (ctx: QueryCtx, me: VerifiedMember) => Promise<Result>): RegisteredQuery<"public", {}, Result | Denial>;
export function memberQuery<Args extends PropertyValidators, Result>(
  definition: { args: Args; handler: (ctx: QueryCtx, me: VerifiedMember, args: ObjectType<Args>) => Promise<Result> },
): RegisteredQuery<"public", ObjectType<Args>, Result | Denial>;
// the guard and its order are unchanged (WS11); arguments never name a member

// convex/leaderboard/totals.ts (additive)
export type RankedRow = { position: number; rank: number; tied: boolean; member: MemberId; name: string | undefined; kudos: number; viewer: boolean };
export type RankedBoard = {
  rows: RankedRow[];                       // every ranked member, in order (G15, G16, G22)
  window: number[];                        // the positions G17's window shows, ascending
  standing: { kind: "ranked"; position: number; rank: number } | { kind: "not-ranked" } | { kind: "left" };
  improvement: Improvement | null;          // G18, null for all time; without places for a viewer who left
};
export function rankedBoardOf(ctx: QueryCtx, workspace: string, viewer: string, period: Period): Promise<RankedBoard>;

// convex/website/leaderboard.ts
export const getLeaderboard = memberQuery({ args: { period: periodValidator }, handler: async (ctx, me, { period }): Promise<Leaderboard> => … });
export type MyLeaderboard = Denial | { kind: "not-found" } | Leaderboard;
export type Leaderboard = {
  kind: "board"; period: Period; chatUrl: string;
  rows: Array<{ position: number; rank: number; tied: boolean; name: string; face: Face; kudos: number; you: boolean }>;
  window: number[];
  standing: RankedBoard["standing"];
  improvement: Improvement | null;
  onTheBoards: boolean;                     // WS46's read-only status
};

// convex/website/profile.ts (extended)
export type MemberProfile = {
  /* the first slice's fields */
  leaderboard: boolean;                     // website and everyone-board both on (WS30)
  progression: { level: number; xp: number; levelStartsAt: number; nextLevelAt: number; xpToNextLevel: number } | null; // WS47
};
```

`rankedBoardOf`'s `name` is the directory's display name when it has one; `getLeaderboard` turns a missing one into "A teammate" (WS34) and drops `member`, so no ID reaches the browser (WS33).

### Data

No new table and no migration. The board reads `givenTotals`, `givenByDay`, `leaderboardSettings` and `members` (map #1's); the home reads `memberProgress` (map #1's).

A board reads every period total of the workspace, as App Home's does. That is fine for one internal workspace; a workspace whose total rows near a query's read limit would need a paged board, which is out of scope here.

### The flags

| Flag | Owner | Subject | Gates on the website | State |
|---|---|---|---|---|
| `website` | this map ([957148](https://us.posthog.com/project/662840/feature_flags/957148)) | workspace | the whole site (WS2–WS4) | sandbox-only, already created |
| `everyone-board` | map #1 (#83) | workspace | the leaderboard page, its nav item and the home's card (WS30, WS37, WS38) | sandbox-only, already created by map #1 |
| `xp-levels` | map #1 (#82) | workspace | level and XP on the home and the profile card panel (WS47–WS50) | sandbox-only, already created by map #1 |
| `unlocks` | map #1 (#104) | workspace | the leaderboard page's P76 states, from ticket 5 (WS52) | map #1's, when #105 ships |

The website creates no new flag. Opening each piece in production is the product owner's switch on the flag that already gates it in Slack, so the website never shows more than Slack does. All are read on the server through the seam.

### Coherence

Proposed declarations. Each ticket writes its part and makes `coherence spec --check` pass.

- **Entrances** (`convex/website/WebsiteReads.spec.md`): `query getLeaderboard: a browser asks for one period's Everyone board as the signed-in member sees it, with the period as its only argument`, trust `browser`.
- **Invariants:**
  - *website reads pass one guard* gains the entrance `query getLeaderboard`, witnessed for it with no session, the flag off and a member.
  - *the public surface is exact* keeps its test, which now lists `getLeaderboard`.
  - *the website's board is invisible while everyone-board is off* (WS30): crossing `browser -> domain`, entrances `query getLeaderboard`, `query getMyProfile`.
  - *a website board row carries only what a board shows* (WS32, WS33): crossing `browser -> domain`, entrances `query getLeaderboard`; witnessed with a member who left the boards, a member who only received, and a former member.
  - *level and XP are invisible while xp-levels is off* (WS47): crossing `browser -> domain`, entrances `query getMyProfile`.
- **Leaderboard module** (`convex/leaderboard/Leaderboard.spec.md`): its summary names `rankedBoardOf` and its existing invariants (G13, G18, G22) are witnessed through it too, so the website's board can't drift from App Home's.
- **Journal:** each ticket records its decisions with `coherence decide` and commits the journal with the change.

## Testing Decisions

- **A good test enters at a seam and checks what a member could observe**: what `getLeaderboard` and `getMyProfile` answer, what the rendered page says and where focus goes. Never private helpers.
- **Seams, highest first:**
  1. **The leaderboard read** with `convex-test`: `getLeaderboard` for each denial, `everyone-board` off and on, each period, ties, a viewer at position 2, at 9 (the gap), not ranked, and who left; a member who only received; a former member; a member without a display name; an argument that tries to name another member is rejected by the validator. The whole board equals the window wherever both show a position, and the window equals `everyoneBoardOf`'s rows for the same viewer and period. A subscription turns over at the viewer's local Monday on a clock tick. Covers WS29–WS36.
  2. **The leaderboard module** (`rankedBoardOf`) beside its own tests, and App Home's and the command's existing tests green unchanged (WS31).
  3. **The profile read**: `getMyProfile`'s `leaderboard` and `progression` with each flag off and on, at level 1, at a level boundary, and past level 5, where it still carries no skill points (WS47, WS51).
  4. **The public surface test** listing `getLeaderboard` (WS29).
  5. **The browser package** with Vitest and Testing Library from typed fixtures: the nav item and the home card only while `leaderboard` is true; the period switch and the URL; the headline for one leader, a shared lead, the viewer leading, and empty; the podium order and ties; the list's gap line; not ranked and left; the whole board, `Jump to me` and `Back to my spot` with the keyboard; the private panel's G18 copy and its absence; the level ring, the level line and bar, and `Level {n}` on the profile card only while `progression` is present; axe in light and dark for every state (WS37–WS50, WS53).
- **Proof each ticket owes:** a red test before the change and green after, `pnpm gate` green (heavy runs through `~/dev/fleet/fleet heavy --`), and for a ticket that changes what the browser shows, screenshots of the running site in light and dark mode in its pull request, from a disposable local backend on its own ports with the flags on through a recorded local override, plus V24's manual pass. The sandbox ticket adds screenshots from the sandbox with the flags on, and a check that production's flags answer off.

## Slices

Each ticket is a sub-issue of map #57, sized to one agent session, and merges into the conductor's integration branch for this slice, never into `main` (WS27). Blocking edges: 1 → 2; 2 and 3 → 4; 2 → 5.

1. **The leaderboard read** — `memberQuery` with arguments, `rankedBoardOf` in the leaderboard module, `getLeaderboard`, `getMyProfile.leaderboard`, the public surface list, and the Coherence entrance and invariants. WS29–WS36. Blocked by nothing.
2. **The leaderboard page** — the router, the nav item, the home's leaderboard card, the board card, the period switch, the headline, the podium, the list, the whole board with `Jump to me`, the two side panels, and the empty state. WS37–WS46, WS53. Blocked by 1.
3. **Level and XP on the home** — `getMyProfile.progression`, the level ring in the HUD and the hero, the level line and bar, and `Level {n}` on the profile card panel. WS47–WS51, WS53. Blocked by nothing.
4. **Prove the second slice on the sandbox** — merge `origin/main`, deploy the integration branch to `different-dog-467` (the first slice's rules 1 and 2 for the shared sandbox), check `everyone-board` and `xp-levels` answer on there and off in production, and record screenshots in light and dark of the leaderboard page and the home. Blocked by 2 and 3.
5. **The leaderboard page follows its unlock** — WS52, through the unlocks read map #1 ships with #105. Blocked by 2, and starts only once #105 has merged to `main`.

## Cross-map needs on map #1

This spec edits nothing on map #1. Map #1's conductor reads these from #57.

1. **G45 amendment.** The groups spec's G45 says individual boards are seen only inside App Home and private replies. The website shows them to signed-in members of the same workspace only, so G45 needs "and the signed-in website" (already on #57's list). Not blocking: production stays dark behind `website` and `everyone-board`, and the progression spec's G17 change already names the website's whole board.
2. **`rankedBoardOf` in the leaderboard module.** Ticket 1 adds it to `convex/leaderboard/` as an additive export, with App Home's and the command's output unchanged and the module's invariants witnessed through it, the way the first slice added `refillsAt` to `homeFacts`. Map #1's lanes that edit `convex/leaderboard/` (groups, #52) merge `main` and keep it.
3. **Directory display fields.** Each member's Slack real name and picture in the directory, from users.info, `team_join` and `user_change` (the first slice's cross-map need 10, and #64's list). Until then other members show initials (WS34). A website follow-up adopts them for V19's full chain.
4. **The unlocks read for the leaderboard.** Ticket 5 needs #105 on `main` (the unlock filter #102 and the leaderboard's unlock #103). The website then also shows skill points (WS51).
5. **O36 for website reads.** Like `website` (WS4), the website's reads of `everyone-board` and `xp-levels` send no `$feature_flag_called`: queries can't write, and Slack's surfaces keep sending one exposure per member. Map #1's conductor records this reading.
6. **Groups (#52).** The Groups and My group boards, their cards and G19's peer line join the page once map #1's groups ship, as a later website slice.

## Out of Scope

- Changing `Show me on the leaderboards`, opening an unlock, or any other command on the website (the first web command is a later slice).
- The Groups and My group boards, G19's peer line, and the Monday post.
- Skill points, coins, the ready pill, crates, level-up moments and band pages (V10–V15).
- Other members' company cutouts and Slack pictures (cross-map need 3), and profile pages of other members.
- A paged board for very large workspaces.

## Further Notes

Calls taken at recommendation under the AFK directive:

1. **The whole ranked board is in, with G17's window as the default view**, because the progression spec of record already amends G17 for the website. "Jump to me" lives in the whole board, where it is needed; "show 5 more" steps are dropped as unneeded.
2. **The window and the ranking come from the leaderboard module** through one additive export, so the website computes no rule and can't drift from App Home.
3. **One board card, Everyone,** shown as a heading, since only the Everyone board is on `main`. The tab list arrives with groups.
4. **The page is gated by map #1's own flags plus `website`**, with no new website flag: a piece is on in production exactly when Slack shows it there.
5. **The leaderboard read sends no exposure** (cross-map need 5), as WS4 already reads O36 for `website`.
6. **Other members show initials** until the directory carries real names and pictures; matching a company cutout by display name would break V21.
7. **No IDs reach the browser:** rows are keyed by position.
8. **Read-only:** the visibility setting is shown as a status, changed in Slack.
9. **The period is a query parameter** (`?period=month`), so later boards can take the path (`/leaderboard/groups`).
10. **Level and XP sit after thanking**, as one quiet line and a neutral ring with no fill, never a big stat (#85, V4, V9).
11. **No skill points on the website yet**, because #102 makes them wait for the skill tree's opening once unlocks ship.
12. **The unlock rule is published now as ticket 5**, blocked until #105 reaches `main`, so the conductor sees the dependency and the page never stays ungated after unlocks ship.
13. **A sandbox proof ticket** (4) before the conductor's ship ticket, because the sandbox is shared and each proof needs its own deploy.

The `to-spec` and `to-tickets` skills can only be started by a human, so this spec follows the first slice's layout (`spec/website.md`) instead.
