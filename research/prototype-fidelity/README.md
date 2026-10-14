# HedgeHug prototype fidelity audit

The live website still lacks many accepted elements. The logo and favicon merged during this audit and are present in the final snapshot. This audit inventories every reachable variant-E screen, shared HUD element, panel, control, illustration and moment, and separates existing code, named upcoming work, confirmed cuts and uncovered omissions.

## Baseline and limits

- Ticket: [#259](https://github.com/Silthus/kudos/issues/259), under [map #57](https://github.com/Silthus/kudos/issues/57). Research only; no deployment and no edits to other tickets.
- Accepted prototype: `3409ade`, `prototype/website-ui`, live at <https://earnest-ibis-715.convex.site>. Variant E is the default. Shared `App`, `SignIn`, `Layout`, `ui`, fonts and mock data were traced through E's active screen registry. Inactive variants A–D and pre-round-9 shared mock entries are not active E elements.
- Initial comparison main: `763c147f81267d8c0581e4e0f2c0b4a9ab45855d`, fetched on 2026-10-14. Hero/ring #236 and teammate pictures #254 are already merged.
- Pinned slice 4: `a9a5e37b18be19d1ba442a075ce6e582efbef4ec`, `origin/spec/website-4`. Its skills, Book and buying count as **present in slice 4**, as #259 requests, but they are **not live** until ship #193. A source branch must not be mistaken for production. Its final fetched head is `97b85349acd249d9468f29481f7d500272de9ecb`; changes since a9a5e37 are proof files only, with no website source change.
- Final main refresh: `0130d82b724513348394bf7190d6aa38a6ad76e8` on 2026-10-14. The only application UI changes since the initial comparison are #258 branding; #254's image-host follow-up also landed. Classifications below include that refresh. Fresh final home/sign-in/closed screenshots and live head checks are below. [Final Frame](https://github.com/Silthus/kudos/blob/0130d82b724513348394bf7190d6aa38a6ad76e8/website/src/Frame.tsx), [BrandSays](https://github.com/Silthus/kudos/blob/0130d82b724513348394bf7190d6aa38a6ad76e8/website/src/BrandSays.tsx), [index.html](https://github.com/Silthus/kudos/blob/0130d82b724513348394bf7190d6aa38a6ad76e8/website/index.html).
- Browser evidence: T3 preview tools, `preview_snapshot(save=true)`. Main and slice 4 were built locally through Fleet and rendered from synthetic component fixtures, an explicitly allowed alternative to a local Convex backend. No backend was deployed, and no production login was performed. No production data, person photo or real member identity is in the screenshots. The prototype declares its names fictional and uses DiceBear drawings.
- Anonymous production HTML was read from <https://affable-bat-254.convex.site/>. It had no icon/theme-color links and referenced `/assets/index-Bn7hC8o0.js` and `/assets/index-DtegcrfP.css`. These static checks do not claim an authenticated end-to-end audit.
- The final anonymous live HTML contains all three icon links and both theme-color values. Anonymous GETs served all three icon files with HTTP 200; hashes/content types are in [source-evidence.json](source-evidence.json). This confirms the live document-head update without authenticating; #258 is closed. Initial comparisons retain the pre-logo state intentionally.
- Every outcome is scoped to the pinned comparison plus the explicitly verified final refresh. Runtime/backend completeness cannot be established from component fixtures. Mock prices, XP, thresholds and names are presentation examples, never production balance or usage numbers.

**Outcome definitions:** **present** means the element/function exists in pinned main or slice 4 (location stated); **coming** names a currently open ticket that actually builds it; **cut** cites a verbatim owner acceptance/decision and its precise scope below; **missing** means neither present nor promised by the named tickets. Missing backend facts mean missing/dependent, not cut. Functionally equivalent controls are present; material placement, imagery and wording differences get separate rows.

## Existing work that should not be duplicated

| Ticket | Baseline state | What it actually covers |
|---|---|---|
| #237 | Open | Stable home slots, locked/ready/open panels, Book/skills links. Explicitly leaves nav unchanged and excludes Inventory/Coins/Hedgehogs. |
| #238 | Open | Public-card label/look, personal quests on home, Everyone standing/neighbours. Explicitly excludes groups and profile medals. |
| #248 | Open | Recent received/given kudos card and safe message renderer. |
| #249 | Open | Activity tabs/timeline, loading, Received/Given and level-up marks. No standalone moment routes. |
| #250 | Open | Random public thank-you panel on leaderboard with Next. |
| #251 | Open | Sandbox proof of #248–#250, not another element implementation. |
| #193 | Open | Ship slice 4 skills, achievements Book and buying; does not implement albums, all perks or all moments. |
| #254 | Closed | Teammate Slack pictures and initials fallback, already in main. |
| #258 | Closed during audit | Now present in final main: HUD heart logo, logos on sign-in/closed, favicon assets, theme-color, titles. Its body incorrectly described the current prototype SignIn illustration as a heart; the actual file uses HandClasp. |

## Screenshots

Each comparison is **production-source fixture on the left**, **accepted E on the right**. Skills/Book left panels are labelled slice 4, not live. Full-resolution originals and URLs are in [screenshots.json](screenshots.json). Desktop was captured at 1440 × 1200; pairs are scaled only for comparison. Mobile samples are 390 × 844. Synthetic fixture values are illustrative and do not assert domain feasibility or backend behaviour.

| Surface | Light | Dark |
|---|---|---|
| Home, level 8 | ![Home, level 8, light](screenshots/compare-home8-light.png) | ![Home, level 8, dark](screenshots/compare-home8-dark.png) |
| Home, level 1 | ![Home, level 1, light](screenshots/compare-home1-light.png) | ![Home, level 1, dark](screenshots/compare-home1-dark.png) |
| Quests | ![Quests, light](screenshots/compare-quests-light.png) | ![Quests, dark](screenshots/compare-quests-dark.png) |
| Leaderboard | ![Leaderboard, light](screenshots/compare-leaderboard-light.png) | ![Leaderboard, dark](screenshots/compare-leaderboard-dark.png) |
| Skill tree (slice 4) | ![Skill tree (slice 4), light](screenshots/compare-skills-light.png) | ![Skill tree (slice 4), dark](screenshots/compare-skills-dark.png) |
| Book overview (slice 4 compared with E overview) | ![Book overview (slice 4 compared with E overview), light](screenshots/compare-book-overview-light.png) | ![Book overview (slice 4 compared with E overview), dark](screenshots/compare-book-overview-dark.png) |
| Book ladder/category (slice 4) | ![Book ladder/category (slice 4), light](screenshots/compare-book-category-light.png) | ![Book ladder/category (slice 4), dark](screenshots/compare-book-category-dark.png) |
| Album absent from slice 4 Book | ![Album absent from slice 4 Book, light](screenshots/compare-book-album-light.png) | ![Album absent from slice 4 Book, dark](screenshots/compare-book-album-dark.png) |
| Inventory absent from home | ![Inventory absent from home, light](screenshots/compare-inventory-light.png) | ![Inventory absent from home, dark](screenshots/compare-inventory-dark.png) |
| Collection, current not-found versus shelf | ![Collection, current not-found versus shelf, light](screenshots/compare-collection-light.png) | ![Collection, current not-found versus shelf, dark](screenshots/compare-collection-dark.png) |
| Sign-in | ![Sign-in, light](screenshots/compare-sign-in-light.png) | ![Sign-in, dark](screenshots/compare-sign-in-dark.png) |
| Palette absent from HUD | ![Palette absent from HUD, light](screenshots/compare-palette-light.png) | ![Palette absent from HUD, dark](screenshots/compare-palette-dark.png) |
| Locked route (different features, same gate comparison) | ![Locked route (different features, same gate comparison), light](screenshots/compare-locked-light.png) | ![Locked route (different features, same gate comparison), dark](screenshots/compare-locked-dark.png) |
| Level-up landing, current not-found versus band | ![Level-up landing, current not-found versus band, light](screenshots/compare-moment-level-light.png) | ![Level-up landing, current not-found versus band, dark](screenshots/compare-moment-level-dark.png) |

Additional original captures: every other moment kind (achievement, kudos, hedgehog, quest, unlock and App Home), both themes; main ready cards/reveals and empty quests; slice 4 mobile skill drawer; prototype mobile Book selector. The picture support finding is source-verified with synthetic initials, deliberately not real photos.

## Final branding refresh

These locally built synthetic captures use final main `0130d82`, with the actual updated head and icon assets. The earlier comparison grid uses initial main `763c147`.

| Surface | Light | Dark |
|---|---|---|
| Final home/header | ![Final header light](screenshots/main-final-home8-light.png) | ![Final header dark](screenshots/main-final-home8-dark.png) |
| Final sign-in | ![Final sign-in light](screenshots/main-final-sign-in-light.png) | ![Final sign-in dark](screenshots/main-final-sign-in-dark.png) |
| Final closed page | ![Final closed light](screenshots/main-final-closed-light.png) | ![Final closed dark](screenshots/main-final-closed-dark.png) |

## Confirmed cuts and source discipline

The following quotes are the actual acceptance words recorded in the sources. They approve the stated scope, not arbitrary later spec omissions. A bare `WS`, `V` or `P` rule is insufficient to call an element cut.

- **D1, static pages and no loops.** Owner acceptance: **“yes to all, but feel free to widen the term team”** ([#63 round-2 record](https://github.com/Silthus/kudos/issues/63#issuecomment-6153172426)), followed by **“yes”** to the complete summary ([#63 handoff](https://github.com/Silthus/kudos/issues/63#issuecomment-6153367108)). The accepted summary explicitly says no infinite animation, ordinary pages static, moments once with Replay. #57's visual-language decision links this handoff. This supports dropping loops/count-ups, not dropping the moment pages themselves.
- **D2, neutral progress and body typography.** The same quoted acceptance covers primary only for next action/selection/you, RoundHog for display, and Inter for other text. It supports neutral rings/bars and Inter body/table text; it does not ban the brand logo or compact node shape.
- **D3, calm locks.** The same quoted summary acceptance covers lock + unlock level + one sentence + silhouette. It supports dropping locked-state climb/levels-to-go/blurred progress teasing; it does not justify removing a locked feature's nav/card wholesale.
- **D4, reveal/received-thanks presentation.** The same quoted summary acceptance specifies labelled full-screen unlock/quest crates and quiet giver/message-led kudos with no chest. It changes the reveal layout and kudos intensity; it does not remove reward information, standalone routes or every Claim label.
- **D5, company-source photos.** The round-2 record with **“yes to all, but feel free to widen the term team”** explicitly includes company cutout → Slack photo → initials, team crest/photo fallback and **member uploads dropped**. Team photos still need to appear; only user-upload controls are cut.
- **D6, round-9 game cut.** The accepted prototype was confirmed with **“Let's lock that design in.”** ([#62 handoff](https://github.com/Silthus/kudos/issues/62#issuecomment-6152903919)). The linked [round-9 decision record](https://github.com/Silthus/kudos/issues/62#issuecomment-6152588034) says, verbatim: **“Cut: boosters, group auras, drops, rarities, titles, quips, workday streaks, streak freezes.”** This last sentence is the decision record's wording, not a reconstructed owner utterance. Its explicit kept list includes coins, kudos emoji, hedgehogs, one skill tree, quests, Book and leaderboard. #57 records the same cut plus obsolete cosmetic cards. Do not extend it to gear, albums or moments.

Where the only direct quote is acceptance of a specific recorded summary, that limitation is explicit above. Nothing here fabricates an unrecorded utterance. If that acceptance evidence is judged insufficient for a particular styling cut, keep it in the owner's decision queue rather than treating an agent rule as authority.

The [catalogue case appendix](catalogue-cases.md) names every prototype hog, emoji, perk node, ladder emblem and category independently.

## Element inventory

### HUD, branding and responsive navigation

Prototype: [variants/e/Frame.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/Frame.tsx), [variants/e/hud.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/hud.tsx).

Comparison source: [Frame.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/Frame.tsx), [AccountMenu.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/AccountMenu.tsx), [ThemeControl.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/ThemeControl.tsx), [LeveledFace.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/LeveledFace.tsx), [features.ts](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/features.ts).

| ID | Visible element / state | Outcome | Evidence, gap or next work |
|---|---|---|---|
| E001 | Sticky translucent top bar and centred 1152 px frame | **present** | Main Frame retains the sticky bar, blur, border, and max width. |
| E002 | 34 px HedgehogHeart beside the wordmark | **present** | #258 merged during the audit, in final main 0130d82. V17 was wrongly used to cut the brand mark in #231; fresh final screenshots verify the restored logo. |
| E003 | HedgeHug display wordmark and Thanks a Hog subtitle | **present** | Main Wordmark retains both strings and RoundHog display type. |
| E004 | Home/profile link on the brand | **present** | Main links to /; prototype uses #/profile. Real paths are the accepted architecture. |
| E005 | Profile navigation label and IconUser | **missing** | Main says Home with IconHome. Decide whether to retain Home or port the prototype label/icon. Call C1; group F1. |
| E006 | Open Quests and Leaderboard links/icons | **present** | Main ScreenNav lists both while their features are open. |
| E007 | Open Book and Skill tree links/icons | **present** | Slice 4 Frame/features provide both; delivery still waits on #193. |
| E008 | Collection navigation link/icon | **missing** | No collection route or registered page. F7; P78/WS59 are gating, not a product cut. |
| E009 | Locked nav entries with lock icon and level tooltip | **missing** | Main and slice 4 omit them. Cut only by WS59/P78/V23 in #231. Call C1; F1. |
| E010 | Next-unlock Lv N badge and stronger next entry | **missing** | No counterpart in ScreenNav. Call C1; F1. |
| E011 | Ready nav entries with crate icon opening their own crate | **missing** | Only the HUD pill exposes readiness; ready nav entries are absent. WS59. Call C1; F1. |
| E012 | Desktop icon-only nav at intermediate widths | **missing** | Prototype hides labels below xl; main always prints them. Port responsive nav in F1. |
| E013 | Mobile horizontal nav rail and selected round pill | **missing** | Main reorders ordinary links but has no overflow rail or mobile pill style. Slice 4 is 422 px wide at a 390 px viewport. F1. |
| E014 | Current desktop page underline | **present** | Frame ScreenLink uses aria-current and primary underline. |
| E015 | Cmd/Ctrl K dashed chip and shortcut | **missing** | No palette or key listener in main/slice 4. WS16 alone was the cut. Call C2; F2. |
| E016 | Skill point glyph/count/link chip | **present** | Slice 4 Frame supplies SkillPointChip; #193 is still open. |
| E017 | Coin glyph/count chip and earning tooltip | **missing** | Neither main nor slice 4 carries a coin balance. Backend prerequisite is map #1 coins. F6; Call C4 if permanently omitted. |
| E018 | Ready pill with crate glyph and singular/plural count | **present** | Main ReadyPill counts feature, Journey and quest crates. Wording is n ready rather than n unlocks ready, because its scope grew. |
| E019 | Ready pill opening the first ready crate | **present** | Main MomentsProvider and ReadyPill connect to the existing open command. |
| E020 | Equipped hedgehog in the HUD avatar | **missing** | Main/slice 4 MemberFace shows the person or initials, not the equipped hog. F4; V20/P78 never cut it. Call C4. |
| E021 | Avatar level badge and XP ring | **present** | Main LeveledFace renders the level badge and filled neutral progress ring. |
| E022 | Avatar link returning to the profile | **missing** | Main avatar opens AccountMenu instead. Separate Sign out lives in that menu. Call C1; F1. |
| E023 | Theme control and persisted light/dark choice | **present** | Main adds a system choice to the prototype's binary toggle and persists it. |
| E024 | Separate desktop Sign out icon | **missing** | Sign-out action exists in AccountMenu, but its separate IconLeave button does not. Call C1; F1. |
| E025 | Newly opened nav/resource pop-in | **missing** | Main has no PopIn/justOpened equivalent. One-off motion is allowed, not required to vanish by V9. Call C11; F1. |
| E026 | Header's subtle bottom shadow | **missing** | Prototype shadow is absent from main Frame. Small visual port in F1. |
| E027 | HUD page background gradients in both themes | **present** | Main index.css ports both hud-root gradients. |
| E028 | Corner marks and uppercase panel labels | **present** | Main index.css ports hud-panel and hud-label. Placement on reading cards was later narrowed by accepted V2. |
| E029 | Light/dark surfaces, border and foreground tokens | **present** | Both use Quill tokens; synthetic screenshots verify both themes. |
| E030 | Inter text and RoundHog display font | **present** | Main bundles Inter Variable and RoundHog locally; prototype fetches Inter remotely. |
| E031 | Ordinary page count-ups, animated fills and ring sweeps | **cut** | D1: accepted static-page motion decision. Keep actual values visible without animation. |
| E032 | Looping glow, XP shimmer and closed-crate wobble | **cut** | D1: accepted no-infinite-animation decision. Production uses a one-off crate nudge. |
| E033 | Primary-coloured progress ring and resource emphasis | **cut** | D2: accepted primary-only-for-action/selection/you decision; production progress is neutral. |

### Document head and sign-in

Prototype: [App.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/App.tsx), [SignIn.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/SignIn.tsx), [Layout.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/Layout.tsx).

Comparison source: [PageTitle.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/PageTitle.tsx), [pages/SignedOutPage.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/pages/SignedOutPage.tsx), [pages/ClosedPage.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/pages/ClosedPage.tsx), [Max.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/Max.tsx).

| ID | Visible element / state | Outcome | Evidence, gap or next work |
|---|---|---|---|
| E034 | UTF-8 and responsive viewport meta | **present** | Both index.html files have them. |
| E035 | HedgeHug · page document titles | **present** | Main PageTitle updates all implemented pages; slice 4 adds Skill tree and Book. No per-moment title exists until those routes exist. |
| E036 | SVG/PNG favicon and apple-touch icon | **present** | #258 merged into final main 0130d82; anonymous live HTML now names all three icons. The prototype never had a favicon: this is a requested addition. |
| E037 | Light and dark theme-color meta | **present** | #258 merged into final main 0130d82; both media-scoped values are present in anonymous live HTML. |
| E038 | Meta description and social preview metadata | **missing** | Absent from both heads. Additional metadata, not prototype regression; do not create a port ticket unless desired. F0 optional. |
| E039 | 112 px HedgehogHandClasp sign-in illustration | **missing** | Actual prototype SignIn uses HandClasp, not HedgehogHeart. Initial main used MaxSays/HedgehogTownCrier; final main 0130d82 uses a 112 px heart logo. #258 does not port the exact HandClasp illustration. Call C3; F3. |
| E040 | Centred, narrow sign-in card without signed-in frame | **missing** | Prototype has a standalone max-w-sm card. Main signs out inside Frame/MaxSays. Call C3; F3. |
| E041 | HedgeHug and Thanks a Hog inside the sign-in surface | **present** | Final main 0130d82 BrandSays shows both beneath the heart logo on sign-in/closed pages. Standalone card/layout fidelity still needs F3. |
| E042 | Sign in with Slack button and four-colour Slack glyph | **present** | Main SignedOutPage retains the action and glyph. |
| E043 | Full-width large sign-in button | **missing** | Prototype uses w-full; main MaxSays renders a content-width action. F3. |
| E044 | Sign-in copy naming levels, perks, stickers and achievements | **missing** | Main says See your kudos. Requires shipped-feature-aware copy, not a fabricated claim. Call C3; F3. |
| E045 | Workspace-members-only sign-in sentence | **present** | Main retains the same audience restriction. |
| E046 | Deep-link destination retained through sign-in | **present** | Production uses signIn(returnTo), route and code-redemption machinery; this replaces the fake prototype transition. |
| E047 | Visible You will land on /destination afterwards hint | **missing** | Prototype prints the destination; main does not. Call C3; F3. |
| E048 | Theme toggle at sign-in page top right | **present** | Theme choice exists in Frame; exact standalone placement belongs to F3. |
| E049 | Prototype no-real-sign-in footer | **missing** | A prototype-only label, not production copy. No direct removal decision quoted; Call C12 recommends excluding it from production. |
| E050 | Prototype variant switcher, arrows and E · Combined badge | **missing** | Fixture tooling only. No direct product-owner cut quoted. Call C12 recommends retaining only in research tools. |
| E051 | Preview level slider, minus/plus and mock-level note | **missing** | Fixture tooling only. No direct product-owner cut quoted. Call C12 recommends excluding from production. |

### Home hero and public-card rail

Prototype: [variants/e/Profile.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/Profile.tsx), [variants/e/profile-card.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/profile-card.tsx), [variants/e/profile-locked.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/profile-locked.tsx), [variants/e/profile-standing.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/profile-standing.tsx), [variants/e/quests-card.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/quests-card.tsx).

Comparison source: [pages/HomePage.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/pages/HomePage.tsx), [home/Hero.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/home/Hero.tsx), [home/ProfileCardPanel.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/home/ProfileCardPanel.tsx), [home/FeatureCards.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/home/FeatureCards.tsx).

| ID | Visible element / state | Outcome | Evidence, gap or next work |
|---|---|---|---|
| E052 | Two-column sheet with persistent main and right-rail slots | **coming** | #237 restores per-feature placement; current Journey/cards sit full width beneath the hero/card pair. |
| E053 | 168 px hog portrait with shadow and hog name | **missing** | Main has a 128 px person face/initials and no hog name. F4; Call C4. Source and current availability are separate questions. |
| E054 | Change gear link scrolling to the character panel | **missing** | No gear panel or link. F5. |
| E055 | 120 px level ring with Level label and number | **present** | Main HeroRing has both at the prototype size, with neutral ink. |
| E056 | Character label and large member-name title | **present** | Main Hero is the already-merged #236 implementation. |
| E057 | Primary group/team name below the member name | **missing** | No group display field is rendered. #237/#238 explicitly exclude it. F8; Call C4/P78. |
| E058 | Full-width XP bar, current XP and XP to next level | **present** | Main XpBar renders all three from Progression. |
| E059 | Allowance label, left/base display, one pip per allowance | **present** | Main KudosLeftToday supplies each part. |
| E060 | Refill-at-midnight/time note | **present** | Main renders the server-provided refillsAt as a local time rather than the prototype's fixed phrase. |
| E061 | Lifetime kudos given/received sentence | **present** | Main renders the exact pattern from lifetime totals; it is private. |
| E062 | Spend skill points action in the hero | **coming** | #237 puts the actionable count/link in the Skill tree panel instead of the hero. The action is covered; exact placement is a Call C5 choice. |
| E063 | First-kudos teaching panel and message icon | **missing** | Main teaches in the hero and Journey, but has no standalone FirstKudosNudge. WS17/WS72/V4 were the cut. Call C5; F3/F5. |
| E064 | Prototype's borderless hero spacing | **missing** | Main wraps the hero in a padded, bordered hud-panel. No explicit decision to preserve this shape rather than E's open header. Call C5; F3. |
| E065 | Inventory locked/ready card occupying the main slot | **missing** | #237 excludes unshipped Inventory. The accepted prototype reserves the slot. F5; Call C4/WS102. |
| E066 | What teammates see heading and Public tag | **coming** | #238 supplies these; current main says Your profile card. |
| E067 | Raised/gradient profile-card container | **coming** | #238 specifies the raised card. Its precise gradient/shadow can be ported from profile-card.tsx. |
| E068 | Large equipped hog inside profile card | **missing** | #238 keeps the person face only. F4/F8; Call C4. |
| E069 | Member name and visible level on profile card | **present** | Main shows both; styling changes remain in #238. |
| E070 | Primary group label on profile card | **missing** | #238 excludes it until groups exist. F8; Call C4. |
| E071 | Best four achievement-tier medals on profile card | **missing** | Neither main nor slice 4 adds them. Requires the public-card contract, not another member's private Book. F8; Call C4/WS93. |
| E072 | Public/private explanatory profile-card sentence | **coming** | #238 replaces the main note. XP/received remain private; coins/perks wording needs their facts later. |
| E073 | Quests this week checklist, neutral progress, weekly note | **coming** | #238 covers personal quest goals/progress and Monday wording. |
| E074 | Claimable quest highlighted on home with a Claim link | **missing** | #238 substitutes Reward ready and omits prototype Claim treatment. Call C6/V13; F9. |
| E075 | Group quest row and IconPeople in home checklist | **missing** | #238 covers personal slots only. F10; unshipped is not cut. |
| E076 | New-unlock bonus quest row in home checklist | **missing** | No bonus facts in the existing read or #238. F11. |
| E077 | See all quests link | **coming** | #238. |
| E078 | Where you stand heading, This week and Everyone row | **coming** | #238 covers the Everyone rank, tie and state copy. |
| E079 | Faces/counts above, at and below you in Everyone row | **coming** | #238 specifies each neighbour, viewer marking and accessible text. |
| E080 | My group and Groups standing rows | **missing** | #238 excludes them. F12; Call C4/G45/P78. |
| E081 | Standing change arrows and gain/loss since last week | **missing** | #238 has no comparison read. F12; Call C7, not a cut based on missing data. |
| E082 | Standing row chevrons and Open the leaderboard link | **coming** | #238 covers the actionable row and link, though only Everyone exists. |
| E083 | Hidden-from-boards note while group still ranks | **missing** | Main handles left on Everyone; no home group note. F12. |
| E084 | Locked feature illustrations, names and unlock levels | **present** | Main FeatureCards already has these; #237 changes placement and badge treatment. |
| E085 | Lock badge over each home teaser's hog | **coming** | #237 specifies the badge; current main puts IconLock in the text row. |
| E086 | Ready feature crate in its stable sheet position | **coming** | #237 changes current grouped crates into in-place feature panels. |
| E087 | Levels-to-go sentence on locked home cards | **cut** | D3: the accepted locked-state summary is calm, one sentence and silhouette, not progress pressure. |
| E088 | Book and Skill tree open-panel links | **coming** | #237 and #193; prototype's literal home has Inventory instead, so these are additional planned slots. |
| E089 | Journey chain on home | **present** | An accepted addition absent from E; #62 explicitly says Journey is not cut. Main JourneyPanel is implemented. |
| E090 | Recent received/given kudos card | **coming** | #248. Additional product-owner requirement, not in E; #249 later adds its Activity links. |
| E091 | Activity tab and infinite-scroll timeline | **coming** | #249, then #251's proof. It is not a substitute for missing standalone moment pages. |

### Character panel and slot picker

Prototype: [variants/e/gear-character.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/gear-character.tsx), [variants/e/gear-picker.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/gear-picker.tsx), [variants/e/gear-sheet.ts](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/gear-sheet.ts), [variants/e/gear-turn.ts](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/gear-turn.ts).

Comparison source: [pages/HomePage.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/pages/HomePage.tsx), [home/FeatureCards.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/home/FeatureCards.tsx).

| ID | Visible element / state | Outcome | Evidence, gap or next work |
|---|---|---|---|
| E092 | Character · 4 slots panel and game-object corner marks | **missing** | F5; no counterpart in main/slice 4. |
| E093 | Character/Inventory two-sided toggle with icons | **missing** | F5; no Gear side control. |
| E094 | One-off panel swirl/flip transition | **missing** | F5. Allowed one-off motion, with reduced-motion alternative; not a loop. |
| E095 | Centre portrait stage with hog, member name and equipped emoji | **missing** | F5; port Portrait and gear-sheet layout. |
| E096 | Hedgehog slot with its icon, art and name | **missing** | F5; depends on F4 avatar facts/commands. |
| E097 | Emoji slot 1 with label, glyph and name | **missing** | F5; depends on ownership/equipment facts. |
| E098 | Emoji slot 2 with label, glyph and name | **missing** | F5. |
| E099 | Emoji slot 3 with label, glyph and name | **missing** | F5. |
| E100 | Empty slot dashed outline and Empty label | **missing** | F5; port GearSlot's empty state. |
| E101 | Selected slot ring and choosing state | **missing** | F5; keep non-colour selection signal as accepted accessibility requires. |
| E102 | Centre-stage picker filtered to one slot kind | **missing** | F5; port SlotPicker, not the in-memory game store. |
| E103 | Choose for slot heading and item-kind icon | **missing** | F5. |
| E104 | Owned-item picker tiles and current check | **missing** | F5. |
| E105 | Other-slot number on emoji already worn elsewhere | **missing** | F5; command/read must define the move/swap. |
| E106 | Take off, Done and Escape-to-cancel controls | **missing** | F5; preserve keyboard focus and command semantics. |
| E107 | Equip returning the centre stage to portrait | **missing** | F5. |
| E108 | Equip burst/pop confirmation and instruction line | **missing** | F5; one-off, with reduced motion. |
| E109 | More hedgehogs at level 7 locked explanation | **missing** | F5; gate from backend facts, not a copied constant. |

### Inventory side and purchases

Prototype: [variants/e/gear-bag.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/gear-bag.tsx), [variants/e/gear-inventory.ts](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/gear-inventory.ts), [variants/e/gear-items.ts](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/gear-items.ts), [variants/e/hedgehogs.ts](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/hedgehogs.ts).

Comparison source: [pages/HomePage.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/pages/HomePage.tsx).

| ID | Visible element / state | Outcome | Evidence, gap or next work |
|---|---|---|---|
| E110 | Inventory heading and calm equip-in-place instruction | **missing** | F6. |
| E111 | Polite live equip/unequip confirmation | **missing** | F6. |
| E112 | Inventory coin balance with coin glyph | **missing** | F6; coins prerequisite. |
| E113 | Hedgehogs section with kind icon and explainer | **missing** | F6. |
| E114 | Kudos emoji section with kind icon and explainer | **missing** | F6. |
| E115 | Equipped n/1 and n/3 counts | **missing** | F6; use authoritative equipped facts. |
| E116 | Owned item art/glyph tiles and names | **missing** | F6. |
| E117 | Equipped tile fill, check and emoji slot number | **missing** | F6. |
| E118 | Click worn emoji to take it off | **missing** | F6. |
| E119 | Choosing new emoji into an empty or replacement slot | **missing** | F6; do not port mock LRU rules without domain contract. |
| E120 | Not yours yet section and dashed rows | **missing** | F6. |
| E121 | Unowned item art/name and how-to-earn text | **missing** | F6; sourceLabel/howToGet are presentation templates only. |
| E122 | Store price/coin-glyph buy buttons | **missing** | F6; no cosmetic-buy entrance in current website. |
| E123 | Insufficient-coins disabled button and shortfall hint | **missing** | F6. |
| E124 | Purchase reveals owned item without a crate | **missing** | F6; respect accepted V13, purchase is not a reward crate. |
| E125 | Every hedgehog on the shelf link | **missing** | F6 after F7 collection. |
| E126 | Inventory remains on its side when equipping | **missing** | F6; explicit accepted prototype interaction. |

### Hedgehog collection

Prototype: [variants/e/Collection.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/Collection.tsx), [variants/e/collection-hedgehogs.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/collection-hedgehogs.tsx), [variants/e/hedgehogs.ts](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/hedgehogs.ts).

Comparison source: [route.ts](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/route.ts), [features.ts](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/features.ts).

| ID | Visible element / state | Outcome | Evidence, gap or next work |
|---|---|---|---|
| E127 | Collection page and Hedgehogs display title | **missing** | F7. /collection is not found in main/slice 4. |
| E128 | Owned-of-catalogue count | **missing** | F7; count from catalogue/ownership facts. |
| E129 | Avatar-explainer sentence and neutrality of kudos value | **missing** | F7. |
| E130 | Coin resource chip on collection | **missing** | F7 after F6. |
| E131 | Responsive 2/3/4-column hedgehog shelf | **missing** | F7. |
| E132 | Every collectable's named art and source line | **missing** | F7; catalogue IDs/prices from backend, not prototype mock values. |
| E133 | Unowned earned hog silhouette and lock icon | **missing** | F7. |
| E134 | Equipped primary ring and disabled Equipped check-button | **missing** | F7. |
| E135 | Owned-hog Equip action | **missing** | F7. |
| E136 | Store-hog Buy for n coins action | **missing** | F7. |
| E137 | Shortfall sentence and unavailable purchase state | **missing** | F7. |
| E138 | One-off purchase reveal on shelf tile | **missing** | F7, honours reduced motion. |
| E139 | Kudos emoji live in your inventory link | **missing** | F7. |
| E140 | Twelve prototype hog entries and five source kinds | **missing** | F7: starter, level, achievement, quest and store are visible presentation cases. Do not freeze the mock catalogue as production balance. |

### Leaderboard boards, rows and sidebar

Prototype: [variants/e/Leaderboard.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/Leaderboard.tsx), [variants/e/leaderboard-list.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/leaderboard-list.tsx), [variants/e/leaderboard-podium.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/leaderboard-podium.tsx), [variants/e/leaderboard-faces.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/leaderboard-faces.tsx), [variants/e/leaderboard-story.ts](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/leaderboard-story.ts).

Comparison source: [pages/LeaderboardPage.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/pages/LeaderboardPage.tsx), [leaderboard/BoardCard.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/leaderboard/BoardCard.tsx), [leaderboard/BoardList.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/leaderboard/BoardList.tsx), [leaderboard/Podium.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/leaderboard/Podium.tsx), [leaderboard/SidePanels.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/leaderboard/SidePanels.tsx), [leaderboard/WholeBoard.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/leaderboard/WholeBoard.tsx).

| ID | Visible element / state | Outcome | Evidence, gap or next work |
|---|---|---|---|
| E141 | Leaderboard · kudos given label | **present** | Main retains it. |
| E142 | This week, This month and All time period switch | **present** | Main PeriodSwitch with URL period. |
| E143 | Everyone board card, icon, blurb and standing | **present** | Main BoardCard renders the single available board. |
| E144 | Groups board card with per-person standing | **missing** | F12; no group board read/page in main/slice 4. P78/G45 is not a cut. |
| E145 | My group board card and its standing | **missing** | F12. |
| E146 | Three-card grid/tablist and My group default | **missing** | F12; current one-card page defaults to Everyone. |
| E147 | Board-specific headline and explanatory deck | **present** | Everyone story exists; group stories require F12. |
| E148 | Group-specific story, most-improved group and peer line | **missing** | F12; not in current web read. |
| E149 | Second/first/third podium order and stepped pedestals | **present** | Main Podium retains the arrangement and correctly levels ties. |
| E150 | Crown for first place and tie marks | **present** | Main Podium/RankWords retain both. |
| E151 | Names, values and kudos unit beneath podium faces | **present** | Main Podium. |
| E152 | Teammate picture on podium and row | **present** | #254 merged into pinned main. Synthetic screenshots deliberately use initials; source Face and leaderboardRowOf prove picture support/fallback. |
| E153 | Viewer's equipped hog on podium/rows | **missing** | F4; current viewer uses person face/initials. |
| E154 | Primary viewer ring and You tag | **present** | Main BoardFace/YouLabel use both. |
| E155 | Group hedgehog/team crests on podium and rows | **missing** | F12, using mapped-team facts rather than hard-coded names. |
| E156 | Group per-person score, participation bar and total | **missing** | F12. |
| E157 | Neutral ranked rows, padded ranks, tie signal and kudos values | **present** | Main BoardLine/BoardList preserve these. |
| E158 | Initial viewer-centred window and skipped-position marker | **present** | Main uses backend window with gap ellipsis. |
| E159 | Show 5 more above and Show 5 more below buttons | **missing** | Main jumps straight to whole board. WS43 describes only gap/window and whole. Call C7; F13. |
| E160 | Show the whole board, scrolling and Back to my spot | **present** | Main BoardList/WholeBoard. |
| E161 | Pinned off-screen viewer row with Jump to me | **present** | Main WholeBoard retains it with keyboard/focus support. |
| E162 | Only you see these improvement line | **present** | Main SidePanels uses the shared improvementLine. |
| E163 | Most improved group crest-card | **missing** | F12, no Groups private facts. |
| E164 | How it counts explanation | **present** | Main explains kudos-given ranking and privacy. |
| E165 | Mention of coins/achievements not ranking anyone | **missing** | Main omits coins/achievements in this sentence. F12/F6 when relevant; P78 alone is no cut. |
| E166 | Show me on the leaderboards interactive switch | **missing** | Main points to Settings in Slack. WS46 is a slice rule. Call C8; F13. |
| E167 | Off-the-board hidden face/private row treatment | **present** | Main ViewerLine represents a member who left the boards. Group variants need F12. |
| E168 | Random thank-you panel with Next | **coming** | #250, proven by #251. This was requested after E and is not a replacement for the group/board omissions. |
| E169 | Prototype large leaderboard headline scale | **missing** | Main PageTitle defaults to text-2xl instead of E's clamp to 3rem. F3. |

### Quest page, group/bonus quests and reward display

Prototype: [variants/e/Quests.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/Quests.tsx), [variants/e/quests-parts.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/quests-parts.tsx), [variants/e/quests-claim.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/quests-claim.tsx), [variants/e/quests-data.ts](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/quests-data.ts).

Comparison source: [pages/QuestsPage.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/pages/QuestsPage.tsx), [crates/RewardCrate.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/crates/RewardCrate.tsx), [crates/RevealDialog.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/crates/RevealDialog.tsx).

| ID | Visible element / state | Outcome | Evidence, gap or next work |
|---|---|---|---|
| E170 | Quests kicker and This week heading | **present** | Main has both; display size differs (F3). |
| E171 | Clock icon and Monday/reset statement | **present** | Main says New quests arrive every Monday, rather than the mocked countdown. |
| E172 | Three personal weekly quest cards | **present** | Main renders the supplied slots, including fewer slots if fewer are feasible. |
| E173 | Per-kind 64 px quest hog illustration | **missing** | Main quest cards have no hog. V17/WS73 alone were the exclusion in #231. Call C6; F9. |
| E174 | Quest kind, goal, neutral progress and done/target count | **present** | Main QuestCard/QuestProgress retain all parts. |
| E175 | Rerolled/Swapped tag | **present** | Main calls it Swapped, matching the actual command vocabulary. |
| E176 | Remaining-reroll icon/count in quest header | **missing** | No swap availability in the web answer. Call C8; F9. |
| E177 | Per-personal-quest Reroll/Swap button | **missing** | The action remains in Slack. WS73. Call C8; F9. |
| E178 | XP reward display | **present** | Main supplies XP before/after the crate opening. |
| E179 | Coin reward glyph/value | **missing** | Current rewards are XP-only. F6/F10; WS70/P78 gating is no permanent cut. |
| E180 | Emoji reward glyph/New emoji and hedgehog reward art/name | **missing** | Not in current quest web contract. F6/F7/F10. |
| E181 | Claim button, primary only for first claimable quest | **missing** | Main uses Open on a labelled crate instead. Crate behaviour is present, exact Claim action/placement is not. Call C6; F9. |
| E182 | Claimed check badge and dimmed finished card | **missing** | Main has Done; it does not retain prototype claimed-card dimming and per-card check on hog. F9. |
| E183 | In-place ClaimCrate replacing the quest-card contents | **cut** | D4: confirmed full-screen labelled reveals replace the in-place animation. Main already does the full-screen version. |
| E184 | Reward chips flying into the HUD after claim | **missing** | No flyToHud equivalent. One-off motion remains allowed. Call C11; F9. |
| E185 | Group quest heading and named primary group | **missing** | F10; accepted retained game feature, no current web read. |
| E186 | Group quest card/progress/reward | **missing** | F10. |
| E187 | Helper avatar row with contributor checks and muted nonhelpers | **missing** | F10, subject to Call C6: P82 forbids names; no direct decision quoted to remove this accepted UI. |
| E188 | Group participation count and shared-reward explanation | **missing** | F10; distinguish anonymous count from contributor identities. |
| E189 | Fresh-unlock bonus quest with New tag | **missing** | F11. |
| E190 | Bonus quest that persists until completed | **missing** | F11; authoritative persistence must be supplied by domain. |
| E191 | Bonus-quest feature link | **missing** | F11. |
| E192 | How quests work panel | **present** | Main retains a personal-quest explanation and Slack-swap direction. |
| E193 | How quests work group/chime-in/bonus sentences | **missing** | F10/F11 after their facts ship. |
| E194 | Quest-target deep links and scroll-to-quest | **missing** | Main /quests has no quest param/anchor targeting; prototype useScrollTo takes an ID. F9. |
| E195 | Unopened earlier-week reward cards and week labels | **present** | Production addition; Main WaitingToOpen covers it, not present in E. |

### Skill tree structure and purchase details

Prototype: [variants/e/Skills.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/Skills.tsx), [variants/e/skills-perks.ts](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/skills-perks.ts), [variants/e/skills-icons.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/skills-icons.tsx).

Comparison source: [pages/SkillTreePage.tsx](https://github.com/Silthus/kudos/blob/a9a5e37b18be19d1ba442a075ce6e582efbef4ec/website/src/pages/SkillTreePage.tsx), [skills/PerkTree.tsx](https://github.com/Silthus/kudos/blob/a9a5e37b18be19d1ba442a075ce6e582efbef4ec/website/src/skills/PerkTree.tsx), [skills/YourPerks.tsx](https://github.com/Silthus/kudos/blob/a9a5e37b18be19d1ba442a075ce6e582efbef4ec/website/src/skills/YourPerks.tsx), [skills/PerkDetails.tsx](https://github.com/Silthus/kudos/blob/a9a5e37b18be19d1ba442a075ce6e582efbef4ec/website/src/skills/PerkDetails.tsx).

| ID | Visible element / state | Outcome | Evidence, gap or next work |
|---|---|---|---|
| E196 | Perks title and Skill tree kicker | **present** | Slice 4 SkillTreePage; #193 delivery pending. Title is smaller than E (F3). |
| E197 | Owned-of-14 header count | **missing** | WS85/WS94 drop it. Call C9; F14. |
| E198 | Skill points to spend line | **present** | Slice 4 renders it. |
| E199 | Skill point, coin and LV resource chips on the page | **missing** | Only the HUD skill-point chip exists. Page chips/LV absent; coin fact not supplied. WS85/WS94. Call C9; F14. |
| E200 | Perk tree panel and level-5 rail | **present** | Slice 4 PerkTree. |
| E201 | Owned, Can buy, Upgraded, Locked legend | **missing** | No legend, including already-supported Owned/Can buy/Locked states. F14. |
| E202 | Compact square nodes with captions beneath | **missing** | Slice 4 uses large enclosing cards. F14; this is independent of unshipped perks. |
| E203 | Spark, Rhythm and Circle nodes/icons | **present** | All three shipped nodes are rendered by slice 4. |
| E204 | Level-7 Flame, Cadence, Bridge and Treasurer row | **missing** | F15; no later-row data. Accepted 14-perk design is not cut by WS85/P78. |
| E205 | Level-9 Focus, Echo, Reserve and Banker row | **missing** | F15. |
| E206 | Level-12 Spotlight, Resonance and Reservoir row | **missing** | F15. |
| E207 | Upgrade connector lines and downward arrows | **missing** | F15. |
| E208 | Neutral owned icons and check badges | **present** | Slice 4 PerkTree renders both. |
| E209 | Locked node lock badge and requirement reason | **present** | Slice 4 supports unavailable nodes and reasons for its returned rows. |
| E210 | Available-node primary border | **missing** | Slice 4 uses neutral border except selected node. V4/WS94 were the drop. Call C9; F14. |
| E211 | Visible selection ring/check or Selected label | **present** | Slice 4 improves E with Selected text and aria-pressed. |
| E212 | Cost chip with skill-point glyph | **present** | Slice 4 shows skill-point cost, though it lacks E's compact pill shape (F14). |
| E213 | Coin cost beside skill point cost | **missing** | F15 after coin-cost perks exist. |
| E214 | Replaced base ghosting and became-upgrade caption | **missing** | F15. |
| E215 | Absorbed base mini-icon on an owned upgrade | **missing** | F15. |
| E216 | Your perks ledger and empty explanation | **present** | Slice 4 YourPerks renders the owned entries and empty copy. |
| E217 | Your perks active count and Permanent always on note | **missing** | No header count/note. F14. |
| E218 | One active entry per chain with stacked Upgraded from base | **missing** | Slice 4 lists owned purchases, not an upgrade-aware ledger. F15. |
| E219 | Full effect in owned perk and detail sheet | **present** | Slice 4 uses authoritative qualifying-kudos copy, not prototype mock balance. |
| E220 | Prototype exact perk effect strings | **missing** | Changed by P94/P95/WS86; no direct product-owner quote here settles every balance/copy change. Call C9: use domain-approved copy, never copy stale mock rules. |
| E221 | Sticky desktop detail sheet | **present** | Slice 4 PerkDetailsPanel. |
| E222 | Mobile detail drawer with name/state/effect/cost | **present** | Slice 4 PerkDetailsDrawer, observed at 390 px in both themes. |
| E223 | Level, prerequisite and permanent/no-respec explanation | **present** | Slice 4 details retain these for available facts. |
| E224 | Buy action and success/failure confirmation | **present** | Slice 4 calls buyPerk through authoritative command and shows its actual outcome; no mock spending. |
| E225 | Switch on for today action on Focus/Spotlight | **missing** | F15; active perk command is not on the website. |
| E226 | Unspent-point/coin shortage copy and disabled buying | **present** | Point/requirement reasons are supported in slice 4. Coin shortage requires F15. |
| E227 | One-off node purchase pop/burst | **missing** | No E-style effect; production confirmation exists. Call C11; F14. |
| E228 | How perks work educational panel | **present** | Production addition in slice 4, not an E omission. |

### Book shell and overview

Prototype: [variants/e/Book.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/Book.tsx), [variants/e/book-achievements.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/book-achievements.tsx), [variants/e/book-data.ts](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/book-data.ts), [variants/e/book.css](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/book.css).

Comparison source: [pages/BookPage.tsx](https://github.com/Silthus/kudos/blob/a9a5e37b18be19d1ba442a075ce6e582efbef4ec/website/src/pages/BookPage.tsx), [book/Ladder.tsx](https://github.com/Silthus/kudos/blob/a9a5e37b18be19d1ba442a075ce6e582efbef4ec/website/src/book/Ladder.tsx).

| ID | Visible element / state | Outcome | Evidence, gap or next work |
|---|---|---|---|
| E229 | Book route and Achievements title | **present** | Slice 4 /book; still awaiting #193 delivery. |
| E230 | Sticky left Book page index with Book icon | **missing** | F16. Slice 4 has one flat list. |
| E231 | Overview index entry | **missing** | F16; no overview route/state. |
| E232 | Sticker albums index section with Yours/completion marks | **missing** | F18; no album read. |
| E233 | Four achievement-category index entries and emblems | **missing** | F16; grouping is absent even for shipped ladders. |
| E234 | Index current-page stripe, neutral bars and counts | **missing** | F16; totals are also Call C10/P61/WS92. |
| E235 | Mobile Book page native select with optgroups | **missing** | F16. Captured prototype at 390 px shows the selector. |
| E236 | Paper texture, spread/book frame and page transitions | **missing** | F16/F18; production cards are plain Quill under V2. Call C10 for paper styling, not a disappearance of the Book's navigation. |
| E237 | Book-reading hog on overview | **missing** | F16; identifying category art is allowed by V17. |
| E238 | Total tiers earned, ladder count and summary progress bar | **missing** | WS92/P61 exclude it. Call C10; F17. |
| E239 | Closest next tier card, emblem and requirement/reward line | **missing** | WS92/P61 exclude it. Call C10; F17. |
| E240 | Recently earned trophy shelf and New marker | **missing** | WS92 excludes it. Call C10; F17. |
| E241 | Shelf latest tier names, medals, dates and rewards | **missing** | F17; dates already exist, reward kinds need facts. |
| E242 | Four category tiles with art, emblems, counts and progress | **missing** | F16/F17; no approved cut. Call C10 for aggregate count. |
| E243 | Sticker albums summary tile | **missing** | F18. |
| E244 | Category-specific page headings and blurbs | **missing** | F16; WS92/call 10 flattening is agent scope, not verbatim owner rejection. |

### Achievement ladders and tiers

Prototype: [variants/e/book-achievements.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/book-achievements.tsx), [variants/e/book-emblems.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/book-emblems.tsx), [variants/e/book-requirements.ts](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/book-requirements.ts), [variants/e/book-rewards.ts](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/book-rewards.ts).

Comparison source: [book/Ladder.tsx](https://github.com/Silthus/kudos/blob/a9a5e37b18be19d1ba442a075ce6e582efbef4ec/website/src/book/Ladder.tsx), [book/LadderEmblem.tsx](https://github.com/Silthus/kudos/blob/a9a5e37b18be19d1ba442a075ce6e582efbef4ec/website/src/book/LadderEmblem.tsx), [book/Medal.tsx](https://github.com/Silthus/kudos/blob/a9a5e37b18be19d1ba442a075ce6e582efbef4ec/website/src/book/Medal.tsx), [bookFixtures.ts](https://github.com/Silthus/kudos/blob/a9a5e37b18be19d1ba442a075ce6e582efbef4ec/website/src/bookFixtures.ts).

| ID | Visible element / state | Outcome | Evidence, gap or next work |
|---|---|---|---|
| E245 | Ladder name, what it counts and four tier cells | **present** | Slice 4 Ladder. |
| E246 | Hedgehog emblem identifying each shipped ladder | **present** | Slice 4 maps seven IDs to official hoggies and supports silhouettes. |
| E247 | Metal rosette matching highest earned tier and sparkle | **missing** | Slice 4 LadderEmblem is a plain circle. F17; tier-metal medals themselves exist. |
| E248 | Unstarted ladder silhouette | **present** | Slice 4 applies book-silhouette when no tier is earned. |
| E249 | Latest/highest tier date beside ladder name | **missing** | Dates appear only in tier cells. F17. |
| E250 | Next-tier neutral progress bar and numeric count | **present** | Slice 4 WayToNext. |
| E251 | Plain-language remaining requirement inside/along the bar | **missing** | Slice 4 shows count of threshold for tier name, not E's requirementOf sentence. F17; requires supplied unit/rule copy, no derived game rule. |
| E252 | Complete line/full bar after all four tiers | **missing** | Slice 4 renders no bar when next is null. F17. |
| E253 | Bronze, silver, gold, diamond metal and printed word | **present** | Slice 4 Medal/Tier; metal tokens have light/dark values. |
| E254 | One-to-four pips and static gold/diamond sparkle | **present** | Slice 4 improves E's shared medal, matching accepted V16. |
| E255 | Earned tier name/date and unearned At threshold | **present** | Slice 4 Tier formats authoritative earnedAt in the supplied time zone. |
| E256 | Next tier tag | **present** | Slice 4 uses a neutral Next tag. |
| E257 | Primary ring/background on the Next tier cell | **missing** | WS92 makes it neutral. V4 alone does not decide whether Next is the one selected action. Call C10; F17. |
| E258 | Coin, emoji and hedgehog reward lines on each tier | **missing** | WS91 omits all rewards. F17/F6/F7; Call C4 for permanence of that omission. |
| E259 | Generosity, Recognition, Connections, Dependability, Applause, Seasons and Old Friends ladders | **present** | These IDs are supported by slice 4's read/emblems; fixture screenshot shows only two deliberately. Runtime count is not the mock count. |
| E260 | Team Spirit ladder | **missing** | F18; depends on album-completion facts. |
| E261 | Crowd Favourite, Standing Ovation and Amplifier ladders | **missing** | F10/F17; slice 4's returned catalogue does not include these IDs. WS90/P78 is no cut. |
| E262 | Four category grouping and per-category header progress | **missing** | F16/F17; WS92 excludes categories and totals. Call C10. |
| E263 | Prototype exact counts, tier thresholds and reward balance | **missing** | Not production data to port. Call C9/C12: fidelity concerns the presentation; the backend owns the catalogue and earned facts. |

### Panini albums, team photos and stickers

Prototype: [variants/e/book-album.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/book-album.tsx), [variants/e/book-data.ts](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/book-data.ts), [variants/e/book.css](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/book.css).

Comparison source: [pages/BookPage.tsx](https://github.com/Silthus/kudos/blob/a9a5e37b18be19d1ba442a075ce6e582efbef4ec/website/src/pages/BookPage.tsx).

| ID | Visible element / state | Outcome | Evidence, gap or next work |
|---|---|---|---|
| E264 | Album pages and mine-first group ordering | **missing** | F18; slice 4 has no albums. |
| E265 | Two-page spread with left/right paper and page numbers | **missing** | F18. |
| E266 | Primary/Your/Group label, crest, name and member count | **missing** | F18; map #1 group roster prerequisite. |
| E267 | Team-photo 16:10 framed cover, corner mounts and credit | **missing** | F18. Accepted V22 uses mapped company-team photo; the whole photo element is not cut. |
| E268 | No team photo yet illustration/state | **missing** | F18; source for empty state and accepted mapped/unmapped fallback. |
| E269 | Upload a team photo, Change and Remove controls | **cut** | D5: product owner accepted company-source/fallback and dropping member uploads. Do not invent upload storage to match the old prototype. |
| E270 | Use our photo from posthog.com action | **missing** | The approved automatic mapped-team source replaces user choice, but the literal action has no distinct verbatim rejection. Call C10: use D5's automatic source, not the mocked illustration as a real team photo. |
| E271 | Sticker range heading and held-of-total count | **missing** | F18. |
| E272 | Numbered collected sticker cards with face and name strip | **missing** | F18; never copy DiceBear or real names/photos into this public report. |
| E273 | Sticker die-cut border, sheen and deterministic slight tilt | **missing** | F18. |
| E274 | Missing numbered slots with member name | **missing** | F18; private album. P61's anti-targeting language needs Call C10 for this literal presentation. |
| E275 | Since/you thanked them/they thanked you tooltip facts | **missing** | F18; read contract must supply each fact. |
| E276 | Remaining-to-collect count and neutral album bar | **missing** | F18; private progress. |
| E277 | Still to swap thanks with named missing members sentence | **missing** | P61/WS101 anti-targeting rules conflict; no quoted owner cut. Call C10; F18. |
| E278 | Completed album stamped Complete with date | **missing** | F18; permanent completion/date fact required. |
| E279 | Album permanence/privacy and Team Spirit link | **missing** | F18. |
| E280 | Shared-team-photo/private-stickers explanation | **missing** | F18; adapt it to D5's company-source photo. |

### Locks, readiness and empty states

Prototype: [variants/e/unlock-gate.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/unlock-gate.tsx), [variants/e/profile-locked.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/profile-locked.tsx), [variants/e/unlock-features.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/unlock-features.tsx).

Comparison source: [pages/WaitsPage.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/pages/WaitsPage.tsx), [pages/ReadyPage.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/pages/ReadyPage.tsx), [leaderboard/EmptyBoard.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/leaderboard/EmptyBoard.tsx), [pages/NotFoundPage.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/pages/NotFoundPage.tsx).

| ID | Visible element / state | Outcome | Evidence, gap or next work |
|---|---|---|---|
| E281 | Below-level page with hog silhouette, lock, unlock level and feature teaser | **missing** | Home cards supply these, but routed WaitsPage uses generic Max and one level sentence. F19. |
| E282 | Blurred feature-specific ghost preview on locked page | **cut** | D3: accepted calm locked summary replaces progress teasers. Retain a meaningful silhouette/feature sentence in F19. |
| E283 | Locked-page levels-to-go sentence and climb progress | **cut** | D3; do not present a progress challenge for a locked feature. |
| E284 | Locked-page Back to your profile/Home action | **present** | Main WaitsPage has Go to Home; slice 4 shares this for Book/skills. |
| E285 | Ready page's crate, unlock name and Open action | **present** | Main ReadyPage and slice 4 FeatureWaitsPage. |
| E286 | Night band and large ready-unlock headline/teaser | **missing** | Main ready page uses a plain card; F19. No verbatim decision drops this static layout. |
| E287 | Ready inventory, coins and collection gates/crates | **missing** | F5/F6/F7; not yet in the shipped feature list. |
| E288 | Ready-feature crate art, gems, lid, rays and hog reveal | **present** | Main CrateArt is a fresh port with theme-safe colours and one-off animation. |
| E289 | Empty leaderboard hog, quiet explanation and Slack action | **present** | Main EmptyBoard adds an actual empty state; E only has mock populated boards. |
| E290 | Empty quests hog, quiet explanation and Slack action | **present** | Main NoQuests supplies these. |
| E291 | Errors, signed-out denial and not-found page | **present** | Main adds real operational states absent from mock E; they are not fidelity omissions. |

### Unlock and quest moments

Prototype: [variants/e/unlock-overlay.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/unlock-overlay.tsx), [variants/e/unlock-crate.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/unlock-crate.tsx), [variants/e/unlock-reward.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/unlock-reward.tsx), [variants/e/Moments.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/Moments.tsx).

Comparison source: [crates/RevealDialog.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/crates/RevealDialog.tsx), [crates/CrateArt.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/crates/CrateArt.tsx), [crates/seen.ts](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/crates/seen.ts), [crates/RewardCrate.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/crates/RewardCrate.tsx).

| ID | Visible element / state | Outcome | Evidence, gap or next work |
|---|---|---|---|
| E292 | Full-screen dark unlock scrim and crate art | **present** | Main RevealDialog/CrateArt; observed from a synthetic ready feature crate. |
| E293 | Feature-opening command and already-earned reward semantics | **present** | Main sends openFeature/openQuestCrate; no client reward draw. |
| E294 | Feature-specific heading and Go there action | **present** | Main EndState/GoThere, with slice 4 /skills and /book destinations waiting for #193. |
| E295 | Detailed what-waits checklist under feature unlock | **missing** | Main prints only It opens … . F19; port unlock-overlay Reveal with supplied feature copy. |
| E296 | Open the next one and remaining-ready count inside reveal | **missing** | Main ends with Done/Go/Replay. F19. |
| E297 | Later/close action and return focus | **present** | Main uses Done/Escape and restores focus; wording differs but the function exists. |
| E298 | First-play, seen end-state and Replay button | **present** | Main uses opaque per-member/crate seen key and Replay. |
| E299 | Skip by click/key and reduced-motion end state | **present** | Main reveal supports skipping and end-state-only reduced motion. |
| E300 | Quest/Journey reward label and XP end-state | **present** | Main RewardEndState and rewardLabelOf. |
| E301 | Reward coin, emoji and hog chips in the reveal | **missing** | Main quest reveal has XP only. F6/F7/F10. |
| E302 | Standalone quest-reward band landing and quest-specific recap | **missing** | Main routes Slack crates to /quests; no /landing/quest. Functional crate is present, full accepted page is absent. F22; Call C11. |
| E303 | Standalone unlock band route, feature list and next-unlock note | **missing** | No /landing/unlock route. F19/F20; Call C11. |
| E304 | Live new-event notifications waiting in HUD pill | **missing** | Pill contains crates, not all level-up/achievement/kudos events. F20/F21/F22; #249 timeline does not add this event tray. |

### Level-up, achievement, kudos and hedgehog band landings

Prototype: [variants/e/Moments.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/Moments.tsx), [variants/e/moments-chest.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/moments-chest.tsx), [variants/e/moments-data.ts](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/moments-data.ts), [variants/e/moments.css](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/moments.css).

Comparison source: [route.ts](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/route.ts), [crates/RevealDialog.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/crates/RevealDialog.tsx).

| ID | Visible element / state | Outcome | Evidence, gap or next work |
|---|---|---|---|
| E305 | Shared moment band shell, brand-colour texture and large headline | **missing** | Band colour tokens exist in main CSS, but no MomentShell/band page. F20/F21/F22. |
| E306 | Back to Slack and Replay on standalone moments | **missing** | Reveal Replay exists; moment-specific return/link does not. F20/F21/F22. |
| E307 | Level up kicker and HedgehogLevelUp art | **missing** | F20; /landing/level-up is not found. |
| E308 | Reached-level ticker, burst/ring and animated XP track | **missing** | F20, respecting accepted first-play/reduced-motion rules. |
| E309 | XP to next level and skill-point reward chip | **missing** | F20; sourced event facts required, not E's fixed numbers. |
| E310 | What this level unlocks rows and ready/open action | **missing** | F20. |
| E311 | Level-up next-feature hint or every-part-is-yours sentence | **missing** | F20. |
| E312 | Level-up primary Open first crate/Spend points/Go profile | **missing** | F20; current home/pill offers those actions elsewhere. |
| E313 | Achievement band, earned-tier name and StampApproved art | **missing** | F21; /landing/achievement is not found. |
| E314 | Achievement medal plaque/stamp and ladder/tier line | **missing** | F21. |
| E315 | Achievement reward chest/item and reward explanation | **missing** | F21 after reward facts; a stored promised reward is not a new draw. |
| E316 | Achievement See achievements or Go profile action | **missing** | F21. |
| E317 | Kudos giver-led name/message/time and private-only note | **missing** | Standalone received-kudos landing is absent. #248/#249 add card/timeline only. F22. |
| E318 | Kudos XP, coin and new-sticker quiet follow-up | **missing** | F22; coins/stickers need facts. Do not invent recipient XP from giver XP. |
| E319 | Kudos sticker-book/profile continuation | **missing** | F22 after F18. |
| E320 | Kudos high-intensity band/count-ups as ordinary received thanks | **cut** | D4: accepted quiet giver/message-led kudos presentation (V14), no chest. Preserve the information in F22. |
| E321 | New-hedgehog lemon band, egg/hatch and hog reveal | **missing** | F23; /landing/hedgehog is not found. |
| E322 | New hog name/source and Make it my avatar action | **missing** | F23 after F4/F7; duplicate equipped state has explicit confirmation. |
| E323 | App Home blue tour band and Reading art | **missing** | F24; /landing/app-home is not found, App Home now links straight home. |
| E324 | Tour links and locked feature rows | **missing** | F24, unless product owner prefers the current direct-home entry. Call C11. |
| E325 | Moment chooser/sub-kind links and prototype sign-in explanation | **missing** | Debug-only picker. No direct cut quote; Call C12 recommends excluding from production. |
| E326 | One-off moment timing, sparks, sticker pop and chest/egg reveal art | **missing** | F20/F21/F23. Source CSS/Chest/Egg are reference assets, not reward logic. |
| E327 | Infinite moment chest wobble and tap-hint breathing | **cut** | D1, confirmed no infinite animation. |
| E328 | Round-9 removed boosters, auras, drops, rarities, titles, quips, streaks and freezes | **cut** | D6: accepted round-9 design. They are already absent from active E; old shared mock data/components are not new missing features. |

### Command palette contents and keyboard states

Prototype: [variants/e/palette.tsx](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/palette.tsx), [variants/e/palette-commands.ts](https://github.com/Silthus/kudos/blob/3409ade/prototype/website-ui/src/variants/e/palette-commands.ts).

Comparison source: [Frame.tsx](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/Frame.tsx), [route.ts](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/website/src/route.ts).

| ID | Visible element / state | Outcome | Evidence, gap or next work |
|---|---|---|---|
| E329 | Modal backdrop, prompt glyph, command input and Esc hint | **missing** | F2; no palette in main/slice 4. |
| E330 | Suggestions with icons, usage, blurb and aliases | **missing** | F2. |
| E331 | Arrow selection, Tab completion, Enter execution and focus return | **missing** | F2; harden dialog focus against the current production accessibility requirements. |
| E332 | Profile, quests, lb flags, Book/achievements and skills commands | **missing** | F2, use real route registry and read gates. |
| E333 | Inventory/collection commands and aliases | **missing** | F2 after F5/F7. |
| E334 | Locked command reason with member level and unlock level | **missing** | F2; needs Call C1 consistency with locked nav. |
| E335 | Ready command opening its crate | **missing** | F2. |
| E336 | Theme and sign-out commands | **missing** | Equivalent controls exist elsewhere; palette affordance itself is absent. F2. |
| E337 | Help/show-everything screen and keyboard footer | **missing** | F2. |
| E338 | Error/status output and unknown-command hog state | **missing** | F2. |
| E339 | Playful hidden commands and witty traps | **missing** | F2; Call C2 for production scope. Correct any stale prototype copy such as 12 ladders/three trees before shipping. |
| E340 | Use system setting command | **missing** | V6 promised it; E lacks it too. Production theme control has the function, palette command waits on F2. |

Inventory: **340 rows**. **97 present**, **16 coming**, **11 cut**, **216 missing**. Counts include reference-only controls and additional requested metadata; they are not a number of implementation tickets.

## Missing work grouped into ticket-sized changes

These are proposed graduation groups, not new tickets. The conductor owns scheduling and any cross-map asks. No other issue was edited. Keep existing #237/#238/#248–#251/#193/#258 in their current scope unless the owner makes a new call.

| Group | Small reviewable change | What to port from E | Prerequisite / owner call |
|---|---|---|---|
| F0 | Optional document metadata | Neither E nor main has description/social metadata; favicon/theme-color already #258 | Additional product choice, not fidelity regression |
| F1 | Complete HUD nav and mobile layout | `Frame.tsx`: locked/ready entries, next badge, icons, overflow rail/mobile selected pill, avatar/sign-out placement and shadow | C1; fix observed 390→422 px slice-4 overflow independently. Leave #237's home scope alone |
| F2 | Keyboard command palette | `palette.tsx`, `palette-commands.ts`: shell, search/help/status, keyboard interaction, route/theme/sign-out commands | C2; wire current routes/read gates; no prototype state/store |
| F3 | Sign-in and display-scale fidelity | shared `SignIn.tsx`; `Profile.tsx` hero spacing; page heading sizes from `Quests.tsx`/`Skills.tsx`/`Leaderboard.tsx` | C3/C5. #258 covers heart branding, not HandClasp/card/deep-link hint/full-width button |
| F4 | Starter/equipped avatar across HUD, hero, card and viewer rows | `hud.tsx` HogAvatar, `Profile.tsx` portrait, `profile-card.tsx`, `leaderboard-faces.tsx` MyHog | Avatar ownership/equipment read and command contract; C4. Keep people photos in lists |
| F5 | Four-slot Character panel and centre picker | `gear-character.tsx`, `gear-picker.tsx`, `gear-sheet.ts`, `gear-turn.ts` | F4 + equipped emoji facts/commands; C4/C5. First useful slice is portrait/slots, then picker |
| F6 | Inventory ownership, equipment and prices | `gear-bag.tsx`, `gear-inventory.ts`, `gear-items.ts` presentation; CoinGlyph from `hud.tsx` | Map #1 coins/items facts. Separate ownership view, equip action, then priced purchase PRs; no copied mock balance |
| F7 | Hedgehog shelf | `Collection.tsx`, `collection-hedgehogs.tsx`, named art/source presentation in `hedgehogs.ts` | F4/F6 + hedgehog catalogue/ownership. Separate read-only shelf from Equip/Buy actions |
| F8 | Public-card group and earned-tier details | `profile-card.tsx` group and best-tier layout | Authorised public-card facts (map #1 #53), groups; never read another member's private Book |
| F9 | Personal quest presentation and controls | `Quests.tsx` QuestCardRow/QuestAction/RerollButton, `quests-parts.tsx` illustrations/rewards, quest-target links | C6/C8/C11; icons/deep-link targeting are a small first PR, web swap is separate |
| F10 | Group quest panel | `Quests.tsx` group section/Helpers, `quests-card.tsx` group row | Authoritative group-quest facts; C6 on named helper row. Anonymous progress/reward first, helper treatment later |
| F11 | Fresh-unlock bonus quest | `Quests.tsx` FreshQuest/FeatureLink, `quests-card.tsx` fresh row | Persistent bonus-quest domain contract and claim command |
| F12 | Group boards and full home standings | `Leaderboard.tsx` board cards/GroupRows/PrivateNotes; `profile-standing.tsx` all three rows/change | Group read contract; split Groups, My group, then home/change/peer details; C4/C7 |
| F13 | Growable Everyone window and website visibility setting | `leaderboard-list.tsx` MoreLine/BoardList; `Leaderboard.tsx` visibility Switch | C7/C8; two independent small changes, existing whole-board implementation retained |
| F14 | Compact shipped perk tree and legend | `Skills.tsx` Legend/PerkNode/CostChip and header chips; `skills-icons.tsx` | No extra perks needed for compact first-row shape. C9 on primary/counters; add one-off confirmation separately |
| F15 | Later perk rows and upgrade-aware ledger | `Skills.tsx` Connector/BecameCaption/OwnedPerk/PerkAction; catalogue topology in `skills-perks.ts` | Map #1 rest-of-tree facts/commands (#39), upgrades/coins. Split graph rows, ledger replacements, active-perk action |
| F16 | Book index and category navigation | `Book.tsx` PageIndex/MobileIndex; `book-achievements.tsx` CategoryPage/CategoryTile | Existing returned ladders can be grouped without new game rules. C10 on totals/paper styling |
| F17 | Achievement detail fidelity and optional overview | `book-emblems.tsx` rosettes; `book-achievements.tsx` LadderRow/TierCell/Overview/TrophyShelf; `book-requirements.ts`/`book-rewards.ts` presentation | Split rosette/complete/requirement first, overview after C10, rewards after their facts. Do not compute unknown requirements in browser |
| F18 | Private Panini team albums | `book-album.tsx`, `book.css`, album sections of `Book.tsx` | Map #1 album/roster/completion read (#54); mapped team photos. Split index/read, numbered spread, photo/completion; D5 excludes uploads, C10 settles named gaps |
| F19 | Routed lock/ready pages and richer feature reveal | `unlock-gate.tsx` static gate shapes; `unlock-overlay.tsx` Reveal/checklist/next crate | Existing unlock facts plus supplied feature copy; D3 excludes progress pressure. Split gate presentation from chained reveal |
| F20 | Level-up band landing and event entry | `Moments.tsx` MomentShell/LevelUpMoment/LevelTicker/LevelOpens, `moments.css` | Event identity/XP/unlock facts, seen keys, Slack deep link; C11. Static band first, one-off motion second |
| F21 | Achievement earned band landing | `Moments.tsx` AchievementMoment, `moments-chest.tsx` Chest, shared medals/band | Earned event and stored reward facts; C11. Never roll reward on opening |
| F22 | Received-kudos landing and quest landing choice | `Moments.tsx` KudosMoment information and QuestMoment recap | Message/event/gains/sticker facts; D4 requires quiet kudos. C11 decides whether `/quests` and Activity replace standalone routes |
| F23 | New-hedgehog reveal/equip landing | `Moments.tsx` HedgehogMoment, `moments-chest.tsx` Egg | F4/F7 authoritative owned hog; seen-key/deep-link contract |
| F24 | App Home tour landing or explicit direct-home decision | `Moments.tsx` AppHomeMoment/TourEntry | C11; current App Home route points straight home. Not covered by existing Activity tickets |

## One owner decision queue

**Which of these agent-rule exclusions should stay, and which should return to the accepted E design?** Recommend restoring retained product features through small gated slices, accepting confirmed styling changes D1–D5, and keeping mock controls only in research tools.

1. **C1, HUD discoverability/placement:** WS59 drops locked/ready nav; WS16 has no palette; main changes Profile to Home, avatar link to account menu, separate sign-out to menu. Keep those deliberate alternatives or restore E? Mobile overflow is a defect either way.
2. **C2, palette:** WS16 was used as a cut in #231 although accepted E and V6 include it. Build the useful route/theme/command palette; optionally keep the playful hidden responses.
3. **C3, sign-in:** exact HandClasp illustration/card/deep-link hint versus the current BrandSays page with #258 heart logo. #258 is brand coverage, not a complete sign-in port.
4. **C4, retained game features:** P78/WS58/WS102/WS93 were used to call unshipped coins, gear, hog avatars, group names/boards, profile medals, sticker albums and tier rewards cut. They are dependencies. Does the accepted kept list still stand? If yes, schedule the web ports after their facts ship.
5. **C5, home shape:** WS17/WS72/V4 replace the separate first-kudos nudge and hero spend-points action, and the new home uses Book/skills panels rather than the literal Inventory-first sheet. Keep these additions/placements or align the final sheet more closely with E?
6. **C6, quests:** V17/WS73 omit quest hogs; P82 disallows named group helpers; V13 was used to remove Claim/highlight even though a labelled crate can retain a Claim action. Preserve the useful icons/claim treatment, and decide helper privacy explicitly.
7. **C7, board controls/change:** WS43 omits Show 5 more and #231 call 10 omits change arrows because no read exists. Restore incremental expansion now, and request change facts later, or explicitly choose whole-board-only/no-delta?
8. **C8, writes stay in Slack:** WS46/WS73 keep leaderboard visibility and quest swap in Slack. #57's direct quoted front-door instruction and later Notes keep Swap/Settings there today, but there is no quoted permanent rejection of website controls. Keep that staged boundary or add the same commands on web?
9. **C9, skill-tree scope/copy:** WS85/WS94/P78 drop later rows, upgrade UI, counts/chips and available-node primary; P94/P95/WS86 replace mock effect copy. Retain authoritative domain copy and factual gating, but decide the visible future-row/count/primary presentation rather than calling the whole tree cut.
10. **C10, Book:** P61/WS91/WS92 drop totals, closest-next, recently-earned shelf, categories, reward lines and named album gaps. Which overview/targeting elements should return? Category navigation, photos, sticker spreads and rosettes are not the same as competitive/targeted progress. Decide the literal automatic-source photo action separately; D5 already cuts uploads.
11. **C11, moments:** existing reveal mechanics and Activity timeline do not build the accepted standalone band pages, event tray, HUD reward flight, new-hog moment or App Home tour. Keep staged delivery or explicitly replace selected routes with Home/Quests/Activity? Keep one-off motion; no loops.
12. **C12, prototype tooling/data:** no direct cut quote exists for level scrubbing, variant picker, moment picker and fake-sign-in footer. Recommend keeping them out of the user-facing production app and retaining them in research/fixture tooling. Mock names, thresholds and prices are never a production port requirement.

The queued calls are not silently answered by the AFK/autonomous directive. #259 specifically asks to surface agent-rule cuts for a new product-owner call. This report records the alternatives without changing any game rule or any other ticket.

## Verification and reproduction

- Read all specified ticket bodies and comments, #57's Notes, #62's round-9/accepted handoff, and the relevant active E/shared sources. Read #231's previous gap table and its underlying WS/V rules. Followed #57's link to #63 to check actual styling acceptance instead of treating V alone as authority.
- Queried Coherence's component, status and practice read-only. No implementation or spec invariants were changed.
- Built pinned main and pinned slice 4 locally with Fleet. The throwaway fixture entry imports the actual unmodified App/components/CSS, supplies synthetic typed-contract-shaped values and stubbed commands, and never imports LiveApp/Convex auth. It validates presentation, not command persistence or Slack delivery.
- The three successful build logs are kept as [build-main.txt](build-main.txt) and [build-slice4.txt](build-slice4.txt) and final refresh [build-current.txt](build-current.txt); absolute environment paths were normalised. Dependency verification initially warned about local symlink directories, then Vite built successfully. No install or build was used as a substitute for viewing the actual pages.
- Reproduction entries are [fixture-main.tsx](fixture-main.tsx) and [fixture-slice4.tsx](fixture-slice4.tsx). Copy the appropriate entry into its pinned branch's `website/audit-preview.tsx`, copy [fixture.html](fixture.html) as `website/audit-preview.html`, and use [vite.audit.config.ts](vite.audit.config.ts) there. With dependencies installed using pnpm, run `~/dev/fleet/fleet heavy -- pnpm --dir website exec vite build --config vite.audit.config.ts --outDir <temporary-directory>`. Serve with [serve.py](serve.py) on a local port; no Convex/deploy is needed. These files are research fixtures, never release entries.
- Tested the actual layout observation at 390 px: slice 4 document scrollWidth was **422**, with Home, Quests, Leaderboard, The Book and Skill tree all open. The mobile drawer itself renders; the nav needs an overflow rail.
- Every screenshot was saved from T3's preview, copied into this branch, and inspected against the code. [screenshots.json](screenshots.json) preserves source URL, filename and dimensions, and [verify.py](verify.py) checks PNG signatures, hashes, dimensions, image links and all four outcome counts.
- No application source files are committed by this research branch. Only this report, reproduction/evidence files and the audit-method journal record `d-c9c54fe8` are added. The branch is throwaway and must not be merged to main as a product change.

## References

- [#259, audit method](https://github.com/Silthus/kudos/issues/259)
- [#57, Notes and decisions](https://github.com/Silthus/kudos/issues/57)
- [Accepted E handoff](https://github.com/Silthus/kudos/issues/62#issuecomment-6152903919)
- [Round-9 game decision](https://github.com/Silthus/kudos/issues/62#issuecomment-6152588034)
- [Styling round-2 acceptance](https://github.com/Silthus/kudos/issues/63#issuecomment-6153172426) and [full-summary acceptance](https://github.com/Silthus/kudos/issues/63#issuecomment-6153367108)
- [Earlier #231 audit / website-5](https://github.com/Silthus/kudos/blob/docs/spec-website-5/spec/website-5.md)
- [Slice-4 spec](https://github.com/Silthus/kudos/blob/docs/spec-website-4/spec/website-4.md)
- [Visual language V1–V24](https://github.com/Silthus/kudos/blob/763c147f81267d8c0581e4e0f2c0b4a9ab45855d/docs/website/visual-language.md)
