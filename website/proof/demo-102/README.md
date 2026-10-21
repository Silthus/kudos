# Demo seed: the core loop on the sandbox

Silthus/personal#102. One command seeds the sandbox `different-dog-467` so a made-up demo member, Robin Ash, arrives at the website to the whole core loop: an XP moment with a level-up, then a full item board with a legendary hoggie, Juno Vale's sticker as the last face on the made-up team Burrow Builders, and the Share. Run it again to reset the demo before a take.

```sh
bun website/proof/demo-102/seed.mts
```

Run it from the repository root after `pnpm install`. The sandbox is fixed in the script: every Convex CLI call names it with `--deployment`, runs from a scratch directory with no `.env` files, and gets no `CONVEX_*` variable from the shell, so it can't reach another deployment. It reads the sandbox's own secrets through the Convex CLI. It takes about a minute.

It prints the waiting items with the rarity each one will turn to, and a snippet that signs a browser in as Robin: open `https://different-dog-467.convex.site/book#me` in a private window, paste the snippet into the console, and the page reloads signed in. A sign-in works for one page load, so `bun website/proof/demo-102/seed.mts sign-in` prints a fresh snippet for the same demo member without seeding again.

## What a run does

1. **Retires the previous run.** Every member whose Slack ID starts with `U0DEMO102` gets a signed `user_change` with `deleted: true`, so it leaves the directory, the boards and the name matching. Nothing is deleted.
2. **Picks a demo member who draws a legendary.** It joins 24 Robin Ash candidates by signed `team_join`. A hoggie draw is a pure function of the draw secret, the member, the crate key and the catalogue version, so it computes each candidate's level 4 draws and keeps the first one with a legendary. It retires the rest.
3. **Joins the cast** (Milo Brandt, Sasha Lind, Niko Pratt, Juno Vale, Kit Moreau, Lena Ortiz) and puts the first four on Burrow Builders in the company copy, keeping every other profile and team as stored. No member has a picture, so no real face appears.
4. **Appends** a `memberProgress` row at 250 XP (level 3) and a `users`, `authSessions` and `authRefreshTokens` row for the demo member, so they count as signed in and get no welcome item.
5. **Before the last visit** (dated yesterday): Robin thanks Milo, Sasha and Niko, and the seed turns their three stickers through `website/album:turnItem`. Their hoggies stay face down.
6. **Appends the last visit** at that moment.
7. **Since the last visit:** six thoughtful kudos to Robin (these cross level 4), five hugs on Robin's message, Robin's hug on Juno's demo post, and Robin's thanks to Juno.

The seed waits until Robin is past level 4's 300 XP, has eight items waiting (four thanked hoggies, Juno's sticker and the three `Level 4` hoggies), no job this run scheduled is still due, and the XP reads the same twice in a row.

Every run joins a new cast, because the cast's givers have a daily allowance of three kudos. So each run's hype emojis carry a number (`juno-vale-4-hype`), and the week's norm line counts every run's givers. Keep the emoji names off camera.

Kudos and hugs use the sandbox's own kudos emoji (its workspace setting, else `KUDOS_EMOJI`; the seed refuses a sandbox that names neither) and are signed Slack-shaped events sent to the sandbox's `/slack/events` with its own signing secret, in a made-up channel `C0DEMO102`. Replies to the made-up members fail at Slack, which is harmless. The Share posts to the sandbox workspace's weekly-post channel.
