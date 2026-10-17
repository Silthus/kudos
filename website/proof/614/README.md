# #614: a pack still opens after openCrate moved to its one HTTP send

Fixture build (`VITE_SHELL_FIXTURE=member-with-packs`), served with `vite preview` and driven through the T3 preview browser. Made-up members and fixture hoggies only. On `/book/collection` the stack was fanned out and pack 1 opened.

| Shot | What it shows |
| --- | --- |
| 01-pack-opened-light-1280 | Pack 1 revealed (Banana), with the "+130 XP" and "+5 coins" chips under its card and packs 2 to 4 still sealed in the scene |
| 02-pack-opened-dark-1280 | The same scene in dark mode |

The fixture's actions don't run the live shell's transport. The one HTTP send of `openCrate` with the session's token, and no socket call, is proven in `website/src/liveShell.test.tsx` under the packs requirement's oracle.
