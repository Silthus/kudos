# PROTOTYPE: Kudos website UI

Throwaway UI prototype for [#62](https://github.com/Silthus/kudos/issues/62) on map [#57](https://github.com/Silthus/kudos/issues/57). It lives on the `prototype/website-ui` branch and is never merged.

**Question:** what should the Kudos website look and feel like, in the PostHog brand, in light and dark mode?

- **Published:** <https://earnest-ibis-715.convex.site> (Convex static hosting, project `kudos-website-prototype`, prototype-only).
- **Three shells**, switchable with the floating bar at the bottom or `?shell=A|B|C`:
  - **A · Desktop**: posthog.com's desktop metaphor, each screen opens as a window.
  - **B · App**: the PostHog app layout, a left sidebar and a breadcrumb bar.
  - **C · Notebook**: one long page, every screen is a chapter.
- **Screens:** profile, skill tree and perks (Tree or Cards layout), sticker book and albums, achievements, collection and loadout, leaderboard, and the deep-link landing (`#/landing/kudos`, `level-up`, `achievement`, `app-home`).
- **Sign-in** is a fake "Sign in with Slack". Sign out from shell B, then open a deep link to see it carry you through.

## Run it

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm deploy     # convex deploy + upload the static build (needs the Convex CLI login)
```

## What is fake

- All data is mock facts in `src/data/mock.ts`, shaped like the progression and groups specs. The site computes no game rules.
- The hedgehog ("Max") is an original placeholder drawing. PostHog's hoggies in `@posthog/brand` are licensed PolyForm Strict, so they are not used here.
- Fonts: IBM Plex Sans (as posthog.com) and Nunito as a free stand-in for PostHog's licensed RoundHog display face.
- Colours follow the PostHog palette. The WoW rarity colours appear only on rarities (`<Rarity />`, P35).
