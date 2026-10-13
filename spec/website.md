# Spec: the website's first slice, sign in with Slack and the home page

> **Accepted on 2026-10-13 under the product owner's autonomous directive** (map [#57](https://github.com/Silthus/kudos/issues/57) Notes: "ship as much as you can of this autonomously proofing each step and deploying dark and safely behind feature flags"), with every open call at its recommendation (listed under "Further Notes"). Ticket [#65](https://github.com/Silthus/kudos/issues/65). This file lives on the branch `docs/spec-website` and is never merged. It is the target design of the first slice; its implementation tickets are listed under "Slices".
>
> Sources: the architecture prototype [#64](https://github.com/Silthus/kudos/issues/64) ([brief](https://github.com/Silthus/kudos/blob/6b9e312/prototype/website-architecture.md), cards W1–W11 and L-W1–L-W6, contracts in its §3), the visual language [#63](https://github.com/Silthus/kudos/issues/63) ([`docs/website/visual-language.md`](https://github.com/Silthus/kudos/blob/main/docs/website/visual-language.md), rules V1–V24, ADR-0005, and its "Follow-ups for #65"), the UI prototype [#62](https://github.com/Silthus/kudos/issues/62) (variant E, `prototype/website-ui` at `3409ade`), the name [#58](https://github.com/Silthus/kudos/issues/58), the auth research [#60](https://github.com/Silthus/kudos/issues/60), the hosting research [#61](https://github.com/Silthus/kudos/issues/61), the Octalysis research [#85](https://github.com/Silthus/kudos/issues/85) ([report](https://github.com/Silthus/kudos/blob/research/octalysis/research/octalysis.md), section 2 of its resolution), the flag seam [#78](https://github.com/Silthus/kudos/issues/78) (rules O31 and O33–O36 of [`spec/posthog.md`](https://github.com/Silthus/kudos/blob/docs/spec-posthog/spec/posthog.md)), map #1's support lane [#90](https://github.com/Silthus/kudos/issues/90) (#87, #88, #89), and the code on `main` at `87ee387`.

## Problem Statement

A member's kudos live in Slack: a reaction, a private reply, an App Home tab. App Home is compact and Block Kit can't carry the PostHog brand, the hedgehogs, or the game screens #62 designed. The game that map #1 is building (XP, levels, quests, the leaderboard, the sticker book) needs a place where a member can see their own progress in full, and every later screen needs the same foundation first: a website that knows who the member is, shows only them their own facts, and can be kept dark in production until Michael switches it on.

## Solution

Each Convex deployment serves its own **website** from its `*.convex.site` root. A member signs in with Slack (Convex Auth with the Auth.js Slack provider, inside the Slack adapter), and lands on their **home**: their own name and picture from the sign-in, an invitation to thank a colleague in Slack, the kudos they have left today and when they refill, and the kudos they gave and received this week and in total. Every fact comes from the same facts function App Home reads (`engine.homeFacts`), through one public, signed-in query. Nothing is computed in the browser.

The whole site sits behind one PostHog flag, `website`, which answers off by default. While it is off, the site shows a closed page, refuses new sign-ins, and every read answers closed. Workers create the flag on in the sandbox and dark in production. App Home links to the website only while the flag is on.

The site is a game HUD on PostHog's design system in light and dark mode (V1–V7). The first slice shows only what exists today: no level, XP or crates until map #1's facts for them exist, and the later features as plain locked cards (#85).

## User Stories

**Signing in**
1. As a member, I want to sign in with the Slack account I already use, so that I don't need another password.
2. As a member, I want Slack to open my own workspace when I sign in, so that I don't pick the wrong one.
3. As a member who just joined, I want my sign-in to work even if HedgeHug hasn't seen me yet, so that I'm not locked out on day one.
4. As a member, I want to sign out from the site, so that a shared machine doesn't stay signed in.
5. As the product owner, I want only members of the deployment's own workspace to sign in, so that nobody else reads a member's kudos.
6. As the product owner, I want a person who left the workspace to lose access at once, so that a valid session can't outlive membership.

**The home page**
7. As a member, I want to see how many kudos I have left today and when they refill, so that I know whether I can thank someone now.
8. As a member, I want to see what I gave and received this week and in total, so that I can see the thanks I'm part of.
9. As a member, I want the page to lead with thanking, not with numbers to chase, so that the site feels like gratitude and not a scoreboard.
10. As a member, I want to see what my teammates can see of me, and that what I receive stays private, so that I trust the site.
11. As a member, I want the page to update when a kudos lands, so that I never reload.
12. As a member with nothing this week, I want one clear pointer back to Slack, so that I know what to do next.
13. As a member, I want the site in light or dark mode, following my system first, so that it fits how I work.

**Running it**
14. As the product owner, I want the whole site dark in production until I switch on one flag, so that nothing reaches members before I decide.
15. As the product owner, I want App Home to link to the site only while it's open, so that members never land on a closed page from Slack.
16. As the product owner, I want the sandbox to prove a real Slack sign-in before production gets anything, so that the unsupported provider is checked live.
17. As a developer, I want every public function on an exact list and every read to check the live session, so that a new entrance is always a reviewed change.

## Rules

Rules are numbered `WS1`–`WS28`. The `WS` prefix keeps them apart from #64's decision cards W1–W11, which this spec cites by their own names.

### The site and its flag

- **WS1. One website per deployment.** Each D9 deployment serves its own website at its `*.convex.site` root, built against that deployment (L-W5). Mock data is only ever published to a disposable deployment. The first slice has one page, the **home**, at `/`. Every other path renders a not-found page with a link home. The tab reads `HedgeHug · Home` and the subtitle is "Thanks a Hog" (#58).
- **WS2. The `website` flag.** One flag gates the whole site. It is declared once through the flag seam (O33): key `website`, subject the workspace (the deployment's `SLACK_WORKSPACE_ID`), values `false` and `true`, safe default `false`. A missing key, a missing definition, a missing workspace key, a failed evaluation, or an unset `SLACK_WORKSPACE_ID` answers off. Because the seam's query path only finds an existing workspace key, an idempotent internal mutation `prepareWebsiteFlag` creates it through the seam's `workspaceKeyOf`, and every deploy runs it after `convex deploy`.
- **WS3. Closed while off.** While `website` is off: every website read answers `closed`; the sign-in callback refuses to create or update a `users` row, so no new account appears; the shell shows the closed page (one hedgehog and one sentence from Max, V18, saying the website isn't open here yet and kudos in Slack work as always) with no sign-in button; and App Home shows no link (WS28). Switching off takes effect on the next read, so open pages turn closed reactively. The guarantee is that a session reads nothing while the flag is off: a session that already exists, one refreshed later, and one completed from a one-time code issued just before the switch all read `closed`. Convex Auth's own rows written during a handshake (`authVerifiers`, `authVerificationCodes`) are allowed; they carry no member fact. A daily job deletes an `authVerifiers` row a day after a handshake that never came back from Slack left it (#116).
- **WS4. Where the flag is read.** `memberQuery` reads the flag first, before the session (WS11). The sign-in callback reads it before it writes a `users` row. App Home reads it before it renders the link. The flag is not an exposure: it gates a surface for the whole workspace, not a member's path, and is only read in queries and in the sign-in callback, where the member may not be known, so no `$feature_flag_called` is sent. Map #1's conductor records this reading of O36 (cross-map need 11).

### Sign-in

- **WS5. Sign in with Slack.** Convex Auth with the Auth.js Slack provider, `checks: ["state", "nonce"]`, scope `openid profile`, and `team` set to `SLACK_WORKSPACE_ID` (L-W1, W3, W10). The provider and the claim mapping live in the Slack adapter (`convex/slack/signIn.ts`), which hands the website module only a chat identity (L-W2). Credentials are `AUTH_SLACK_ID` and `AUTH_SLACK_SECRET`, the deployment's own Slack app (W10). The shell redeems the one-time code Slack's return brings itself, once, with Convex Auth's own handling off, and a redemption that fails shows "Sign-in didn't finish" instead of loading forever (#116).
- **WS6. Sign-in fails closed.** An unset `SLACK_WORKSPACE_ID`, another workspace's `team_id`, an empty team or user claim, or the flag off creates no account. So do the eight refusals of #64 §4.3: a wrong nonce, another client's token, a tampered state, a missing state cookie, login CSRF, a replayed one-time code, and a stolen code without the browser's verifier. The browser lands back on the site signed out (or closed), and a sign-in that started in this browser and came back without a session shows "Sign-in didn't finish" with a retry.
- **WS7. Accounts link only by the Slack pair.** The account key is `<workspace>/<user>`, never an email. The `users` row keeps the name, given and family name and picture from the sign-in claims, refreshed on every sign-in (W8). A `users` row is a sign-in identity, never a member: membership stays in the directory.
- **WS8. A person the directory doesn't know yet** signs in, the Slack adapter's `verifyMember` (users.info) is scheduled, and the page shows "Checking your membership…" until the directory answers, then turns into the home or the not-a-member page reactively (W4). `verifyMember` tries at most 3 times, waiting at least the `Retry-After` Slack asks for, and writes the directory only from a definite answer. After the last failure the person reads `unverified` ("We couldn't check your membership right now"), never a member, and signing in again schedules a fresh check.
- **WS9. Sessions.** Convex Auth's defaults: a 1-hour JWT, 30 days total and 30 days of inactivity (W5). Refresh stays allowed and changes nothing that WS3, WS11 and WS14 check. Sign-out from the avatar menu ends the session at once, and every read rechecks the live session (L-W3), so a still-valid JWT after sign-out reads `signed-out`.

### Reads

- **WS10. The public surface is an exact list.** Exactly these Convex functions are public: Convex Auth's `signIn`, `signOut` and `isAuthenticated` in `convex/auth.ts`, and `getMyProfile` in `convex/website/profile.ts`. A test lists them, so a new public function fails until it is added by a reviewed change. This replaces R50's empty list with #64's rule text (§3.1): *only HTTP routes, Convex Auth's `signIn`, `signOut` and `isAuthenticated`, and the website's signed-in functions in `convex/website/` are public; every website function resolves the signed-in member from the session before it reads or acts, and every other function is internal.*
- **WS11. One guard, in one order.** Every website query is built on `memberQuery`, which checks, in order: the flag (`closed`), the live session (`signed-out`), the session's workspace against the current `SLACK_WORKSPACE_ID` (`signed-out`), and the directory (`verifying`, `unverified`, `not-a-member`). It returns each denial itself and calls the handler only with a verified member: `{ member, workspace, user, name?, image? }`. The member comes from the session, never from arguments; `getMyProfile` takes `{}`.
- **WS12. A typed answer, never an empty profile.** `getMyProfile` answers exactly one of `closed`, `signed-out`, `verifying`, `unverified`, `not-a-member` or `member`. A denial is never a profile of zeros.
- **WS13. Facts, never rules.** The member answer projects `homeFacts` (L-W6, R46): the kudos emoji, kudos left today and the allowance base, when the allowance refills, given and received this week, given and received in total, plus the name and picture from the sign-in. When `homeFacts` carries level and XP (map #1's XP slice, #80), the answer passes them through unchanged; until then the site shows neither. The refill time is a fact the engine computes and `homeFacts` carries (`refillsAt`); the website never derives it from a time zone.
- **WS14. Membership on every read.** The directory decides on each read, so a person `user_change` marks deactivated reads `not-a-member` on their next read, whatever their session (L-W3). A session from another workspace, left over after `SLACK_WORKSPACE_ID` changes, reads `signed-out` before any directory or facts read.
- **WS15. Reactive, across midnight too.** The home is one Convex subscription to `getMyProfile`, with no polling and no reload. It updates when a kudos lands. Because `homeFacts` reads the clock, a website-owned `websiteClock` row, ticked by a cron every 15 minutes, is read by `getMyProfile`, so an open page re-reads its facts after each member's local midnight and after the week turns, without another kudos.

### The home

- **WS16. The HUD frame (V1) in the first slice** holds the HedgeHug wordmark, the screen nav with Home as its only item, the theme control (V6: light, dark, or "Use system setting", since the first slice has no command palette; a blocking script first in the page's head applies the choice before the first paint, from a file named after its content hash), and the member's avatar with a menu that signs out. Skill points, coins, the ready pill and the level ring appear only once their facts exist.
- **WS17. Thanking first, counters second** (#85). The hero (a game object, V2) leads with gratitude: the member's avatar and name, a RoundHog headline that invites thanking a colleague for work they noticed, and the one action, thanking someone in Slack, as the page's only primary element (V4). Kudos left today out of the base and the refill time follow as one quiet line, not a big stat. Max's insight line states this week's thanks in words and never forecasts (V18). The counters, this week and in total, given and received, follow in a plain Quill card (V2) with tabular figures (V5). Copy never solicits incoming thanks, names a missing person, or sets a volume or rank deadline (#85). The first slice has no kudos message content to lead with; leading with the latest thanks received (V14) waits for a map #1 facts function (cross-map need 9).
- **WS18. Received stays private** (#85, P65). The member's own received counts appear only on their own home. The "Your profile card" panel shows exactly what a teammate can see of them today, their face and name, and says that the kudos they receive stay private. It never shows a received count.
- **WS19. Later features as plain locked cards** (V23, #85). Below the counters, the later features (quests, the leaderboard, the sticker book and achievements, the skill tree, coins, hedgehogs) each show as a calm locked card: a lock icon, the feature's name, one sentence on what it is, and its hedgehog in silhouette. The first slice derives no unlock state: every card is locked for every member, carries no level number and no progress, and nothing is a crate or ready. The sentences avoid copy #85 flagged: a sticker comes from a colleague you thanked or who thanked you, and perk copy names no rule #86 hasn't settled. Ready, opened, crate states and V23's "Unlocks at level N" come from map #1's unlocks read (#99) once it reaches `main`.
- **WS20. Empty and error states** (V23, V18). A member who gave and received nothing this week sees one hedgehog, one sentence from Max, and one action that opens the workspace in Slack to thank someone; it never points to a reward. The not-a-member, unverified, not-found and error pages each carry one hedgehog and one sentence from Max. So does "Can't reach HedgeHug", shown while the answer is still loading and the socket to the deployment has stayed unconnected for five seconds; it moves on by itself once the socket connects (#116).

### Faces

- **WS21. The member's own face** follows V19's chain: their company profile cutout on its colour when the posthog.com sync (WS22) holds exactly one profile whose normalised first plus last name matches the member's Slack real name (V21) and that profile has a cutout, then the Slack picture from the sign-in claims, then initials on a muted tile. The real name comes from the sign-in claims (`given_name`, `family_name`, `name`), which Slack fills from the profile; ticket 5 confirms that against a live token in the sandbox, and if it doesn't hold, matching waits for the directory's display fields (cross-map need 10). Until hedgehog facts exist (V20), the avatar slot on the HUD and the hero shows this face, because a hedgehog nobody chose would carry no meaning (V17).
- **WS22. The posthog.com sync.** A daily internal action reads posthog.com's public team API into the website's own `companyProfiles` table (name, cutout image when the person has one, colour, team slug). A run replaces the table only after a complete, validated read; a failed or malformed read keeps the previous rows and logs a fixed code. Cutouts hotlink `res.cloudinary.com` with size transforms. Only this sync knows posthog.com. Tests use synthetic fixtures only; the sandbox never matches, so it exercises the fallback. Every deploy also runs it once, after `prepareWebsiteFlag`, so a fresh deployment has faces before the next daily run (#116). It lands before the product owner opens production.

### Look and accessibility

- **WS23. The look.** The site follows V1–V7 and V16–V24 on `@posthog/quill`, `@posthog/icons` and `@posthog/brand` (ADR-0005). It ports variant E's static styles fresh and never copies prototype code wholesale. It drops E's three loops (the XP shimmer, `hud-glow`, the crate wobble) and every count-up (V8–V9). Until PostHog's brand team provides Max art, an existing hoggie stands in for Max.
- **WS24. Accessibility** (V24). WCAG 2.2 AA in both modes. Every page is checked with axe in light and dark. The keyboard path covers sign-in, the theme control, the avatar menu and sign-out, and focus lands on the page title after a state change. Each slice gets a manual pass of focus order, focus visibility, reduced motion and screen-reader wording.

### Security, hosting and links

- **WS25. A strict Content Security Policy on the shell** (W5), because session tokens live in `localStorage`. It is a response header on every HTML response, never a `<meta>` policy, which can't forbid framing: the app owns the static route (WS26), so it wraps the component's handler to add the header. Scripts and styles from the site's own origin only; connections to the site and its deployment's `*.convex.cloud` (HTTPS and WebSocket); images from the site, Slack's avatar host and `res.cloudinary.com`; `frame-ancestors 'none'`. A face's colour (V19) is set through React's style property, which a style policy doesn't block, so no inline style is allowed. The shell holds no member data: every fact arrives through `getMyProfile`.
- **WS26. App-owned routing** (L-W4). `convex/http.ts` registers the Slack routes, then Convex Auth's routes (`/api/auth/*` and `/.well-known/*`), then the static catch-all with an SPA fallback, last. Slack's URLs never move. Hashed assets are `immutable`, HTML revalidates, and the first slice ships no lazy chunks (hosting research #61).
- **WS27. Deploy path.** Implementation tickets merge into the conductor's integration branch, never into `main`, because every push to `main` deploys production. A deploy builds the website against its own deployment and uploads it after `convex deploy`, then runs `prepareWebsiteFlag` (WS2) and the posthog.com sync once (WS22). The sandbox `different-dog-467` goes first, from the integration branch, and its acceptance is the live Slack sign-in (W11). Production `affable-bat-254` follows only when the ship ticket merges the integration branch into `main`, dark: the `website` flag answers off there, so production shows only the closed page.
- **WS28. App Home links in.** While `website` is on for the workspace and `SITE_URL` is set, App Home shows one "Open HedgeHug on the web" link to `${SITE_URL}/`. Otherwise App Home is unchanged. The link carries no identity (W9): a signed-out member signs in and lands on the home.

## Implementation Decisions

### Modules

- **website package (new, `website/`)**: a pnpm workspace package beside `convex/` with its own `package.json` (React, Vite, Tailwind, Quill, Convex Auth's React client) and a DOM `tsconfig`. It imports `../convex/_generated/api`. `pnpm gate` runs its typecheck and tests through Vitest projects (W1).
- **website module (new, `convex/website/`)**: `signedInMember`, `memberQuery`, the `createOrUpdateUser` callback, the `website` flag declaration and `prepareWebsiteFlag`, the `websiteClock` and its cron, and `getMyProfile`. Later pages add one query each here (W6).
- **Slack adapter (extended, `convex/slack/`)**: the sign-in provider and claim mapping (`signIn.ts`), and `verifyMember` for a signed-in person the directory doesn't know (W4, WS8). App Home renders the link (WS28).
- **Convex Auth (new, `convex/auth.ts`, `convex/auth.config.ts`)**: its tables, its routes, and its three public functions.
- **Kudos engine (extended)**: `homeFacts` gains `refillsAt`, additive; App Home ignores it.
- **Company profiles (new, `convex/companyProfiles/`)**: the posthog.com sync, its table, and the matcher for one member's face (WS21–WS22). Only it knows posthog.com.
- **Static hosting (new component)**: `@convex-dev/static-hosting` mounted by the app's router, not at `/` by the component, behind an app-owned wrapper that adds the CSP header (WS25, L-W4).

### Contracts

From #64 §3, with this slice's changes.

```ts
// convex/slack/signIn.ts (the Slack adapter)
export function slackSignIn(): OIDCConfig; // Auth.js Slack provider, checks ["state", "nonce"], scope "openid profile", team = SLACK_WORKSPACE_ID
export function signedInProfile(claims: SlackClaims, allowedWorkspace: string | undefined): SignedInProfile; // throws for another workspace, a missing claim or no allowed workspace
export type SignedInProfile = {
  id: `${string}/${string}`; chatWorkspace: string; chatUser: string;
  name?: string; givenName?: string; familyName?: string; image?: string;
};

// convex/website/memberQuery.ts
export type Denial = { kind: "closed" } | { kind: "signed-out" } | { kind: "verifying" } | { kind: "unverified" } | { kind: "not-a-member" };
export type VerifiedMember = { member: MemberId; workspace: string; user: string; name?: string; givenName?: string; familyName?: string; image?: string };
export function memberQuery<Result>(handler: (ctx: QueryCtx, me: VerifiedMember) => Promise<Result>): RegisteredQuery<"public", {}, Result | Denial>;
// order: website flag → live session → session workspace === SLACK_WORKSPACE_ID → directory (WS11)

// convex/website/signIn.ts: Convex Auth's createOrUpdateUser
export function rememberSignedInMember(ctx: MutationCtx, args: { existingUserId: Id<"users"> | null; profile: SignedInProfile }): Promise<Id<"users">>;
// throws while the flag is off (WS3); links by the Slack pair only (WS7); schedules verifyMember for an unknown person (WS8)

// convex/website/flag.ts
export const websiteFlag = { key: "website", subject: "workspace", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean, "workspace">;
export function websiteOpen(ctx: QueryCtx | MutationCtx): Promise<boolean>; // false when SLACK_WORKSPACE_ID is unset
export const prepareWebsiteFlag: RegisteredMutation<"internal", {}, null>; // creates the workspace key through the seam, idempotent

// convex/engine/home.ts (#87 on map #1's lane, plus refillsAt from this slice)
export function homeFacts(ctx: QueryCtx, workspace: string, user: string): Promise<HomeFacts | null>;
export type HomeFacts =
  | ({ kind: "member"; left: number; base: number; kudosEmoji: string; refillsAt: number } & WeekTotals & LifetimeTotals)
  | { kind: "not-a-member" };

// convex/website/profile.ts
export const getMyProfile = memberQuery(async (ctx, me): Promise<MemberProfile> => …); // args {}
export type MyProfile = Denial | MemberProfile;
export type MemberProfile = {
  kind: "member"; name?: string; face: Face; kudosEmoji: string;
  allowance: { left: number; base: number; refillsAt: number };
  thisWeek: { given: number; received: number }; lifetime: { given: number; received: number };
};
export type Face =
  | { kind: "company-profile"; image: string; colour: string }
  | { kind: "slack"; image: string }
  | { kind: "initials"; initials: string };
```

`face` starts as the Slack or initials form; the posthog.com ticket adds the company-profile form. When #80's facts join `homeFacts`, `MemberProfile` passes them through unchanged in the ticket that adopts them, and when #99's unlocks read reaches `main`, the page that adopts it composes it here beside `homeFacts`.

```ts
// convex/http.ts
http.route({ path: "/slack/events", method: "POST", handler: slackEvents });
http.route({ path: "/slack/commands", method: "POST", handler: slackCommands });
auth.addHttpRoutes(http);   // /api/auth/signin/*, /api/auth/callback/* (GET and POST), /.well-known/openid-configuration, /.well-known/jwks.json
registerWebsite(http);      // the static catch-all with the SPA fallback and the CSP header, last
```

### Data

```ts
...authTables,                    // authSessions, authAccounts, authRefreshTokens, authVerificationCodes, authVerifiers, authRateLimits
users: defineTable({              // Convex Auth's table, narrowed: a sign-in identity, never a member
  name: v.optional(v.string()), givenName: v.optional(v.string()), familyName: v.optional(v.string()),
  image: v.optional(v.string()),
  chatIdentity: v.optional(v.object({ workspace: v.string(), user: v.string() })),
}),
memberVerifications: defineTable({ // WS8: one row per person being verified
  workspace: v.string(), user: v.string(), attempts: v.number(), state: v.union(v.literal("pending"), v.literal("failed")),
}).index("by_user", ["workspace", "user"]),
websiteClock: defineTable({ tick: v.number() }), // WS15: one row, ticked every 15 minutes
companyProfiles: defineTable({    // the posthog.com sync, replaced whole per successful run
  firstName: v.string(), lastName: v.string(), normalisedName: v.string(),
  image: v.optional(v.string()),   // a person without a cutout keeps a row, so a namesake can't take their face (d-b8300fea)
  colour: v.string(), team: v.optional(v.string()),
}).index("by_normalised_name", ["normalisedName"]),
```

No migration: every table is new. Deleting a member's data later includes their `users`, `authAccounts`, `authSessions` and `memberVerifications` rows.

### Environment variables (per deployment)

| Variable | Holds | Unset means | Set by |
|---|---|---|---|
| `SLACK_WORKSPACE_ID` | the one workspace that may sign in (W3) | nobody signs in, and the flag answers off | map #1's #88 |
| `AUTH_SLACK_ID`, `AUTH_SLACK_SECRET` | the Slack app's client ID and secret (W10) | sign-in fails | **the product owner** (parks) |
| `SITE_URL` | the deployment's `https://<deployment>.convex.site` | Convex Auth refuses redirects; App Home shows no link | the deploy ticket |
| `JWT_PRIVATE_KEY`, `JWKS` | Convex Auth's signing keys, generated per deployment | sign-in fails | the deploy ticket |
| `POSTHOG_PERSONAL_API_KEY` | the flags key (O31, secret) | every flag answers off | the deploy ticket on the sandbox, from the devbox file, never printed |

### The flag

| Flag | Project | Release condition | Evaluation | Created by | The owner's switch |
|---|---|---|---|---|---|
| `website` | 662840 ("HedgeHug") | person property `environment` exact `sandbox`, 100% | `server` | the deploy ticket, through the fleet-posthog MCP (`switch-project 662840`, `create-feature-flag`) | add a production condition to open the site |

The site reads the flag only on the server, through the seam, so `server` is enough. The flag evaluates per workspace key, which `prepareWebsiteFlag` creates on every deploy (WS2); a missing key still answers off, the safe direction.

### Coherence

Proposed declarations. Each ticket writes its part and makes `coherence spec --check` pass, adjusting the wording the grammar asks for.

- **Trust levels** (in `Kudos.spec.md`):
  - `browser (outside)`: what anyone on the internet sends to the website's public functions, the sign-in routes and the static pages.
  - `session`: a browser presenting a live Convex Auth session for an identity of the deployment's workspace, not yet known to be a member.
  - `posthog-com (outside)`: what posthog.com's public team API returns.
  - Directory-verified members are `domain`, as today.
- **Components:** `website/Website.spec.md` (`# Website`, the browser package), `convex/website/WebsiteReads.spec.md` (`# Website reads`), and `convex/companyProfiles/CompanyProfiles.spec.md`.
- **Entrances**, all trust `browser`: `query getMyProfile` (`getMyProfile in convex/website/profile.ts`); `action signIn`, `action signOut`, `query isAuthenticated` (`convex/auth.ts`); `route GET /api/auth/signin/slack`, `route GET /api/auth/callback/slack` and `route POST /api/auth/callback/slack`; `route GET /.well-known/openid-configuration` and `route GET /.well-known/jwks.json` (`control: none`: public discovery and public keys only); `route GET /*` (`control: none`: public static bytes with no member data, WS25).
- **Invariants**, each with its test as `via` and its `entrances:` line:
  - *the public surface is exact* (WS10): crossing `browser -> domain`, entrances `none` (it checks the module surface, not a request).
  - *website reads pass one guard* (WS3, WS9, WS11, WS14): crossing `browser -> domain`, entrances `query getMyProfile`.
  - *only the allowed workspace signs in, and only while open* (WS3, WS6): crossing `browser -> session`, entrances `route GET /api/auth/callback/slack`, `route POST /api/auth/callback/slack`, `action signIn`.
  - *accounts link only by the Slack pair* (WS7): crossing `browser -> session`, entrances `route GET /api/auth/callback/slack`.
  - *a failed posthog.com read keeps the previous profiles* (WS22): crossing `posthog-com -> domain`, entrances `none`.
  - `action signOut` and `query isAuthenticated` are Convex Auth's own; their entrances carry `control:` lines naming what they expose (ending one's own session; one boolean).
- **Journal:** each ticket records its decisions with `coherence decide` and commits the journal with the change.

## Testing Decisions

- **A good test enters at a seam and checks what a member or the product owner could observe**: what `getMyProfile` answers, where the browser lands after a sign-in, what the rendered page says, what App Home publishes. It never asserts on private helpers.
- **Seams, highest first:**
  1. **The signed-in query** with `convex-test`: `getMyProfile` for no session, an expired or signed-out session, a refreshed session, an unknown person, a failed verification, a deactivated member, a session left over after `SLACK_WORKSPACE_ID` changes, the flag off and on, and a member with kudos given and received this week and before. A subscription crosses the member's local midnight and the week's turn on a clock tick, without another kudos. Covers WS2–WS4, WS8–WS15, WS18.
  2. **The sign-in handshake** against a mock Slack issuer (#64's `mock-slack.ts`, ported as a fixture): the happy path landing on `/`, the eight refusals, the flag off, the flag switched off between initiation, callback and code redemption (each resulting session reads `closed`), and an unknown person turning from verifying to member, and to unverified after three failed lookups. Runs as an integration test on a disposable local backend on its own ports (never the shared `3210`), which `pnpm test:handshake` starts and removes itself; CI runs it in its own job beside the gate on every pull request and push to `main` (#116). Covers WS3, WS5–WS8.
  3. **The public surface test** replacing R50 (WS10).
  4. **The browser package** with Vitest and Testing Library: each state renders from a typed `MyProfile` fixture, the hero's order (gratitude and the Slack action before the allowance and counters), no received count on the profile card, the locked cards with no level or progress, the theme control and its persistence (V6), the keyboard path, and axe in light and dark (WS16–WS24).
  5. **The HTTP router**: the CSP header on `/` and an SPA path, the Slack routes unchanged, and in a browser, framing the site is refused (WS25–WS26).
  6. **App Home** through the existing `appHome.test.ts` seam: the link with the flag on and `SITE_URL` set, and no link otherwise (WS28).
  7. **The posthog.com sync** with a stubbed `fetch` and synthetic fixtures: a good read, a failed read, a malformed read, and the match rules (one match, two, none, accents and case) (WS21–WS22).
  8. **The deploy workflows** through `deploy.test.ts`: the website builds and uploads after `convex deploy`, `prepareWebsiteFlag` runs, then the posthog.com sync, and the deploy key reaches only those steps (WS22, WS27).
- **Proof each ticket owes:** a red test before the change and green after, `pnpm gate` green (heavy runs through `~/dev/fleet/fleet heavy --`), and for any ticket that changes what the browser shows, screenshots of the running site in light and dark mode in its pull request, plus V24's manual pass. The deploy ticket adds the live sandbox sign-in (W11) and screenshots of the sandbox; the ship ticket adds production's closed page.
- **Overrides:** a proof that needs `website` on outside the sandbox uses a disposable local deployment, never a production override, and is recorded in the pull request.

## Slices

Each ticket is a sub-issue of map #57, sized to one agent session, and merges into the conductor's integration branch (WS27). Blocking edges: #106 → #107 → #108 and #109; #108 → #110; #108 and #109 → #111.

1. [#106](https://github.com/Silthus/kudos/issues/106) **Scaffold and hosting** — the `website/` package, the HUD shell in light and dark with the closed, signed-out, not-found and error pages on fixtures, static hosting and routing, the CSP header, the gate and Coherence covering the package. WS1, WS16, WS20 (pages), WS23–WS26. Blocked by nothing.
2. [#107](https://github.com/Silthus/kudos/issues/107) **Sign in with Slack** — Convex Auth, the Slack provider, the allowed workspace, the auth tables, `memberQuery`, `verifyMember` with its retries, the `website` flag, `prepareWebsiteFlag` and the closed path, the public surface test, and the sign-in, sign-out, verifying, unverified, not-a-member and "didn't finish" screens. WS2–WS12, WS14. Blocked by 1. Needs map #1's flag seam (#75).
3. [#108](https://github.com/Silthus/kudos/issues/108) **The home** — `getMyProfile`'s member answer from `homeFacts` (with `refillsAt`), the clock, the hero, the counters, the profile card panel, the locked cards and the empty state. WS13, WS15, WS17–WS21. Blocked by 2. Needs `homeFacts` (#87, shipped by #90).
4. [#109](https://github.com/Silthus/kudos/issues/109) **App Home links to the website** — WS28. Blocked by 2.
5. [#110](https://github.com/Silthus/kudos/issues/110) **Faces from posthog.com** — the sync, its table and the matcher. WS21–WS22. Blocked by 3. Not on the sandbox deploy's path; it lands before production opens.
6. [#111](https://github.com/Silthus/kudos/issues/111) **Deploy to the sandbox, prepare production** — the workflows, the env, the flag, the live sign-in on the sandbox from the integration branch, and production's env ready for the ship merge. WS27. Blocked by 3 and 4. The live check parks on the owner's manifest step and Slack credentials.

## Cross-map needs on map #1

From #57's "Asked of map #1 tonight", map #1's answers, and this spec's review. This spec edits nothing on map #1.

1. **`engine.homeFacts`** — #87, on `spec/website-support`, shipped by #90. Blocks ticket 3.
2. **Manifests and `SLACK_WORKSPACE_ID`** — #88, shipped by #90. Applying the manifests to the live apps needs the product owner: the live sign-in check in ticket 6 parks on it.
3. **`AUTH_SLACK_ID` and `AUTH_SLACK_SECRET`** — the product owner sets them on both deployments. Ticket 6's live check parks on them.
4. **The flag seam on `main`** — #78, shipping with #75 (PR #84). Blocks ticket 2.
5. **The default emoji setting** — #89. Not blocking: the home shows whatever `kudosEmoji` the settings hold.
6. **The L1/R50 exception** — ticket 2 replaces R50's test with WS10's exact list, using #64's rule text. Map #1's conductor records the rule amendment.
7. **`refillsAt` in `homeFacts`** — additive; ticket 3 adds it with an engine test and App Home green.
8. **XP and levels** — #80. Optional: the home shows them once `homeFacts` carries them.
9. **Recent kudos messages as facts** — later: the hero leads with the latest thanks received (V14, #85) once map #1 offers a facts function for a member's recent kudos messages.
10. **Directory display fields** — the Slack real name for face matching if the sign-in claims don't carry it (WS21, #63), and names and avatars before the first page that shows another member (W8). G45's amendment comes with the first board.
11. **O36 for a workspace flag** — the `website` flag is never an exposure (WS4). Map #1's conductor records that O36 covers a member entering a flagged path, not a workspace-wide surface gate.
12. **The unlocks read** — #99 (stopping point #94), behind the `unlocks` flag, after #80. Not in the first slice: it turns WS19's plain locked cards into locked, ready and opened states, crates, and "Unlocks at level N", through `openUnlock` on the website's own entrance.
13. **The sandbox** — ticket 6 deploys the integration branch to the shared sandbox once; the conductor clears it with map #1's conductor so it doesn't clobber a map #1 lane's deploy.

## Out of Scope

- Any page beyond the home, any command (W7), crates, moments and band pages (V10–V15).
- Other members' faces and names, and the real leaderboard, sticker book, quests, skill tree, coins and hedgehogs (they appear only as locked cards).
- Vercel, a custom domain, preview deploys.
- Opening production: the product owner switches the flag.
- The written brand-licence confirmation and Max art (open on #63).

## Further Notes

Calls taken at recommendation under the AFK directive:

1. **Rule prefix `WS`**, not `W`, so the rules don't collide with #64's cards W1–W11.
2. **The flag's subject is the workspace**, not the member: the site is one switch per deployment, and sign-in decides before a member is known. Its read is never an exposure (cross-map need 11).
3. **The closed check lives in `memberQuery`**, which answers signed-out visitors too, so the closed page needs no extra public function.
4. **Closed means a session reads nothing**, not that no Convex Auth row is ever written: a handshake can't be fully gated inside Convex Auth, so the guarantee sits on every read.
5. **The home is `/`.** `/profile` is reserved for a later profile page; App Home links to `/`.
6. **No level, XP or crates in the first slice** (#85: "do not imply later XP, coin, quest or Journey state exists"). Later features show as plain locked cards with no level number (the conductor's note on #99), a narrow reading of V23 until #99's facts carry the level.
7. **The avatar is the member's face** until hedgehog facts exist (V17, V20).
8. **The refill time comes from the engine** as `refillsAt`, and a website-owned 15-minute clock keeps an open page true across midnight without polling.
9. **Lead with gratitude** (#85): the hero leads with an invitation to thank and the Slack action; the allowance is one quiet line and the counters come second.
10. **`verifyMember` retries 3 times**, then shows `unverified`; signing in again retries.
11. **The CSP is a header**, never a meta policy.
12. **The posthog.com sync is its own ticket**, off the sandbox path, and lands before production opens.
13. **App Home's link is its own small ticket**, gated by the same flag.
14. **Tickets merge into the integration branch**; production gets the slice only through the ship merge, dark.

**Review.** One read-only GPT-6.1 Sol review found 11 issues (1 blocker: sandbox-first deploys weren't enforced, since every push to `main` deploys production). All 11 were fixed in this revision: the gate covers every step of the handshake through the read guard, `memberQuery` owns the order and checks the workspace, the CSP is a header, the deploy path runs through the integration branch, the clock keeps facts true across midnight, verification retries and fails visibly, the Coherence declarations name crossings and entrances, face matching uses the real name, the O36 reading is a cross-map note, and V6 and #85 are met.

The `to-spec` and `to-tickets` skills can only be started by a human, so this spec follows map #1's spec layout (`spec/posthog.md`) instead.
