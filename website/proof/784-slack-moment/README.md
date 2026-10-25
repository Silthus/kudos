# Proof: the XP moment waits for a click and shows Slack messages in full (#784)

`bun website/proof/784-slack-moment/drive.mts seed` uses signed `team_join` requests to join three made-up members on the sandbox `different-dog-467`: Pip Hollow, Wren Calder and Tam Ferris, with Slack IDs starting `U0PRF784`. It appends a `users` row and a last visit for Pip, then has Pip thank Wren and Wren thank Pip. Wren's thanks is a long rich-text message with code, bold and a link. Finally it prints a sign-in snippet for an incognito tab on `/book#me`. `more` has Tam thank Pip, and `sign-in` prints a fresh snippet. Every event is a signed Slack-shaped request, not a Slack click. The page behind the canvas is blurred in the stills so that no workspace names or counts show.

- `desktop-waiting.png`: 1440 px, 30 s after the moment opened. There is no ring, and the orb still reads `? XP · Tap to collect`. The excerpts sit in two columns as full Slack messages, with Lato, initials avatars, the time, Wren's mention in blue, and Pip's own mention in Slack's yellow. Wren's message shows its code, bold and link, and HedgeHug's level-up carries its `APP` tag.
- `desktop-collecting.png`: a click on the orb starts the stream into the orb.
- `desktop-collected.png`: the stream ends in the level 2 takeover.
- `phone-waiting.png`: 390 px, Tam's kudos. The board is one column, the orb is docked below it, and Pip's own mention is yellow.
