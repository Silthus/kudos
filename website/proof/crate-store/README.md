# #469: buy and open coin-bought crates on the Collection page

Map #57, on `main` after #465's contract (PR #512) and #468's crest beat (PR #511). The Collection page sells a crate for coins, lists the crates a member bought until they open them, and plays the full loot-box reveal on Open. A bought crate has a deep link, `/book/collection?crate=bought:{n}`.

## What it does

- **Buy.** While `getCollection` carries `crateStore`, the Crates section offers `Buy a crate · 50 coins` beside `Your next crate`. Short of coins, the button is held with the inventory's `{n} more coins to go` hint and stays focusable. A press sends `buyCrate { next }` once over HTTP (#289's `useSentOnce`) with the offer's `next`; while it is out the button reads `Buying…`. The answers: `bought` says `You bought a crate.` and moves focus to the new crate's Open once the read lists it; `stale` says `The offer changed. Try again.` and the button re-offers with the read's fresh `next`; `no-coins` and `coins-not-open` say why; null and every denial say `That couldn't be bought right now.`; a failed send says `Couldn't reach HedgeHug. Try again.`. The header's coins chip counts down from the read.
- **Open.** Each crate in `bought` waits under `Waiting to open` as `Crate {n}` with Open. The first Open is primary and Buy turns outline while any crate waits. Open sends `openCrate { crate }` once, reads `Opening…`, then plays the reveal labelled `A crate you bought`: the crate charges, the hoggie card bursts out with its rarity and `New!` or its copy count, the crest card lands after it when the drop completes a team, and the finish reads `You found {name}` with Done. The announcement says `You opened a crate you bought. You found an uncommon Scientist.` Bought crates stay out of the ready pill.
- **Deep links.** `{ page: "bookCollection", crate: { kind: "bought", n } }` through `websiteLinkOf` gives `/book/collection?crate=bought%3A{n}`, and `{ page: "bookCollection", crate: "store" }` gives `/book/collection?crate=store`. The router reads both back through the same `crateTargetIn`, scrolls to the crate or the offer, focuses its Open or Buy and never opens or buys; a crate already opened, a missing offer or a broken target leaves the plain page. A bought number that isn't a safe positive integer is dropped on both sides.

## Fixture build, `VITE_SHELL_FIXTURE=member-with-the-crate-store`

| What | File |
| --- | --- |
| The Collection with two crates waiting and the offer, 1280 light | `1-collection-store-1280-light.png` |
| The same in dark | `2-collection-store-1280-dark.png` |
| The Crates section at 390 px | `3-collection-store-390-light.png` |
| After Buy: `You bought a crate.` | `4-bought-notice-1280-light.png` |
| The reveal's finish: `You found Scientist` with the card | `5-reveal-found-1280-light.png` |
| Buy → Open → the reveal → Done, recorded | `6-buy-then-open-1280-light.mp4` |
| The reveal's finish in dark | `7-reveal-found-1280-dark.png` |

## Sandbox, `different-dog-467`, read-only

The sandbox runs the ship head (#466) and was not deployed. This branch's build was pointed at the sandbox deployment (`VITE_CONVEX_URL`), served locally, and signed in as the synthetic member Cy (`U0PRF350CYP`) through one appended six-hour `authRefreshTokens` row for Cy's existing session, as #468 did; nothing wrote a store row. Cy holds 20 coins and an opened `bought:1`, so the real `getCollection` answers `bought: []` and `crateStore: { price: 50, next: 2 }` (`sandbox-getCollection-cy.json`), and the page shows the offer held with `30 more coins to go`.

| What | File |
| --- | --- |
| Cy's Collection from the real read: the offer, held short | `8-sandbox-collection-cy-short-1280-light.png` |

## Tests

- `red-router.txt`, `red-link.txt`: the bought target before the routes and the link validator knew it.
- `red-buy.txt`: the store's Buy tests before the Crates section existed.
- `green-buy.txt`, `green-open-and-deep-link.txt`: the final `crateStore.test.tsx` and `deepLinkTargets.test.tsx`.
- `red-on-main.txt`: the final test files run against `main` at the branch's base.
- `gate.txt`: `pnpm gate` under `fleet heavy` on the landed tree.

## Refutations

Both website commands were already covered by the WebsiteReads invariants **a website command never launches unlocks** and **a website command is a D17 command**. Two breaks, each staged alone in `convex/website/commands.ts` and restored byte for byte: dropping `noLaunchWaitsFor` from `buyCrate` and `openCrate` turned the two bought-crate launch tests red; dropping `openCrate`'s App Home republish turned the CL27 rows-and-republish test red. The runs are `07-refute-step1.txt` (green before), `08-refute-step3.txt` and `10-refute-d17.txt` (red), `09-refute-step5.txt` and the end of `10-refute-d17.txt` (green after).

## Review

GPT-6.1 Sol (high, `codex exec --sandbox read-only`) over the diff against `main` with the ticket, map #1's contract, both website specs and the visual language as the oracle. `review-round-1.md`: four minor findings, all taken (a bought crate is never marked seen; the status region lives outside the offer; a bought number is validated on both sides; axe and keyboard coverage for the store and the reveal). `review-final.md`: two partials, both taken (the live region stays while buying; `Number.isSafeInteger` on both sides). `review-final-2.md`: the final read of that commit and the `store` target.
