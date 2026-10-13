# PROTOTYPE: Kudos website UI

Throwaway UI prototype for [#62](https://github.com/Silthus/kudos/issues/62) on map [#57](https://github.com/Silthus/kudos/issues/57). It lives on the `prototype/website-ui` branch and is never merged.

**Question:** what should the Kudos website look and feel like, in the PostHog brand, in light and dark mode?

- **Published:** <https://earnest-ibis-715.convex.site> (Convex static hosting, project `kudos-website-prototype`, prototype-only).
- **Round 5 (current, `?v=E`, the default):** round 4's combined variant with Michael's notes applied:
  - the skill tree as three deep WoW-style talent trees
  - stickers and achievements as one book, laid out like WoW's achievement window, with Panini-style team albums
  - gear (hedgehog, title, quips, kudos emoji) equipped on the profile from an inventory, with cards dropped
  - a leaderboard restyled to match, with the three boards as the main switch
- **Round 4:** variant E combined B's character sheet, C's front-page leaderboard, A's Max line and D's command palette. It added the deep-link moments (`#/landing/level-up`, `achievement`, `discovery`, `hedgehog`, `kudos`, `app-home`) and collectable hedgehogs.
- **Round 3:** variants A (dashboard), B (character sheet), C (zine) and D (terminal), still in the floating switcher (←/→).
- **Round 2** (`?v=0`): one calm layout in the PostHog app's shape, built on PostHog's own libraries:
  - [`@posthog/quill`](https://www.npmjs.com/package/@posthog/quill), PostHog's unified design system (base-ui and Tailwind v4). LemonUI isn't published as a package; Quill is the published library from the same repo.
  - `@posthog/icons` for every icon, and the official hedgehogs from `@posthog/brand/hoggies`.
  - The WoW rarity colours only on rarities (`<Rarity />`, P35).
- **Screens:** profile, skill tree and perks, sticker book and albums, achievements, collection and loadout, leaderboard, and the deep-link landing (`#/landing/kudos`, `level-up`, `achievement`, `app-home`).
- **Sign-in** is a fake "Sign in with Slack". Sign out at the bottom of the left nav, then open a deep link to see it carry you through.

## Run it

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm deploy     # convex deploy + upload the static build (needs the Convex CLI login)
```

## What is fake

- All data is mock facts in `src/data/mock.ts`, shaped like the progression and groups specs. The site computes no game rules.
- Buttons that would act (buy, equip, switch on) only change local state.
