# #687 proof: the maintainer maps Slack emojis to earned emojis

## Red, then green

- `red-backend.txt`: `convex/album/emojiMappings.test.ts` before the change, 14 of 14 failed (no `website/emojiMappings` module).
- `red-website.txt`: `website/src/emojiMapping.test.tsx` with the Settings section not rendered, 7 of 9 failed (the two that pass assert the section stays out).
- Green: both files pass whole, 14 and 9 tests, every assertion intact.
- `gate-3936bdb9.txt`: `fleet heavy -- pnpm gate` on `3936bdb9` (the branch with `main` merged in): 335 files, 6,595 tests, Coherence's spec and lexicon checks, exit 0.

## Sandbox live run (signed in by hand, not a Slack click)

The branch merged with the live sandbox tree `d44e6e13` (#656's proof tree, which also carries #697's head) was deployed to `different-dog-467` at 10:00:58 UTC on 2026-10-19, functions only. The dry run added only `randomEmojis.by_workspace_name` and `randomEmojiDrops.by_member_name` and deleted nothing, and every function the sandbox served was exported by the tree, so both lanes stayed live.

A `users` and `authSessions` row was imported for the synthetic member `U0PRF652GVRA` (#652's cast-A giver), and every call ran as `convex run … --identity` for that session.

0. `0-mappings-before-maintainer.json`: with `KUDOS_MAINTAINER` unset, `getEmojiMappings` answers `off`.
1. `KUDOS_MAINTAINER` set to that member at 10:04:29. `1-mappings-as-maintainer.json`: the sandbox workspace's 14 Slack custom emoji with their pictures. Two are **pre-classified by name**: `piggy` as #652's proof team and `beacons-a` as #696's proof team. The 59 company teams, the five milestones by their gold names, the five levels and 152 people are listed (people's names left out here).
2. `2-album-before.json`: the giver's hype emoji for their packed person reads `caspian-thornea-hype`, not in Slack, pictured by the person's face; level 5 reads `level-5`, not in Slack, pictured by the catalogue emblem.
3. `3-mapSlackEmoji-answers.txt`: `squirrel` mapped to that person's hype, `shipit` to level 5 and `glitch_crab` to the random drops each answered `mapped`; a name the workspace doesn't have answered `refused`.
4. `4-album-after-mapping.json`: **the hype emoji is now `squirrel` and level 5 is `shipit`, both in Slack and pictured as Slack pictures them** (`shipit` is an alias of `squirrel` in this workspace, so they share a picture). `4-mappings-after.json` lists the five mapped emojis.
5. All three unmapped again. `5-album-after-unmapping.json`: the hype emoji is back to `caspian-thornea-hype` and level 5 to `level-5`, since neither name is in Slack. `5-mappings-after-unmapping.json` keeps only the two pre-classified emojis.
6. `KUDOS_MAINTAINER` unset again at 10:06:24. `6-mappings-after-env-removed.json`: `off`.

No random drop was rolled live: a pack hits one time in ten, and the roll is covered by `AL23: a random emoji drops from a thoughtful pack`.

## Browser

The fixture app (`VITE_SHELL_FIXTURE=album-maintainer`, the album shell with the maintainer's Settings) at 1440 × 900, rather than an upload of this branch's website over the shared sandbox, where UI lanes are proving.

- `shots/settings-light.png`, `shots/settings-dark.png`: the section in both themes.
- `shots/settings-hype-editor.png`: a row's editor mapping `:shipit:` to a person's hype, found by name.
- `shots/search-filter-hype.mp4`: search by part of a name, filter by place, and the hype editor.
- `shots/map-to-team.mp4` and `shots/save-closes-the-editor.mp4`: mapping `:hedgehog:` to a team; Save closes the editor and puts focus back on its Change button.
- `shots/comparison.png`: the prototype's emoji popup (round 6, `0ac9e96d`; the prototype gives Settings no design of its own, "today's settings page, inside the frame") beside the section in light and dark.
