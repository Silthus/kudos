# #722 sandbox proof: uncollected people show their own picture, greyed out

Branch `album/fix-722`. The functions were deployed from `69d01b87` to the sandbox `different-dog-467`; the website was uploaded from `bd0fbd18` (the design-pass fix, frontend only). The dry run first showed no index or function would be dropped. `album` is on there.

1. A synthetic member with a posthog.com match (a sandbox giver from #251, on a company team) got an appended `authSessions` row and fresh `authRefreshTokens` rows, short-lived; the browser session was set from the refresh token.
2. Their own team page at 1440 × 900, light and dark: the teammate not collected yet shows their company picture greyed out (`data-picture="grey"`, computed `filter: grayscale(1)`, opacity 0.5), the collected teammate in colour, and the posthog.com person with no Slack match as a named silhouette, "Not in Slack yet".
3. The uncollected teammate's person page: the large photo and the hype emoji still to unlock are both greyed out.
4. `drive.mts` signs Slack-shaped `message` events with the sandbox signing secret (not a Slack click): the member thanks a teammate with a reason, which earns a thoughtful pack. The pack was opened in the browser (rip, Skip, Done), the card waited in the tray, and **Put … card in** was clicked on the team page. On landing, the same `<img>` stayed in place and its frame turned `data-picture="colour"`; the computed filter went grayscale(1) → 0.69 → 0.40 → 0.17 → 0.03 → none over about 0.9 s. Output: `drive-output.txt`.
5. The preview tab is never visible to this agent, so its screen recorder captured no repaints. The moment was captured instead by pausing the page's own CSS transitions on landing (`Animation.pause()`, `currentTime` stepped 0 → 750 ms, then `finish()`) and taking a still at each step; the stills were joined into `grey-to-colour.webm` in the browser with `MediaRecorder`.
6. Phone, 390 × 844, light and dark: no sideways scroll, stickers 76 px. Keyboard: Tab from the page title reaches the uncollected person's link with a visible focus ring, and Enter opens their page.
7. Reduced motion can't be emulated in the preview; the served stylesheet carries `@media (prefers-reduced-motion: reduce) { .al-photo-sticker, .al-photo-sticker > img, .al-hype-frame > img { transition: none } }`.
8. No `securitypolicyviolation` in any walk. During the dark walk one teammate's Cloudinary picture stopped loading (a fresh `Image()` of the same URL failed too); the page showed that person's named silhouette, the fallback for a person without a picture.

Faces in every capture are blurred: a `MutationObserver` set `blur(5px)` on each face picture's parent, and the large person-page photo was blurred again in a canvas before publishing.

Run: `KUDOS_SITE=https://different-dog-467.convex.site KUDOS_WORKSPACE=<sandbox team> KUDOS_PUBLIC_CHANNEL=<channel> KUDOS_GIVER=<giver user> KUDOS_THANKED=<teammate user> SLACK_SIGNING_SECRET_FILE=<600 file> bun website/proof/722-album/drive.mts`
