# Spec: measure how members use HedgeHug

> **Accepted on [#631](https://github.com/Silthus/kudos/issues/631) (2026-10-18): the product owner said "Yes to all", accepting the spec, its 9 tickets, replay masking A and the backend events and dashboard without a flag.** This file lives on the branch `docs/measure` and is never merged. It is the measurement half of map [#624](https://github.com/Silthus/kudos/issues/624): it makes every later change in the map measurable, before the redesign ships.
>
> **Rule numbers.** Rules are cited as `MS1`–`MS40`. Analytics rules are cited as `O10`, `E11` and `F7`, as `convex/analytics/Analytics.spec.md` and the PostHog spec (#69) cite them. Collection rules are cited as `CV7`.
>
> **Five stopping points.** 1 (MS1–MS6) is the activation dashboard, PostHog only. 2 (MS7–MS15) is the new backend events. 3 (MS16–MS29) is the website in the browser behind `website-analytics`: pageviews, autocapture, heatmaps, dead and rage clicks, web vitals, session replay with masking and error tracking. 4 (MS30–MS33) is the replay vision scanners. 5 (MS34–MS37) is a `Feedback` button. 1 and 2 come first and are independent; 3 is independent of both; 4 and 5 start once 3 is on `main`. MS38–MS40 say what this replaces.
>
> Sources: ticket #631 (the product owner's words, quoted under "Further Notes"); the resolution of #630 (the activation metric, the north star and the guardrails, accepted by the product owner; its numbers stay in a private note); the map's Notes (flags start as `environment = sandbox` at 100%); the code on `main` at `6a07403b` (`convex/analytics/` `projections.ts`, `subscribers.ts`, `outbox.ts`, `person.ts`, `flags.ts`, `darkFeatures.test.ts`; `convex/progression/gate.ts`; `convex/engine/awards.ts`; `convex/stickers/records.ts`, `backfill.ts`; `convex/hoggies/drops.ts`; `convex/website/` `hosting.ts`, `flag.ts`, `memberQuery.ts`, `profile.ts`; `website/src/` `main.tsx`, `Root.tsx`, `ErrorBoundary.tsx`, `route.ts`, `LiveApp.tsx`, `activity/KudosMessage.tsx`, `entryBundle.test.ts`); PostHog project 662840 as it stands on 2026-10-18 (the adoption dashboard 2209148, action 386031, cohort 636309; session replay, heatmaps, exception autocapture and surveys are switched off in the project).

## Problem Statement

The product owner is about to redesign the website into a game and change the core loop, and can't tell whether either works. The project has no pageview at all: nobody knows who opens the website, where they spend their time, what they click or where they give up. Errors in the browser go nowhere. The backend events can't say whether a kudos was more than five words, whether it thanked someone new, or whether a member collected a person. The adoption dashboard still measures "gave 3+ kudos", which the research on #630 replaced.

In the product owner's words: "instrument everything we can on the website. Maybe there's also alternative instrumentation. We actually get to know how people use it, where they spend the time, and what they interact with. Also set up error tracking and replay vision."

## Solution

**Every member action, on Slack and on the website, lands in PostHog under one person, and one dashboard says whether HedgeHug is working.**

- **The dashboard first.** The adoption dashboard gains the accepted activation metric, the north star and the two guardrails, built from events that exist today. "Gave 3+ kudos" stays as a secondary measure.
- **Richer backend events.** `kudos given` says how many words the message had and how many of its recipients the giver thanked for the first time. A new `person collected` event fires when a member collects a person's sticker. Every pack open says whether it happened in Slack or on the website, and "pack opened" is one PostHog action over it.
- **The website in the browser.** For members the `website-analytics` flag is on for, the website sends pageviews and page leaves, including the Book's hash-routed spreads, autocapture, heatmaps, dead and rage clicks, web vitals, session replay and exceptions, under the same distinct id the backend uses. Kudos message text never leaves the browser. The page still runs only its own code, and talks only to the deployment and PostHog.
- **Replay vision.** Two scanners watch website replays for friction and confusion, sized to the credit budget.
- **Something cheaper.** A small `Feedback` button asks one question and lands the answer in PostHog beside the member's replay.
- **Dark first.** The browser half ships behind `website-analytics`, on in the sandbox only, and widens when the product owner says so. The backend events and the dashboard change nothing a member sees, so they ship without a flag, as every product event before them did, and a recorder may not read a flag (E11). This reads the map's flag rule as covering what members see, and the product owner accepted that reading on #631.

## User Stories

**The dashboard (stopping point 1)**
1. As the product owner, I want the adoption dashboard to show the share of new members who give a thoughtful kudos within 7 days of their first event, so that I know whether new members reach the centre of the loop.
2. As the product owner, I want the activation rate counted only over members whose 7 days have passed, so that the newest members don't drag it down.
3. As the product owner, I want weekly thoughtful givers beside the enrolled member count, so that the north star stays comparable as the workspace grows.
4. As the product owner, I want hugs per weekly active member, so that I see when hugs vanish or start to replace thoughtful kudos.
5. As the product owner, I want the giver repeat rate, so that a novelty spike can't pass for growth.
6. As the product owner, I want "gave 3+ kudos" kept but labelled secondary, so that the old baseline isn't lost.
7. As the product owner, I want every flag change marked on the dashboard, so that I can split the weeks before and after it.
8. As an agent maintaining the dashboard, I want each metric to be a proposed Data Catalog metric, so that later agents reuse one definition.

**Backend events (stopping point 2)**
9. As the product owner, I want `kudos given` to carry its word count, so that I can move the thoughtful bar without a code change.
10. As the product owner, I want `kudos given` to say how many of its recipients the giver had never thanked before, so that I can see whether members reach new people.
11. As a member, I want my message's words never to leave HedgeHug, only their count, so that what I write stays between colleagues.
12. As the product owner, I want a `person collected` event each time a member collects a person's sticker, so that collecting people is countable.
13. As the product owner, I want stickers filled in by a backfill not counted as collected today, so that a backfill doesn't look like engagement.
14. As the product owner, I want every pack open to say whether it was opened in Slack or on the website, so that I know where packs are opened.
15. As the product owner, I want "pack opened" as one thing I can chart, so that I never add two events that mean the same open.
16. As the product owner, I want the events the thoughtful bar will need already named, so that the core-loop change is measurable from its first day.

**The website in the browser (stopping point 3)**
17. As the product owner, I want a pageview for every page and every Book spread a member opens, so that I know where members go.
18. As the product owner, I want a page leave with the time spent, so that I know where members spend their time.
19. As the product owner, I want clicks, heatmaps, dead clicks and rage clicks, so that I know what members interact with and where they get stuck.
20. As the product owner, I want web vitals, so that I know when the site is slow for members.
21. As the product owner, I want session replays, so that I can watch how members use the site.
22. As the product owner, I want browser exceptions, including those the error page catches, with readable stack traces, so that I see what breaks.
23. As the product owner, I want the website's events on the same person as the member's Slack events, so that one funnel crosses Slack and the website.
24. As the product owner, I want the website's events to carry the environment, so that the dashboard's production filter covers them.
25. As a member, I want what my colleagues wrote to me never to appear in a replay or an event, so that their thanks stay private.
26. As a member, I want the sign-in code from Slack, and the Slack links and pictures on the page, never to reach PostHog, so that nobody can reuse my sign-in or find my Slack account.
27. As a member, I want nothing captured after I sign out, so that a shared browser isn't tracked as me.
28. As a member, I want the website to load as fast as before, so that measuring me doesn't slow me down.
29. As the product owner, I want all of this off for a member while the flag is off for them, so that nothing changes until I widen it.
30. As a maintainer, I want the page to run only its own code, so that adding PostHog opens no door for injected scripts.
31. As a maintainer, I want the widened policy proven in a real browser with no violation, so that a blocked request never silently breaks replay.

**Replay vision (stopping point 4)**
32. As the product owner, I want new website replays scanned for friction (lost, dead end, slow, error, misread control), so that I learn where members struggle without watching every replay.
33. As the product owner, I want each replay scored for confusion, so that I can watch the worst ones first.
34. As the product owner, I want the scanners capped within the credit budget, so that they never drain it.

**`Feedback` (stopping point 5)**
35. As a member, I want a small `Feedback` button, so that I can say what's confusing in my own words.
36. As the product owner, I want each answer in PostHog beside the member's replay, so that I can see what they were doing when they wrote it.

**Rollout**
37. As the product owner, I want the browser half behind its own flag, on in the sandbox only, so that I see it before anyone.
38. As the product owner, I want to decide when it widens to production, so that I choose when colleagues are recorded.

## Rules

"`website-analytics` is on for a member" means the flag answers true in their member decision. "The project" means PostHog project 662840. Every PostHog object a ticket creates is named `HedgeHug: …` and is created by the ticket that owns it, never by this spec.

### Stopping point 1: the activation dashboard (PostHog only)

- **MS1. Activation.** A member is activated when their first `kudos given` with `thoughtful = true` falls within 7 days of their first event among `kudos given`, `kudos received`, `member welcomed`, `journey step activated`, `unlock opened`, `app home opened`, `hug given`, `command used`, `crate opened`, `quest finished` and `attempt failed`, production only. The rate is activated members divided by members whose first event is at least 7 days old, per week of first event. A hug never counts.
- **MS2. North star.** Weekly thoughtful givers: distinct members with at least one `kudos given` with `thoughtful = true` in the Monday-start week, production only, shown beside the enrolled member count (members with any event so far).
- **MS3. Guardrails.** Hugs per weekly active member: `hug given` events in the week (and stars' own event, if stars ship one), divided by members with any `kudos given` or `hug given` that week. Giver repeat rate: the share of week N's thoughtful givers who give a thoughtful kudos in week N+1.
- **MS4. Where they go.** A "Measurement" row at the top of dashboard 2209148 holds MS1–MS3 as saved insights (SQL where a typed query can't express the 7-day window), each with a short description. The existing "gave 3+" tiles keep their queries and gain "(secondary)" in their names. Nothing is deleted.
- **MS5. One definition each.** MS1–MS3 are created as proposed Data Catalog metrics from their insights; a text card's `agent_context` names them. No definition is copied into card text.
- **MS6. Flag changes are annotated.** Each later ticket in map #624 that changes a flag's rollout in production adds a project annotation at that instant naming the flag. This ticket adds the first, for the dashboard's own change.

### Stopping point 2: the new backend events

- **MS7. Word count.** `kudos given` gains `word_count`: the number of words the giver's gate decision counted (the parser's `words`, recorded on the message's annotations), read from the event's annotations, never by reparsing or reading the message. A message whose annotations carry no count leaves `word_count` out. Analytics reads it through one typed function of `Progression`'s gate, beside `gateDecisionOf`.
- **MS8. The privacy amendment.** Analytics' invariant "only allowlisted properties leave the deployment" changes from "the gate decision's word count never do[es]" to "the gate decision's word count leaves only as the number `word_count` on `kudos given`". Message text, emoji names, time zones, channel, message, thread and Convex document IDs still never leave. The product owner accepted this on #630 (the instrumentation list), and the amendment records a decision citing it.
- **MS9. New recipients.** `kudos given` gains `new_recipients`: how many of the message's recipients had no award from the giver before this message's award to them, between 0 and `recipients`. Analytics' kudos subscriber computes it in its own transaction through Engine's exported `earliestAwardFrom(giver, recipient)`, one indexed `.first()` per recipient, comparing the earliest award with the event's award. The giving transaction reads nothing new, since the giving mutation is near Convex's range limit.
- **MS10. Person collected.** Stickers publishes a new domain event, `stickersCollected`, from the live sticker subscriber in the transaction that inserts the stickers: the workspace and, per inserted sticker, the collector, the person and the sticker's first award. Analytics projects one `person collected` per sticker, with the collector as subject and one property, `via`: `gave` when the collector gave the first award, `received` when they received it. The collected person is never named, not even by an analytics ID. A backfill inserts stickers without publishing, so it records nothing.
- **MS11. Pack opened is an action, not an event.** Every crate open that drops a hoggie, with collection on for the member and no earlier drop for that crate, publishes `hoggieDropped` from `Hoggies`' `dropFor`, and Analytics sends it as `hoggie dropped` with `crate_kind`, `rarity`, `is_new` and, when a pack bonus was paid, `pack_xp` and `pack_coins` (CV7). A reward revealed while collection is off, and a repeated open, publish no drop and count as no pack. No second event is added for the same open. The dashboard ticket creates the PostHog action `HedgeHug: pack opened` matching `hoggie dropped`.
- **MS12. Surface.** `hoggieDropped` gains `surface`: `slack` or `website`, passed explicitly by the adapter or the website command that started the open, through Quests' opens, Unlocks' opens and `Hoggies`' bought-crate opens to `dropFor`. It is never inferred from the crate kind or the idempotency key. `hoggie dropped` sends it as `surface`; an event queued before the field existed leaves it out.
- **MS13. Events for the thoughtful bar.** The core-loop spec's rule (#630 Q12: a thoughtful kudos earns a pack once per giver, per person, per week) is not built here. When it lands, its crate kind appears as a new `crate_kind` on `hoggie dropped`, and `kudos given` gains `packs_earned`: the number of the message's recipients for whom it earned the giver a pack. Both names are reserved by this spec.
- **MS14. Isolation.** The new recordings obey "analytics only observes" (E11) as it stands: they write only the outbox, the drain's state and, the first time, an analytics ID or workspace key; they read no flag and schedule nothing but the drain and the one identify job. The new `stickersCollected` subscriber joins the darkFeatures totality walk, which must fire it, and the invariant's coverage sentence names it.
- **MS15. The dashboard's collection row.** A `Collecting` row on dashboard 2209148 holds weekly members who collected a person, people collected per week, packs opened per week by `surface`, and the share of `kudos given` with `new_recipients > 0`. Each tile is added by the ticket whose event it reads.

### Stopping point 3: the website in the browser

#### The flag and the identity

- **MS16. One flag.** `website-analytics` is a boolean member-decision flag declared through Analytics' flag seam, safe default `false`, created in the project at `environment = sandbox`, 100%. The browser never evaluates a flag: posthog-js runs with `advanced_disable_feature_flags`, which keeps the remote configuration replay and heatmaps need.
- **MS17. One read.** A new website read, `getBrowserAnalytics`, behind `memberQuery` like every website read, with no arguments. `memberQuery` answers its denials (signed-out, verifying, unverified, not-a-member, closed) before the handler runs. The handler answers `{ kind: "off" }` unless `website-analytics` is on for the signed-in member (read without writing), they have an analytics ID, and the deployment has `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST`; otherwise `{ kind: "capture", token, host, distinctId, environment }`: the public project token, the host, the member's own analytics ID and the deployment's environment. A query creates nothing; members admitted to the website already have an analytics ID (`websiteAdmits`).
- **MS18. The same person.** posthog-js starts bootstrapped with `distinctId` as an identified ID, with person profiles for identified users only, and never calls `identify`, `alias` or `setPersonProperties`. It registers `environment` as a super property. The only person properties the browser may write are posthog-js's automatic first-visit `$set_once` properties, with scrubbed URLs (MS21), which Analytics' person events never set or unset; Analytics stays the writer of the profile (F7). The ticket verifies this on the pinned SDK's request bodies.
- **MS19. Loaded late.** posthog-js is a pnpm dependency of the website, imported from `posthog-js/dist/module.full.no-external` in a chunk loaded only after `getBrowserAnalytics` answers `capture`, so the entry bundle's budget test stays as it is and a member the flag is off for never downloads it. It loads nothing from PostHog's servers as script.
- **MS20. Capture stops when the answer does.** Whenever `getBrowserAnalytics` stops answering `capture` (sign-out, an expired session, the flag turning off, an error), the module stops replay, opts out of capturing and then resets, before anything else is sent; a pending import is abandoned. A later `capture` answer, for the same or another member, starts afresh with that answer's ID. A signed-out visitor is never captured.

#### What the browser sends

- **MS21. No sign-in code.** Before any event is sent, every URL property (`$current_url`, `$referrer`, `$initial_current_url`, `$initial_referrer`, the pageleave's previous URL and every stack frame's URL) loses its `code` query parameter. Replay's URLs pass the same function.
- **MS22. Pageviews follow the address.** posthog-js captures no pageview by itself. One seam watches the address (`pushState`, `replaceState`, `popstate` and `hashchange`) and captures `$pageview` whenever the route `routeOf` reads, or the hash, differs from the last one captured; a `replaceState` that only canonicalises the same route captures nothing. Each pageview carries `page` and, on the Book, `book_page` and `spread` (the spread's hash, such as `hoggies/legendary`). Before each new pageview the seam captures one `$pageleave` for the previous one, with its duration; posthog-js sends the one at unload. The seam reads the address, not either shell, so the redesigned shell keeps it unchanged. The ticket verifies that the pinned SDK sends no second leave.
- **MS23. Autocapture and its kin.** Autocapture of clicks, changes and submits, heatmaps, dead clicks, rage clicks and web vitals are on. Autocapture masks all element text and attributes, so an event names the element by its tag, classes and position, never by a label or a link; a control worth naming carries a `data-ph-capture-attribute-control` with a fixed name. The project's settings switch on heatmaps and exception autocapture, with the website's production and sandbox origins as authorised URLs.
- **MS24. Exceptions, without their messages.** Exception autocapture is on, and the shell's error boundary reports the error it caught with `captureException`, once, with the route's `page`. Before an exception is sent, each value's message is replaced by its type name, as the backend does for every error that isn't reportable (O23), and its frames keep their file, line and function with scrubbed URLs. An error from inside posthog-js is never reported back to PostHog.
- **MS25. Readable stack traces.** The website's production build emits source maps, served beside the bundle by the static hosting, so PostHog resolves stack traces from them. The repository is public, so the maps reveal nothing new, and no upload secret is needed.

#### Session replay and masking

- **MS26. Replay is on.** Session replay records every session of a member the flag is on for, all inputs masked, network payloads and console logs off, canvas off. The project's settings switch session replay on, with the same authorised URLs.
- **MS27. Private things are blocked.** Every element that carries kudos text or a Slack reference sits inside an element with `ph-no-capture`: kudos messages with their links and emoji (`KudosMessage`), Open in Slack links (permalinks hold channel and message IDs; today two `OpenInSlack` components), faces (Slack picture URLs hold team and user IDs; `Face`) and emoji shown by name or picture (`NamedEmoji`, `CustomEmoji`). Replay draws each as an empty block of the same size, and autocapture ignores clicks inside it. A test over every page rendered from fixtures guards it: every text node and attribute holding a fixture's kudos words, a Slack-shaped ID, a Slack host's URL or an emoji name sits inside such an element. Names, levels, hoggies and quests stay visible in replay: the project is internal to PostHog, and this is a deliberate exception for replay only, which the product owner chose (masking A, see "Replay masking").

#### The page's own policy

- **MS28. The CSP widens by two hosts.** The website's `Content-Security-Policy` keeps `script-src 'self'`, `style-src 'self'` and every other directive. `connect-src` adds the configured `POSTHOG_HOST` and its assets host (for `https://us.i.posthog.com`, `https://us-assets.i.posthog.com`), and nothing else. If the pinned recorder needs a worker, `worker-src` allows exactly what it needs and the ticket says why. Without `POSTHOG_HOST` the policy is today's. The policy sends no violation reports, since a report would leave the browser outside the flag and with an unscrubbed URL.
- **MS29. The website row.** A "Website" row on dashboard 2209148 holds weekly members who visited, pageviews by `page`, median time on page by `page`, web vitals by `page`, and exceptions per week, all production only.

### Stopping point 4: replay vision

- **MS30. Friction.** A `classifier` scanner, `HedgeHug: website friction`, over production website recordings of at least 10 seconds, with tags `lost`, `dead-end`, `slow`, `error-seen`, `misread-control`, `rage`, `none`, multi-label, prompting the model to tag where the member struggled and say where.
- **MS31. Confusion.** A `scorer` scanner, `HedgeHug: website confusion`, over the same recordings, scoring confusion from 1 (fluent) to 5 (lost), with signals on so findings reach the Signals inbox.
- **MS32. Sized first.** Before each scanner is created, the ticket runs the estimate and reads the remaining budget, picks the default model with `balanced` sampling, and sets a per-scanner `credit_limit`. A scanner whose projection is more than a quarter of the remaining budget is created disabled, and the ticket says so instead of enabling it.
- **MS33. Rated.** The ticket rates its first 5 observations of each scanner, so the prompts are corrected by data, not left at the first guess. Masked kudos text is the scanners' input too: they see the same replay a human does.

### Stopping point 5: a `Feedback` button

- **MS34. One API survey.** The project holds one survey of type API, `HedgeHug: website feedback`, with one open question, "What's confusing or missing here?". The website renders it itself, so no survey widget, style or script is loaded and the CSP stays as MS28 sets it.
- **MS35. The button.** While `getBrowserAnalytics` answers `capture`, the shell's frame shows a small `Feedback` control. Opening the form captures `survey shown`; sending captures `survey sent` with `$survey_id` and `$survey_response`; closing it unsent captures `survey dismissed`. The answer is the member's own words, sent only when they press Send, and the form sits outside every `ph-no-capture` block. This stopping point is the last and the most optional: dropping it removes nothing else.
- **MS36. Brand.** The control and form use the brand's existing components and type, pass WCAG AA contrast, and are reachable by keyboard.
- **MS37. Where answers go.** The survey's results page in the project lists the answers, each linked to its session replay. No answer is stored in Convex.

### What this replaces

- **MS38.** "Gave 3+ kudos" stops being the headline activation; cohort 636309 and its tiles stay as secondary measures (MS4).
- **MS39.** The "website visited" event #630 asked for is the `$pageview` of MS22; no custom visit event is added.
- **MS40.** The "pack opened" event #630 asked for is the action of MS11; the "person collected" event is MS10.

## Coherence

- **Entrances.** `convex/website/WebsiteReads.spec.md` declares `query getBrowserAnalytics: a browser asks whether, and as whom, the signed-in member's browser sends analytics, with no arguments`, handler `getBrowserAnalytics` in `convex/website/browserAnalytics.ts`, trust `browser`. It joins the entrances of "website reads pass one guard" and the list of "the public surface is exact".
- **Trust levels.** No new level. The new read crosses `browser -> domain`, like the website reads beside it. PostHog's ingestion is outside the deployment: the browser talks to it directly, so the website's own invariants, not a Convex entrance, carry what it may send.
- **New invariants**, each a totality oracle with `over:` and `via:` naming its test:
  - In `convex/website/WebsiteReads.spec.md`: "a browser learns only its own analytics ID": getBrowserAnalytics reaches its handler only through `memberQuery`'s guard, and answers the session's own member's analytics ID only while `website-analytics` is on for them, `off` otherwise. Over the read for a member with the flag on, off, unset and without the flags key, without an analytics ID, without the token, and for two members in turn. Crossing `browser -> domain`, `entrances: query getBrowserAnalytics`, kinds `read, identity`.
  - In `convex/website/WebsiteReads.spec.md`: "the website runs only its own code": the policy every HTML response carries is MS28 exactly. Over the policy with and without `POSTHOG_HOST`. Kinds `output`.
  - In `website/Website.spec.md`: "nothing private reaches PostHog from the browser": MS27's test, over every page rendered from fixtures, and MS24's exception scrub, over a boundary error and an unhandled one full of distinctive words, Slack-shaped IDs and a sign-in URL. Kinds `output, message`.
  - In `website/Website.spec.md`: "the browser captures only while told to": no posthog-js call before a `capture` answer, and none after the answer changes (MS20), over an `off` answer, each denial, an error, sign-out and the flag turning off mid-session. Kinds `output, identity`.
  - In `website/Website.spec.md`: "no sign-in code leaves the browser": every URL property of every event, every frame URL and every replay URL is stripped of `code` (MS21). Kinds `credential, output`.
- **Amended invariants.** Analytics' "only allowlisted properties leave the deployment" (MS8) and its `over:` line gain `word_count`, `new_recipients`, `person collected` and `surface`. "Analytics only observes" names the `stickersCollected` recorder. "Website reads pass one guard" and "the public surface is exact" list `query getBrowserAnalytics`.
- **Lexicon.** Declare **browser analytics**: what the website sends to PostHog from the browser for a member `website-analytics` is on for. Product event names, such as `person collected`, stay out of the lexicon, as today's do. One term at a time.
- **Journal.** Each decision below is a `coherence decide` record committed with this file; MS8's quotes #630.

## Implementation Decisions

- **Analytics** gains: `word_count` and `new_recipients` in the `kudos given` projection (reading Engine's `earliestAwardFrom`, `Progression`'s typed word count); a `stickersCollected` subscriber projecting `person collected`; `surface` on `hoggie dropped`; the `website-analytics` flag declaration; and a read, `browserIdentityOf(member)`, that answers the member's existing analytics ID without creating one. It stays the only module that knows PostHog's names.
- **`Progression`** exports a typed `wordCountOf(annotations)` beside `gateDecisionOf`; the gate's annotation shape doesn't change.
- **Stickers** publishes `stickersCollected` from `recordStickersOf`'s live caller only; `backfill.ts` keeps calling it without publishing. The bus validator lists the inserted stickers.
- **Hoggies** threads `surface` through `dropFor` and `hoggieDropped`; Quests, Unlocks and the bought-crate open pass it from their callers; the Slack adapter passes `slack` and website commands pass `website`.
- **Website (Convex)** gains `getBrowserAnalytics` (a `memberQuery`) and the CSP's two hosts in `contentSecurityPolicy`, which gains the host as an argument.
- **Website (browser)** gains one module, browser analytics, mounted by `Root` around both shells: it calls `getBrowserAnalytics`, lazy-imports posthog-js, starts it with the MS16–MS26 options, owns the address seam (MS22), the URL and exception scrubs (MS21, MS24) and the stop (MS20), and exposes `captureException` to `ShellBoundary`. The renderers MS27 names gain `ph-no-capture` on their roots. The `Feedback` control (MS35) is a small component in the frame that renders only while the module is capturing. The website's Vite build turns source maps on.
- **PostHog project settings** (session replay, heatmaps, exception autocapture, authorised URLs) are switched by the ticket that needs them, through the MCP, and its PR says which.
- **Schema.** No table changes. The bus gains `stickersCollected`; `hoggieDropped` gains optional `surface`.

## Testing Decisions

- **Good tests** drive the system from the outside: kudos through the signed Slack event router and website reads and commands with `convex-test`, PostHog stubbed at `fetch`, asserting the request bodies the drain sends; and the website rendered with `Testing Library` over a fake posthog-js whose calls are recorded, asserting what would be sent. Never a table, never posthog-js internals. Fixtures use made-up people and distinctive made-up words.
- **Backend events** (prior art: `convex/analytics/kudosGiven.test.ts`, `crateOpened.test.ts`, `darkFeatures.test.ts`, `projections.test.ts`): `word_count` equals the gate's count and the body holds no word of the message; a message without annotations leaves it out; `new_recipients` counts first-time recipients across a message to one old and two new recipients, and a redelivered event counts the same; `person collected` fires once per sticker with `via` for each direction, never for a backfill, and its body names no second person; `surface` is `slack` from App Home and `website` from each website open; the darkFeatures walk fires the new recorder.
- **The read** (prior art: `convex/website/profile.test.ts`, `preview.test.ts`; sign members in with `aSignedInSession`, so the member decision is tested): `off` with the flag off, unset, without the flags key, without an analytics ID, and without the token; the member's own ID with it on; signed-out, unverified and not-a-member answer as every website read does.
- **The CSP** (prior art: `convex/website/hosting.test.ts`): the policy with and without `POSTHOG_HOST`, exactly.
- **The browser** (prior art: `website/src/routeList.test.tsx`, `deepLinkTargets.test.tsx`, `App.test.tsx`, `entryBundle.test.ts`, `accessibility.test.tsx`): no import before a `capture` answer and no call after it changes; bootstrap with the read's ID and no identify; one `$pageview` per route or spread change, one `$pageleave` for the previous page, and none for a canonicalising `replaceState`; `code` stripped from every URL property and frame; the error boundary reports once, with the message replaced by the type; the block totality over every page's fixture; the entry budget unchanged; the `Feedback` form's events and its keyboard path.
- **Proofs a real browser owes** (on the sandbox, in each ticket's PR): a signed-in session with the flag on shows events, a replay with kudos text, links and faces blocked, a heatmap and a web vitals event in the project under the member's person, the request bodies show no person property but posthog-js's first-visit ones, and the console shows no CSP violation; with the flag off, and after sign-out, no request leaves for PostHog. Production proofs wait for the product owner's widening.
- Each gate proves its flag: off, unset and missing-key equal `main`.

## Out of Scope

- Capturing signed-out visitors and the sign-in page: errors before sign-in are not tracked.
- PostHog's toolbar, its surveys widget, feature flags in the browser and experiments.
- A/B tests: #630 found them underpowered; before-and-after with annotations replaces them (MS6).
- The thoughtful bar itself and its crate kind (the core-loop spec); only its event names are reserved (MS13).
- Slack App Home analytics beyond today's events.
- Coins-spent events, which #630 asked for only if coins stay.
- Widening `website-analytics` in production, which waits for the product owner.

## Replay masking

**Decided: A**, by the product owner on #631 (2026-10-18). The options as they were put: session replay will show text written by other people. The project is internal to PostHog, so everyone in the organisation can open a replay.
Autocapture sends no text or attributes in every option (MS23), and inputs are always masked.
- **A. Block kudos and Slack references, show names (recommended).** Kudos messages, Open in Slack links, faces and emoji are empty blocks in replay (MS27); names, levels, hoggies and quests stay readable. Replays and the scanners stay useful, colleagues' words stay private, and no Slack ID is recorded. Names in replay are a deliberate exception to "names leave only on the person".
- **B. A, and mask all other text too.** Every text node is masked as well. Nothing written by or about a colleague is readable, but replays and the scanners lose most of what makes them useful.
- **C. Mask inputs only.** Kudos text, permalinks and Slack picture URLs are recorded and readable by anyone in the organisation. Not recommended.

## Review

A GPT-6.1 Sol review (high) of the first draft found 10 majors and 4 minors. All are taken:

1. **Minor: not every crate open drops a hoggie.** A reveal with collection off and a repeated open publish no drop; MS11 now says the action counts fresh drops only.
2. **Major: masking text left kudos links and emoji URLs in replay, and `ph-sensitive` doesn't scrub replay.** Private elements are now `ph-no-capture` blocks (MS27).
3. **Major: names, permalinks and Slack picture URLs escaped the mask.** Open in Slack links, faces and emoji are blocked too, with a totality test over every page (MS27); visible names are an explicit, replay-only exception, which the product owner chose (masking A).
4. **Major: browser exceptions could quote kudos text.** Messages are replaced by type names, as on the backend (MS24).
5. **Major: a CSP `report-uri` would send reports outside the flag with unscrubbed URLs.** Dropped; the proof reads the console instead (MS28).
6. **Major: `reset` alone doesn't stop capture.** Capture stops, then resets, whenever the read stops answering `capture` (MS20).
7. **Major: the backend's flag exemption contradicted the map's Notes.** Kept, because a recorder may not read a flag (E11) and nothing changes for members, and put to the product owner explicitly on #631.
8. **Major: page leaves weren't specified for manual pageviews.** The seam sends one leave per navigation; the SDK's unload leave is verified (MS22).
9. **Major: replay may need a worker.** `worker-src` allows exactly what the pinned recorder needs, verified in the ticket (MS28).
10. **Minor: name the bundle and the flags option.** `module.full.no-external` and `advanced_disable_feature_flags` (MS16, MS19).
11. **Minor: posthog-js sets first-visit person properties.** Allowed explicitly, scrubbed, and verified on request bodies (MS18).
12. **Major: the crossing didn't match the entrance's trust.** `browser -> domain`, totality oracles, and `memberQuery`'s real denial answers (Coherence, MS17).
13. **Minor: E11 already allows a first analytics ID and the identify job.** MS14 keeps that allowance.
14. **Minor: `survey shown` came at the wrong moment.** It fires when the form opens, and stopping point 5 is marked optional (MS35).

## Further Notes

**The product owner's words this spec builds on, verbatim** (2026-10-18, on #631): "instrument everything we can on the website. Maybe there's also alternative instrumentation. We actually get to know how people use it, where they spend the time, and what they interact with. Also set up error tracking and replay vision."

**The cheaper instrumentation.** A one-question API survey behind a `Feedback` button (MS34–MS37) is the smallest thing that asks members why, and it costs no CSP change and no widget. #630 also recommended 3 to 5 conversations; they need no code and stay the product owner's.

**Casting.** The build tickets run on Opus 5.5 (high). Reviews run on GPT-6.1 Sol (high).
