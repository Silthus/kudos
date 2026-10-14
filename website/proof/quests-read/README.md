# The quests read and the Journey's facts (#147)

WS69–WS71 and WS64, from a disposable local backend on `127.0.0.1:4910`/`4911` and the mock Slack issuer on `4912` (`testing/handshake/`), never a cloud deployment. This ticket changes no page: the Journey panel and `/quests` come in later tickets. So the proof is each read's answer for a signed-in member, called with `convex run --identity` and that member's own `users` and `authSessions` rows.

## The flag override

`xp-levels`, `unlocks` and `quests` were on only on that local backend: the mock served them on for everyone with `MOCK_FLAGS_ON=xp-levels,unlocks,quests`, beside `website`, which the mock serves on. `KUDOS_ENVIRONMENT` was `sandbox`. In step 8 the mock restarted with `MOCK_FLAGS_ON=xp-levels,unlocks`, followed by `lib:refreshFlagDefinitions`, to switch `quests` off. No PostHog project was read or written.

## The steps

1. **Launches before anyone joined.** `feedback/unlockFilter:unopenedReplyOf` for a user the directory doesn't know recorded unlocks' launch, `shipped: ["quests"]`. `quests/weekly:drawWeeklyQuests` for a placeholder member recorded the Journey's launch. Juno and Rowan joined after both launches, so the join stored nothing for them.
2. **Locked, and a website-first member.** At level 1 Juno's `getQuests` answers `{ kind: "locked", level: 2 }`: [1-getQuests-locked.json](1-getQuests-locked.json). Her `journey` lists `first-thanks` active, with its goal, hint and 10 XP: [1-journey-website-first.json](1-journey-website-first.json). `journeySteps` holds no row of hers, only the placeholder's: [1-journeySteps.txt](1-journeySteps.txt).
3. **Ready.** Unlocks' `makeReady` ran with a `levelReached` event for level 2: [2-getQuests-ready.json](2-getQuests-ready.json).
4. **Open.** The website's own `openFeature({ feature: "quests" })` answered `opened` ([3-openFeature.json](3-openFeature.json)). The backend ran the scheduled draw and the `first-quest` activation. `getQuests` lists three slots in progress at 0, with an empty `waiting`: [3-getQuests-open.json](3-getQuests-open.json). The journey gains `first-quest`, active, with no hint: [3-journey.json](3-journey.json).
5. **A real kudos.** A signed Slack `message` event from Juno to Rowan that says why. Each slot's `done` moved to 1. `Thank someone and say why.` is `finished`, with its `crate` and `seen`. `first-thanks` and `first-quest` are `finished`: [4-slots-after-kudos.json](4-slots-after-kudos.json), [4-journey-after-kudos.json](4-journey-after-kudos.json).
6. **Opened and swapped, through App Home.** App Home's published buttons carry the same `quest` values the read returns: [5-app-home-before.json](5-app-home-before.json). Signed `block_actions` clicked `Open` on `first-thanks` and `Swap` on slot 2. `first-thanks` reads `opened`, with the same `seen` and no `crate`. Slot 2 reads `swapped`, with the quest swapped in at 0: [5-getQuests-after-clicks.json](5-getQuests-after-clicks.json), [5-journey-after-clicks.json](5-journey-after-clicks.json), [5-app-home-after.json](5-app-home-after.json).
7. **Waiting.** The backend's clock can't move to next Monday. So last week's finished, unopened crate was seeded by `convex import --append`: its draw ([6-seed-questDraws.jsonl](6-seed-questDraws.jsonl)) and its reward record ([6-seed-rewardRecords.jsonl](6-seed-rewardRecords.jsonl)). `waiting` lists it with its goal, recorded XP, `crate` and `seen`: [6-getQuests-waiting.json](6-getQuests-waiting.json). The real Monday turn is proven in `convex-test`.
8. **Another member.** Rowan, at level 1, reads Quests locked and his own `first-thanks` active: [7-getQuests-rowan.json](7-getQuests-rowan.json), [7-journey-rowan.json](7-journey-rowan.json).
9. **Quests off.** `getQuests` answers `not-found`, `journey` is `null`, and the Quests feature has no card: [8-getQuests-quests-off.json](8-getQuests-quests-off.json), [8-profile-quests-off.json](8-profile-quests-off.json).

## Tests

- [red.txt](red.txt): `convex/website/quests.test.ts` on the tree before the change. 19 of 19 fail: `getQuests` and `journey` are missing.
- [green.txt](green.txt): the same file, after review, plus `convex/publicSurface.test.ts` on the landed tree, verbose, none skipped.
- The gate: [gate.txt](gate.txt).
- Coherence, in `convex/website/WebsiteReads.spec.md`:
  - *quests are invisible where they don't apply* is new. It was refuted by dropping `journeyStepsOf`'s `questsApplyIn` check: 4 of 4 tests failed. The code was then restored, and it is green batched and alone.
  - *website reads pass one guard* gains `query getQuests`.
