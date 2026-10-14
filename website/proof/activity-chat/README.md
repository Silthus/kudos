# #409: a chat-style Activity timeline, with emoji drawn inline

From the fixture build (`VITE_SHELL_FIXTURE=member-with-every-feature-open`, `/activity`, every page loaded).

- `red.txt`: the new tests failing on `main` (`32a8c42`) before the change.
- `green.txt`: the same tests passing after it.
- `timeline-light.png`, `timeline-dark.png`: 1280 px wide.
- `timeline-phone-light.png`: 390 px wide; no horizontal overflow, every bubble column at most 80% of the row.

The screenshot browser had no emoji font, so a proof-only `@font-face` (Noto Color Emoji, served locally) was injected into the page before each capture. The app ships no font.

Bundle: the name-to-character map adds 42.8 KB raw and 17.0 KB gzip to the main chunk (1,880.13 → 1,897.17 KB gzip).
