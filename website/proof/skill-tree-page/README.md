# #188: the skill tree page and the HUD's skill point chip

`/skills` renders `getSkillTree`'s `tree` answer (WS85, WS86), and the HUD shows `getMyProfile.skillPoints` as a chip linking to `/skills` (WS84).

- **Red:** [`red.txt`](red.txt). `website/src/SkillTreePage.test.tsx` before the page existed: 29 of its 35 tests fail. The 6 that pass already held on the interim page: the locked, ready and not-found pages, the chip's absence while `skillPoints` is `null`, the tree read only on `/skills`, and the P95 copy check.
- **Green:** [`green.txt`](green.txt). The same file on the landed tree, verbose, 40 tests passing and none skipped: every red test with its assertions intact, plus the ones below. Between red and green, three of the shared `FeaturePages.test.tsx` cases for `/skills` moved here, since the page now follows its own read (the locked page with no nav item, the ready crate opening through `openFeature`, and the reveal ending on the tree with focus on its title), plus the current nav item.
- **Red, from the running app:** [`red-drawer-after-narrowing.txt`](red-drawer-after-narrowing.txt). A press on a wide screen left the drawer's open state set, so narrowing the window popped the drawer open by itself. The test now passes (38 in the file), fixed in `25bb6a4`.
- **Gate:** [`gate.txt`](gate.txt). `pnpm gate` through `fleet heavy` on the landed tree, after merging `origin/main` (#224) and the integration tip with #191: typecheck, 129 files and 2,028 tests, `coherence spec --check` with 0 problems, and `coherence lexicon --check` with 0 unknown nouns. Landing second, this ticket also removed the interim open-feature page that neither `/skills` nor `/book` uses any more.
- **Review:** [`review-gpt-6.1-sol.md`](review-gpt-6.1-sol.md). One round of GPT-6.1 Sol (high), read-only, with the spec as the oracle. Its three minor findings held and are fixed: the drawer's focus return through `finalFocus`, the first-load selection kept once chosen, and the live shell's fake asserting the query asked for. Reds in [`red-review.txt`](red-review.txt).

## Running app

A disposable local backend on ports 5910 (cloud) and 5911 (site), storage under `/tmp`, never the shared 3210 and never a cloud deployment. The mock Slack issuer and flag server ran on 5912 with `MOCK_FLAGS_ON=xp-levels,unlocks,skill-tree`, a local override on this backend only; `website` is on in the mock by default. Juno was imported as a member, unlocks were launched from the shell for an unknown user the way App Home's first open would (P77 opened the shipped Skill tree for Juno), and Juno signed in through the real Convex Auth handshake in the T3 preview browser. Each later state is a `convex import` of `perksOwned` and `memberProgress` rows; the open page followed each change through its subscription.

| State | Light | Dark |
|---|---|---|
| 1,000 XP (level 6), 2 points, nothing owned, wide: Spark selected on first load, its details beside the tree with `Buy it in Slack's App Home.` | [light](1-points-nothing-owned-wide-light.png) | [dark](1-points-nothing-owned-wide-dark.png) |
| Spark owned (1 point left), Spark selected: `Owned since 13 Oct 2026`, Your perks lists it, the chip reads 1 | [light](2-spark-owned-wide-light.png) | [dark](2-spark-owned-wide-dark.png) |
| Spark and Rhythm owned, no points left, Circle selected: its reason, the header's `No skill points to spend`, the chip reads 0 | [light](3-no-points-left-wide-light.png) | [dark](3-no-points-left-wide-dark.png) |
| The same on a phone (390 px): Circle's details in the drawer | [light](4-no-points-left-narrow-drawer-light.png) | [dark](4-no-points-left-narrow-drawer-dark.png) |
| The HUD's chip on the home, beside the open Skill tree card | [light](5-hud-chip-home-light.png) | [dark](5-hud-chip-home-dark.png) |

## V24 manual pass

- **Focus order** on `/skills` (Tab from the page): the wordmark, Home, Skill tree, the chip (`0 skill points to spend`), the theme control, the account menu, then Spark and Rhythm in the tree. Every stop matched `:focus-visible`. Enter on Rhythm selected it, and its details took its name.
- **Drawer:** on the phone width, Esc closed Circle's drawer and focus returned to the Circle node with a visible focus ring (`document.activeElement` read in the running page).
- **Not by colour alone:** an owned node has a filled icon, a check mark and the word `Owned`; an unavailable one a dashed muted icon with a lock; the selected one a primary ring and the word `Selected`. Each node's accessible name says its state.
- **Reduced motion:** the page has no motion of its own: no count-ups, bursts or transitions on the nodes (V8, V9). The preview can't emulate `prefers-reduced-motion`, so the drawer's own slide is Quill's.
- **Screen-reader wording:** the nodes read `Spark. Can buy. Costs 1 skill point.`, `Spark. Owned.` and `Circle. No skill points to spend. Costs 1 skill point.`, with `pressed` on the selection; the chip reads `2 skill points to spend`, `1 skill point to spend` and `0 skill points to spend`.
- **Non-text contrast (by eye, since axe skips it):** node borders, the owned icon fill, the primary ring and the check and lock marks stand clear of the card in both modes. The skill point glyph is decorative beside its number.
