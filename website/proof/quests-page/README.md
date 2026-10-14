# The Journey panel and the quests page (#148)

WS72, WS73, WS69 and WS75, from a disposable local backend on `127.0.0.1:5110`/`5111` and the mock Slack issuer on `5112` (`testing/handshake/`), never a cloud deployment. Juno and Rowan signed in through the real Convex Auth handshake against the mock. Each state below is the running site, in light and dark.

## The flag override

`xp-levels`, `unlocks` and `quests` were on only on that local backend: the mock served them on for everyone with `MOCK_FLAGS_ON=xp-levels,unlocks,quests`, beside `website`, which the mock serves on. No PostHog project was read or written. Unlocks launched through `feedback/unlockFilter:unopenedReplyOf` for a user the directory doesn't know (P77's query-safe path, not the website), before the members joined. The website never ran the launch.

## The steps

1. **The Journey starts, Quests locked.** Juno, at level 1, signed in. The home shows the Journey panel between the counters and the feature cards, with `first-thanks` active: goal, hint and `Pays 10 XP`. Quests is under Still locked as `Weekly quests of your own.` [light](1-home-journey-started-light.png), [dark](1-home-journey-started-dark.png).
2. **`/quests` locked.** `Quests opens at level 2.` with a link home, and no Quests nav item. [light](2-quests-locked-light.png), [dark](2-quests-locked-dark.png).
3. **Ready, in place.** An imported `unlocks` row made Quests ready ([seed](seeds/3-unlocks-ready.jsonl)). The open page turned into the Quests crate with a primary `Open` (WS67). [light](3-quests-ready-light.png), [dark](3-quests-ready-dark.png).
4. **Opened from the page, then a real kudos.** The crate's `Open` sent `openFeature`, which drew the week. A signed Slack `message` event from Juno to Rowan that says why finished slot 0, `first-thanks` and `first-quest`. Slot 0 shows its crate, `Quest reward · 20 XP`, with Slack's fallback sentence and its progress kept; the others show `1 of 2` and `1 of 3`. The nav shows Quests, current. [light](4-quests-finished-light.png), [dark](4-quests-finished-dark.png).
5. **The home.** Both finished steps are crates, `Journey reward · {xp} XP`, and the Quests card under Open links to `/quests` with `Your quests this week.` [light](5-home-journey-finished-light.png), [dark](5-home-journey-finished-dark.png).
6. **Opened through App Home.** Signed `block_actions` clicks on App Home's own `Open` buttons opened `first-thanks` and slot 0. The open home followed: `✓ Done · You earned 10 XP`. [light](6-home-journey-opened-light.png), [dark](6-home-journey-opened-dark.png).
7. **Done, swapped and waiting.** Slot 0 reads `✓ Done`. A signed App Home `Swap` on slot 1 shows `Swapped`, reactively. Last week's finished, unopened crate, seeded by `convex import` ([draw](seeds/6-seed-questDraws.jsonl), [record](seeds/6-seed-rewardRecords.jsonl)), is listed under `Waiting to open`. [light](7-quests-opened-swapped-waiting-light.png), [dark](7-quests-opened-swapped-waiting-dark.png).
8. **No draw.** Rowan, with Quests open and an empty draw for the week ([seeds](seeds/8-questDraws-rowan.jsonl)), signed in from a separate browser profile: one hedgehog, `You have no quests this week.` and one `Open Slack`. [light](8-quests-no-draw-light.png), [dark](8-quests-no-draw-dark.png).

## V24's manual pass

- **Focus order:** on `/quests`, Tab runs Wordmark, Home, Quests, theme, account menu, then the page's one action (`Open Slack` on the empty state). Until ticket 7 adds `Open`, a page with quests has no focusable control in `main`. Arriving from the nav or the home card moves focus to `This week` (tested).
- **Focus visibility:** Tab from the title to `Open Slack` matched `:focus-visible`, with Quill's 2 px ring. [dark](9-keyboard-focus-dark.png).
- **Reduced motion:** the reward crates' single nudge comes from `CrateArt`, whose CSS already stops under `prefers-reduced-motion`. The preview can't emulate it, so this rests on #145's tests.
- **Screen-reader wording:** each progressbar is named `{done} of {target}` with its value range; the visible count is hidden from the accessibility tree, so it is read once. `✓` is hidden, so `Done` is read alone. The Journey is a list of steps, each with its goal as a heading, and no step count.
- **Non-text contrast:** the first build drew the progress track as filled `bg-muted`, about 1.4:1 in dark. It now uses the level bar's outlined `muted-foreground` track, visible in both modes (steps 4 and 7).

## Tests

- [red.txt](red.txt): `QuestsPage.test.tsx` and `JourneyPanel.test.tsx` on the tree before the change. 22 fail; the 6 that pass guard absence (no panel, no nav item, no `Waiting to open`).
- [red-copy.txt](red-copy.txt): the locked Quests card promised a group quest.
- [red-review.txt](red-review.txt): the review's three findings as tests, before the fix.
- Green and the gate: linked from #148's resolution.
