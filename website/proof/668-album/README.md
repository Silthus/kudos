# Proof for #668: the album's profile page

- `red-backend.txt`: `convex/website/albumProfile.test.ts` before `getAlbumProfile` existed, 4 of 4 failing.
- `red-website.txt`: `website/src/album/profile.test.tsx` against the placeholder profile, 14 of 15 failing (the one pass is the "no note" case, true of the placeholder too).
- `red-round-1-*.txt`, `red-round-2-website.txt`: the review rounds' new tests failing before their fixes.
- `green.txt`: the same two files on the reviewed branch, every test passing.
- `sandbox-read.txt`: `getAlbumProfile` on the sandbox `different-dog-467` through `convex run --identity`, signed in as the synthetic member Avery Hedge with an appended short-lived session. The kind note is the newest thoughtful kudos Avery received; the newest people are their four latest album stickers.

The browser proof (1440×900 and 390×844, light and dark, the keyboard walk and its recording) is attached to the pull request. Real posthog.com team photos were blurred in the page through CSSOM before each capture.
