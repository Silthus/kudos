# The sign-in handshake test

`signIn.handshake.ts` drives the real Convex Auth Slack handshake against `mockSlackIssuer.ts`, a stand-in for Slack's OpenID Connect issuer, `users.info` and PostHog's flag definitions on `127.0.0.1:3412` (`MOCK_SLACK_PORT`). It runs on a disposable local backend on its own ports, never the shared `3210` and never a cloud deployment.

`pnpm test:handshake` starts that backend itself (`disposableBackend.ts`, Vitest's global setup): it takes the pinned `convex-local-backend` from `~/.cache/convex/binaries/`, or downloads it there, or uses `CONVEX_LOCAL_BACKEND`; starts it on two free ports with storage under the system's temp directory; sets the mock's env and fresh signing keys; deploys; and removes it all afterwards. CI runs it in its own job beside the gate.

To run it against a backend you started yourself, set `HANDSHAKE_ENV_FILE` (a file with `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`) and `HANDSHAKE_SITE_URL`, and give that backend the env `disposableBackend.ts` sets.

The mock serves the `website` flag on unless the test switches it, so the flag is only ever on for that disposable backend. To click through the site by hand, upload a build with `npx --no -- static-hosting upload --dist website/dist` and run `node testing/handshake/serveMockSlack.ts`; `POST /control/next` picks who signs in next and `POST /control/website` switches the flag, followed by `npx --no -- convex run --component posthog lib:refreshFlagDefinitions`. `MOCK_FLAGS_ON=xp-levels,everyone-board` serves those flags on for everyone as well, a local override for a proof that needs them.
