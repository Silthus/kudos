# Slack sign-in for the Kudos website

Research for [ticket #60](https://github.com/Silthus/kudos/issues/60) on [website map #57](https://github.com/Silthus/kudos/issues/57). Sources checked on 2026-10-13. This report proposes a technical direction; it does not adopt an ADR, change the sibling map, implement authentication, or prove a live sign-in.

Research recommendation recorded in Coherence as `d-0689b31a` in `.coherence/journal/website-r60.jsonl`; conditional on #64, not an adopted architecture decision.

## Recommendation and decision inputs

**Prototype Convex Auth with the Auth.js Slack OIDC provider, explicitly configured with `checks: ["state", "nonce"]`, and map its auth user to the existing member by the verified Slack workspace/user pair.** This keeps sign-in, sessions and the website's authenticated reads in the existing Convex deployment. Convex Auth supports a React SPA without a frontend server, but remains beta and explicitly does not support Slack as a tested provider. Treat the recommendation as conditional on the sandbox checks in §7, not as established compatibility. [C1][C2][A1][A2][A3]

The smallest first slice is the auth library's endpoints plus **one authenticated public query, `website.getMyProfile({})`**. Keep domain functions internal. The query derives its member from authentication, calls the existing domain interface and returns only the caller's allowed profile facts. The first slice has no website command endpoint. This requires the conductor to arrange a narrow L1/R50 exception in the sibling map; research alone does not change that invariant. [R1][R2][R3][C3][C4]

Three findings change the choice:

- Auth.js Slack defaults to **nonce only**, not state. Convex Auth implements state and nonce checks, so explicitly request both. Its React session tokens use browser storage by default; the OAuth handshake cookies do not turn those into an HTTP-only application session. [A1][A2][A3][A7]
- **WorkOS now supports Slack social login**, but the documented AuthKit identity/session shapes do not establish a trustworthy Slack workspace/user pair. Slack user claims must be preserved or recovered through a verified server-side integration before WorkOS can authorize this website. A WorkOS organization ID is not a Slack workspace ID. [W1][W2][W3]
- The documented **Better Auth Convex SPA combination has a concrete security verification gap**: the integration skips the state-cookie check for cross-domain auth, while the pinned Slack provider sends state but no nonce or PKCE. The source itself acknowledges that its cross-domain flow does not bind initiation and continuation to the same browser. This is evidence against adopting that combination without a hardened, proven alternative, not a demonstrated exploit. [B1][B2][B3]

For static hosting, preserve the existing application HTTP router and use `registerStaticRoutes` after registering auth/Slack routes. The component's fastest root-mounted recipe moves application routes under `/api`, which would change existing Slack URLs and can double-prefix auth paths. [H1][H2][R2]

## 1. Baseline and what this research adds

The earlier [Convex report §6](https://github.com/Silthus/kudos/blob/3bfa8ee57990feedaf9da150d14f8a531d23968c/research/convex-slack-backend.md#6-convex-auth-and-sign-in-with-slack) established plausible, unproved Slack-provider compatibility. The earlier [Slack report §6](https://github.com/Silthus/kudos/blob/579c1e258d125a20e2f4116ca8a61625ae8d9e5c/research/slack-platform.md#6-sign-in-with-slack-versus-app-installation) separated OIDC sign-in from bot installation. This report adds the session/claims mapping, candidate-source checks, browser interface and hosting consequences. [R4][R5]

The architecture brief locks D8 to Slack sign-in with `(workspace, user)` identity; D9 to two single-workspace apps with separate deployments; D17 to platform-neutral commands; and L1 to internal domain functions. The website map explicitly records authenticated website access as a cross-map dependency. [R1][R3]

At core-loop commit `c4bcc3e`, `convex/http.ts` registers only `POST /slack/events` and `POST /slack/commands`. The schema's `members.by_user` index is `[workspace, user]`; members have kind and optional time zone, but no display name/avatar or auth-user mapping. `kudosTotals` already stores given/received totals by member. R50 rejects every public query, mutation and action, including library-generated auth functions. These are branch facts, not claims about deployed production. [R2][R6][R7][R8]

Version observations: the package registry reports Convex Auth `0.0.96`, Auth.js core `0.41.3` and static hosting `0.2.1`. Convex Auth's setup documentation still installs Auth.js core `0.41.1`; its Slack provider was inspected at that version. Convex Auth source is pinned to tag `v0.0.96`; static-hosting source is pinned to the checked commit. Better Auth's Convex guide pins `~1.6.15`, and integration `0.12.5` accepts Better Auth `>=1.6.11 <1.7.0`. Do not mix the latest Better Auth documentation with a different installed release. [V1][V2][V3][C2][A1][B1][B4]

## 2. Compare the four paths

| Path | Setup and ongoing ownership | State, nonce and PKCE | Application session | Internal-tool cost |
| --- | --- | --- | --- | --- |
| Convex Auth + Auth.js Slack | Auth tables, auth module/config, signing keys/JWKS, per-deployment Slack credentials, HTTP registration, React provider and member mapping. Library owns refresh/session machinery; we own an unsupported Slack integration and its acceptance checks. [C1][C2][A4][A5] | Slack provider defaults to `nonce`; override to `state` + `nonce`. Convex Auth generates handshake cookies and validates returned state and expected nonce. PKCE is not on by default for Slack. [A1][A2][A3] | Defaults: one-hour Convex JWT; 30-day total session and inactivity limit, configurable. React persists JWT and refresh token in `localStorage` unless custom storage is supplied. [A5][A6][A7] | Apache-2.0 library, no separate hosted-auth subscription. Auth work consumes ordinary Convex resources. Unsupported-provider maintenance is the main extra cost. [A8][C8] |
| WorkOS AuthKit + Slack | Configure a WorkOS environment/client, Slack OAuth credentials, WorkOS's Slack callback and the application's AuthKit redirect. Use the client-only SDK or a server SDK; establish the Slack pair mapping separately. WorkOS owns the hosted service and session infrastructure. [W1][W4][W5] | Managed Slack integration owns the upstream OIDC flow. Client-only auth uses PKCE; application state can carry redirect context. Reviewed docs do not specify Slack-side nonce validation, so that detail is **unverified**. [W4][W5][W6] | Access-token duration, maximum session length and inactivity timeout are dashboard settings. Numeric defaults are **unverified** in the reviewed sources. Client-only auth without a custom auth domain requires `devMode: true`, storing refresh tokens in local storage. [W3][W5] | AuthKit has a free tier. Current listed optional costs: custom auth domain $99/month; Enterprise SSO starts at $125/connection/month. Slack social login is not automatically Enterprise SSO. [W1][W7] |
| Better Auth on Convex | Install compatible Better Auth and Convex component; wire its adapter, Convex JWT plugin, HTTP routes and React integration; preserve Slack claims in custom fields/mapping. Own version compatibility and the provider/SPA hardening below. [B1][B4][B5] | Pinned Slack provider sends state and performs secret-backed code exchange + HTTPS userInfo; it sends no nonce/PKCE. Documented cross-domain plugin uses database state and `skipStateCookieCheck: true`, acknowledging the missing same-browser check. A secure same-origin alternative is **unverified** here. [B2][B3] | Better Auth defaults to seven-day sessions, refreshed after one day; options control duration/refresh/freshness. Convex JWT plugin defaults to 15-minute tokens. The SPA plugin stores session-cookie material in local storage and sends it in `Better-Auth-Cookie` with `credentials: "omit"`. Provider access-token lifetime is a different clock. [B6][B7][B10] | MIT core and Apache-2.0 Convex integration, no mandatory hosted-auth subscription for this self-hosted setup. Convex resources and integration maintenance remain. [B4][B8][C8] |
| Custom OIDC + Convex custom JWT | Own authorization/callback endpoints, browser-bound transactions, code exchange and claim validation, signing keys/JWKS, session storage, refresh/revocation, rotation and client integration. Use maintained OIDC/JOSE libraries rather than implementing cryptography. [S1][S2][C5][J1] | Explicit random state + nonce, short-lived one-use transaction bound to the initiating browser; validate callback and token before issuing a session. Slack's token method documents `code_verifier`, but live discovery does not advertise PKCE challenge methods. OIDC PKCE support is a prototype check, not inferred from the separate bot-install PKCE guide. [S1][S2][S3][S4] | No framework default: choose total/inactive session limits and short-lived Convex JWTs, plus refresh/revocation behavior. Slack's ID-token expiry is not the application's session lifetime. [C5][S2] | No extra auth vendor is inherently required, but we own the largest security-sensitive implementation and its maintenance; normal Convex costs remain. [C5][C8] |

**Choice:** Convex Auth is the smallest candidate that already has nonce and state machinery and fits the static React website. WorkOS is credible if its exact Slack mapping is proved and its hosting/session tradeoff accepted. Better Auth needs the documented version/SPA/provider gaps resolved first. Custom OIDC is the fallback if the Convex Auth spike fails, not the starting point. These are recommendations based on the matrix, not product decisions.

Convex Auth's inspected callback processes the code response with `oauth4webapi`, validates expected nonce and obtains validated ID-token claims. It does not explicitly invoke an independent JWT-signature validation routine there. OIDC Core §3.1.3.7 permits TLS server validation instead of signature checking for an ID token obtained directly from the token endpoint. Do not describe this source path as independent JWKS signature verification, and never apply that exception to an arbitrary token supplied by a browser. The custom-flow fallback should explicitly validate signatures with Slack's JWKS. [A3][S5][J1]

## 3. Map authentication to the existing member

The authoritative external identifiers are `https://slack.com/team_id` and `https://slack.com/user_id`, returned in Slack's OIDC response. `team` in the authorization request expresses intended workspace selection; it is not our authorization check. Require the returned team to equal the deployment's configured allowed workspace. Email/domain, Slack display name, a WorkOS organization and a frontend route parameter are not substitutes for those identifiers. [S1][S2][R1][W3]

### Proposed Convex Auth mapping

1. Configure only Slack for this slice. In its `profile` callback, read and validate both Slack claims as nonempty strings; require the expected workspace before creating a user/session. Return a stable provider account ID encoded from the pair, plus narrowly named `slackWorkspace` and `slackUser` fields. Request `openid profile`; add `email` only if the profile product requirement needs it. [S1][S2][A1][A4]
2. Customize the auth `users` schema and `createOrUpdateUser` callback to retain the pair and, once found, the member reference. Match by the Slack pair/provider account, not email. The default Convex Auth user path can link accounts via verified email; the custom callback replaces that path. Validate any existing auth-user mapping before updating it. [A4][A9]
3. Resolve `(slackWorkspace, slackUser)` through the existing `members.by_user` index. Require `kind === "member"`. A missing directory entry needs verification through the deployment's Slack adapter before it can become an authorized member; OIDC sign-in must not blindly create a domain member. Existing directory verification rejects bots/deleted users and mismatched team IDs. [R6][R8][R9]
4. For each website request, resolve `getAuthUserId(ctx)` to the retained mapping, then look up/recheck the current member and allowed workspace. Also resolve `getAuthSessionId(ctx)` and require its stored session to exist, belong to that auth user and remain unexpired: deleting a Convex Auth session does not immediately invalidate an already-issued JWT. Convex Auth's JWT subject is an auth-user/session identifier, not Slack's `user_id`; use the library helper instead of parsing it as a Slack ID. Per-request membership checking makes directory removal effective for already-issued sessions. It does not repair a stale directory by itself. [A5][A10][A13][R8]
5. Return the domain member ID as the platform-neutral actor inside the website adapter. A future command may take a target ID or item ID, but the authenticated actor and workspace must never come from caller input. Route it through D17's existing command mechanism. [R1][R3]

**Deactivation freshness is still a spec/prototype task.** The inspected directory schema has no verification timestamp, and no live directory-refresh guarantee was measured. Specify how current Slack membership becomes known, how stale membership fails closed, and how a legitimate first sign-in warms the directory before claiming immediate deactivation enforcement. Query functions cannot fetch Slack; refresh belongs in an action/adapter, with subsequent reads using verified stored facts. [R6][R9][C6]

### What the other providers must preserve

- Better Auth `1.6.15` maps its Slack provider account ID from Slack `user_id`, but application `session.user.id` is an auth-system user ID. The raw profile contains team/user; preserve both through supported custom profile/schema hooks and check workspace server-side. The inspected provider does not forward the `team` configuration claimed by current provider docs. Even forwarding it would not replace the returned-team check. [B2][B9]
- AuthKit's documented identities API lists `idp_id`, type and provider, while its session subject names a WorkOS user. No reviewed documented field guarantees Slack `team_id`. Auth responses can include provider OAuth tokens "if applicable", but Slack-specific availability and a supported claim-recovery procedure are **unverified**. Do not borrow `raw_attributes` from the separate SSO profile API and pretend AuthKit returns them. [W2][W3][W8][W9]
- A custom JWT can carry verified `slack_workspace`, `slack_user` and a session reference. Configure Convex with the exact issuer, JWKS, `RS256` or `ES256`, and an explicit per-environment `applicationID` audience. Convex verifies JWT authentication; the website still authorizes current membership. [C5][C7]

## 4. The smallest readable public surface

| Interface | Behavior and obligations | Fit for this slice |
| --- | --- | --- |
| Authenticated public Convex queries/mutations | Browser SDK supplies the configured auth token; handler calls `ctx.auth.getUserIdentity()` or provider helper, checks membership, and delegates to domain functions. Queries participate in Convex reactive subscriptions; validators and typed generated references keep the interface small. A public function is callable by anyone, so each handler must enforce auth. [C3][C4][C6] | **Recommend one query** `website.getMyProfile({})`, with validated result projection. Add explicit command mutations only when those product slices exist. |
| Authenticated HTTP API | HTTP action accepts a Bearer JWT and reads `ctx.auth`; calls internal queries/mutations. Own request parsing/validation, errors, client refresh, cache invalidation/polling and cross-origin CORS/OPTIONS. HTTP transport can keep domain registrations internal, but auth libraries may themselves export public functions. [C3][C9][A10] | A viable alternative if keeping HTTP as the sole domain entry is chosen, but it adds browser transport work without simplifying sign-in. Initial read could be `GET /website/me`; no generic internal-function relay. |

The smallest useful exception is **an explicit allowlist**, not permission to turn domain queries public: required auth functions (`auth.signIn`, `auth.signOut`, and the library's `auth.isAuthenticated` where used), plus `website.getMyProfile`. Auth `store` stays internal. Account for any component-generated/library-required public surface before amending R50. Do not automatically add static hosting's optional deployment-update query or a generic public `execute(command: any)` endpoint. [A10][H2][R7]

The profile query exposes only this member's permitted facts: authoritative allowance left and given/received totals, plus display fields once the directory dependency exists. The website must not recalculate game rules or expose full awards, message/receipt state or hidden progression through a broad query. Existing core-loop schema supports totals, while display names/avatars are a recorded dependency. This result shape is a proposal for #64/#65, not an implemented query. [R3][R6]

**Auth-required behavior:** use a typed denial or signed-out result as specified; never interpret unauthenticated access as an empty profile. Authorization tests must cover no identity, wrong workspace, unrecognized/inactive member, tampered actor/target and permitted projection. Real OIDC checks remain separate from tests using synthetic Convex identities. [C3][C10]

## 5. Two Slack apps and two Convex deployments

D9's two apps each have their own Slack client ID/client secret, bot token and signing secret. Sign-in can use that environment's existing Slack app credentials; its OIDC grant remains separate from bot installation scopes. Register that app's OIDC callback in its own redirect settings. A successful login does not demonstrate that the bot is installed or correctly configured. [R1][S1]

Proposed environment shape, with placeholder identifiers only:

| Setting | Sandbox | Production |
| --- | --- | --- |
| Slack OIDC client | Sandbox app's client | Production app's client |
| Convex Auth callback | `https://<sandbox>.convex.site/api/auth/callback/slack` | `https://<production>.convex.site/api/auth/callback/slack` |
| Initially allowed website origin / `SITE_URL` | `https://<sandbox>.convex.site` | `https://<production>.convex.site` |
| Allowed Slack workspace | Sandbox workspace ID | Production workspace ID |
| Convex URL in browser build | Sandbox `.convex.cloud` | Production `.convex.cloud` |
| Auth signing keys/session data | Sandbox deployment | Production deployment |

These callback paths follow Convex Auth's source with its normal application router mounting. Use one frontend codebase built with environment-specific deployment configuration, not a browser-controlled tenant selector. Convex environment variables are deployment-scoped. Do not put a Slack client secret, bot token, signing key or deploy key in browser variables or static assets. [A4][A11][C11][R1]

Slack requires HTTPS callbacks. Send the same explicit `redirect_uri` to authorization and token exchange; use the library-derived path. `SITE_URL` is the post-auth website destination, distinct from Slack's callback. Restrict any custom return/redirect callback to approved origins and relative paths rather than trusting a URL parameter. [S1][S2][A11][A12]

If using WorkOS, also isolate WorkOS environments/clients and Slack credential configuration. Slack redirects to WorkOS's configured Slack integration callback, then AuthKit redirects to the website; these are two separate registrations. If using Better Auth, its callback is normally `/api/auth/callback/slack` on the configured auth origin. A custom flow registers its own deployment callback. Exact mounted paths and provider configuration must be checked in #64. [W4][B1][B9][S1]

## 6. Hosting now and on Vercel later

**Convex static hosting works at the architecture level for a built React SPA.** It serves static assets and SPA route fallback at `*.convex.site`. It is not a frontend SSR server, and it does not protect static HTML/assets with the member's session. Serve a sign-in shell and gate every data read/command in Convex; never embed private data into the static bundle. The map's "no public internet pages" requirement needs this distinction in the first-slice spec: private content is authenticated, while login assets are necessarily reachable. [H1][H2][R3]

Use app-owned root routing: install the component without mounting it at `/`, retain `convex/http.ts`, register exact Slack/auth routes, then its static catch-all. Auth path prefixes are more specific than the root static prefix. The current component source supports this coexistence and documents preserving existing callbacks. The alternative `defineApp({ httpPrefix: "/api" })` moves application endpoints, so copying the fast recipe into this backend is unsafe without updating registrations everywhere. [H1][H2][R2]

Convex Auth explicitly supports static React/CDN applications; its sign-in endpoints live in Convex. On Vercel later, keep those endpoints and the Slack callback at the same Convex origin, change `SITE_URL`/approved return origins and rebuild against the intended Convex URL. No auth migration is inherently required for a Vite SPA move. Browser local storage is origin-scoped, so expect reauthentication when the website origin changes. Both-host live behavior is **unverified**. [C1][A7][A11][A12][H3]

Better Auth's documented React SPA recipe uses the cross-domain plugin; its §2 limitation applies whenever that plugin is enabled, regardless of frontend hostname. A same-origin setup that safely omits it remains unverified. WorkOS documents client-only deployments, but its cookie setup requires a compatible custom auth domain; the reviewed sources do not prove HTTP-only cookie auth on a stock `*.convex.site` host. A custom JWT approach can serve callbacks/session endpoints in Convex from either host, but must explicitly solve cross-origin cookies or refresh-token storage/CORS when Vercel serves the frontend. [B1][B3][W5][C9]

## 7. Follow-ups for the downstream tickets

- **#62, UI prototype:** represent sign-in/loading, successful member profile, denied workspace, directory verification pending/unavailable, canceled sign-in, expired session and return-to-page behavior. Use mock data. Avoid implying a successful Slack login automatically authorizes a member. [R3][S1]
- **#63, visual-language grilling:** keep the Slack sign-in action recognizable and honor Slack's button/branding guidance; product copy should explain access in terms of members and workspace. Auth provider names need not become product navigation. [S6][R3]
- **#64, architecture prototype:** prove Convex Auth + pinned Slack provider with explicit state/nonce, custom pair mapping and exact router coexistence. Test missing/mismatched state and nonce, code replay, canceled flow, wrong issuer/audience, workspace denial, unknown/deactivated member, refresh/logout and reload/deep links. Verify state/nonce cookies and the one-use app verification-code exchange in the actual browser. Decide whether OIDC PKCE can be enabled without relying on the bot-install guide or dropping state on discovery fallback. Keep raw token/identity values out of screenshots, logs and public artifacts. [A2][A3][A11][S1][S2][S3][H1]
- **#65, first-slice spec:** name `getMyProfile`, its allowed projection, auth/R50 exception, directory freshness/first-login behavior, session policy and static login-shell interpretation. Coordinate the already-recorded sibling-map dependencies through the conductor. [R3][R6][R7]

**Unverified:** no real Slack authorization round trip, wrong-workspace login, live nonce/state failure, application refresh/revocation timing, directory freshness, deployment routing, custom auth domain or Vercel origin move was executed. No credentials or live deployment were created or changed. The source findings resolve the research question; these checks belong to the architecture prototype and implementation acceptance gate.

## Artifact verification

The report has no undefined reference IDs; all 65 reference targets were fetched successfully. A read-only source accuracy pass corrected the Better Auth same-origin assumption and added its browser-storage behavior. `git diff --check` and `coherence spec --check` passed. `coherence lexicon --check research/website-auth.md` flags the external product names Convex, Convex Auth and Better Auth as three unknown nouns; this report does not add technology vendors to the domain vocabulary. The repository-wide vocabulary check therefore also fails. No implementation tests or full `pnpm gate` were run for this research-only branch.

## References

### Repository evidence

- [R1](https://github.com/Silthus/kudos/blob/65b4411236b6a3e893b7b9096b3d8a798e14a928/prototype/architecture.md) (D8, D9, D17, L1).
- [R2](https://github.com/Silthus/kudos/blob/c4bcc3eedeb56d04914fa84883d4679ad0597cdc/convex/http.ts)
- [R3](https://github.com/Silthus/kudos/issues/57)
- [R4](https://github.com/Silthus/kudos/blob/3bfa8ee57990feedaf9da150d14f8a531d23968c/research/convex-slack-backend.md)
- [R5](https://github.com/Silthus/kudos/blob/579c1e258d125a20e2f4116ca8a61625ae8d9e5c/research/slack-platform.md)
- [R6](https://github.com/Silthus/kudos/blob/c4bcc3eedeb56d04914fa84883d4679ad0597cdc/convex/schema.ts)
- [R7](https://github.com/Silthus/kudos/blob/c4bcc3eedeb56d04914fa84883d4679ad0597cdc/convex/internalDomain.test.ts)
- [R8](https://github.com/Silthus/kudos/blob/c4bcc3eedeb56d04914fa84883d4679ad0597cdc/convex/workspace/directory.ts)
- [R9](https://github.com/Silthus/kudos/blob/c4bcc3eedeb56d04914fa84883d4679ad0597cdc/convex/slack/directory.ts)

### Convex, Convex Auth and Auth.js

- [C1](https://labs.convex.dev/auth)
- [C2](https://labs.convex.dev/auth/setup) and https://labs.convex.dev/auth/config/oauth
- [C3](https://docs.convex.dev/auth/functions-auth)
- [C4](https://docs.convex.dev/functions/internal-functions)
- [C5](https://docs.convex.dev/auth/advanced/custom-jwt)
- [C6](https://docs.convex.dev/functions/query-functions)
- [C7](https://github.com/get-convex/convex-js/blob/main/src/server/authentication.ts)
- [C8](https://www.convex.dev/pricing)
- [C9](https://docs.convex.dev/functions/http-actions)
- [C10](https://docs.convex.dev/testing/convex-test)
- [C11](https://docs.convex.dev/production/environment-variables)
- [A1](https://github.com/nextauthjs/next-auth/blob/089f0e377ae175e956c667fff5d0f09162612ff6/packages/core/src/providers/slack.ts) (Auth.js core `0.41.1`).
- [A2](https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/oauth/authorizationUrl.ts) and https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/oauth/checks.ts
- [A3](https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/oauth/callback.ts)
- [A4](https://labs.convex.dev/auth/config/oauth) and https://labs.convex.dev/auth/setup/manual
- [A5](https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/types.ts) and https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/implementation/tokens.ts
- [A6](https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/implementation/sessions.ts) and https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/implementation/refreshTokens.ts
- [A7](https://github.com/get-convex/convex-auth/blob/v0.0.96/src/react/index.tsx) and https://github.com/get-convex/convex-auth/blob/v0.0.96/src/react/client.tsx
- [A8](https://github.com/get-convex/convex-auth/blob/v0.0.96/package.json)
- [A9](https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/implementation/users.ts)
- [A10](https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/implementation/index.ts)
- [A11](https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/oauth/convexAuth.ts)
- [A13](https://labs.convex.dev/auth/advanced) (session invalidation and getAuthSessionId).
- [A12](https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/types.ts) (redirect callback).
- [V1](https://registry.npmjs.org/%40convex-dev%2fauth/latest)
- [V2](https://registry.npmjs.org/%40auth%2fcore/latest)
- [V3](https://registry.npmjs.org/%40convex-dev%2fstatic-hosting/latest)

### Slack and standards

- [S1](https://docs.slack.dev/authentication/sign-in-with-slack/)
- [S2](https://docs.slack.dev/reference/methods/openid.connect.token/)
- [S3](https://slack.com/.well-known/openid-configuration) (live response advertised query response mode and no `code_challenge_methods_supported` on the research date; prefer discovery over the static documentation example).
- [S4](https://docs.slack.dev/authentication/using-pkce/) (the documented example uses bot-install OAuth endpoints).
- [S5](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation)
- [S6](https://docs.slack.dev/authentication/sign-in-with-slack/#design-guidelines)
- [J1](https://github.com/panva/jose) (JWT/JWKS signing and verification library).

### WorkOS

- [W1](https://workos.com/docs/user-management/social-login.md)
- [W2](https://workos.com/docs/reference/authkit/identity.md)
- [W3](https://workos.com/docs/authkit/sessions.md)
- [W4](https://workos.com/docs/integrations/slack-oauth.md)
- [W5](https://workos.com/docs/authkit/client-only.md)
- [W6](https://github.com/workos/authkit-js/blob/b797256c136ace9ae2ddda71c7c408049ac16b60/src/create-client.ts)
- [W7](https://workos.com/pricing)
- [W8](https://workos.com/docs/reference/authkit/authentication.md)
- [W9](https://workos.com/docs/reference/sso/profile.md)

### Better Auth

- [B1](https://labs.convex.dev/better-auth/framework-guides/react)
- [B2](https://github.com/better-auth/better-auth/blob/v1.6.15/packages/core/src/social-providers/slack.ts)
- [B3](https://github.com/get-convex/better-auth/blob/175224e1b1137e181b740c084cc2a79ddb480d42/src/plugins/cross-domain/index.ts)
- [B4](https://github.com/get-convex/better-auth/blob/175224e1b1137e181b740c084cc2a79ddb480d42/package.json)
- [B5](https://labs.convex.dev/better-auth)
- [B6](https://github.com/better-auth/better-auth/blob/v1.6.15/docs/content/docs/concepts/session-management.mdx)
- [B7](https://github.com/get-convex/better-auth/blob/175224e1b1137e181b740c084cc2a79ddb480d42/src/plugins/convex/index.ts)
- [B8](https://github.com/better-auth/better-auth/blob/v1.6.15/LICENSE.md)
- [B10](https://github.com/get-convex/better-auth/blob/175224e1b1137e181b740c084cc2a79ddb480d42/src/plugins/cross-domain/client.ts)
- [B9](https://www.better-auth.com/docs/authentication/slack) (current provider docs must be checked against the installed source).

### Hosting

- [H1](https://github.com/get-convex/static-hosting/blob/d2d8e02a019e4021ff2e50812b44113df12b1419/README.md)
- [H2](https://github.com/get-convex/static-hosting/blob/d2d8e02a019e4021ff2e50812b44113df12b1419/src/client/index.ts)
- [H3](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

[R1]: https://github.com/Silthus/kudos/blob/65b4411236b6a3e893b7b9096b3d8a798e14a928/prototype/architecture.md
[R2]: https://github.com/Silthus/kudos/blob/c4bcc3eedeb56d04914fa84883d4679ad0597cdc/convex/http.ts
[R3]: https://github.com/Silthus/kudos/issues/57
[R4]: https://github.com/Silthus/kudos/blob/3bfa8ee57990feedaf9da150d14f8a531d23968c/research/convex-slack-backend.md
[R5]: https://github.com/Silthus/kudos/blob/579c1e258d125a20e2f4116ca8a61625ae8d9e5c/research/slack-platform.md
[R6]: https://github.com/Silthus/kudos/blob/c4bcc3eedeb56d04914fa84883d4679ad0597cdc/convex/schema.ts
[R7]: https://github.com/Silthus/kudos/blob/c4bcc3eedeb56d04914fa84883d4679ad0597cdc/convex/internalDomain.test.ts
[R8]: https://github.com/Silthus/kudos/blob/c4bcc3eedeb56d04914fa84883d4679ad0597cdc/convex/workspace/directory.ts
[R9]: https://github.com/Silthus/kudos/blob/c4bcc3eedeb56d04914fa84883d4679ad0597cdc/convex/slack/directory.ts
[C1]: https://labs.convex.dev/auth
[C2]: https://labs.convex.dev/auth/setup
[C3]: https://docs.convex.dev/auth/functions-auth
[C4]: https://docs.convex.dev/functions/internal-functions
[C5]: https://docs.convex.dev/auth/advanced/custom-jwt
[C6]: https://docs.convex.dev/functions/query-functions
[C7]: https://github.com/get-convex/convex-js/blob/main/src/server/authentication.ts
[C8]: https://www.convex.dev/pricing
[C9]: https://docs.convex.dev/functions/http-actions
[C10]: https://docs.convex.dev/testing/convex-test
[C11]: https://docs.convex.dev/production/environment-variables
[A1]: https://github.com/nextauthjs/next-auth/blob/089f0e377ae175e956c667fff5d0f09162612ff6/packages/core/src/providers/slack.ts
[A2]: https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/oauth/authorizationUrl.ts
[A3]: https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/oauth/callback.ts
[A4]: https://labs.convex.dev/auth/config/oauth
[A5]: https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/types.ts
[A6]: https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/implementation/sessions.ts
[A7]: https://github.com/get-convex/convex-auth/blob/v0.0.96/src/react/index.tsx
[A8]: https://github.com/get-convex/convex-auth/blob/v0.0.96/package.json
[A9]: https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/implementation/users.ts
[A10]: https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/implementation/index.ts
[A11]: https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/oauth/convexAuth.ts
[A13]: https://labs.convex.dev/auth/advanced
[A12]: https://github.com/get-convex/convex-auth/blob/v0.0.96/src/server/types.ts
[V1]: https://registry.npmjs.org/%40convex-dev%2fauth/latest
[V2]: https://registry.npmjs.org/%40auth%2fcore/latest
[V3]: https://registry.npmjs.org/%40convex-dev%2fstatic-hosting/latest
[S1]: https://docs.slack.dev/authentication/sign-in-with-slack/
[S2]: https://docs.slack.dev/reference/methods/openid.connect.token/
[S3]: https://slack.com/.well-known/openid-configuration
[S4]: https://docs.slack.dev/authentication/using-pkce/
[S5]: https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation
[S6]: https://docs.slack.dev/authentication/sign-in-with-slack/#design-guidelines
[J1]: https://github.com/panva/jose
[W1]: https://workos.com/docs/user-management/social-login.md
[W2]: https://workos.com/docs/reference/authkit/identity.md
[W3]: https://workos.com/docs/authkit/sessions.md
[W4]: https://workos.com/docs/integrations/slack-oauth.md
[W5]: https://workos.com/docs/authkit/client-only.md
[W6]: https://github.com/workos/authkit-js/blob/b797256c136ace9ae2ddda71c7c408049ac16b60/src/create-client.ts
[W7]: https://workos.com/pricing
[W8]: https://workos.com/docs/reference/authkit/authentication.md
[W9]: https://workos.com/docs/reference/sso/profile.md
[B1]: https://labs.convex.dev/better-auth/framework-guides/react
[B2]: https://github.com/better-auth/better-auth/blob/v1.6.15/packages/core/src/social-providers/slack.ts
[B3]: https://github.com/get-convex/better-auth/blob/175224e1b1137e181b740c084cc2a79ddb480d42/src/plugins/cross-domain/index.ts
[B4]: https://github.com/get-convex/better-auth/blob/175224e1b1137e181b740c084cc2a79ddb480d42/package.json
[B5]: https://labs.convex.dev/better-auth
[B6]: https://github.com/better-auth/better-auth/blob/v1.6.15/docs/content/docs/concepts/session-management.mdx
[B7]: https://github.com/get-convex/better-auth/blob/175224e1b1137e181b740c084cc2a79ddb480d42/src/plugins/convex/index.ts
[B8]: https://github.com/better-auth/better-auth/blob/v1.6.15/LICENSE.md
[B9]: https://www.better-auth.com/docs/authentication/slack
[H1]: https://github.com/get-convex/static-hosting/blob/d2d8e02a019e4021ff2e50812b44113df12b1419/README.md
[H2]: https://github.com/get-convex/static-hosting/blob/d2d8e02a019e4021ff2e50812b44113df12b1419/src/client/index.ts
[H3]: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
[B10]: https://github.com/get-convex/better-auth/blob/175224e1b1137e181b740c084cc2a79ddb480d42/src/plugins/cross-domain/client.ts
