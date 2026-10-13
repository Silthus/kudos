# Website hosting: `Convex` now, Vercel later

Research for [ticket #61](https://github.com/Silthus/kudos/issues/61), on [website map #57](https://github.com/Silthus/kudos/issues/57). Checked 2026-10-13. This report proposes implementation choices; it does not lock product decisions, change another ticket, or authorize a hosting migration.

Coherence journal record `d-9da88e2b`, in `.coherence/journal/research-r61.jsonl`, records the research-only delivery scope.

**Recommendation:** keep the agreed prototype on `Convex` static hosting, using the published `@convex-dev/static-hosting` **0.2.1** release and one component instance per deployment. Ship the first signed-in production slice there if its actual hosting and authentication checks pass. Keep the React/Vite build portable, then move asset delivery to Vercel when a custom domain or branch previews justify it. Vercel Hobby restricts use to personal, non-commercial projects, so budget for an appropriate team plan for this product. [map][map] [published package][package] [vercel hobby][hobby]

The `*.convex.site` address is included, but static files use `Convex` storage and HTTP actions. **A free address is not unlimited hosting.** `Convex`'s current Free plan has hard caps, while Starter offers usage-based overages. [serving source][http] [convex limits][limits]

## Evidence and scope

- Component findings use the registry's latest release, 0.2.1, whose `gitHead` is `17461fe5693963def7b5c8ff94e93cb57b13f437`. Its peer dependencies are `convex ^1.37.0` and React `^18.3.1 || ^19.0.0`. Upstream main was also inspected at `d2d8e02a019e4021ff2e50812b44113df12b1419`; its only difference from that release is test registration support in `src/test.ts`. The links below pin the released source. [registry][package] [release source][source] [compared main][main-source]
- `Convex` platform documentation was read from the official repository at `863869cbfb77d3c1c35573646ade05582c881dc3`. `Convex Auth` source was inspected at `7eab86015b09cf91ac36a359beaaa4036aa24cc1`. Those are documentation/source observations, not a recommendation to install unpublished packages. [platform docs][platform-source] [auth source][auth-source]
- Kudos observations use `origin/main` at `63f458b`. No `Convex` backend or pnpm workspace exists at that baseline. Other map workers may introduce them after this snapshot. [root package][root-package] [repository snapshot][repo]
- Existing private projects were inspected read-only. References below identify paths and commits without reproducing private implementation. No deployed project was probed and no credential, customer data, workspace name, or internal usage metric is included.
- **Unverified:** no end-to-end Slack authentication, live hosted smoke test, deploy-key upload, DNS cutover, latency measurement, or billing measurement was performed in this research ticket. The verification list below assigns those checks to the prototypes and shipping spec.

## 1. Deploying a React/Vite build to `Convex`

The component stores a path manifest and deployment state in its own database and files in its own storage. An HTTP action resolves the path, reads the file and returns the correct content type. `https://<deployment>.convex.site` serves the website; `https://<deployment>.convex.cloud` is the frontend's `Convex` API connection. The two URLs are not interchangeable. [component schema][schema] [http handler][http] [build environment][build-env]

For a new integration, use 0.2.1 directly. The 0.2 release removed `exposeUploadApi`, changed file ownership from application storage to component storage, and supports component-owned HTTP routes. Copying a 0.1.x setup requires a real migration and asset re-upload. A fresh Kudos integration does not need that migration. [changelog][changelog] [migration guide][migration]

### Route ownership

**Recommended for Kudos:** preserve application-owned root routing, register auth and Slack endpoints in the application's router, and add the component's static GET catch-all. This avoids moving existing callback/webhook URLs when hosting is added. Exact routes take precedence; existing prefixes must also remain reachable. This mode uses the component for storage and uploads but adds an application-side query and storage fetch to serving. [integration guide][integration] [compatibility handler][client]

The shape, from public component docs, is:

```ts
import { defineApp } from "convex/server";
import staticHosting from "@convex-dev/static-hosting/convex.config";

const app = defineApp();
app.use(staticHosting);
export default app;
```

```ts
import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { components } from "./_generated/api";

const http = httpRouter();
registerStaticRoutes(http, components.staticHosting);
export default http;
```

These are illustrative hosting fragments, not complete Kudos configuration: the existing application endpoints belong before the static registration. [integration guide][integration]

The alternative, faster component-owned mode is `defineApp({ httpPrefix: "/api" })` plus `app.use(staticHosting, { httpPrefix: "/" })`. This moves the application's HTTP routes under `/api`. Do not apply it automatically to an app with established callbacks; in particular, avoid inadvertently changing `/api/auth/callback/slack` into a differently prefixed URL. Choose that mode only if #64 proves the complete route map intentionally. [component readme][readme] [convex auth oauth callbacks][auth-oauth]

### Build and publish commands

Assuming the root owns the installed `Convex` CLI and component, `convex/` remains at the root, and the website package is named `website`, these are the pnpm equivalents of the documented commands:

```sh
pnpm exec convex dev --once
pnpm exec static-hosting upload --build-command "pnpm --filter website build" --dist apps/website/dist
```

The first pushes the development backend; the second builds and uploads to the development target. Keep Vite's dev server for HMR during ordinary editing. [development workflow and cli][integration]

```sh
pnpm exec static-hosting deploy --build-command "pnpm --filter website build" --dist apps/website/dist
```

`deploy` targets production. It obtains the target's URLs, injects `VITE_CONVEX_URL` and `STATIC_HOSTING_BASE_PATH` into the build, deploys the backend, then uploads assets. On the first publish it may deploy the backend before building so it can resolve the component. If the mount changes, it rebuilds. **Always override the default build command**, which is `npm run build`. The published CLI resolves the installed `Convex` binary directly rather than requiring npm for its internal execution. [deploy source][deploy] [command execution source][commands] [cli arguments][args]

A split production pipeline is also supported:

```sh
pnpm exec convex deploy --cmd "pnpm --filter website build" --cmd-url-env-var-name VITE_CONVEX_URL
pnpm exec static-hosting upload --prod --dist apps/website/dist
```

For a root-mounted SPA, Vite's default `/` base is sufficient. A prefix mount additionally needs the correct Vite/router base; the component CLI supplies `STATIC_HOSTING_BASE_PATH` when it runs the build. Do not build against a developer URL and then upload that same bundle to production. Backend deployment and asset publication are separate operations even inside the one-command CLI; keep frontend/backend changes compatible across that interval. [integration guide][integration] [deploy source][deploy]

**Do not depend on `VITE_CONVEX_SITE_URL` being injected by 0.2.1.** The inspected release sets the API URL and base path. The separate upstream PR #39 proposing the site URL remains open. Any frontend auth HTTP origin must be configured explicitly until the chosen released tooling provides it. [build source][deploy] [upstream pr #39][pr39]

## 2. SPA routing, caching, and publishing limits

### Routing and access

- `/` resolves to `/index.html`. An exact uploaded asset wins. An extensionless missing path, such as `/profile/settings`, falls back to the SPA by default. The final path segment controls whether a path has a file extension. A missing `/assets/missing.js` is a 404; a dotted route such as `/profile/some.name` is not an extensionless fallback route. `--no-spa` disables fallback for that published deployment. [resolution source][lib] [serving helpers][serving] [integration guide][integration]
- Before the first upload, the root returns a 503 setup page with `Cache-Control: no-store`, not a production-ready website. The component exposes GET serving routes, not HEAD. Use GET for hosted health checks. [http handler][http] [integration guide][integration]
- The component performs **no user authentication** when serving the SPA. HTML, scripts and illustrations are public bytes; member information must be fetched through authenticated, workspace-scoped functions. For the map's “no public internet pages” decision, treat the shell as a sign-in surface and protect every data read. If the requirement instead includes private asset delivery, stock static hosting does not meet it. No decision from Michael is needed to investigate that distinction in #64. [http handler][http] [map audience decision][map]

### Cache behavior

- Recognized hashed non-HTML assets get `public, max-age=31536000, immutable`. HTML, extensionless pages and ordinary unversioned assets get `public, max-age=0, must-revalidate`. The hash recognizer is a filename heuristic, not a check that the content actually matches a hash. Leave Vite's content-derived filenames intact and verify the emitted bundle. [serving helpers][serving]
- ETags use the storage ID. Matching `If-None-Match` returns 304 before reading the blob. Weak validators and validator lists are supported. Revalidation still reaches the handler; do not equate a 304 with no `Convex` work. [http handler][http] [compatibility handler][client]
- Uploads stage the complete manifest and atomically switch the live manifest after all new files have uploaded. Failed publication preserves the prior live manifest; replaced files are queued for bounded cleanup. That atomicity applies to the static manifest, not to the backend plus frontend as one transaction. [upload guide][integration] [publish mutation][lib] [deploy source][deploy]
- **Old-tab risk:** old assets are removed after publication. A tab that already loaded the old HTML can later request an old lazy chunk that is no longer on the origin, and its browser may not have cached that chunk. Atomic publication does not prevent this. The optional deployment update hook/banner can prompt a reload; avoid unnecessary lazy splitting in the first slice and prove recovery during a hosted update. This risk is inferred directly from cleanup and serving behavior, not observed on a deployed site. [upload lifecycle][integration] [publication/cleanup source][lib] [update hook][react]

### Limits and cost

The component's supported maximum is **1,800 files** and **2 MiB serialized manifest metadata**, enforced in both the CLI and publication path. This is not a 2 MiB cap on all asset bytes. Files left unreferenced by interrupted uploads are recovered by later maintenance after 24 hours. Do not enable the legacy `--cdn` mode for a new integration: its ConvexFS integration is documented as incompatible with current authenticated setups. [integration limits][integration] [upload checks][upload] [publication checks][lib]

Public platform limits checked on the research date:

- `Convex` Free includes 1 GB file storage, 1 GB/month file data egress, 1,000,000 function calls/month, and 20 GB-hours/month action compute. Free has hard caps. Starter has the same included quantities with usage-based overages. [convex resource limits][limits]
- Current Starter overages are $0.033 per GB/month of file storage, $0.132 per GB of file data egress, $2.20 per additional million function calls, and $0.33 per GB-hour action compute. Professional has different included quantities and rates. Recheck the official pricing page before choosing a plan. These are public list prices, not project usage estimates. [limits/prices][limits] [pricing][pricing]
- Serving uses an HTTP action plus an asset-resolution query, and a blob read unless a validator matches. Platform usage definitions count HTTP actions and file storage calls among function calls and include accessing files inside functions in file egress. Do not budget “exactly one billable function call per asset” from the presence of one HTTP handler. Exact accounting, compression, CDN hit behavior and effective cost remain **unverified** until measured on a disposable deployment. [serving source][http] [resource definitions][limits] [usage metrics][usage]
- The HTTP action response limit is 100 MiB; this is a platform response limit, not the component's manifest limit or a recommended asset size. `Convex` offers deployment usage thresholds that can disable a deployment when exceeded. Static delivery shares the deployment's resource budget with its backend, so monitor both. [platform limits][limits] [usage thresholds][usage]

**Production proposal:** keep illustrations/fonts small, measure a cold hosted page and a reload privately, monitor deployment resource consumption, and move assets to Vercel if hosting competes with backend headroom. Do not publish usage measurements to this public repository. This follows the shared-resource model above and the repository's public-data rule. [kudos instructions][agents]

## 3. One site per deployment, and earlier-project lessons

“One site per deployment” is a Kudos architecture constraint from this ticket's D9 requirement, not a limitation of the component. Each component instance has its own deployment singleton and asset manifest; multiple named instances and prefix mounts are technically supported. Use one root instance in each sandbox/real deployment and give each build its own API URL. Do not use path prefixes or host dispatch to mix those environments. [ticket requirement][ticket] [component schema][schema] [component mounts][readme]

Keep prototype hosting independent from the real website until #64 assigns its backend target. Publish mock fixtures only to that disposable environment. Treat signed-in production as a distinct build/deployment rather than adding an environment picker to the product. These are recommendations to enforce the stated isolation, not additional product decisions. [map decisions][map] [ticket requirement][ticket]

Private reference projects, inspected without copying their source:

- **`Silthus/convex-starter-template`, commit `4c4c4e611af1a67235ef59e802381425b92fd5dd`:** `packages/backend/package.json` pins static-hosting 0.1.4; `convex/convex.config.ts` uses a named `main` instance; `convex/http.ts` registers auth before the static catch-all; `convex/staticHostingApps.ts` joins the instance, dist path and build filter; `scripts/deploy.ts` distinguishes development and production, builds for the chosen URL, uploads the chosen dist directory and sets a default frontend `SITE_URL`. Reuse the routing and explicit-target principles, not the obsolete upload re-exports or a multiple-app registry for a single site. [private template paths][template]
- **Lonir reference:** `Silthus/next-session`'s earlier hosting research identifies its source as `Omni-GM/lonir`, which GitHub now resolves to the private `Omni-GM/omni-gm-prototype-v3` repository. At commit `824bd52d175374b0c0db64c7c80cd9f1cd7c138d`, `packages/backend/convex/convex.config.ts`, `http.ts`, `staticHostingApps.ts`, `scripts/deploy.ts` and `package.json` show a 0.1.4, multiple-app integration. Its deploy script has a deployment-specific preview-credential workaround before uploading. That is useful evidence of the preview limitation, not a pipeline to transplant into Kudos. [private historical research pointer][next-research] [private lonir paths][lonir]
- **`Silthus/next-session`, commit `70eeabffca3a09c8ef416840af342d20ad428910`:** its current `docs/adr/0001-spa-on-cloudflare-workers-backend-on-convex-free.md`, `worker/index.ts`, `wrangler.jsonc`, `convex/http.ts` and `.github/workflows/ci.yml` describe an SPA on Cloudflare Workers and backend/auth on `Convex`. It is not a current static-hosting deployment recipe. Its private ADR's concerns about custom-domain availability and shared hosting resources are independently checked against public `Convex` docs above. [private next-session paths][next]

## 4. Vercel, previews, and a custom domain later

**Migration can keep the same Vite SPA and `Convex` backend.** Vercel documents Vite builds and `Convex` documents deploying its backend from the Vercel build. No Next.js rewrite is required to change static hosts. Configure the repository/root directory so the build can see the root `convex/`, use `pnpm --filter website build`, and publish `apps/website/dist`. Add the documented SPA rewrite to `/index.html` so direct profile links and reloads continue to work. [vercel vite][vercel-vite] [convex vercel integration][vercel]

For production, the official `Convex` integration uses a production deploy key scoped only to Vercel Production. For previews, use a **preview deploy key** scoped only to Vercel Preview. The build can run `pnpm exec convex deploy --cmd "pnpm --filter website build" --cmd-url-env-var-name VITE_CONVEX_URL`. With the preview key, the `Convex` CLI creates/selects an isolated backend and injects that backend's URL into the build; a seed function can run via `--preview-run`. Never configure an arbitrary branch frontend against production data merely to get a preview URL. [convex vercel integration][vercel]

**Static-hosting branch previews are not verified:** upstream issue #38 remains open for 0.2.1 failing to upload after a project preview deploy key creates the backend. Its follow-up describes the missing credential/target handoff. The public PR #39 does not fix that upload problem. Use a known development deployment for the prototype; do not promise automatic `Convex`-hosted PR previews from the stock command. The private Lonir workaround does not turn this into supported component behavior. [upstream issue #38][preview-issue] [follow-up][preview-comment] [pr #39][pr39] [private lonir script][lonir]

For the domain there are two separate options:

1. **Stay on `Convex`:** custom domains serve HTTP actions, so the static site can remain there. Register the domain in Deployment Settings and use the DNS records `Convex` supplies. Official pricing reserves custom domains for Professional and higher, not Free/Starter. Changing `CONVEX_SITE_URL` affects HTTP-action URLs and `Convex Auth` redirects/issuer; changing `CONVEX_CLOUD_URL` affects API client builds and storage URLs. Rebuild and retest if either canonical backend URL changes. [convex domains][domains] [pricing][pricing]
2. **Move the frontend to Vercel:** add the frontend domain to the Vercel project, configure its displayed DNS records, and retain the backend's `.convex.cloud` API and `.convex.site` HTTP origins. This needs no `Convex` custom domain purely to put a domain on the website. Vercel assigns a `vercel.app` URL separately from any purchased/custom domain. Do not hard-code DNS values before a real domain is selected. [vercel domains][vercel-domains] [convex frontend/backend split][vercel]

Recommendation for the later move: first prove the same built UI on Vercel against the intended isolated backend, then configure auth/frontend origin, attach DNS, update Slack/App Home links, and retain the previous hosting route for a deliberate transition. Domain purchase, ownership, target plan and actual DNS are **unverified and undecided**. They do not block this research or the mock-data UI prototype. [map's later hosting scope][map]

## 5. Sign-in across domains

Hosting alone does not pick the session model. #64 must prove it before #65 makes the first-slice contract. [map architecture dependency][map]

- Sign in with Slack is OIDC using `openid`, optionally `profile` and `email`. Slack documents separate flows for sign-in scopes and other OAuth scopes. The `redirect_uri` must exactly match or be a subdirectory of a registered redirect URL. Validate `state` and `nonce`, and map the verified Slack user/workspace claims to the correct Kudos member; a `team` hint in the request does not replace authorization. [slack's sign-in documentation][slack] [map audience constraint][map]
- **If #64 chooses `Convex Auth` for the Vite SPA:** its OAuth callback lives at the backend HTTP origin, for example `<backend>.convex.site/api/auth/callback/slack` if the provider ID is `slack`. `SITE_URL` is the frontend return origin. Moving only the frontend to Vercel can keep the Slack callback on `Convex`; update `SITE_URL` and validate the allowed return origins instead of assuming the callback moves too. Slack is among the other Auth.js providers `Convex Auth` lets callers try, not among its explicitly supported GitHub/Google/Apple integrations. Slack compatibility remains **unverified**. [convex auth oauth][auth-oauth] [return url source][auth-redirects]
- The React `Convex Auth` provider defaults to browser `localStorage` for session tokens. The default key namespace uses the `Convex` client URL, but browser storage still belongs to the frontend origin. A move from `.convex.site` to `.vercel.app` or a custom domain does not carry those stored sessions across; plan for re-authentication. OAuth itself still uses transient backend cookies, so a token-based SPA does not mean “no cookies anywhere.” [react auth provider][auth-react] [browser storage specification][webstorage] [oauth cookie source][auth-cookies]
- **If #64 chooses HttpOnly sessions instead:** a cookie set by the `Convex` host cannot be scoped to an unrelated Vercel/custom host. RFC 6265's domain-match rules prohibit that, and host-only cookies stay on the issuing host. A same-origin BFF/proxy or deliberately designed cross-origin session flow would be a separate architecture choice. Prove CORS, credentials, CSRF and modern cookie behavior before choosing it; no such flow was verified here. [cookie domain rules][cookies] [http-action cors documentation][http-actions]
- Previews need both isolated backend credentials and a permitted sign-in callback/return URL. Default `Convex Auth` redirects accept only the configured `SITE_URL`; allowing arbitrary absolute return URLs is not the default. Prefer a stable sandbox sign-in origin until #64 proves a preview strategy. Preview backend documentation alone does not prove Slack sign-in works on every ephemeral domain. [auth return url source][auth-redirects] [vercel preview docs][vercel] [slack redirect rules][slack]

## 6. Repo layout, gate, Coherence, and CI

**Proposal:** keep the backend at root `convex/` and add `apps/website/` as one pnpm workspace package. Keep one root lockfile, root-owned deployment scripts, and the existing root entry spec when the first domain implementation creates it. No Turbo or new backend package is needed for two build surfaces. pnpm supports a root workspace plus packages declared in `pnpm-workspace.yaml`; recursive commands exclude the root by default, so explicit root/website steps avoid accidentally skipping it. [pnpm workspaces][pnpm] [pnpm recursive][pnpm-recursive] [current root package][root-package]

The current gate is `typecheck -> tests -> Coherence spec/lexicon checks`. The current root TypeScript config includes `**/*.ts` but no TSX/React JSX setting, and Vitest discovers `**/*.test.ts`, not website `.test.tsx` suites. The Gate workflow runs `pnpm gate`; a separate Coherence workflow checks specs and chokepoints. Merely creating an `apps/website` folder would not give the new UI complete type/test/build coverage. [root gate][root-package] [typescript config][tsconfig] [vitest config][vitest] [gate workflow][gate-ci] [coherence workflow][coherence-ci]

When the implementation arrives:

1. Give the website its own strict TypeScript/JSX and UI test configuration; keep root backend test/typecheck scopes from accidentally traversing or duplicating website suites. Make the root gate explicitly run both existing backend checks and website typecheck, meaningful tests, and production Vite build. A broken website must fail `pnpm gate`. This is the recommended closure of the current gaps above.
2. Run the repo-level Coherence spec/lexicon check once; declare the website component in `apps/website/Website.spec.md`, and browser/auth/public-function entrances in the owning specs. Link the spec hierarchy and trust crossings rather than treating a UI file as the authorization boundary. Declare `website` in the root lexicon with the first mainline implementation, as map #57 requires. [coherence spec grammar][coherence-grammar] [map vocabulary decision][map]
3. Keep Gate and Coherence as required checks for the implementation. Deploy the selected sandbox/production target only after the local/CI gate and required review pass; do not give untrusted PR jobs production credentials. Run broad local checks via `~/dev/fleet/fleet heavy -- pnpm gate` under the supplied Linux devbox instructions. No deployment workflow exists in the inspected mainline snapshot; the first shipping slice must add its actual publication path. [current workflows][gate-ci] [repository snapshot][repo]
4. Keep deploy secrets on the backend/CI side. Vite explicitly bundles `VITE_*` variables into frontend code, so only public API/origin configuration belongs there, never Slack secrets or `Convex` deploy keys. [vite environment documentation][vite-env]

## 7. Handoff to the decisions ahead

- **#62, UI prototype:** use a disposable `Convex` target and released 0.2.1, root-mounted SPA, one instance, explicit pnpm build command and mock data. Keep local Vite HMR. Prove a hosted direct-route reload, missing-asset 404, cache headers and GET health check. Do not copy the 0.1.4 upload wrappers or require production auth to explore the design.
- **#63, visual-language grilling:** hashing bundled illustrations/fonts lets the stock handler cache them; assets copied under stable names revalidate. Choose art and loading behavior with cold-page weight in mind. No hosting change is needed to establish the brand. [cache source][serving]
- **#64, architecture prototype:** prove Slack OIDC, member/workspace binding, route coexistence, the backend/frontend origin split, and the chosen session mechanism on both `Convex`-hosted and separate frontend origins. Test sign-out and rejected return origins. Resolve sandbox/real targeting and the L1/public authenticated-function exception. The report establishes hosting constraints, not the final auth choice. [map cross-map dependencies][map]
- **#65, first-slice spec:** require unauthenticated access to return no member data, reject cross-workspace reads, gate both backend and UI, and name the actual sandbox/real publish targets and callback URLs. Include a hosted direct-link/reload check and a deploy-with-an-old-tab exercise. Treat the Vercel move and real domain as later work until selected. [map first slice and audience][map]

These are follow-ups for the existing tickets, not new tickets or dispatched work.

## Verification performed

Read the actual published component source, official docs, private reference configurations, current public issue/PR state and the Kudos gate files. Ran **11 assertions directly against `src/component/serving.ts` from the release commit**: JS/font immutable caching, HTML and profile revalidation, stable SVG revalidation, extension detection, malformed URL rejection and weak/listed ETag matching. All passed. This proves those helper behaviors; it does not prove a hosted response, route coexistence, billing, or sign-in.

Coherence's spec check found no spec at this baseline and no problems. Its lexicon check passed with zero rejected names and zero unknown nouns. Historical journal names remain advisory. No domain vocabulary was added for the research branch.

The helper check can be reproduced without installing or deploying the component:

```sh
curl --fail --silent --show-error https://raw.githubusercontent.com/get-convex/static-hosting/17461fe5693963def7b5c8ff94e93cb57b13f437/src/component/serving.ts -o /tmp/kudos-static-serving.ts
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { cacheControlFor, hasFileExtension, decodeRequestPath, etagMatches } from '/tmp/kudos-static-serving.ts';
const immutable = 'public, max-age=31536000, immutable';
const revalidate = 'public, max-age=0, must-revalidate';
assert.equal(cacheControlFor('/assets/index-D3LP-ukt.js'), immutable);
assert.equal(cacheControlFor('/assets/font-B71cUw87.woff2'), immutable);
assert.equal(cacheControlFor('/index.html'), revalidate);
assert.equal(cacheControlFor('/assets/page-B71cUw87.html'), revalidate);
assert.equal(cacheControlFor('/profile'), revalidate);
assert.equal(cacheControlFor('/favicon.svg'), revalidate);
assert.equal(hasFileExtension('/profile/settings'), false);
assert.equal(hasFileExtension('/missing.js'), true);
assert.equal(decodeRequestPath('/bad%zz'), null);
assert.equal(etagMatches('W/"old", W/"asset"', '"asset"'), true);
assert.equal(etagMatches('"old"', '"asset"'), false);
console.log('11 assertions passed');
JS
```

Use Node 24, which ran the check here. No application code, dependency, spec, lexicon or CI configuration was changed by this report. The research branch must not merge to main. [ticket delivery instruction][ticket]

## References

All cited technical sources are official docs, published package metadata, first-party implementation, or the component repository's direct issue report. Private project pointers are access-controlled source references; the public report contains no copied private implementation.

[map]: https://github.com/Silthus/kudos/issues/57
[ticket]: https://github.com/Silthus/kudos/issues/61
[package]: https://registry.npmjs.org/@convex-dev%2Fstatic-hosting/latest
[source]: https://github.com/get-convex/static-hosting/tree/17461fe5693963def7b5c8ff94e93cb57b13f437
[main-source]: https://github.com/get-convex/static-hosting/compare/17461fe5693963def7b5c8ff94e93cb57b13f437...d2d8e02a019e4021ff2e50812b44113df12b1419
[readme]: https://github.com/get-convex/static-hosting/blob/17461fe5693963def7b5c8ff94e93cb57b13f437/README.md
[integration]: https://github.com/get-convex/static-hosting/blob/17461fe5693963def7b5c8ff94e93cb57b13f437/INTEGRATION.md
[changelog]: https://github.com/get-convex/static-hosting/blob/17461fe5693963def7b5c8ff94e93cb57b13f437/CHANGELOG.md
[migration]: https://github.com/get-convex/static-hosting/blob/17461fe5693963def7b5c8ff94e93cb57b13f437/MIGRATION.md
[http]: https://github.com/get-convex/static-hosting/blob/17461fe5693963def7b5c8ff94e93cb57b13f437/src/component/http.ts
[client]: https://github.com/get-convex/static-hosting/blob/17461fe5693963def7b5c8ff94e93cb57b13f437/src/client/index.ts
[serving]: https://github.com/get-convex/static-hosting/blob/17461fe5693963def7b5c8ff94e93cb57b13f437/src/component/serving.ts
[schema]: https://github.com/get-convex/static-hosting/blob/17461fe5693963def7b5c8ff94e93cb57b13f437/src/component/schema.ts
[lib]: https://github.com/get-convex/static-hosting/blob/17461fe5693963def7b5c8ff94e93cb57b13f437/src/component/lib.ts
[deploy]: https://github.com/get-convex/static-hosting/blob/17461fe5693963def7b5c8ff94e93cb57b13f437/src/cli/deploy.ts
[upload]: https://github.com/get-convex/static-hosting/blob/17461fe5693963def7b5c8ff94e93cb57b13f437/src/cli/upload.ts
[args]: https://github.com/get-convex/static-hosting/blob/17461fe5693963def7b5c8ff94e93cb57b13f437/src/cli/args.ts
[commands]: https://github.com/get-convex/static-hosting/blob/17461fe5693963def7b5c8ff94e93cb57b13f437/src/cli/commands.ts
[build-env]: https://github.com/get-convex/static-hosting/blob/17461fe5693963def7b5c8ff94e93cb57b13f437/src/cli/deployEnvironment.ts
[react]: https://github.com/get-convex/static-hosting/blob/17461fe5693963def7b5c8ff94e93cb57b13f437/src/react/index.tsx
[preview-issue]: https://github.com/get-convex/static-hosting/issues/38
[preview-comment]: https://github.com/get-convex/static-hosting/issues/38#issuecomment-5544987558
[pr39]: https://github.com/get-convex/static-hosting/pull/39
[platform-source]: https://github.com/get-convex/convex-backend/tree/863869cbfb77d3c1c35573646ade05582c881dc3/npm-packages/docs/docs
[limits]: https://docs.convex.dev/production/state/limits
[usage]: https://docs.convex.dev/production/usage-limits
[pricing]: https://www.convex.dev/pricing
[domains]: https://docs.convex.dev/production/custom-domains
[vercel]: https://docs.convex.dev/production/hosting/vercel
[http-actions]: https://docs.convex.dev/functions/http-actions
[vercel-vite]: https://vercel.com/docs/frameworks/frontend/vite
[vercel-domains]: https://vercel.com/docs/domains/working-with-domains/add-a-domain
[hobby]: https://vercel.com/docs/plans/hobby
[slack]: https://docs.slack.dev/authentication/sign-in-with-slack/
[auth-source]: https://github.com/get-convex/convex-auth/tree/7eab86015b09cf91ac36a359beaaa4036aa24cc1
[auth-oauth]: https://github.com/get-convex/convex-auth/blob/7eab86015b09cf91ac36a359beaaa4036aa24cc1/docs/pages/config/oauth.mdx
[auth-redirects]: https://github.com/get-convex/convex-auth/blob/7eab86015b09cf91ac36a359beaaa4036aa24cc1/src/server/implementation/redirects.ts
[auth-react]: https://github.com/get-convex/convex-auth/blob/7eab86015b09cf91ac36a359beaaa4036aa24cc1/src/react/index.tsx
[auth-cookies]: https://github.com/get-convex/convex-auth/blob/7eab86015b09cf91ac36a359beaaa4036aa24cc1/src/server/cookies.ts
[cookies]: https://www.rfc-editor.org/rfc/rfc6265#section-5.3
[webstorage]: https://html.spec.whatwg.org/multipage/webstorage.html#the-localstorage-attribute
[pnpm]: https://pnpm.io/workspaces
[pnpm-recursive]: https://pnpm.io/cli/recursive
[vite-env]: https://vite.dev/guide/env-and-mode
[repo]: https://github.com/Silthus/kudos/tree/63f458b
[agents]: https://github.com/Silthus/kudos/blob/63f458b/AGENTS.md
[root-package]: https://github.com/Silthus/kudos/blob/63f458b/package.json
[tsconfig]: https://github.com/Silthus/kudos/blob/63f458b/tsconfig.json
[vitest]: https://github.com/Silthus/kudos/blob/63f458b/vitest.config.ts
[gate-ci]: https://github.com/Silthus/kudos/blob/63f458b/.github/workflows/gate.yml
[coherence-ci]: https://github.com/Silthus/kudos/blob/63f458b/.github/workflows/coherence.yml
[coherence-grammar]: https://github.com/PostHog/coherence/blob/main/docs/spec.md
[template]: https://github.com/Silthus/convex-starter-template/tree/4c4c4e611af1a67235ef59e802381425b92fd5dd/packages/backend
[next-research]: https://github.com/Silthus/next-session/blob/research/hosting-and-auth/docs/research/hosting-and-auth.md
[lonir]: https://github.com/Omni-GM/omni-gm-prototype-v3/tree/824bd52d175374b0c0db64c7c80cd9f1cd7c138d/packages/backend
[next]: https://github.com/Silthus/next-session/tree/70eeabffca3a09c8ef416840af342d20ad428910
