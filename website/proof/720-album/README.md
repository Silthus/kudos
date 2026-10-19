# #720 proof: card backs in the official PostHog playing-card design

Branch `album/fix-720`. The website was built from `4bb3f01c` (`main` at `228ea4c8` merged in) and uploaded to the sandbox `different-dog-467` with the deploy workflow's `static-hosting upload` step only. No function changed, so the live lanes' functions stayed as they were.

## Tests

- Red (`red.txt`): the new `packOpening.test.tsx` case, "#720: a face-down card shows PostHog's playing-card back", at the test-only commit `fed87578`. No PostHog logo is on either face-down card.
- Green (`green.txt`): `packOpening.test.tsx` and `albumAccessibility.test.tsx`, 158 passed. Both face-down cards carry the stacked mono logo twice. Its markup equals `@posthog/brand`'s runtime `Logo`, and only the second copy sits under a half turn. The card back passes axe at every beat in both themes. Its ink on its red reaches 3:1.
- Gate (`gate-4bb3f01c.txt`): 6742 of 6743 passed. The one failure is `convex/album/packs.test.ts`'s 120-recipient case, which hit its 5 s timeout at a load average near 40. It passes when rerun alone, and this change touches no backend file.

## Bundle

The album's lazy chunk, gzipped (`vite build`, `AlbumApp-*.js`):

| Build | gzip |
| --- | --- |
| `main` `228ea4c8` | 36.3 kB |
| `Logo` imported at run time (`0d192c93`) | 45.2 kB |
| Logo rendered at build time (`4bb3f01c`) | 38.3 kB |

The entry chunk is unchanged. The entry-budget and own-chunk tests in `entryBundle.test.ts` pass.

## Sandbox walk

1. `website/proof/662-album/drive.mts` with `KUDOS_CAST=Q` signed Slack-shaped events with the sandbox signing secret. Nobody clicked in Slack. Three synthetic members joined, and the giver thanked the other two in one message with a reason, which earned two thoughtful packs. Output: `drive-output.txt`.
2. A `users`, an `authSessions` and an `authRefreshTokens` row were appended for the giver with a six-hour expiry. The browser session was set from the refresh token. The rows stay in place, and nothing was deleted.
3. Light, 1440 × 900, by mouse, recorded (`shots/sandbox-light-1440-open-and-turn.mp4`):
   - The packs button opens the pack, and the rip shows both cards face down with the new back (`shots/sandbox-light-1440-face-down.png`).
   - The first card turns from the back to the person card (`shots/sandbox-light-1440-first-turned.png`), then the hoggie turns.
4. Dark, recorded (`shots/sandbox-dark-1440-and-390-keyboard.mp4`):
   - At 1440 × 900, the second pack opens to both backs (`shots/sandbox-dark-1440-face-down.png`).
   - Resized to 390 × 844, the backs draw crisply at 156 × 220 px, and the page doesn't scroll sideways (`scrollWidth` 390) (`shots/sandbox-dark-390-face-down.png`).
   - By keyboard, Enter turns the first card, Escape jumps to the end, and Enter on Done closes.
5. The console showed no error and no CSP violation in either walk.

## Side by side with the prototype

The prototype `0ac9e96d` (`VITE_SHELL_FIXTURE=prototype-redesign`, `?variant=5`) is beside this PR's fixture build (`VITE_SHELL_FIXTURE=album`) at the same beat, 1440 × 900:

- `shots/comparison-light-1440.png`: the prototype's striped blue HedgeHug back beside the PostHog playing-card back.
- `shots/comparison-dark-1440.png`: the prototype was built light only (the map's prototype-fidelity decision), so its light frame sits beside this PR's dark sandbox frame.

The look follows the product owner's photo of PostHog's official playing cards. The photo is private and is not attached. The pattern was measured from it and redrawn as SVG lines. The logo is never traced: it comes from `@posthog/brand`.
