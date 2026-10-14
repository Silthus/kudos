# Achievements

Achievements: owns each member's ladders and the tiers they earn, and the Book that shows them (P58 to P61, P75, P76, P78, P79, P93). The ladder catalogue is versioned code with a stable ID for every ladder, tier and tier reward; the names are copy. It holds the ladders that need nothing unshipped: Generosity, counting kudos given, and Recognition, counting kudos received, each with bronze at 1, silver at 25, gold at 100 and diamond at 500, Connections, counting different people thanked, at 3, 6, 12 and 24; Dependability, counting days with a kudos given, at 10, 30, 100 and 250; Applause, counting days thanking 3 or more different people, at 3, 10, 30 and 100; Seasons, counting calendar months with a kudos given, at 1, 3, 6 and 12; and `Old Friends`, counting the times a member thanked someone again 30 or more days after they last did, with bronze at 1, silver at 3, gold at 6 and diamond at 12. Each tier names its promised reward by kind and reward ID: bronze coins, silver a kudos emoji, gold a hedgehog, diamond coins and a hedgehog. The Book ships with the achievements flag in Unlocks' schedule and opens achievements, so it becomes ready at level 4 only where the achievements flag is on, and its readiness copy names nothing that hasn't shipped. The Book applies in a workspace only where the achievements flag (a workspace flag, off by default), xp-levels are on and unlocks applies there; every mutation and query that shows the Book reads that one predicate. App Home's publish, which also follows every XP change, sends the achievements exposure once per member and value, and only where xp-levels and unlocks apply, since only there does the flag decide anything (O36). The first mutation that sees the Book apply in a workspace stores the Book's launch once, with its time: Achievements' kudosGiven subscriber, App Home's publish, or any of Unlocks' mutations that sees unlocks live there (its own launch, readiness on a level up, the ship sweep, an opening or a command's reply), so the Book is never ready before it is launched. Nothing is counted before the launch, and the launch counts the workspace's whole history (P62): the first mutation that sees a ladder or tier ID the workspace hasn't evaluated, the launch itself or the first one after a deploy that adds one, records those IDs as evaluated and schedules their replay, so each ladder and tier is evaluated once per workspace. A ladder new to the workspace is replayed over every Given award of the workspace in award order, 100 awards per mutation, each mutation scheduling the next and keeping where it stopped apart from the replay's own record, which changes only when the replay finishes, so the kudos and Unlocks mutations that read the records don't conflict with every page; a tier added to a ladder is evaluated from the count stored with each counted award, once that ladder's history is counted (a tier added while it is still being counted waits for it), so nothing is counted again and the tiers already earned stay as they are; each replay earns only the tiers it records. The replay and the kudosGiven subscriber share the award-keyed counting, so an award counts once whichever of them reaches it first: the subscriber counts a ladder only once that ladder's replay has finished, and the replay reads to the last award, so it catches up every award given while it ran, in award order. All the ladders and tiers one mutation finds unevaluated form one launch batch: every tier a replay earns carries its batch, in its record and in achievementEarned, and the batch is complete only when all its replays are; when it completes, each member who had opened the Book by then is told the tiers it earned them, while the Book applies. From the launch on the subscriber counts every kudos, whatever the flags say later, so turning a flag off and on again loses nothing. Each award counts once per member and ladder, keyed by the award, whatever its gate decision (P13): in kudos units toward the giver's Generosity and the recipient's Recognition; toward the giver's Connections, Dependability, Applause and Seasons from what each of them keeps per member, the people the giver thanked, the days and months they gave a kudos and the different people they thanked on each day, never by reading their history again, so live counting and the replay stay within Convex's read limits; and as one toward the giver's `Old Friends` when the giver's previous award to the same recipient, in award order, was on a giver's day 30 or more days earlier (a first thanks to someone counts nothing), so a redelivered kudosGiven counts nothing twice, and the count after it is stored with it. Days and months are the giver's, the day the award was given on in their time zone (P59), and a person, day or month counts once per member: Applause counts a day once it reaches 3 different people, across any number of messages that day. `Old Friends` reads that previous award from the awards, which are never changed, so whether an award counts never depends on the order the replay and the subscribers reach a pair's awards. When an award takes a count from below a tier's count to at or above it, the tier is earned: it is stored once per member, ladder and tier, with the time of the award that reached it, that award, the catalogue version and the promised rewards, marked hidden when the subscriber or a replay page earns it while the Book doesn't apply, each reading the Book's predicate in its own mutation, so it is never announced, not even in a later summary, and never changed or taken back, so a kudos made earlier but counted later never moves a tier's date; Achievements publishes achievementEarned for it, keyed by member, ladder and tier, in the same mutation. A tier whose rewards include coins pays them in the same mutation, whatever any flag says, hidden or not (CO1, CO7): one reward record per coin reward, written through Progression's recordReward, which credits the wallet, `{ xp: 0, coins, item: null }` with bronze 10 and diamond 100, keyed `tier:{reward ID}` and dated by the tier's earned time; the other kinds are granted when they ship. A one-off internal job, backfillTierCoins, pages through every earned tier, 25 per mutation, and writes the same records, dated by the time it ran, for the tiers earned before coins existed; it tells nobody, and since the key exists, a second run, or a tier earned while it runs, writes nothing twice. The ship runs it to completion in a deployment before `coins` is created or switched on there. While the Book is shown, the subscriber hands the tiers a kudos earns each member to tellTiersEarned in the same mutation, which tells members who had opened the Book by the kudos' time; a tier earned while the Book doesn't apply is never handed over. After a kudos counts for a member who has opened the Book, while it applies, Achievements republishes their App Home. App Home gets a Book tab once the member has opened the Book while it applies, showing each ladder's count with what it counts, in the singular for a count of 1, every earned tier with its name and date in the member's time zone, and the next tier with the count it needs, never whom to thank. The website reads achievementsOf, whose shape stays stable: each ladder in catalogue order with its ID, name, what it counts and its count, every tier in ladder order with its ID, name, threshold and promised rewards, each reward of kind coins with its coins and, once the tier is earned, recordedAt, the time its reward record was written, or null for a tier earned before coins existed until the backfill pays it (CO28), and, once earned, its earned time and catalogue version, and the next tier's ID, and nothing where the Book doesn't apply or hasn't launched.

## invariants
- a tier is earned once and never taken back: A member earns each tier of a ladder at most once, dated by the award that reached its count, and keeps it with that date; however often a kudosGiven is delivered, its award counts once per member and ladder, and achievementEarned is published once per member, ladder and tier.
  over: a kudos that reaches 25 given delivered twice, and a kudos after a tier was earned, read through achievementsOf and the published achievementEarned events
  via: P59 P61 P93: a tier is earned once and never taken back
  because: a tier is earned once and never taken back (P61), and achievementEarned is keyed by stable IDs (P93) so the notices and rewards built on it fire once; the bus schedules each kudosGiven subscriber on its own and may run one again, so without the award key a redelivery would count a kudos twice and without the tier key it would earn and announce a tier again
  refuted: earnTier no longer skipped a tier already earned -> both cases failed: the redelivery and the later kudos earned and published the tier again (2026-10-14)
  refuted: countKudosGiven no longer skipped an award already counted -> the redelivery case failed: the count reached 26 (2026-10-14)
  kinds: message, state
  checklist: destination-confinement dismissed: the subscriber sends nothing outside; achievementEarned goes only to the in-process bus
  checklist: message-authenticity dismissed: kudosGiven comes from the engine's own transaction, never from outside; the Slack event behind it is covered by signed Slack requests only
  checklist: input-validation dismissed: the subscriber's argument is checked by the kudosGiven event validator, and only the engine publishes the event
  checklist: retry-recognition dismissed: a repeated event finds its award already counted and is skipped as done, never reported as a conflict
  checklist: duplicate-suppression declared as a tier is earned once and never taken back
  checklist: keyed-ordering dismissed: a count is a sum, and Convex serializes the mutations that touch one member's count, so each sees the other's total and only the one that reaches a tier earns it
  checklist: acknowledgment-barrier dismissed: nothing acknowledges kudosGiven; the count, the earned tier and the event commit in one mutation
  checklist: retry-classification dismissed: the subscriber calls no external system
  checklist: revalidated-permission dismissed: no permission is involved; the launch is read in the same mutation that counts
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession declared as a tier is earned once and never taken back
  checklist: supersession-safety dismissed: an earned tier is never replaced; the first record stands and every later count only skips it
  checklist: worker-fencing dismissed: no worker owns a member's ladders; Convex serializes the mutations that touch one member's rows
  checklist: commit-ordered-effects dismissed: achievementEarned is published inside the transaction that stores the tier and reaches subscribers only after it commits
  checklist: resumption-coverage dismissed: no batch operation resumes
- a tier's coins are paid once: Each coin reward of a tier a member earned is written as one reward record, keyed by its reward ID, and credits their wallet once, whether the tier is earned live, its kudosGiven is delivered again, the backfill pays it, runs again, or runs while the tier is earned.
  over: a kudos earning bronze tiers with every flag off delivered twice, 60 members holding all 28 tiers paid by the backfill run twice under Convex's transaction limits, and a tier earned live between two backfill pages, read through the reward records, the wallet balances and the backfill's totals
  via: CO1 CO7: a tier's coins are paid once, whether it is earned live or by the backfill
  because: CO7 pays a tier's coins once, at earning or through the backfill for tiers earned before coins existed; the bus may run a kudosGiven subscriber again, the ship may run the backfill twice, and a live earning can land between two of its pages, so without the reward key a member would be paid a tier's coins twice and the wallet would show coins nobody earned
  refuted: payTierCoins wrote each coin reward's record and credit directly, without recordReward's check that its key was already recorded -> 2 of 3 failed: the second backfill run paid 840 records again, and the backfill paid the tier earned live between its pages a second time (2026-10-14)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; earning and the backfill pay whatever the flags say (CO1)
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: a reward record is only ever inserted, once per key, and the balance only grows by its coins
  checklist: supersession-safety dismissed: a reward record is never replaced; a second write for its key finds it and writes nothing
  checklist: worker-fencing dismissed: no worker owns a member's rewards; Convex serializes the mutations that read and write one member's reward key and wallet row, so a backfill page and a live earning each see the other's record
  checklist: commit-ordered-effects dismissed: the record, the credit and xpRecorded commit in one mutation, and App Home's refresh runs only after it commits
  checklist: resumption-coverage declared as a tier's coins are paid once
- every award counts once across the replay and live counting: Whichever of the launch's replay and the kudosGiven subscriber reaches an award first counts it toward each ladder, once, and the tiers it reaches are dated by it, in either order the bus runs them.
  over: a kudos given during the replay whose subscriber runs before the replay finishes, a delayed subscriber of a kudos given before the launch that runs after the replay, and a kudos given after the replay, read through each ladder's count and earned tiers
  via: P62: the replay and live counting count every award once
  refuted: laddersCountedLiveIn no longer waited for the ladder's replay to finish -> the kudos given during the replay was counted live first and dated Generosity bronze instead of the older kudos (2026-10-14)
  refuted: countAward no longer skipped an award already counted -> both order cases failed: the catch-up and the delayed subscriber counted their award a second time (2026-10-14)
  because: P62 counts every member's whole history at the launch and P61 dates a tier by the award that reached it; the bus schedules each kudosGiven subscriber on its own, so a live award can be counted before the replay reaches older ones, which would date a tier by the wrong award, and a delayed subscriber can arrive after the replay counted its award, which would count it twice
  kinds: message, state
  checklist: destination-confinement dismissed: the replay and the subscriber send nothing outside; achievementEarned goes only to the in-process bus
  checklist: message-authenticity dismissed: kudosGiven comes from the engine's own transaction and the replay reads the awards table, never anything from outside
  checklist: input-validation dismissed: the replay's argument is a bookReplays ID checked by its validator, and the subscriber's by the kudosGiven event validator
  checklist: retry-recognition dismissed: a replay page run again finds its awards already counted, and a finished replay returns at once
  checklist: duplicate-suppression declared as every award counts once across the replay and live counting
  checklist: keyed-ordering declared as every award counts once across the replay and live counting
  checklist: acknowledgment-barrier dismissed: nothing acknowledges a replay page; its counts, earned tiers, events and cursor commit in one mutation
  checklist: retry-classification dismissed: the replay calls no external system
  checklist: revalidated-permission dismissed: no permission is involved; the replay counts whatever the flags say, like the subscriber after the launch
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: a replay only moves from running to done, and a batch from open to complete, each by one patch in the mutation that finishes it
  checklist: supersession-safety dismissed: a replay row is never replaced; an ID once evaluated is never evaluated again
  checklist: worker-fencing dismissed: one replay row has one page scheduled at a time, and Convex serializes the mutations that touch its row and the counts it writes
  checklist: commit-ordered-effects dismissed: achievementEarned and the next page are scheduled inside the mutation that counts, and run only after it commits
  checklist: resumption-coverage declared as every award counts once across the replay and live counting
- a person, day or month counts once per member: A member's ladders count each person they thanked, each of their days and each of their calendar months once: Connections counts each different person the member thanked, Dependability each day with a kudos given, Applause each day on which they thanked 3 or more different people across any number of messages, and Seasons each calendar month with a kudos given, all on the giver's day.
  over: every ladder's counting over the table of award sequences: a month boundary, the same month a year later, 3 different people across two messages on one day, the same person twice on one day, a fourth person on a day, 3 people across two days, and the same instants in two time zones
  via: P58 P59: each ladder counts its awards on the giver's days and months
  because: P58 counts people, days and months rather than kudos, and P59 says a day counts once per member, on the giver's day and calendar month; counting a person, day or month again would earn tiers early, and Applause counting a person twice on one day would turn two people into three
  refuted: stepOf no longer skipped a key already marked in its group -> the same person twice on one day counted an Applause day (2026-10-14)
  refuted: the Seasons mark grouped by day instead of calendar month -> two days in one month counted two months (2026-10-14)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; counting reads only the award and the member's own marks
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: a mark is only ever inserted, and a count only grows, in the mutation that counts the award
  checklist: supersession-safety dismissed: a mark is never replaced; a later award to a marked person, day or month only skips it
  checklist: worker-fencing dismissed: no worker owns a member's marks; Convex serializes the mutations that touch one member's rows
  checklist: commit-ordered-effects dismissed: counting has no external effect; its marks, count and earned tiers commit in one mutation
  checklist: resumption-coverage declared as every award counts once across the replay and live counting
- `Old Friends` counts each pair's awards as their award order says: Whether an award counts toward its giver's `Old Friends` is decided by the giver's previous award to the same recipient in award order, so the replay, the subscribers in any order and a delayed subscriber of an older award reach the same count.
  over: a launch's replay of a history with a first thanks, 29 and 30 days apart, two and three awards of one pair whose subscribers run in reverse order, and a delayed subscriber of an older award after a newer one, read through the `Old Friends` count and earned tiers
  via: P62: Old Friends counts each pair's awards as their award order says
  refuted: dayThankedBefore read the pair's latest award instead of the one before this award in award order -> all 4 cases failed: the replay and the reverse-order subscribers counted nothing, since each award compared against itself or a newer one (2026-10-14)
  because: P58 counts thanking someone again 30 or more days after you last did, so an award's count depends on the pair's award before it; the bus schedules each kudosGiven subscriber on its own, so a pair's newer award can be counted before its older one, and a count kept from the last award counted would then compare against the wrong award
  kinds: state
  checklist: destination-confinement dismissed: counting sends nothing outside
  checklist: message-authenticity dismissed: the awards are the engine's own rows, never anything from outside
  checklist: input-validation dismissed: the award ID comes from the kudosGiven event validator or the awards table
  checklist: retry-recognition dismissed: a counted award is skipped by the award key, as for every ladder
  checklist: duplicate-suppression dismissed: covered by every award counts once across the replay and live counting
  checklist: keyed-ordering declared as `Old Friends` counts each pair's awards as their award order says
  checklist: acknowledgment-barrier dismissed: nothing acknowledges a count
  checklist: retry-classification dismissed: counting calls no external system
  checklist: revalidated-permission dismissed: no permission is involved
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: an `Old Friends` count only grows, like every ladder's
  checklist: supersession-safety dismissed: awards are never replaced, so the previous award of a pair never changes
  checklist: worker-fencing dismissed: no worker owns a pair; Convex serializes the mutations that touch one member's count
  checklist: commit-ordered-effects dismissed: the count and the tiers it earns commit in one mutation
  checklist: resumption-coverage dismissed: covered by every award counts once across the replay and live counting
- the Book is dark where it doesn't apply: Where the achievements flag, xp-levels or unlocks is off, the flags key is missing, or unlocks hasn't launched in the workspace, whatever the skill-tree flag says, a workspace whose Book never launched stores no launch, replay, count, mark or earned tier, and no member gets a tier DM, public line, summary or notice, App Home shows no Book tab and never names the Book as ready or next, and the Journey shows no `two-days` step, even for a member who opened the Book before.
  over: at the Slack boundary, two kudos that say why, one reaching level 4, App Home for three members, the ship sweep and the new-week sweep, with achievements off and skill-tree on, achievements not created, the flags key missing, unlocks off and never launched, unlocks turned off after its launch, xp-levels off, and all four of xp-levels, unlocks, achievements and quests on in the sandbox only read in production, read through every Achievements table, the Book's openings, every DM, public post, success reply and App Home, and the events published
  via: the Book applies only where achievements, xp-levels and unlocks all apply, whatever skill-tree says
  because: every new member-facing feature reaches production dark behind a flag whose safe default is off (the owner, 2026-10-13; O33), and the Book sits on XP and unlocks, so it applies only where both do (#163); its launch replays the whole history (P62), so nothing is counted before it, and only a mutation that sees the Book apply may store it
  refuted: achievementsApplyIn no longer read the achievements flag -> 5 of 7 cases failed: with achievements off, unset or unreadable, the Book was named to members or recorded (2026-10-14)
  kinds: output, state
  checklist: destination-confinement dismissed: the predicate only withholds records and lines; where a DM, a public line or App Home goes is unchanged and covered by feedback's and the adapter's own invariants
  checklist: redaction dismissed: the predicate removes whole surfaces rather than scrubbing content inside one
  checklist: commit-ordered-effects dismissed: each mutation reads the predicate before it stores the launch or decides a view, and a tier DM or public line is checked again when Slack takes it
  checklist: circuit-breaker-policy dismissed: the flags are read from the PostHog component's cached definitions, never by calling PostHog per read, so there is no failure history to divert on
  checklist: declared-target-coverage dismissed: the surfaces are the tier DM, public line, summary and notice, App Home's tab, readiness and next line, and the Journey's `two-days` step, each reading the predicate itself and each covered by a case of the oracle; there is no fan-out registry
  checklist: revalidated-permission dismissed: no permission is involved; the predicate is read in each mutation
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: before the launch nothing of the Book is written, so there is no state to succeed
  checklist: supersession-safety dismissed: the flags are read in the mutation that would launch, so a late delivery reads the flags of its own moment
  checklist: worker-fencing dismissed: no worker owns the Book; Convex serializes the mutations that read the flags and write
  checklist: resumption-coverage dismissed: no replay starts before the launch, so none resumes
- a stale crate button writes nothing: An `Open` on the Book's crate in a level-up DM or in App Home, left from when the Book applied and clicked where the achievements flag, unlocks or xp-levels is now off, opens nothing, publishes no unlockOpened and sends no summary, and the click is still acknowledged.
  over: both buttons clicked after achievements, unlocks or xp-levels turned off, read through the Book's openings, the events published, the member's DMs and App Home
  via: a stale crate button from when the Book applied writes nothing and publishes nothing
  because: Slack keeps a DM's buttons and an App Home already published for good, so an `Open` outlives the flags it was shown under (O35); a click that still opened the Book would open a feature that doesn't exist (P78) and send the opening's summary of tiers nobody can see (P62)
  refuted: stateOf no longer read whether a feature's ship flag is on -> the achievements-off case failed: the stale `Open` opened the Book (2026-10-14)
  kinds: message, state
  checklist: destination-confinement dismissed: a refused click sends nothing anywhere; App Home is republished to the clicking member only, as for every click
  checklist: message-authenticity dismissed: the click arrives as a signed Slack request, covered by the adapter's signed-request invariant
  checklist: input-validation dismissed: the command is checked by the command validator, and names a feature, never a member
  checklist: retry-recognition dismissed: a replayed click is refused the same way, by the same flag read
  checklist: duplicate-suppression dismissed: the adapter runs each click once by its idempotency key, and a refused click writes nothing to duplicate
  checklist: keyed-ordering dismissed: a refused click changes no state, so its order against other clicks doesn't matter
  checklist: acknowledgment-barrier dismissed: Slack's acknowledgment is the adapter's 200, sent whatever the command decides
  checklist: retry-classification dismissed: the command calls no external system
  checklist: revalidated-permission declared as a stale crate button writes nothing
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: a refused click changes no state
  checklist: supersession-safety dismissed: the flags are read in the mutation that would write, so a click is judged by the flags of its own moment
  checklist: worker-fencing dismissed: no worker owns a member's openings; Convex serializes the mutations that touch one member's rows
  checklist: commit-ordered-effects dismissed: a refused click publishes nothing, and an allowed one publishes inside its own transaction
  checklist: resumption-coverage dismissed: no batch operation resumes
- turning the Book off and on loses nothing: Turning the achievements flag, unlocks or xp-levels off after the Book's launch hides the Book while every kudos still counts and earns its tiers, stores and enqueues no tier notice, summary or public line for a tier earned meanwhile, so that tier is never announced, rewrites no launch, replay, count or earned tier, and turning it back on shows every tier, those earned while off included, with no replay run again.
  over: a member who opened the Book, with their first tier told by DM and public line and 24 kudos given, turned off by each of the three flags, giving the kudos that earns the silver tier for 25 kudos given and running both sweeps while off, then turned on again, read through every Achievements table, the stored tier notices, summaries and public tier lines, the tier DMs, the public posts and the Book tab
  via: O35: turning the Book off and on again loses nothing
  because: a tier is earned once and never taken back (P61), and the Book counts from its launch whatever any flag says later (P75), like XP recorded dark, so turning a flag on again loses nothing and needs no second replay (P62, O35, ADR-0004); a tier earned while the Book doesn't apply is never announced (#170), so a flag flip never floods a member with old news
  refuted: countKudosGiven counted only while the Book is shown -> all 3 cases failed: the kudos given while off earned no tier (2026-10-14)
  refuted: countKudosGiven handed tiers earned while the Book doesn't apply to tellTiersEarned -> the unlocks-off and xp-levels-off cases failed: what was stored to tell tiers changed for the tier earned while off (2026-10-14)
  kinds: state
  checklist: revalidated-permission dismissed: no permission is involved; each mutation reads the flags itself
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: earned tiers are inserted once and never changed, a count only grows, and a flag change writes nothing
  checklist: supersession-safety dismissed: an earned tier carries its date, award and catalogue version fixed when it was earned, so a later flag value never reaches it
  checklist: worker-fencing dismissed: no worker owns the Book; Convex serializes the mutations that touch one member's rows
  checklist: commit-ordered-effects dismissed: hiding and showing are reads; nothing is published by a flag change
  checklist: resumption-coverage dismissed: the launch's replay runs once, and a flag change never starts another
- a tier the replay earns while the Book is dark is never announced: A tier that a page of the Book's replay earns while the achievements flag, unlocks or xp-levels is off is stored hidden, so once the Book applies again a member who opens it sees the tier with no DM summary and no public line for it.
  over: a member's kudos before the launch, the launch storing the replay, a flag turned off before the replay's pages run, and the member opening the Book after the ship sweep once it is back, for each of the three flags, read through the member's DMs, the public posts and the Book tab
  via: a tier the Book's replay earns while the Book doesn't apply is never announced
  because: a tier earned while the Book doesn't apply is never announced (#170); the replay runs in pages after the launch and reads no flag, so a page that ran after a flag turned off earned tiers the opening's summary would later tell, unlike the same tiers earned by the kudosGiven subscriber (the review of #170)
  refuted: the replay pages stored no hidden mark -> all 3 cases failed: opening the Book sent a DM summary of the replayed tiers (2026-10-14)
  kinds: state, output
  checklist: destination-confinement dismissed: the mark only withholds notices; where a summary goes is unchanged
  checklist: redaction dismissed: the mark withholds whole notices rather than scrubbing content inside one
  checklist: commit-ordered-effects dismissed: each replay page reads the predicate in the mutation that stores the tier and its mark together
  checklist: circuit-breaker-policy dismissed: the flags are read from the PostHog component's cached definitions
  checklist: declared-target-coverage dismissed: the replay's two earning paths, counting history and evaluating added tiers, share one mark, and the summaries read it
  checklist: revalidated-permission dismissed: no permission is involved; each page reads the predicate itself
  checklist: separation-of-duties dismissed: no approval policy applies
  checklist: legal-state-succession dismissed: an earned tier is inserted once with its mark and never changed
  checklist: supersession-safety dismissed: the mark is fixed when the tier is earned, so a later flag value never reaches it
  checklist: worker-fencing dismissed: one replay row has one page scheduled at a time
  checklist: resumption-coverage dismissed: each page reads the predicate again, so a replay resumed after a flag change marks by the flags of its own page
