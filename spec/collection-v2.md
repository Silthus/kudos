# Spec: collection v2: foil packs with XP and coins, and teams of people from posthog.com

> **Accepted on [#584](https://github.com/Silthus/kudos/issues/584) (2026-10-16) under the map's autonomous authority, every call at its recommendation.** This file lives on the branch `docs/collection-v2` and is never merged. It is the backend half of the product owner's Collection prototype session of 2026-10-16 (accepted prototype `prototype/collection-v2` at `72529d83`, `?variant=b` with `?crate=pack`). The Book's spread, the pack stack and every animation are map #57's.
>
> **Rule numbers.** Rules are cited as `CV1`–`CV40`. Collection rules are cited as `CL8`, sticker book rules as `SB11`, crate rewards rules as `CR3`, progression rules as `P85`.
>
> **Four stopping points.** 1 is the Book spread, website only, map #57's (CV1). 2 (CV2–CV13) is XP and coins in every pack, behind `packs`. 3 (CV14–CV30) is teams of people from posthog.com in the Book, behind `team-pages`. 4 (CV31–CV38) is team crests earned by completing a team page, and Team Spirit counting them, behind `team-spirit`. 2 and 3 are independent; 4 starts once 3 is on `main`. CV39–CV40 say what this replaces.
>
> Sources: ticket #584 (the locked design and the product owner's words, quoted under "Further Notes"); map #1's decisions 18, 22–27; the collection spec (`spec/collection.md` on `docs/collection` at `4143cd7`: CL6–CL9, CL14, CL15, CL22–CL30); the sticker book spec (`spec/sticker-book.md` on `docs/sticker-book` at `3becd6a7`: SB1–SB27); the crate rewards spec (CR3, CR14); the code on `main` at `68439c82` (`convex/hoggies/` `drops.ts`, `collection.ts`, `boughtCrates.ts`, `crateKey.ts`, `catalogue.ts`; `convex/quests/` `open.ts`, `pendingCrates.ts`; `convex/unlocks/unlocks.ts`; `convex/progression/` `progression.ts`, `rewards.ts`; `convex/companyProfiles/` `sync.ts`, `faces.ts`; `convex/stickers/`; `convex/website/` `collection.ts`, `commands.ts`, `settings.ts`, `faces.ts`); the branch `spec/sticker-book-team-spirit` at `a09bf87e` (#551, #552); the prototype's fixtures (`website/src/book/v2/packs.ts`, `teamFixtures.ts`); and posthog.com's public team API as `companyProfiles/sync.ts` reads it (team `slug`, `name`, `crest`, `profiles`, `leadProfiles`; profile `firstName`, `lastName`, `companyRole`, `color`, `avatar`).

## Problem Statement

The product owner opened today's Book and found it shapeless: "it's like an infinite scroll, almost. It needs a lot more structure." The crate reveal felt cheap ("the legendary box there. You can do much better"). And the teams in the Book are the wrong teams: group albums are Slack user groups, and team crests are rosters of hoggies, while what he wants to collect are the people on PostHog's real teams: "the team members from the actual website are collected there, like I already collected as stickers … not from the Slack group, but truly from the website team, and you should correlate them."

The website map is rebuilding the Book as one open book with foil packs (map #57). That needs two things the backend doesn't have: packs that hold XP and coins as well as a hoggie, and teams made of people from posthog.com.

## Solution

**Every pack pays XP and coins beside its hoggie, and every posthog.com team is a page of people to collect in the Book.**

- **Packs.** Every crate is a foil pack. Opening one, of any kind, pays a random amount of XP and coins on top of what the crate already held, drawn per crate from its kind's band, the same on every retry. The Book lists every waiting pack, and the website opens any of them with one command; what a pack pays is told only by its open.
- **Teams of people.** The daily posthog.com sync keeps every team with its name, crest, lead and people. A posthog.com person is matched to a teammate by name, or by the teammate saying "This is me on posthog.com", or by an admin. Each team is a page in the Book whose slots are its matched people; a slot fills when the member holds that person's sticker.
- **Team crests (stopping point 4).** Filling a team page earns its crest, once, at the kudos that filled it, told privately under that message like a tier. Team Spirit counts filled team pages.
- **What goes.** Slack group albums and hoggie rosters leave the Book. Crests already collected by hoggies stay collected.
- **Dark first, then everyone.** Each stopping point ships behind its own member-decision flag, on in the sandbox and for the product owner's email, and widens to everyone once its ship's proofs pass, as the product owner decided: "Lock it in and tell the contractor to build it and push it out to production autonomously."

## User Stories

**Packs (stopping point 2)**
1. As a member, I want every crate I open to pay some XP and coins, so that opening a pack always moves me forward.
2. As a member, I want the amounts to vary from pack to pack, so that opening one is exciting.
3. As a member, I want a quest's own reward to still arrive in full, so that the pack adds to what I earned and takes nothing away.
4. As a member, I want a feature's crate and a crate I bought to pay XP and coins too, so that every pack means the same thing.
5. As a member, I want a pack opened twice, from a double click, a second device or a retried request, to pay once and answer the same amounts, so that I can't lose or double a reward by accident.
6. As a member, I want a pack opened in Slack and one opened on the website to pay the same, so that it doesn't matter where I open it.
7. As a member, I want my level to rise when a pack's XP crosses a level, so that the pack counts like any XP.
8. As a member, I want to see all my waiting packs in one stack, whatever kind they are, so that I know how many I have to open.
9. As a member, I want to tap any pack in the stack to open it, so that I don't have to go to the quest or feature it came from.
10. As the website's builder, I want each open to answer what it applied with the standing before and after, so that the XP chip can fly to the level ring and the coin chip to the coin counter.
11. As the product owner, I want packs to stay a small part of a member's XP, so that thanking people stays the main way to level.

**Teams of people (stopping point 3)**
12. As a member, I want a page in the Book for every team on posthog.com, so that I collect the real teams, not Slack groups.
13. As a member, I want a team page's slots to be the team's people I can thank, so that filling it means thanking them.
14. As a member, I want a slot to fill once I hold that person's sticker, so that the stickers I already have count straight away.
15. As a member, I want my own teams first, so that I start with the people I work with every day.
16. As a member, I want never to be a slot on my own team's page, so that I can fill my own team.
17. As a member, I want each slot to show the person's name, role and posthog.com picture and colour, so that the page looks like the team page on posthog.com.
18. As a member, I want to see who on a team I still need to thank, so that I know whom to thank next.
19. As a member, I want posthog.com people who aren't matched to a teammate to be counted and not block me, so that a missing match doesn't keep a page from filling.
20. As a member whose Slack name differs from my posthog.com name, I want to say "This is me on posthog.com", so that I'm on my teams' pages.
21. As a member, I want to undo my pick, so that a mistake isn't permanent.
22. As a member, I want nobody else to be able to claim my posthog.com profile while I'm matched to it, so that nobody takes my place.
23. As an admin, I want to match a teammate to their posthog.com profile or to none, so that I can fix what a name match or a pick got wrong.
24. As a member, I want a team page to follow the team as posthog.com changes it, so that it matches the team as it is now.
25. As a member, I want a crest I already collected with hoggies to stay collected on its team's page, so that nothing I earned is taken away.
26. As a member, I want my posthog.com picture to be my face once I'm matched, including by a pick, so that matching fixes my face too.

**Team crests and Team Spirit (stopping point 4)**
27. As a member, I want a team's crest once I hold everyone on its page, so that filling a page gives me something.
28. As a member, I want to be told under the kudos that completed a team, privately, so that I notice the moment.
29. As a member, I want a completed page to stay complete when people join the team or the team leaves posthog.com, so that I don't lose what I earned.
30. As a member, I want Team Spirit to count the team pages I completed, so that crossing teams is rewarded.
31. As a member, I want pages I filled before this shipped to count without a burst of messages, so that I'm credited quietly.

**Rollout**
32. As the product owner, I want each stopping point behind its own flag, on for the sandbox and me first, so that I see it before anyone.
33. As the product owner, I want each flag widened to everyone once its ship's proofs pass, without asking me again, as I decided.
34. As a member, I want nothing to change for me while a flag is off for me.

## Rules

"`packs` is on for a member" means the flag answers true in their member decision. "The Book's collection is shown" means `getCollection` answers `{ kind: "collection" }` for the member, as on `main` (CL15).

### Stopping point 1: the Book spread (map #57)

- **CV1. Today's reads.** The Book spread, the page tabs, the cover, the hoggies and achievements spreads, and the pack stack and opening session for bought crates are built by map #57 against `main` as it is, with no backend change: `getCollection` (`rarities`, `hoggies` with `seen`, `owned`, `total`, `crests`, `bought`, `crateStore`, `stickers`, `albums`), `getBook` (the ladders), `buyCrate` and `openCrate` (bought crates, answering `drop`), `openQuestCrate` (`applied` and `drop`), `openFeature` (`drop`), and the HUD's level and coin reads. Until stopping point 3, the Teams tab shows today's `crests` and group `albums`. Until stopping point 2, a bought pack shows no XP or coin chips.

### Stopping point 2: XP and coins in every pack

- **CV2. A pack.** A pack is a crate that drops a hoggie (CL6): a weekly quest's, a group quest's, a Journey step's, a feature's or a bought crate, named by its crate key. Every pack pays a **pack bonus**, `{ xp, coins }`, on top of what the crate held: a quest's or Journey step's held reward still applies at the open as CR3 says, and a feature's crate still opens its feature. The bonus is the only thing a feature's or bought crate pays.
- **CV3. The bands.** The pack bonus is drawn from its crate kind's band, versioned catalogue data beside the hoggies. Version `1` gives every kind the same band: XP from 5 to 25 in steps of 5, and coins from 1 to 5. The prototype's 40–160 XP and 5–30 coins were a fixture; at those amounts three weekly packs would pay more XP than a week of thanking, against P85's rule that base XP stays the largest source, and a 50-coin bought pack would pay back a third of its price. Changing a band is a one-line catalogue change; it applies to packs opened from then on.
- **CV4. The draw.** The pack bonus is a pure function of the deployment's `HOGGIE_DRAW_SECRET`, the member, the crate key and the band version: `p = SHA-256("{secret}:{member}:{crateKey}:pack:{bandVersion}")`; its first 4 bytes, as an unsigned integer divided by 2³², pick the XP step and the next 4 the coins, each uniformly within the band. It is drawn with no rarity weighting and independently of the hoggie (CL8). The same member, crate and band version draw the same bonus on any backend with the same secret, so a retried open pays the same. No read answers a bonus before its open: the amounts are the open's surprise, as the hoggie is.
- **CV5. Paid once, at the open.** The pack bonus is paid in the mutation of the crate's first successful open, in the drop's own step (CL7), after the held reward and before the open's event, through the same progression step that applies a held reward: coins credited, XP added, `xpRecorded` and any `levelReached` published. It is stored on the drop record as `pack: { xp, coins, from, to }`, `from` and `to` being the member's standing with coins before and after the bonus (CR14's shape). A refused open, and every open after the first, pays nothing. A crate opened while `packs` is off for the member keeps no bonus: nothing pays it later. Turning `packs` off takes nothing back.
- **CV6. The open's answer.** While `packs` is on for the member, the website's opens answer `applied` for every pack, read from the stored records, never drawn again:

  ```ts
  type Applied = { xp: number; coins: number; from: StandingWithCoins; to: StandingWithCoins }; // CR14's, unchanged
  // openQuestCrate: { kind: "opened"; applied: Applied | null; drop?: Drop | null } | { kind: "refused" }
  // openFeature:    { kind: "opened"; applied: Applied | null; drop?: Drop | null } | { kind: "refused" }
  // openCrate:      { kind: "opened"; applied: Applied | null; drop: Drop | null } | { kind: "refused" }
  ```

  `applied` covers the whole open: its `xp` and `coins` add the held reward's and the pack bonus's, `from` is the standing before the held reward (or the bonus, where nothing was held), and `to` the standing after the bonus. It is null where the open paid nothing (a crate opened while `packs` was off and nothing held). While `packs` is off, `openFeature` and `openCrate` answer as on `main`, with no `applied` field, and `openQuestCrate`'s `applied` is the held reward's alone. The composed `applied` goes through the same projection as today's: coins and skill points in `xp`, `coins`, `from` and `to` are shown as CR14 shows them, hidden while they aren't visible to the member.
- **CV7. Every waiting pack.** While `packs` is on for the member and the Book's collection is shown, `getCollection` gains:

  ```ts
  type Pack = { crate: string; kind: "weekly" | "group" | "journey" | "unlock" | "bought"; n: number };
  // { kind: "collection"; ...; packs?: Pack[]; morePacks?: boolean }
  ```

  `packs` lists every crate the member could open right now: weekly and group quest crates finished and unopened (the pending crates), Journey steps finished and unopened, features ready and unopened, and bought crates unopened, each only where its own open would pass its checks (`questsLiveFor`, the Journey step and group quest predicates, `unlocksShownTo`), read through query-safe forms of the same predicates the opens use, so a listed pack opens. They are ordered by when each became waiting (its row's time: the pending crate's creation, the Journey reward's `at`, the feature's `readyAt`, the bought crate's `boughtAt`), then by crate key; `n` is the place in that order, 1 for the one waiting longest. At most 50 are listed, with `morePacks: true` beside them where more wait; each kind is read through one index range of at most 51 rows, so the read is a fixed number of ranges and bounded documents. No pack answers what it will pay: the open's `applied` tells it (CV6), so nothing in the network tab spoils the next pack (the product owner, decision 25: "You don't know what you get before you open the crate"). `bought` stays as on `main`. - **CV8. One command opens any pack.** While `packs` is on for the member, the website's `openCrate { crate }` opens any crate key `packs` can list, routing a quest or Journey key to the quest crate's open, an `unlock:` key to the feature's open and a `bought:` key to the bought crate's open, each with its own checks, as one D17 command. It refuses, writing nothing, while `collection` is off for the member, so every first open through it drops a hoggie and pays a bonus; a crate that isn't the member's, isn't waiting or fails its own open's checks refuses too. It answers CV6's `openCrate` answer, read from the stored records: a repeat answers the stored drop and `applied`, and a crate opened earlier elsewhere while `collection` or `packs` was off answers `drop: null` or `applied: null`, never a late drop or bonus. While `packs` is off it opens bought crates only, as on `main`.
- **CV9. Slack.** Opening a crate from App Home pays the pack bonus by CV5. Nothing new is sent (decision 22): the open's App Home republish shows the new XP and coins, and a level crossed sends the level-up as any XP does.
- **CV10. Events.** `hoggieDropped` gains `pack: { xp, coins }` where a bonus was paid, and the product event `hoggie dropped` gains `pack_xp` and `pack_coins`. With `packs` off the event equals `main`'s.
- **CV11. The flag.** `packs`, a member decision, `safeDefault: false`, on for `environment = sandbox` and the product owner's email (copying `sticker-book`'s condition). It is read with exposure only in the drop step of a first successful open while `collection` is on, and without exposure in queries. With it off, unset or the flags key missing, every Slack call, website answer, product event and table equals `main`'s, apart from the flag's own exposure row and `$feature_flag_called` event. It needs `collection` on: no drop, no bonus.
- **CV12. Widening.** Once ship 2's proofs pass, the ship turns `packs` on for everyone in production (the product owner's "push it out to production autonomously", CV40). No backfill runs: packs opened before pay nothing more.
- **CV13. Coherence.** The `Hoggies` spec gains **a pack pays its bonus once** (refuted by a second open paying again, or a retried open in a fresh backend paying different amounts) and, as the gate's oracle, **packs are dark where `packs` is off**. Quests' invariant on opening a crate gains in its prose that the open also pays the pack bonus once.

### Stopping point 3: teams of people from posthog.com

#### The copy of posthog.com

- **CV14. Company profiles keep their ID and every team.** The daily sync keeps each posthog.com person once, as today, now with their posthog.com ID, every team they are on (not only the first), and their role (`companyRole`, trimmed, absent when empty). Start date, country and every other field stay unread. The new fields ship optional, so rows written before the first new sync still read (faces read only names), and the first good sync fills them.
- **CV15. Company teams.** The same sync keeps every team that has a slug and a name as a **company team** `{ team: slug, name, crestImage?, leads: profileId[], people: profileId[] }`, `people` in posthog.com's order and `leads` its lead profiles. `crestImage` is the CMS crest's URL, kept only where it is a Cloudinary image, sized like the cutouts. Company teams are replaced in the same mutation as the company profiles, after the same complete and validated read: a failed read keeps both (the module's existing invariant widens to teams). Every sync stamps its rows with `asOf`, the time its read began, and a replacement older than the stored `asOf` is dropped, so two overlapping runs can't put an older copy over a newer one. A team without a slug or a name is skipped; its people are still kept as profiles.
- **CV16. Crest art.** A company team's crest is `{ kind: "crest"; slug }` where the pinned `@posthog/brand` has a crest of that slug (the catalogue's crests), else `{ kind: "image"; url: crestImage }`, else null, where the website draws the default crest. No art is committed.

#### Matching people

- **CV17. A member's company profile.** One matcher answers a workspace member's company profile, in this order:
  1. an **admin link** for the member: that profile, or none where the admin chose none;
  2. else the member's own **self link**, unless an admin link gives that profile to another member;
  3. else a **name match**: the one company profile whose normalised first and last name equals the member's normalised name as the directory keeps it, where exactly one profile and exactly one current member have that name, and no link gives that profile to another member.

  A profile is any member's at most once. A member who is not a current member (R5) has none, and their links hold nothing while they aren't. Where two self links name one profile (a member returning after another claimed it), the earlier link holds it and the later member is unmatched until an admin decides. The name match is today's `companyFaceOf` rule made two-sided. **What's reliable:** the name match for most people, since posthog.com and Slack mostly carry the same full name; nicknames (a "Sam" who is "Samantha" on posthog.com), changed names and two people of one name fail it, and the self link and the admin link cover them.
- **CV18. Links.** A link is stored as `{ workspace, member, profile: profileId | null, by: "self" | "admin", setBy, at }`, at most one per member and kind, and kept when the profile leaves posthog.com (the member is then unmatched until it returns). Writing an admin link to a profile deletes, in the same mutation, every other member's admin link to it, so an admin transfer is atomic. Only the company profiles module writes links.
- **CV19. "This is me on posthog.com".** While `team-pages` is on for the member, the website's Settings read gains a `companyProfile` section:

  ```ts
  type ProfileChoice = { profile: number; name: string; role: string | null; teams: string[]; face: CompanyFace | null };
  type CompanyProfileSetting = {
    mine: ProfileChoice | null;        // the matcher's answer for me
    by: "name" | "self" | "admin" | null;
    choices: ProfileChoice[];          // profiles no other member holds, by name
  };
  ```

  `linkMyCompanyProfile { profile: number | null }`, a D17 command, sets or clears the member's self link. It is for unmatched members: it refuses, writing nothing, a member the name match or an admin link already matches (`matched`), a profile another member holds by CV17 (`taken`), and a profile not in the current copy (`unknown`). A member with a self link can change it under the same rules or clear it with null. A repeat with the same profile changes nothing. A wrong claim is an admin's to fix (CV20): holding a free profile proves nothing, so nobody can take a held one by picking it. It answers `{ kind: "linked" } | { kind: "refused"; reason: "matched" | "taken" | "unknown" }`.
- **CV20. The admin override.** While `team-pages` is on for an admin (a workspace admin or owner, as the directory keeps it), the website's Settings read gains an `admin` part, and Settings' sections list it:

  ```ts
  type AdminProfiles = {
    members: Array<{ key: string; name: string; profile: number | null; by: "name" | "self" | "admin" | null }>; // every current member, by name
    profiles: Array<ProfileChoice & { heldBy: string | null; by: "name" | "self" | "admin" | null }>;         // every profile, by name; heldBy is a member key
  };
  ```

  A member `key` is `seenKeyOf(admin, "member:{member}")`, opaque. `linkCompanyProfile { member: key, profile: number | "none" | null }`, a D17 command, sets the member's admin link to a profile or to none, or clears it with null; a profile another member holds moves to this member (CV18). It answers `{ kind: "linked" } | { kind: "refused"; reason: "not-admin" | "unknown" }`, refusing and writing nothing where the caller isn't an admin, the key names no current member of the caller's workspace, or the profile isn't in the current copy.
- **CV21. Faces follow the matcher.** A member's own face (`faceOf`) is their company profile's cutout and colour when the matcher answers a profile with a cutout, a self or admin link included. Where `team-pages` is off for the member, `faceOf` takes `main`'s name-only path and ignores links, so it equals `main`'s whatever links exist.

#### Team pages

- **CV22. A team page.** Every member has a **team page** for every company team. Its **people** are the team's profiles that the matcher gives to a current member other than the page's owner. Its `unmatched` count is the team's profiles given to no member. A person is **held** when the owner holds their sticker (SB1). Progress is `held` of `total`, `total` being its people's count. The page is **mine** when the owner's own company profile is on the team.
- **CV23. Pages follow the team.** A team page is derived when it is read, never stored in this stopping point: from the company teams and profiles, the links, the workspace's members and the owner's stickers. Someone joining the team on posthog.com, a new match or a new link adds a person; someone leaving removes one. A team leaving posthog.com drops its page, apart from CV25.
- **CV24. `getCollection` gains teams.** While `team-pages` and `sticker-book` are on for the member and the Book's collection is shown (team pages show stickers, so they never show where stickers don't):

  ```ts
  type TeamCrestArt = { kind: "crest"; slug: string } | { kind: "image"; url: string } | null;
  type TeamPerson = { key: string; name: string; role: string | null; face: Face; lead: boolean; held: boolean; heldAt: number | null };
  type TeamPage = {
    team: string; name: string; art: TeamCrestArt; mine: boolean; listed: boolean;
    leads: string[];              // the team's leads' posthog.com names, in posthog.com's order, matched or not
    held: number; total: number; unmatched: number; complete: boolean;
    people: TeamPerson[];
    unmatchedPeople: Array<{ name: string; role: string | null }>; // posthog.com's public name and role, never a slot
    crest: { collectedAt: number; seen: string } | null;
  };
  // { kind: "collection"; ...; teams?: TeamPage[] } and no `albums`, no `crests`
  ```

  `teams` is every page, mine first, then by name. `people` is in posthog.com's order. A person's `key` is the sticker's key (`seenKeyOf(member, "sticker:{person}")`, SB11), so the website can fly a sticker to its slot; `name` is the directory's; `face` is their company profile's cutout and colour where it has one, else the teammate face as on `main`; `heldAt` is the sticker's `firstAt`. `complete` is `total > 0 && held === total` in this stopping point; stopping point 4 adds recorded completions (CV33). `listed` is false only for CV25's and CV31's pages.
- **CV25. Crests collected with hoggies stay.** A crest the member collected by its hoggie roster (CL23) stays collected: the team page of that slug answers `crest` with its `collectedAt` and its existing seen key (`crest:{crest}:{collectedAt}`), so it isn't new again; where posthog.com has no team of that slug, the crest stays as a page with no people, `listed: false`, the catalogue's crest name and art. Rosters are no longer shown once `team-pages` is on. A roster still collects its crest as CL23 says, derived from the tallies and never stored, so a roster a later drop happens to complete shows its crest too: nothing is written to stop it, and it takes nothing from anyone. App Home's crest count (CL25) is unchanged in this stopping point.
- **CV26. Group albums and rosters leave the Book.** While `team-pages` is on, `getCollection` answers no `albums` and no `crests`. Stickers stay (SB11). Slack user groups keep the leaderboard, group boards, group quests and the Monday post.
- **CV27. The read budget.** The teams part of `getCollection` reads a fixed number of index ranges: the company teams, the company profiles, the workspace's links, the workspace's members (one range, as SB12) and the member's stickers. It is bounded by the workspace's size and posthog.com's (the sync reads at most 10 pages), never by kudos history. Its documents and answer grow with the teams' memberships added up, so the supported size is stated in them, as SB12 does: up to 2,000 members, 2,000 profiles, 100 teams and 6,000 team memberships in total. The page ticket proves that size with `transactionLimits: true` and the whole `getCollection` answer under 2 MiB. Beyond it, paging team people is a follow-up this spec doesn't build.
- **CV28. The flag.** `team-pages`, a member decision, `safeDefault: false`, sandbox plus the product owner's email, read without exposure in queries and with exposure in the two link commands. The sync's wider copy (CV14, CV15) is written whatever the flag says; it shows nothing by itself. With the flag off, unset or the flags key missing, every Slack call, website answer, product event and table equals `main`'s apart from the company profiles' and teams' rows and the flag's exposure.
- **CV29. Widening.** Once ship 3's proofs pass, the ship turns `team-pages` on for everyone in production (CV40). No backfill runs: pages are derived.
- **CV30. Coherence.** The `CompanyProfiles` spec gains **a profile is matched to at most one member, links first** (refuted by two members answering one profile, or a name match beating an admin link) and widens **a failed posthog.com read keeps the previous profiles** to teams. The `Stickers` spec, or a new component the page ticket names, gains, as the gate's oracle, **team pages are dark where `team-pages` is off**, and **the sticker book is private** extends to team pages.

### Stopping point 4: team crests and Team Spirit

- **CV31. Completing a team page.** A team page is complete when it has at least one person and the owner holds every one of them. Completion is recorded once, as the insert-only `{ member, team, name, crestImage?, award, at, people, told }`, unique per member and team: `name` and `crestImage` the team's at the record, `people` the page's `total` then, and `award` and `at` the **completing award**: of the page's people, the sticker with the latest `firstAt` (then the latest in award order), and its `firstAward` (SB2), so a check that runs late still credits the kudos that filled the page, never the one that triggered the check. A recorded page stays complete when people join, when matches change, and when the team leaves posthog.com (it is then listed with `listed: false`, its name and art from the record).
- **CV32. When it is checked.** As SB19 says for albums, with team pages in their place: when the live sticker subscriber records a new sticker for a member, it schedules one check for that member keyed by that award; the check reads the member's pages by CV22, records at most 25 completions per mutation and pages on. The backfill schedules no checks. The branch `spec/sticker-book-team-spirit` (`a09bf87e`) already builds this scaffolding for group albums, and the build starts from it (CV39).
- **CV33. The crest.** A recorded completion earns the team's crest at its `at`, unless the member already holds it by CV25. A page's `crest` answers the earlier of the two: `{ collectedAt, seen }`, `seen` being `seenKeyOf(member, "team:{team}:{collectedAt}")` for a completion. Pages gain `completion: { at: number; seen: string } | null` from the record, `seen` keyed `page:{team}:{at}`, so the website can play the team-complete moment even where the crest came earlier; `complete` becomes `completion !== null || (total > 0 && held === total)`. App Home's crest count (CL25) counts every crest the member holds, by roster or by page, once per slug.
- **CV34. Told under the kudos.** A member's first check after `team-spirit` turns on for them records every page already complete silently (`told: false`), as SB22. Every later completion is `told: true` and is told to the member privately under the completing award's message. The tier notices learn a second kind of line, a completion line, queued once per completion record (the record is the dedupe key) and delivered with that message's tier lines, aggregated per member and message, with `team-spirit` and the member's message setting for tiers checked at delivery, so it is told whether or not it earned a tier: `Team complete · {Team} crest earned` (or `Team complete · {Team}` where the crest was already held). It never gets a public line.
- **CV35. Team Spirit counts team pages.** The `team-spirit` ladder, built on the branch as a completion ladder (SB21: bronze at 1, silver at 2, gold at 4, diamond at 8, the same names and rewards, `handshake` at silver), counts completed team pages instead of group albums: `team pages completed` (`team page completed` for one). Every other rule of SB21–SB24 holds with team pages in place of albums, `teamSpiritShownTo` guarding every surface; it answers true only where `team-spirit`, `team-pages` and `sticker-book` are all on for the member.
- **CV36. Events.** One `teamPagesCompleted { workspace, member, message, award, teams: Array<{ team, people }>, at, told }` per completing award among a check mutation's completions, projected as one `team page completed` product event per team, with `team` (the public posthog.com slug), `people` and `told`, never a person's name.
- **CV37. The flag.** `team-spirit`, a member decision, `safeDefault: false`, sandbox plus the product owner's email, read with exposure in the check and without in queries; it needs `team-pages` on. With it off, every Slack call, website answer, product event and table equals stopping point 3's apart from the exposure. Once ship 4's proofs pass, the ship turns it on for everyone (CV40); members are checked at their next new sticker, so no backfill runs.
- **CV38. Coherence.** The component that owns completions gains **a completed team page stays complete** (refuted by a join or a lost match un-completing it, or a second record for a member and team) and, as the gate's oracle, **Team Spirit is dark where `team-spirit` is off**.

### What this replaces

- **CV39. The sticker book's group albums and Team Spirit (#551–#554).** Group albums leave the Book (CV26); Team Spirit counts team pages instead (CV35). The branch `spec/sticker-book-team-spirit` at `a09bf87e` is **reused**: stopping point 4's first ticket merges it and swaps its album source from Slack user groups to team pages, keeping the completion ladder, the told-or-silent tiers, the check scaffolding, `teamSpiritShownTo`, `handshake` and the event plumbing. #553 and #554 (the gate and ship for albums) are superseded by stopping point 4's gate and ship, and #551 and #552 by its build tickets: the conductor closes all four, pointing at their replacements. Hoggie rosters and the `crests` stopping point (#463, #464, #504) retire from the Book under `team-pages`; their code stays for CV25 until a later cleanup removes rosters.
- **CV40. Ship authority.** The product owner, 2026-10-16: "Lock it in and tell the contractor to build it and push it out to production autonomously." Each stopping point still ships by the repository's rules: its own pull request from `main`, its flag default off and on for the sandbox and his email first, the gate green, proofs recorded, a review by the other model family, no real names, faces or usage numbers in anything committed. Once a ship's proofs pass in the sandbox and in production for his email, the ship widens its flag to everyone without asking again.

## Implementation Decisions

- **Hoggies** owns the pack bands (catalogue data beside the hoggies), the pack draw and the bonus on the drop record. `dropFor` gains the bonus step: read `packs` with exposure, draw, pay through Progression, store `pack` on the drop record and in `hoggieDropped`. A new read, `waitingPacksOf(member)`, assembles CV7 from Quests' pending crates and Journey reward records, Unlocks' ready features and its own bought crates, through each module's exported read, never their tables.
- **Progression** generalises today's `applyHeldReward` into one step that applies `{ xp, coins }` for a cause and answers `Applied`; held rewards and pack bonuses both use it.
- **Website**: `openQuestCrate`, `openFeature` and `openCrate` compose `applied` from the opening's held reward and the drop's `pack`; `openCrate` routes any pack key (CV8) through `runCommand`; `getCollection` gains `packs`, then `teams` and the dropped `albums`/`crests`; Settings gains `companyProfile` and its `admin` part, and two commands.
- **Company profiles** owns the wider sync, company teams, links, the matcher (`companyProfileOf(member)` and `companyProfilesIn(workspace)`, the one answer every reader uses) and the two link commands. It stays the only module that knows posthog.com.
- **Stickers** gains team pages (`teamPagesOf(member)`) beside albums, reading company teams and the matcher through Company profiles' reads. Stopping point 4 moves the branch's completions from albums to team pages.
- **Schema**: drop records gain optional `pack`; `companyProfiles` gains `profile`, `teams`, `role` and loses `team`; new `companyTeams` by team; new `companyProfileLinks` by workspace and member, and by profile; stopping point 4's `teamPageCompletions` by member and team and the branch's first-check records.
- **Lexicon**: declare **pack** (a crate as the Book shows it, paying a hoggie and a pack bonus), **pack bonus**, **company team**, **team page** and **company profile link**; redefine **crate** (its open pays a pack bonus), **team** (its people are collected on a team page, and its crest earned by completing it), **crest** (earned by a completed team page, or kept from a roster), **sticker book** (team pages instead of group albums) and **Team Spirit**; retire **group album** and **roster** once their code is removed (a retire needs the product owner's words: CV39 quotes them). One term at a time.
- **Coherence**: CV13's, CV30's and CV38's invariants; a journal decision quotes the product owner's words.

## Testing Decisions

- **Good tests** drive the system from the outside: App Home's signed interactivity payloads, kudos through the signed Slack event router, and the website's member queries and mutations with `convex-test`, Slack, PostHog and posthog.com stubbed at `fetch`. They assert what the website answers and what Slack is asked to publish, never tables, except the every-table equality of a gate's dark proof. Times come from `settleInTimeOrder`. Fixtures use made-up people, never a real name, picture or team roster.
- **Packs** (prior art: `convex/website/openQuestCrate.test.ts`, `buyCrate.test.ts`, `convex/hoggies/drops.test.ts`, `convex/quests/heldRewards.test.ts`): each kind's open pays a bonus inside its band once, from App Home and from the website, with a repeat, a replay and a fresh backend answering the same; a held quest reward and the bonus add up in one `applied` with `from` before both; a bonus crossing a level sends the level-up; over 10,000 keys each step is drawn within a point of its share; `packs` lists every waiting kind and answers no amount; `openCrate` opens each kind and refuses another member's crate and a key that isn't waiting; with `packs` off everything equals `main`.
- **Sync** (prior art: the company profiles sync tests): a person on two teams keeps both; roles and leads are kept; a team without slug or name is skipped; a non-Cloudinary crest is dropped; every failure keeps both tables.
- **Matching** (prior art: `convex/website/settings.test.ts`, `profile.test.ts`): name match one-to-one; two members or two profiles of one name match neither; a self link wins over a name match and a taken profile refuses; an admin link and an admin "none" win over both; clearing returns to the name match; a non-admin can't use the admin command; faces follow links.
- **Team pages** (prior art: `convex/stickers/albums.test.ts`, `convex/website/collection.test.ts`): slots are matched teammates other than me; held follows stickers; unmatched counted; mine first; a roster crest stays on its page, or on a `listed: false` page where posthog.com has no such team; `albums` and `crests` absent; the budget at 2,000 members and 2,000 profiles.
- **Completions and Team Spirit** (prior art: the branch's `convex/stickers/completions.test.ts`, `convex/achievements/teamSpirit.test.ts`): as #551 and #552 prove for albums, with team pages.
- Each gate proves its flag: off, unset and missing-key equal the stopping point before; on for one email changes only that member.

## Out of Scope

- The Book spread, the pack stack, the opening scene, the landing flights, the sticker and team-complete moments, hover polish and the phone layout (map #57).
- A Slack picker for "This is me" or the admin override; both are on the website.
- Rarity-weighted pack bonuses, pity timers, or bonuses tied to the hoggie.
- Removing roster code and retiring **roster** and **group album** from the lexicon (a later cleanup after `team-pages` is on everywhere).
- Using posthog.com's start dates, countries or other profile fields.
- Kudos counting for a team, or team leaderboards (teams stay collected, groups stay counted).

## Review

A GPT-6.1 Sol review (high) of the first draft found 15 majors and 3 minors. The website conductor's answer (below) had already removed `packs[].reward`, which settled half of #4 and #7. Sixteen findings are fixed and one is rejected:

1. **Major: a profile could end up with two members** after a returning member's old self link, and through two admin links. Links of non-members hold nothing, the earlier self link wins a tie, and an admin link moves the profile atomically (CV17, CV18).
2. **Major: matched members could repick, and free profiles could be squatted.** The pick is for unmatched members only, and wrong claims are the admin's to fix (CV19).
3. **Major: the admin command didn't check the target.** It needs a current member of the caller's workspace and a known profile, with its answers spelled out (CV20).
4. **Major: waiting packs were unbounded and unordered.** At most 50 are listed, with `morePacks`, ordered by when they became waiting and then by key (CV7).
5. **Major: a listed pack might not open.** Listing uses query-safe forms of each open's own checks (CV7).
6. **Major: `openCrate` demanded a drop that old opens lack.** `drop` is nullable for opens made elsewhere while a flag was off, and `openCrate` refuses while `collection` is off, so it never pays without a drop (CV6, CV8).
7. **Major: coins could show before coins are visible.** The composed `applied` goes through today's visibility projection (CV6).
8. **Rejected: stop rosters earning crests after the switch.** The brief retires rosters *from the Book* and keeps owned crests. Rosters are no longer shown, so completing one is incidental and takes nothing from anyone. A cutoff needs either a per-member write, which a query can't make, or a catalogue version that would also change what members with the flag off see. CV25 says so.
9. **Major: `complete` wasn't durable, and the completion moment was hidden behind an earlier crest.** Stopping point 4 adds `completion` with its own seen key, and `complete` reads it (CV33).
10. **Major: a team leaving posthog.com lost its name.** The completion record snapshots the name and crest (CV31).
11. **Major: a late check could credit the wrong kudos.** The completing award is the latest sticker's `firstAward` among the page's people (CV31), and events group by it (CV36).
12. **Major: completions that earn no tier went untold.** Completion lines are their own notice, deduped by the record (CV34).
13. **Major: flag dependencies were incomplete.** Team pages need `sticker-book`, `teamSpiritShownTo` needs all three flags, and faces ignore links while `team-pages` is off (CV21, CV24, CV35).
14. **Major: the budget ignored overlapping teams.** The supported size is stated in total memberships and proven on the whole answer (CV27).
15. **Major: admins couldn't see who holds a profile.** The admin part lists every profile with its holder and source (CV20).
16. **Minor: unmatched people weren't shown.** `unmatchedPeople` carries their public name and role (CV24).
17. **Minor: there was no schema transition or sync freshness.** The fields ship optional, and rows carry `asOf` so an older replacement is dropped (CV14, CV15).
18. **Minor: a real-sounding nickname example.** It is now a made-up one (CV17).

## Further Notes

**The product owner's words this spec builds on, verbatim** (2026-10-16, the prototype session on #584):

1. On today's Book: "it's like an infinite scroll, almost. It needs a lot more structure."
2. On the crate: "the legendary box there. You can do much better, right, from a design point of view?"
3. On teams: "the team members from the actual website are collected there, like I already collected as stickers … not from the Slack group, but truly from the website team, and you should correlate them."
4. "I like B the most. I think we should make the full page something like this, not just if I click on collection. If I click on book in the top tab, the whole thing should look like this book, right?"
5. "I like the foil packs the most. Maybe you could layer them behind each other so I can see how many packs there are, and then I can click on the layers, and they all spread out. I can click the single packs and get those. Let's keep the crates, but have them like these cards come out."
6. "I also want experience points in the crates and coins, so randomize the amounts there."
7. "Remove these stupid subtitles like 'a new page in your book' and '1 in 50 crates.' I think it's enough if it says 'legendary find wizard.'"
8. "Instead of a button at the bottom, which breaks this immersion, we should have the next chest besides it, and clicking that opens it as well. They all stay open. When I'm done, they all go into the book at the correct places, so it should animate them into it."
9. "Lock it in and tell the contractor to build it and push it out to production autonomously."

**The website conductor's answer** (map #57, 2026-10-16) accepted the contracts. On its asks, `packs` answers no `reward` (CV7: the amounts come only from `applied` at the open, keeping decision 25's loot-box rule), and a page answers `leads: string[]`, since some posthog.com teams have two leads. Map #57 builds the Settings admin part, shown only while the answer carries it, and SP1 behind its own `book-spread` flag (its #585, #586).

**Calls taken at recommendation** are listed with their journal IDs in the resolution on #584.

**Casting.** The build tickets run on Opus 5.5 (high). Reviews run on GPT-6.1 Sol (high).
