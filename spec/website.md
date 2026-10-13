# Spec: the website's first slice, sign in with Slack and the home page

> **Accepted on 2026-10-13 under Michael's autonomous directive** (map [#57](https://github.com/Silthus/kudos/issues/57) Notes: "ship as much as you can of this autonomously proofing each step and deploying dark and safely behind feature flags"), with every open call at its recommendation (listed under "Further Notes"). Ticket [#65](https://github.com/Silthus/kudos/issues/65). This file lives on the branch `docs/spec-website` and is never merged. It is the target design of the first slice; its implementation tickets are listed under "Slices".
>
> Sources: the architecture prototype [#64](https://github.com/Silthus/kudos/issues/64) ([brief](https://github.com/Silthus/kudos/blob/6b9e312/prototype/website-architecture.md), cards W1–W11 and L-W1–L-W6, contracts in its §3), the visual language [#63](https://github.com/Silthus/kudos/issues/63) ([`docs/website/visual-language.md`](https://github.com/Silthus/kudos/blob/main/docs/website/visual-language.md), rules V1–V24, ADR-0005, and its "Follow-ups for #65"), the UI prototype [#62](https://github.com/Silthus/kudos/issues/62) (variant E, `prototype/website-ui` at `3409ade`), the name [#58](https://github.com/Silthus/kudos/issues/58), the auth research [#60](https://github.com/Silthus/kudos/issues/60), the hosting research [#61](https://github.com/Silthus/kudos/issues/61), the Octalysis research [#85](https://github.com/Silthus/kudos/issues/85) ([report](https://github.com/Silthus/kudos/blob/research/octalysis/research/octalysis.md), section 2 of its resolution), the flag seam [#78](https://github.com/Silthus/kudos/issues/78) (rules O31 and O33–O36 of [`spec/posthog.md`](https://github.com/Silthus/kudos/blob/docs/spec-posthog/spec/posthog.md)), map #1's support lane [#90](https://github.com/Silthus/kudos/issues/90) (#87, #88, #89), and the code on `main` at `87ee387`.

## Problem Statement

A member's kudos live in Slack: a reaction, a private reply, an App Home tab. App Home is compact and Block Kit can't carry the PostHog brand, the hedgehogs, or the game screens #62 designed. The game that map #1 is building (XP, levels, quests, the leaderboard, the Book) needs a place where a member can see their own progress in full, and every later screen needs the same foundation first: a website that knows who the member is, shows only them their own facts, and can be kept dark in production until Michael switches it on.

## Solution

Each Convex deployment serves its own **website** from its `*.convex.site` root. A member signs in with Slack (Convex Auth with the Auth.js Slack provider, inside the Slack adapter), and lands on their **home**: their own name and picture from the sign-in, the kudos they have left today and when they refill, and the kudos they gave and received this week and in total. Every fact comes from the same facts function App Home reads (`engine.homeFacts`), through one public, signed-in query. Nothing is computed in the browser.

The whole site sits behind one PostHog flag, `website`, which answers off by default. While it is off, the site shows a closed page and refuses sign-in. Workers create the flag on in the sandbox and dark in production. App Home links to the website only while the flag is on.

The site is a game HUD on PostHog's design system in light and dark mode (V1–V7). The first slice shows only what exists today: no level, XP, locked feature cards or crates until map #1's facts for them exist (#85).

## User Stories

**Signing in**
1. As a member, I want to sign in with the Slack account I already use, so that I don't need another password.
2. As a member, I want Slack to open my own workspace when I sign in, so that I don't pick the wrong one.
3. As a member who just joined, I want my sign-in to work even if HedgeHug hasn't seen me yet, so that I'm not locked out on day one.
4. As a member, I want to sign out from the site, so that a shared machine doesn't stay signed in.
5. As Michael, I want only members of the deployment's own workspace to sign in, so that nobody else reads a member's kudos.
6. As Michael, I want a person who left the workspace to lose access at once, so that a valid session can't outlive membership.

**The home page**
7. As a member, I want to see how many kudos I have left today and when they refill, so that I know whether I can thank someone now.
8. As a member, I want to see what I gave and received this week and in total, so that I can see the thanks I'm part of.
9. As a member, I want the page to lead with thanking, not with numbers to chase, so that the site feels like gratitude and not a scoreboard.
10. As a member, I want to see what my teammates can see of me, and that what I receive stays private, so that I trust the site.
11. As a member, I want the page to update when a kudos lands, so that I never reload.
12. As a member with nothing this week, I want one clear pointer back to Slack, so that I know what to do next.
13. As a member, I want the site in light or dark mode, following my system first, so that it fits how I work.

**Running it**
14. As Michael, I want the whole site dark in production until I switch on one flag, so that nothing reaches members before I decide.
15. As Michael, I want App Home to link to the site only while it's open, so that members never land on a closed page from Slack.
16. As Michael, I want the sandbox to prove a real Slack sign-in before production gets anything, so that the unsupported provider is checked live.
17. As a developer, I want every public function on an exact list and every read to check the live session, so that a new entrance is always a reviewed change.

## Rules

Rules are numbered `WS1`–`WS28`. The `WS` prefix keeps them apart from #64's decision cards W1–W11, which this spec cites by their own names.

### The site and its flag

- **WS1. One website per deployment.** Each D9 deployment serves its own website at its `*.convex.site` root, built against that deployment (L-W5). Mock data is only ever published to a disposable deployment. The first slice has one page, the **home**, at `/`. Every other path renders a not-found page with a link home. The tab reads `HedgeHug · Home` and the subtitle is "Thanks a Hog" (#58).
- **WS2. The `website` flag.** One flag gates the whole site. It is declared once through the flag seam (O33): key `website`, subject the workspace (the deployment's `SLACK_WORKSPACE_ID`), values `false` and `true`, safe default `false`. A missing key, a missing definition, a failed evaluation, or an unset `SLACK_WORKSPACE_ID` answers off.
- **WS3. Closed while off.** While `website` is off: every website read answers `closed`, sign-in is refused before anything is written, the shell shows the closed page (one hedgehog and one sentence from Max, V18, saying the website isn't open here yet and kudos in Slack work as always) with no sign-in button, and App Home shows no link (WS28). Switching off takes effect on the next read, so open pages turn closed reactively. Sessions survive but can read nothing.
- **WS4. Where the flag is read.** `getMyProfile` reads the flag first, before the session. The sign-in callback reads it before it writes a `users` row. App Home reads it before it renders the link. The flag is never an exposure (O36): it gates a surface for the workspace, not an experiment for a member, so no `$feature_flag_called` is sent.

### Sign-in

- **WS5. Sign in with Slack.** Convex Auth with the Auth.js Slack provider, `checks: ["state", "nonce"]`, scope `openid profile`, and `team` set to `SLACK_WORKSPACE_ID` (L-W1, W3, W10). The provider and the claim mapping live in the Slack adapter (`convex/slack/signIn.ts`), which hands the website module only a chat identity (L-W2). Credentials are `AUTH_SLACK_ID` and `AUTH_SLACK_SECRET`, the deployment's own Slack app (W10).
- **WS6. Sign-in fails closed.** An unset `SLACK_WORKSPACE_ID`, another workspace's `team_id`, an empty team or user claim, or the flag off creates no session. So do the eight refusals of #64 §4.3: a wrong nonce, another client's token, a tampered state, a missing state cookie, login CSRF, a replayed one-time code, and a stolen code without the browser's verifier. The browser lands back on the site signed out (or closed), and a sign-in that started in this browser and came back without a session shows "Sign-in didn't finish" with a retry.
- **WS7. Accounts link only by the Slack pair.** The account key is `<workspace>/<user>`, never an email. The `users` row keeps the name and picture from the sign-in claims, refreshed on every sign-in (W8). A `users` row is a sign-in identity, never a member: membership stays in the directory.
- **WS8. A person the directory doesn't know yet** signs in, the Slack adapter's `verifyMember` (users.info) is scheduled, and the page shows "Checking your membership…" until the directory answers, then turns into the home or the not-a-member page reactively (W4).
- **WS9. Sessions.** Convex Auth's defaults: a 1-hour JWT, 30 days total and 30 days of inactivity (W5). Sign-out from the avatar menu ends the session at once, and every read rechecks the live session (L-W3), so a still-valid JWT after sign-out reads `signed-out`.

### Reads

- **WS10. The public surface is an exact list.** Exactly these Convex functions are public: Convex Auth's `signIn`, `signOut` and `isAuthenticated` in `convex/auth.ts`, and `getMyProfile` in `convex/website/profile.ts`. A test lists them, so a new public function fails until it is added by a reviewed change. This replaces R50's empty list with #64's rule text (§3.1): *only HTTP routes, Convex Auth's `signIn`, `signOut` and `isAuthenticated`, and the website's signed-in functions in `convex/website/` are public; every website function resolves the signed-in member from the session before it reads or acts, and every other function is internal.*
- **WS11. The member comes from the session, never from arguments.** Website functions are built on `memberQuery`, which resolves the signed-in member before the handler runs. `getMyProfile` takes `{}`.
- **WS12. A typed answer, never an empty profile.** `getMyProfile` answers exactly one of `closed`, `signed-out`, `verifying`, `not-a-member` or `member`, checked in that order: the flag, the live session, the directory. A denial is never a profile of zeros.
- **WS13. Facts, never rules.** The member answer projects `homeFacts` (L-W6, R46): the kudos emoji, kudos left today and the allowance base, when the allowance refills, given and received this week, given and received in total, plus the name and picture from the sign-in. When `homeFacts` carries level and XP (map #1's XP slice, #80), the answer passes them through unchanged; until then the site shows neither. The refill time is a fact the engine computes and `homeFacts` carries (`refillsAt`); the website never derives it from a time zone.
- **WS14. Membership on every read.** The directory decides on each read, so a person `user_change` marks deactivated reads `not-a-member` on their next read, whatever their session (L-W3).
- **WS15. Reactive.** The home is one Convex subscription to `getMyProfile`. It updates when a kudos lands, with no polling and no reload.

### The home

- **WS16. The HUD frame (V1) in the first slice** holds the HedgeHug wordmark, the screen nav with Home as its only item, the light and dark toggle (V6), and the member's avatar with a menu that signs out. Skill points, coins, the ready pill and the level ring appear only once their facts exist.
- **WS17. Thanking first, counters second** (#85). The hero (a game object, V2) leads with the act of thanking: the member's avatar and name, the kudos left today out of the base as the one big stat (V5), when they refill, and the one action, thanking someone in Slack, as the page's only primary element (V4). Max's insight line states this week's thanks in words and never forecasts (V18). The counters, this week and in total, given and received, follow in a plain Quill card (V2) with tabular figures (V5). The first slice has no kudos message content to lead with; leading with the latest thanks received (V14) waits for a map #1 facts function (cross-map need 9).
- **WS18. Received stays private** (#85, P65). The member's own received counts appear only on their own home. The "Your profile card" panel shows exactly what a teammate can see of them today, their face and name, and says that the kudos they receive stay private. It never shows a received count.
- **WS19. Show only what exists** (#85). The first slice shows no level, XP, quest, coin, crate, ready feature, or locked feature card, because no facts for them exist on `main`. Later slices derive locked, ready and opened from map #1's unlock facts (P73, V23) and never from a level table in the website.
- **WS20. Empty and error states** (V23, V18). A member who gave and received nothing this week sees one hedgehog, one sentence from Max, and one action that opens the workspace in Slack to thank someone; it never points to a reward. The not-a-member, not-found and error pages each carry one hedgehog and one sentence from Max.

### Faces

- **WS21. The member's own face** follows V19's chain: their company profile cutout on its colour when the posthog.com sync (WS22) holds exactly one profile whose first and last name match the sign-in name (V21), then the Slack picture from the sign-in claims, then initials on a muted tile. Until hedgehog facts exist (V20), the avatar slot on the HUD and the hero shows this face, because a hedgehog nobody chose would carry no meaning (V17).
- **WS22. The posthog.com sync.** A daily internal action reads posthog.com's public team API into the website's own `companyProfiles` table (name, cutout image, colour, team slug). A run replaces the table only after a complete, validated read; a failed or malformed read keeps the previous rows and logs a fixed code. Cutouts hotlink `res.cloudinary.com` with size transforms. Only this sync knows posthog.com. Tests use synthetic fixtures only; the sandbox never matches, so it exercises the fallback.

### Look and accessibility

- **WS23. The look.** The site follows V1–V7 and V16–V24 on `@posthog/quill`, `@posthog/icons` and `@posthog/brand` (ADR-0005). It ports variant E's static styles fresh and never copies prototype code wholesale. It drops E's three loops (the XP shimmer, `hud-glow`, the crate wobble) and every count-up (V8–V9). Until PostHog's brand team provides Max art, an existing hoggie stands in for Max.
- **WS24. Accessibility** (V24). WCAG 2.2 AA in both modes. Every page is checked with axe in light and dark. The keyboard path covers sign-in, the theme toggle, the avatar menu and sign-out, and focus lands on the page title after a state change. Each slice gets a manual pass of focus order, focus visibility, reduced motion and screen-reader wording.

### Security, hosting and links

- **WS25. A strict Content Security Policy on the shell** (W5), because session tokens live in `localStorage`. Scripts and styles from the site's own origin only; connections to the site and its deployment's `*.convex.cloud` (HTTPS and WebSocket); images from the site, Slack's avatar host and `res.cloudinary.com`; no framing. The shell holds no member data: every fact arrives through `getMyProfile`. Ticket 1 sends the policy as a response header if the app-owned static route can set one, and as a `<meta>` policy otherwise, recording what the meta form can't enforce.
- **WS26. App-owned routing** (L-W4). `convex/http.ts` registers the Slack routes, then Convex Auth's `/api/auth/*`, then the static catch-all with an SPA fallback, last. Slack's URLs never move. Hashed assets are `immutable`, HTML revalidates, and the first slice ships no lazy chunks (hosting research #61).
- **WS27. Deploy path.** A deploy builds the website against its own deployment and uploads it after `convex deploy`, in the same workflow. The sandbox `different-dog-467` goes first, and its acceptance is the live Slack sign-in (W11). Production `affable-bat-254` follows, dark: the `website` flag answers off there, so production shows only the closed page.
- **WS28. App Home links in.** While `website` is on for the workspace and `SITE_URL` is set, App Home shows one "Open HedgeHug on the web" link to `${SITE_URL}/`. Otherwise App Home is unchanged. The link carries no identity (W9): a signed-out member signs in and lands on the home.

## Implementation Decisions

### Modules

- **website package (new, `website/`)**: a pnpm workspace package beside `convex/` with its own `package.json` (React, Vite, Tailwind, Quill, Convex Auth's React client) and a DOM `tsconfig`. It imports `../convex/_generated/api`. `pnpm gate` runs its typecheck and tests through Vitest projects (W1).
- **website module (new, `convex/website/`)**: `signedInMember`, `memberQuery`, the `createOrUpdateUser` callback, the `website` flag declaration and `getMyProfile`. Later pages add one query each here (W6).
- **Slack adapter (extended, `convex/slack/`)**: the sign-in provider and claim mapping (`signIn.ts`), and `verifyMember` for a signed-in person the directory doesn't know (W4). App Home renders the link (WS28).
- **Convex Auth (new, `convex/auth.ts`, `convex/auth.config.ts`)**: its tables, its routes, and its three public functions.
- **Kudos engine (extended)**: `homeFacts` gains `refillsAt`, additive; App Home ignores it.
- **Company profiles (new, `convex/companyProfiles/`)**: the posthog.com sync, its table, and the matcher for one member's face (WS21–WS22). Only it knows posthog.com.
- **Static hosting (new component)**: `@convex-dev/static-hosting` mounted by the app's router, not at `/` by the component (L-W4).

### Contracts

From #64 §3, with this slice's additions marked.

```ts
// convex/slack/signIn.ts (the Slack adapter)
export function slackSignIn(): OIDCConfig; // Auth.js Slack provider, checks ["state", "nonce"], scope "openid profile", team = SLACK_WORKSPACE_ID
export function signedInProfile(claims: SlackClaims, allowedWorkspace: string | undefined): SignedInProfile; // throws for another workspace, a missing claim or no allowed workspace
export type SignedInProfile = { id: `${string}/${string}`; chatWorkspace: string; chatUser: string; name?: string; image?: string };

// convex/website/signedInMember.ts
export type SignedInMember = { kind: "signed-in"; workspace: string; user: string; name?: string; image?: string } | { kind: "signed-out" };
export function signedInMember(ctx: QueryCtx): Promise<SignedInMember>; // JWT → users row → live session → chat identity
export function memberQuery<Result>(handler: (ctx: QueryCtx, me: SignedInMember) => Promise<Result>): RegisteredQuery<"public", {}, Result>;

// convex/website/signIn.ts: Convex Auth's createOrUpdateUser
export function rememberSignedInMember(ctx: MutationCtx, args: { existingUserId: Id<"users"> | null; profile: SignedInProfile }): Promise<Id<"users">>;
// reads the website flag first (WS4); links by the Slack pair only (WS7); schedules verifyMember for an unknown person (WS8)

// convex/website/flag.ts (new in this slice)
export const websiteFlag = { key: "website", subject: "workspace", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean, "workspace">;
export function websiteOpen(ctx: QueryCtx | MutationCtx): Promise<boolean>; // false when SLACK_WORKSPACE_ID is unset

// convex/engine/home.ts (#87 on map #1's lane, plus refillsAt from this slice)
export function homeFacts(ctx: QueryCtx, workspace: string, user: string): Promise<HomeFacts | null>;
export type HomeFacts =
  | ({ kind: "member"; left: number; base: number; kudosEmoji: string; refillsAt: number } & WeekTotals & LifetimeTotals)
  | { kind: "not-a-member" };

// convex/website/profile.ts
export const getMyProfile = memberQuery(...); // args {}
export type MyProfile =
  | { kind: "closed" } | { kind: "signed-out" } | { kind: "verifying" } | { kind: "not-a-member" }
  | { kind: "member"; name?: string; image?: string; face: Face; kudosEmoji: string;
      allowance: { left: number; base: number; refillsAt: number };
      thisWeek: { given: number; received: number }; lifetime: { given: number; received: number } };
export type Face =
  | { kind: "company-profile"; image: string; colour: string }
  | { kind: "slack"; image: string }
  | { kind: "initials"; initials: string };
```

`face` starts as the Slack or initials form; the posthog.com ticket adds the company-profile form. When #80's facts join `homeFacts`, `MyProfile` passes `progress` through unchanged in the ticket that adopts them.

```ts
// convex/http.ts
http.route({ path: "/slack/events", method: "POST", handler: slackEvents });
http.route({ path: "/slack/commands", method: "POST", handler: slackCommands });
auth.addHttpRoutes(http);                             // /api/auth/signin/*, /api/auth/callback/*, /.well-known/*
registerStaticRoutes(http, components.staticHosting); // GET /* with the SPA fallback, last
```

### Data

```ts
...authTables,                    // authSessions, authAccounts, authRefreshTokens, authVerificationCodes, authVerifiers, authRateLimits
users: defineTable({              // Convex Auth's table, narrowed: a sign-in identity, never a member
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  chatIdentity: v.optional(v.object({ workspace: v.string(), user: v.string() })),
}),
companyProfiles: defineTable({    // the posthog.com sync, replaced whole per successful run
  firstName: v.string(), lastName: v.string(), normalisedName: v.string(),
  image: v.string(), colour: v.string(), team: v.optional(v.string()),
}).index("by_normalised_name", ["normalisedName"]),
```

No migration: every table is new. Deleting a member's data later includes their `users`, `authAccounts` and `authSessions` rows.

### Environment variables (per deployment)

| Variable | Holds | Unset means | Set by |
|---|---|---|---|
| `SLACK_WORKSPACE_ID` | the one workspace that may sign in (W3) | nobody signs in, and the flag answers off | map #1's #88 |
| `AUTH_SLACK_ID`, `AUTH_SLACK_SECRET` | the Slack app's client ID and secret (W10) | sign-in fails | **Michael** (parks) |
| `SITE_URL` | the deployment's `https://<deployment>.convex.site` | Convex Auth refuses redirects; App Home shows no link | the deploy ticket |
| `JWT_PRIVATE_KEY`, `JWKS` | Convex Auth's signing keys, generated per deployment | sign-in fails | the deploy ticket |
| `POSTHOG_PERSONAL_API_KEY` | the flags key (O31, secret) | every flag answers off | the deploy ticket on the sandbox, from the devbox file, never printed |

### The flag

| Flag | Project | Release condition | Evaluation | Created by | Michael's switch |
|---|---|---|---|---|---|
| `website` | 662840 ("HedgeHug") | person property `environment` exact `sandbox`, 100% | `server` | the deploy ticket, through the fleet-posthog MCP (`switch-project 662840`, `create-feature-flag`) | add a production condition when he wants the site open |

The site reads the flag only on the server, through the seam, so `server` is enough. The flag evaluates per workspace key. The seam's query path finds an existing workspace key only, so the deploy ticket confirms the sandbox's key exists (capture on, any recorded event) before its acceptance check; a missing key answers off, the safe direction.

### Coherence

- **Trust levels** (in `Kudos.spec.md`): `browser (outside)`: what anyone on the internet sends to the website's public functions, the sign-in routes and the static pages. `signed-in`: a browser whose session `signedInMember` resolved to a member of the deployment's workspace. `posthog-com (outside)`: what posthog.com's public team API returns.
- **Components:** `website/Website.spec.md` (`# Website`, the browser package) and `convex/website/WebsiteReads.spec.md` (`# Website reads`), plus `convex/companyProfiles/CompanyProfiles.spec.md`.
- **Entrances** (trust `browser`): `query getMyProfile` (`getMyProfile in convex/website/profile.ts`); `action signIn`, `action signOut`, `query isAuthenticated` (`convex/auth.ts`); `route GET /api/auth/signin/slack` and `route GET /api/auth/callback/slack` (Convex Auth's routes); `route GET /*` (the static catch-all).
- **Invariants**, each with its test as `via`:
  - *the public surface is exact* (WS10), crossing `browser -> domain`.
  - *website reads come from the live session* (WS9, WS11, WS14), crossing `browser -> signed-in`, entrances `query getMyProfile`.
  - *closed while the flag is off* (WS3), entrances `query getMyProfile`, `route GET /api/auth/callback/slack`.
  - *only the allowed workspace signs in* (WS6), crossing `browser -> signed-in`, entrances `route GET /api/auth/callback/slack`.
  - *accounts link only by the Slack pair* (WS7).
  - *a failed posthog.com read keeps the previous profiles* (WS22), crossing `posthog-com -> domain`.
- **Journal:** each ticket records its decisions with `coherence decide` and commits the journal with the change.

## Testing Decisions

- **A good test enters at a seam and checks what a member or Michael could observe**: what `getMyProfile` answers, where the browser lands after a sign-in, what the rendered page says, what App Home publishes. It never asserts on private helpers.
- **Seams, highest first:**
  1. **The signed-in query** with `convex-test`: `getMyProfile` for no session, an expired or signed-out session, an unknown person, a deactivated member, another workspace's identity, the flag off and on, and a member with kudos given and received this week and before. Covers WS2–WS4, WS9–WS15, WS18.
  2. **The sign-in handshake** against a mock Slack issuer (#64's `mock-slack.ts`, ported as a fixture): the happy path landing on `/`, the eight refusals, the flag off, and an unknown person turning from verifying to member. Runs as an integration test on a disposable local backend on its own ports (never the shared `3210`). Covers WS5–WS8.
  3. **The public surface test** replacing R50 (WS10).
  4. **The browser package** with Vitest and Testing Library: each state the home renders from a `MyProfile` fixture, the theme toggle and its persistence (V6), the keyboard path, and axe in light and dark (WS16–WS24). The fixtures are typed by `MyProfile`, so a contract change breaks them.
  5. **App Home** through the existing `appHome.test.ts` seam: the link with the flag on and `SITE_URL` set, and no link otherwise (WS28).
  6. **The posthog.com sync** with a stubbed `fetch` and synthetic fixtures: a good read, a failed read, a malformed read, and the match rules (one match, two, none, accents and case) (WS21–WS22).
  7. **The deploy workflows** through `deploy.test.ts`: the website builds and uploads after `convex deploy`, with the deploy key reaching only those steps (WS27).
- **Proof each ticket owes:** a red test before the change and green after, `pnpm gate` green (heavy runs through `~/dev/fleet/fleet heavy --`), and for any ticket that changes what the browser shows, screenshots of the running site in light and dark mode in its pull request. The deploy ticket adds the live sandbox sign-in (W11) and screenshots of the sandbox and of production's closed page.
- **Overrides:** a proof that needs `website` on outside the sandbox uses a disposable local deployment, never a production override, and is recorded in the pull request.

## Slices

Each ticket is a sub-issue of map #57, sized to one agent session. Numbers are filled in once published.

1. **Scaffold and hosting** — the `website/` package, the HUD shell in light and dark with the closed, signed-out, not-found and error pages on fixtures, static hosting and routing, the CSP, the gate and Coherence covering the package. WS1, WS16, WS20 (pages), WS23–WS26. Blocked by nothing.
2. **Sign in with Slack** — Convex Auth, the Slack provider, the allowed workspace, the auth tables, `signedInMember`, `memberQuery`, `verifyMember`, the `website` flag and its closed path, the public surface test, and the sign-in, sign-out, verifying, not-a-member and "didn't finish" screens. WS2–WS12, WS14. Blocked by 1. Needs map #1's flag seam on `main` (#75).
3. **The home** — `getMyProfile`'s member answer from `homeFacts` (with `refillsAt`), the hero, the counters, the profile card panel and the empty state. WS13, WS15, WS17–WS21. Blocked by 2. Needs `homeFacts` on `main` (#87, shipped by #90).
4. **App Home links to the website** — WS28. Blocked by 2.
5. **Faces from posthog.com** — the sync, its table and the matcher. WS21–WS22. Blocked by 3. Not on the first deploy's path.
6. **Deploy to the sandbox, then production, dark** — the workflows, the env, the flag, the live sign-in, then production dark. WS27. Blocked by 3 and 4. The live check parks on Michael's manifests and Slack credentials.

## Cross-map needs on map #1

From #57's "Asked of map #1 tonight" and map #1's answer. This spec edits nothing on map #1.

1. **`engine.homeFacts`** — #87, on `spec/website-support`, shipped by #90. Blocks ticket 3.
2. **Manifests and `SLACK_WORKSPACE_ID`** — #88, shipped by #90. Applying the manifests to the live apps needs Michael: the live sign-in check in ticket 6 parks on it.
3. **`AUTH_SLACK_ID` and `AUTH_SLACK_SECRET`** — Michael sets them on both deployments. Ticket 6's live check parks on them.
4. **The flag seam on `main`** — #78, shipping with #75 (PR #84). Blocks ticket 2.
5. **The default emoji setting** — #89. Not blocking: the home shows whatever `kudosEmoji` the settings hold.
6. **The L1/R50 exception** — ticket 2 replaces R50's test with WS10's exact list, using #64's rule text. Map #1's conductor records the rule amendment.
7. **`refillsAt` in `homeFacts`** — additive; ticket 3 adds it with an engine test and App Home green. Recorded for map #1.
8. **XP and levels** — #80. Optional: the home shows them once `homeFacts` carries them.
9. **Recent kudos messages as facts** — later: the hero leads with the latest thanks received (V14, #85) once map #1 offers a facts function for a member's recent kudos messages.
10. **G45 and directory display fields** — not needed by this slice (no boards, no other members). They come before the first page that shows another member (W8).

## Out of Scope

- Any page beyond the home, any command (W7), crates, moments and band pages (V10–V15).
- Other members' faces and names, the leaderboard, the Book, quests, the skill tree, coins and hedgehogs.
- Vercel, a custom domain, preview deploys.
- Opening production: Michael switches the flag.
- The written brand-licence confirmation and Max art (open on #63).

## Further Notes

Calls taken at recommendation under the AFK directive:

1. **Rule prefix `WS`**, not `W`, so the rules don't collide with #64's cards W1–W11.
2. **The flag's subject is the workspace**, not the member: the site is one switch per deployment, and sign-in decides before a member is known. Its read is never an exposure.
3. **The closed check lives in `getMyProfile`**, which answers signed-out visitors too, so the closed page needs no extra public function.
4. **The home is `/`.** `/profile` is reserved for a later profile page; App Home links to `/`.
5. **No level, XP or locked cards in the first slice** (#85: "do not imply later XP, coin, quest or Journey state exists"). This narrows the prompt's "home at level 1 with locked cards": they arrive with their facts.
6. **The avatar is the member's face** until hedgehog facts exist (V17, V20).
7. **The refill time comes from the engine** as `refillsAt`, so the website never computes the allowance day.
8. **Lead with thanking** (#85): the hero leads with kudos left and the Slack action, counters second; the latest-thanks lead waits for a map #1 facts function.
9. **The posthog.com sync is its own ticket**, off the first deploy's path, because the sandbox never matches and production is dark.
10. **App Home's link is its own small ticket**, gated by the same flag.
11. **The deploy is an implementation ticket**; the conductor may fold it into the `ship` ticket.

The `to-spec` and `to-tickets` skills can only be started by Michael, so this spec follows map #1's spec layout (`spec/posthog.md`) instead.
