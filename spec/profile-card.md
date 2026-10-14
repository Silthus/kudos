# Spec: the profile card

> **Accepted on [#53](https://github.com/Silthus/kudos/issues/53) (2026-10-14) under the map's autonomous authority, every call at its recommendation.** This file lives on the branch `docs/profile-card` and is never merged. It is stopping point 2 of the groups spec (`spec/groups.md` on `docs/spec-groups`) and builds G28–G30 as the progression spec of record amends them (`spec/progression.md` on `docs/spec-progression-v2` at `4bfc420`: "Changes to the groups spec", P65, P76). It is independent of groups: the group spec [#52](https://github.com/Silthus/kudos/issues/52), specced in parallel, adds the primary group to the card, and the hedgehogs spec [#96](https://github.com/Silthus/kudos/issues/96) adds the hedgehog avatar as its image (PC14).
>
> **Rule numbers.** Rules are cited as `PC1`–`PC17`. Groups spec rules are cited as `G28`, progression rules as `P76`, website rules as `WS343`.
>
> Sources: the code on `main` at `2fe2a5a` (`convex/slack/commands.ts`, `convex/achievements/`, `convex/progression/`, `convex/feedback/home.ts`, `convex/website/profile.ts`, `convex/website/leaderboard.ts`, `convex/analytics/flags.ts`, `slack-app/manifest.ts`); map #1's decisions 11, 12 and 18; the website map's needs (map #57, `spec/website-7.md` on `docs/spec-website-7`, WS343, ticket #284) and its conductor's answer (PC16); the accepted website prototype (`prototype/website-ui`, variant E's `profile-card.tsx`).

## Problem Statement

A member who gets a kudos from a colleague, or sees a name on the leaderboard, has no way to look that person up in HedgeHug. Levels and achievement tiers are public by design (P65), yet nothing shows them to anyone but their owner. A member's own website shows a "Your profile card" panel, but it holds only their face, name and level: it can't show the medals teammates would see, because no read answers the card.

## Solution

**`/hedgehug @member` replies privately with that member's profile card, and the website reads the member's own card as teammates see it.**

- **The card.** The member's name, `Level {n}`, and their best four achievement tiers as medals. It never shows coins, perks, XP, kudos counts, quests or stickers. It is read live, and nothing is stored for it.
- **What has shipped, not who has unlocked what.** Teammates see a level once XP and levels have shipped, and medals once the Book has shipped, whatever anyone's unlocks. The one exception is a member's own card: its medals wait until that member has opened the Book (P76).
- **Slack.** `/hedgehug @member` (and the `/kudos` alias) answers with the card as a private reply. It also answers a person who isn't a member, and it shows usage help for anything that isn't exactly one person mention.
- **The website.** One read, `getProfileCard`, answers the signed-in member's own card in the same shape. The website renders it in "What teammates see" (WS343, #284).
- **Behind `profile-card`.** A new flag that starts sandbox-only plus Michael's email (decision 18). While it is off, `/hedgehug @member` behaves exactly as today and the read answers `not-found`.
- **It grows.** Groups (#52) add the primary group and hedgehogs (#96) add the avatar image, each as an addition to the same read and the same reply.

## User Stories

**Looking someone up in Slack**
1. As a member, I want to type `/hedgehug @colleague` and see their profile card, so that I can learn a bit about a teammate who just thanked me.
2. As a member, I want the card as a private reply, so that looking someone up doesn't post anything in the channel.
3. As a member, I want to see their level, so that I can see how much they take part.
4. As a member, I want to see their best achievement tiers, so that I can see what they have collected.
5. As a member, I want the best tiers first, so that a diamond never hides behind a bronze.
6. As a member, I want at most four medals, so that the card stays a glance.
7. As a member, I want each medal to name its tier, so that I know what "💎" stands for.
8. As a member, I want to look up my own card, so that I can see what my teammates see of me.
9. As a member who mistypes, I want a short usage line when I mention two people or a group, so that I learn the command's form.
10. As a member, I want `/hedgehug @someone` for a bot or a guest to say they aren't an active member, so that I'm not left wondering.
11. As a member, I want a card for a colleague who has never used HedgeHug, so that the command works for everyone in the workspace.
12. As a member, I want `/hedgehug` alone and `/hedgehug leaderboard` to keep working as before, so that the new form changes nothing I already use.
13. As a member whose colleague has earned nothing yet, I want their card to show just their name and level, so that an empty card doesn't look broken.

**Privacy**
14. As a member, I want my card never to show my XP, coins, perks, kudos counts, quests or stickers, so that only what is public by design is public (G28, P65, P66).
15. As a member, I want my card to show what has shipped, not what my teammate has unlocked, so that every viewer sees the same card of me (P76).
16. As a member who hasn't opened the Book yet, I want my own card to show no medals, so that HedgeHug doesn't tell me about achievements before I open them (P76).
17. As a member, I want the card read live, so that it always shows my current level and tiers (G30).

**On the website**
18. As a member on the website, I want the "What teammates see" panel to show my medals, so that it shows me exactly what my teammates see in Slack.
19. As a member, I want the website card to show the same name, level and medals as Slack, so that the two never disagree.

**Rollout and measurement**
20. As Michael, I want the card behind its own flag, sandbox-only plus my email first, so that I try it before anyone else (decision 18).
21. As Michael, I want `/hedgehug @member` to behave exactly as today while the flag is off for the person typing it, so that shipping it changes nothing for members.
22. As Michael, I want a product event when a member views a card, own or a teammate's, so that I can see whether people use it.
23. As a website builder, I want the card's later parts (group, hedgehog) to arrive as new fields, so that my rendering never breaks when they ship.

## Rules

### The command

- **PC1. The card command.** When the text of the slash command (`/hedgehug`, or its `/kudos` alias) is exactly one person mention, it replies privately with that person's profile card. A member can show their own card.
- **PC2. Reading the text.** The manifest escapes the command's text (`should_escape`), so a person mention arrives as `<@U…>` or `<@U…|label>`. A user group (`<!subteam^…>`), a broadcast (`<!here>`, `<!channel>`, `<!everyone>`) or a channel (`<#C…>`) is not a person mention. The card command applies only when the text's first word is a mention of any kind:
  - exactly one word, a person mention: the card (PC3–PC5);
  - otherwise, when the first word is a mention: G29's usage line, ``Type `/hedgehug @someone` to see their profile card.`` (the command shown is always `/hedgehug`, as the other usage lines do);
  - text whose first word isn't a mention keeps today's behaviour: none joins the channel, `leaderboard` shows the board, and anything else joins the channel.
- **PC3. Who the card is for.** The directory decides. A member gets their card. A bot or a person the directory records as not a member gets ``<@U…> isn't an active member of this workspace.`` (G29, with the mention as the name). A person the directory doesn't know yet is looked up in Slack first, the same way the command's usage fact looks up its viewer, at most three tries. If every try fails, the reply is ``I couldn't look up <@U…> right now. Try again in a minute.``
- **PC4. Answering in time.** When the directory already knows the person, the command's HTTP response carries the reply. Otherwise a scheduled action looks the person up and answers through the command's `response_url`, as the channel join does today. Either way the reply is an ephemeral `response_type`.
- **PC5. What Slack shows.** The reply has up to three lines, each present only when it has content:
  1. the member's name, as a bold person mention;
  2. `Level {n}` (PC7);
  3. the medals (PC8), each `{medal} {tier name}`, joined by ` · `, with the medal emoji the Book uses in App Home (🥉 bronze, 🥈 silver, 🥇 gold, 💎 diamond). Example: `💎 Patron of Praise · 🥇 Hall of Fame · 🥈 Connector · 🥉 Regular`.

  A card with no level and no medals is the name line alone.

### The card

- **PC6. Only what is public.** A card holds the member's name, level and medals, and nothing else: never coins, perks, skill points, XP, kudos given or received, quests, stickers or a streak (G28, P65, P66). There is nothing to hide: no switch hides a part of the card (P65).
- **PC7. Level.** The member's current level from progression, present while `xp-levels` is on in the workspace decision, absent otherwise.
- **PC8. Medals.** Present while the Book applies in the workspace and its launch is recorded, the same predicate `achievementsOf` uses. Take each ladder's highest earned tier, sort the tiers diamond, gold, silver, bronze, break ties by the ladder catalogue's order, and keep the first four. Each medal carries its ladder, its tier and the tier's name. Tiers earned while notices were held back (`hidden`) count: they are earned for good (P61). No earned tier means no medals.
- **PC9. What has shipped, not who has unlocked.** PC7 and PC8 follow what has shipped in the workspace, never the viewer's or the member's unlocks (P76). The exception is a member's own card: its medals are empty until that member has opened the Book, because P76 keeps a member's own progress about a feature silent until they open it. Their level shows from the start, since the card belongs to the Basics (level 1, P72's schedule).
- **PC10. Live.** The card is computed from current state each time it is shown. Nothing is stored for it (G30). Reading a card never records a workspace launch, a preview moment or an exposure other than PC11's.

### Flag, analytics and the website

- **PC11. The `profile-card` flag.** A new flag declared like the others (`safeDefault: false`). The command consults it only on PC2's mention path. It reads the member decision of the person typing the command when the directory knows them as a member, and the workspace decision otherwise. It sends the exposure once per member and value, and for a viewer the directory doesn't know yet, once they are known, the way `/hedgehug leaderboard` does. While the flag is off, the command behaves exactly as on `main`: it joins the channel and answers today's join line.
- **PC12. Rollout.** Per decision 18, `profile-card` starts sandbox-only plus Michael's email. The ship creates it in PostHog that way and never widens it. Widening to production is Michael's call once he has tried it.
- **PC13. Product event.** Each card shown in Slack to a member records a usage fact that projects to the product event `profile card viewed`, with properties `own` (the viewer looked up themselves) and `surface: "command"`. Recording never blocks or fails the reply. Usage lines, not-a-member replies, lookups that failed and the website read record nothing.
- **PC14. Later parts are additions.** The groups stopping point (#52) adds the member's primary group: in Slack it joins the second line as `{group} · Level {n}` (G28), and the read gains `group: { name } | null`. The hedgehogs stopping point (#96) adds the equipped hedgehog as the card's image and `hedgehog: { id, name } | null` in the read. Neither changes an existing field. Until they ship, the fields are absent, and absent means "not shipped".
- **PC15. The website's read.** `getProfileCard`, a public query on `memberQuery` with no arguments, answers the signed-in member's own card, with the member taken from the session and never from arguments. It answers `Denial` first, then `{ kind: "not-found" }` while `profile-card` is off for the member (the member decision, read without an exposure, as every website query reads flags), else the card:
  - `name`: the directory's display name, the same name a board row shows, else "A teammate";
  - `level`: PC7's level, or `null`;
  - `medals`: PC8's medals, empty under PC9 until the member opened the Book.
- **PC16. No command, no other member.** The card is read-only, so this spec adds no D17 command and no keyed outcome. The website reads only the member's own card. A read of another member's card waits until Michael asks for it (the website conductor's answer, 2026-10-14).
- **PC17. Production unchanged.** With `profile-card` off, every Slack reply and every website answer is byte-for-byte today's, and the new public query answers `not-found`.

## The contract for the website (#284)

Accepted by the website conductor on 2026-10-14 as proposed: the shape fits #284, the best four medals match the prototype's `bestTiers`, an own card shows no medal row until the Book is opened, and the website gates #284 on `not-found` and adds no flag of its own.

```ts
type Medal = {
  ladder: "generosity" | "recognition" | "connections" | "dependability" | "applause" | "seasons" | "old-friends";
  tier: "bronze" | "silver" | "gold" | "diamond";
  name: string; // the tier's name, e.g. "Generous Soul"
};

type ProfileCard = {
  kind: "card";
  name: string;
  level: number | null;
  medals: Medal[]; // at most four, best first
  // later, as additions: group?: { name: string } | null (#52); hedgehog?: { id: string; name: string } | null (#96)
};

// getProfileCard() → Denial | { kind: "not-found" } | ProfileCard
```

**What the website does with it** (its ticket #284 owns the UI): "What teammates see" calls `getProfileCard`, keeps today's panel while it answers `not-found`, shows the medal row only when `medals` is non-empty, draws each medal as the website's medal with the tier's name beside it, and treats a missing `group` or `hedgehog` as not shipped.

## Implementation Decisions

- **A new profile card module** (a deep module beside the other domain modules) owns the card: `profileCardOf(ctx, member, { own })` returns the platform-neutral card (name, level or none, medals) from the directory, progression's level read, achievements' earned tiers and the Book predicate, and Unlocks' opened state for PC9. It only reads, so a query and a mutation can both call it. It reads other modules through their exported functions, never their tables. It owns the best-four rule (PC8) and its catalogue-order tie break.
- **Achievements** exports a query-safe predicate for "the Book applies and is launched in the workspace", the one `achievementsOf` already uses, so the card and `achievementsOf` share it.
- **The flag**: `profileCardFlag` (`profile-card`, `safeDefault: false`) with a `isProfileCardShown` internal mutation shaped like `isEveryoneBoardShown` (member decision with exposure for a known member, workspace decision for an unknown viewer), and the deferred exposure added to the command's `exposeOnceKnown`.
- **The Slack adapter**: the slash command handler gains PC2's parse before today's fallthrough. A known target answers in the HTTP response. An unknown target schedules an action that looks the person up with the existing `lookUpUser` and three-try policy, then answers through `response_url` (PC4).
- **Feedback** renders the card's lines (`renderProfileCard`), the not-a-member line, the lookup-failed line and the usage line from segments, with the Book's medal emoji (PC5). The command copy lives with the other command copy.
- **Analytics**: a `profileCardViewed` usage fact (`own`, `surface`) and its projection to `profile card viewed` (PC13), recorded without blocking, as `leaderboardViewed` is.
- **The website module** adds `getProfileCard` on `memberQuery` (PC15) and declares it as an entrance in its component spec.
- **Coherence**: a component spec for the profile card module with the invariants "a profile card shows only name, level and medals" (PC6), "a card follows what has shipped, never anyone's unlocks, except an own card's medals wait for the Book" (PC9) and "`/hedgehug @member` is today's command while `profile-card` is off" (PC11, PC17). Commands' and Slack's component specs gain the card command, and Website reads gains `getProfileCard`. The lexicon's **profile card** stays as it is. It already names name, hedgehog avatar, primary group, level and tiers, and this spec builds the parts that have shipped.
- **No schema change.** The card stores nothing (PC10).
- **No manifest change.** `should_escape` is already on, and the command keeps its description, so no re-paste is needed.

## Testing Decisions

- **Good tests** drive the system from the outside. They send signed slash commands through the HTTP router with `convex-test`, stub Slack and PostHog at `fetch`, and call the website's public query with a signed-in identity. They assert what the member sees: the ephemeral's text, the `response_url` body, the query's answer. They never assert on tables.
- **The Slack boundary** (prior art: `convex/slack/leaderboard.test.ts`, `everyoneBoardFlag.test.ts`, `commands.test.ts`, `unknownPeople.test.ts`):
  - with `profile-card` on, `/hedgehug <@U…>` for a member with XP and earned tiers answers the three lines, medals best first, at most four, catalogue order on ties;
  - an own card before the Book is opened has no medal line, and a teammate's card shows the medals whatever either member's unlocks;
  - with `achievements` off or the Book not launched, there is no medal line, and with `xp-levels` off, there is no level line;
  - two mentions, a group mention or a mention followed by words answer the usage line;
  - a bot and a not-a-member answer the not-a-member line;
  - an unknown person is looked up and answered through `response_url`, and three failed lookups answer the lookup-failed line;
  - with the flag off, `/hedgehug <@U…>` is byte-for-byte `main`'s join path, and `/hedgehug` and `/hedgehug leaderboard` are unchanged with the flag on;
  - the exposure is sent once per member and value, also for a viewer the directory learns later;
  - `profile card viewed` is captured with `own` true and false, and not for the usage or not-a-member replies.
- **The website boundary** (prior art: `convex/website/profile.test.ts`, `leaderboard.test.ts`): `getProfileCard` answers the signed-in member's own card, equal in name, level and medals to the Slack card of the same member viewed by themselves. It answers `not-found` with the flag off and the denials of `memberQuery` first, and it never carries another field.
- **The card module** gets no tests of its own: both boundaries cover it. The best-four rule is proven at the Slack boundary with seeded tiers on several ladders.

## Out of Scope

- The primary group on the card (#52) and the hedgehog avatar as its image (#96). Each is an acceptance criterion of the stopping point that brings it (PC14).
- A website read of another member's card (PC16).
- Titles, cards (the cosmetic), hide switches, streaks: cut by decision 12, or never on the card (P65).
- The website's UI for the card (#284 on map #57).
- A Slack shortcut, an App Home button or a message action that opens a card. The slash command is the one entry.
- Changing the slash command's manifest description.

## Further Notes

**Michael's decisions this spec builds on, verbatim.**

1. The cut (map #1, decision 12, 2026-10-13): "things I would cut: boosters, group auras, drops, rarities, titles, quips, streaks, freezes, journey", "can we reduce the skill tree to just a single tree?", "Let's lock that design in", corrected to "the onboarding journey is not cut, the rest is as stated". So the card has no title and no card cosmetic, and nothing on it can be hidden (G28 as amended, P65).
2. All in (map #1, decision 18, 2026-10-14): "let's just turn them all on for everyone. I'm going to organically roll this out as we go. Just make sure that code where it's not yet fully there still has the flags only for me, but for everyone else, just turn them on. Let's go all in here." So new work ships behind a flag that starts sandbox-only plus Michael's email (PC11, PC12).
3. Every new feature behind a flag (map #1, decision 11, 2026-10-13): "make sure that any new feature going to production, like leveling, the new website, etc. is behind a feature flag."

**The calls taken at recommendation** are listed with their journal ids in the resolution on #53.

**Casting.** The build tickets run on Opus 5.5 (high). Reviews run on GPT-6.1 Sol (high).
