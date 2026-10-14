# Open a quest crate on the website (#149)

WS74, WS68, WS75 and WS64, from a disposable local backend on `127.0.0.1:5310`/`5311` and the mock Slack issuer on `5312` (`testing/handshake/`), never a cloud deployment. Juno signed in through the real Convex Auth handshake against the mock. Each state below is the running site.

## The flag override

`xp-levels`, `unlocks` and `quests` were on only on that local backend: the mock served them on for everyone with `MOCK_FLAGS_ON=xp-levels,unlocks,quests`, beside `website`. No PostHog project was read or written.

## The launches came first, and never from the website

1. Unlocks launched through `feedback/unlockFilter:unopenedReplyOf` for a user the directory doesn't know (P77's query-safe path).
2. The Journey launched through `quests/weekly:drawWeeklyQuests` with an `unlockOpened` event for a placeholder member ([seed](seeds/placeholder.jsonl)), before Juno and Rowan joined ([seed](seeds/seed-members.jsonl)).

After every website call, the backend still held exactly one of each: [unlockLaunches](unlock-launches.txt), [journeyLaunches](journey-launches.txt). The command's own gate refuses before D17 while either launch is missing (tested in `convex/website/openQuestCrate.test.ts`).

## The steps

1. **Crates on `/quests`.** Juno's Quests is open and this week is drawn ([unlocks](seeds/seed-unlocks.jsonl), [draw](seeds/seed-questDraws.jsonl)). One signed Slack `message` from Juno to Rowan that says why ([driver](drive.mts)) finished slots 0 and 1, `first-thanks` and `first-quest`. The first crate on the page has a primary `Open`, the second an outline one, and the pill reads `4 ready`. The sign-in started on `/quests` came back there (`redirectTo=%2Fquests`). [light](1-quests-crates-light.png), [dark](1-quests-crates-dark.png).
2. **The reveal plays after `opened`.** `Open` sent `openQuestCrate` with the crate's own quest from the read. The dialog is labelled `Quest reward`. Behind it, the card already reads `✓ Done`, the next crate took the primary `Open`, and the pill reads `3 ready`. [playing, dark](2-quest-reveal-playing-dark.png).
3. **The end state.** `You earned 20 XP`, a primary `Done` and `Replay`. There is no `See this week's quests`, because the reveal started on `/quests`. [light](3-quest-reveal-end-light.png), [dark](3-quest-reveal-end-dark.png). After `Done`, focus was on the quest's card, and the browser held only the opaque `seen` key ([focus](focus-after-quest-reveal.json)).
4. **Journey crates on the home.** Both finished steps are crates with an outline `Open`, after the counters. [light](4-home-journey-crates-light.png), [dark](4-home-journey-crates-dark.png).
5. **A Journey reward.** `Open` on `first-thanks` played `Journey reward` ([playing, dark](5-journey-reveal-playing-dark.png)) and ended on `You earned 10 XP` with `See this week's quests`, because Quests is open and the reveal started on the home. [light](6-journey-reveal-end-light.png), [dark](6-journey-reveal-end-dark.png). Esc closed it, and focus was on the `first-thanks` step.
6. **The ready pill.** `2 ready` took the first quest crate, the Journey's `first-quest`. It played `Journey reward` · `You earned 20 XP`, the live region said `You opened your Journey reward.`, and the pill read `1 ready`.
7. **To this week's quests.** `See this week's quests` went to `/quests` and closed the dialog. Slot 0 reads `✓ Done`, slot 1 has the page's one primary `Open`. [light](7-quests-after-light.png).

## App Home drops each crate

The mock records every `views.publish`. App Home's `Open` buttons went from 4 ([before](app-home-before.json)) to 3 after the website opened slot 0 ([after the quest](app-home-after-quest.json)) to 1 after both Journey crates ([after](app-home-after.json)); summary in [app-home-opens.txt](app-home-opens.txt). The backend holds one crate opening per opened crate: [crateOpenings](crate-openings.txt).

The Journey shots in step 4 were retaken after a divider fix: `crateOpenings` was reset to slot 0 alone ([seed](seeds/crateOpenings-weekly-only.jsonl)), so both steps show their crates again.

## V24's manual pass

- **Focus order:** in the Journey panel, Tab runs from the first step's `Open` to the second's. In the reveal, Tab cycles through its actions and stays inside the dialog (tested).
- **Focus visibility:** Tab onto the second step's `Open` matched `:focus-visible`, with Quill's ring. [dark](8-keyboard-focus-dark.png).
- **Focus return:** to the quest's card on `/quests`, and to the Journey step on the home (steps 3 and 5). An earlier week's crate leaves the read once opened, so its reveal returns focus to the page title (WS24, tested).
- **Reduced motion:** the reveal reuses #145's dialog, whose reduced-motion path is tested. The preview can't emulate it.
- **Screen-reader wording:** the dialog is named `Quest reward` or `Journey reward`; the live region says `You opened your quest reward.` or `You opened your Journey reward.`, and the pill reads `{n} ready`.

## Tests

- [red-convex.txt](red-convex.txt): `openQuestCrate.test.ts` before the command existed, 20 of 20 failing, and WS10's surface test missing `openQuestCrate`.
- [red-website.txt](red-website.txt): `questCrateMoment.test.tsx`, `JourneyPanel.test.tsx` and `QuestsPage.test.tsx` before the change, 18 failing.
- [red-deep-link.txt](red-deep-link.txt): a sign-in started on `/quests` came back to `/` after the merge of #157.
- [review-gpt-6.1-sol.txt](review-gpt-6.1-sol.txt): the review's one finding, rejected with a test (see #149's resolution).
- Green and the gate: linked from #149's resolution.
