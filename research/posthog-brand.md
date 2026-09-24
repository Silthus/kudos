# The PostHog brand, hedgehogs and crests

Research for [#52](https://github.com/Silthus/kudos/issues/52). It feeds the PostHog restyle spec and the gamification grilling ([#55](https://github.com/Silthus/kudos/issues/55)).
Gathered 2026-09-24.

Sources, pinned where possible:

| Source | Version read |
|---|---|
| [`PostHog/posthog.com`](https://github.com/PostHog/posthog.com) | `b92e7ca` (2026-09-23) |
| [`PostHog/posthog`](https://github.com/PostHog/posthog) | `754fa69e` (2026-09-24) |
| [`PostHog/hedgehog-mode`](https://github.com/PostHog/hedgehog-mode) | `c206d6a` (2026-09-15) |
| npm [`@posthog/hedgehog-mode`](https://www.npmjs.com/package/@posthog/hedgehog-mode) | `0.0.58` |
| npm [`@posthog/brand`](https://www.npmjs.com/package/@posthog/brand) | `0.12.3` |
| [brand.posthog.com](https://brand.posthog.com/) and its Colors, Fonts, Logo, Crests and Hoggies subpages | live on 2026-09-24 |

Repo paths below are relative to the repo named in each section.

## TL;DR

- **The look can be reproduced; the art cannot.** Colour values, radii, the "3D button" and the window chrome are techniques and facts, so we restate them in our own Tailwind `@theme` and code.
- **Every hedgehog illustration ("hoggie"), crest and brand font is off-limits.** None of them may go into this public repo or its deploy without written permission from PostHog.
- **One hedgehog has an explicit open licence: Hedgehog Mode.** This is the animated pixel-art hog that replaced HedgehogBuddy. It ships as the npm package `@posthog/hedgehog-mode` and is declared MIT.
  - Plan: depend on the package and load its sprite atlas at runtime from a version-pinned CDN.
  - Never commit the PNG to this repo.
  - Gate it behind the PostHog skin.
- **Crests become our own heraldry.** Original shields in our palette, with no hedgehog, and not traced from PostHog's crests.
- **No AI-drawn hedgehogs.** PostHog's brand rules explicitly ban AI-generated hog art and derivative hedgehog styles, and every artist on this map is an AI agent. Where a real hoggie would go, we leave a named art slot and ask PostHog for the art (see [Asking PostHog](#asking-posthog)).
- **brand.posthog.com is a draft.** Every page carries the banner "Work in progress. This entire website is AI-generated, and the PostHog brand shown here is not finalized — everything is subject to change."
  - It is the demo site for the `@posthog/brand` npm package ([screenshot](posthog-brand/brand-overview.png)).
  - Treat its 12-colour palette as the incoming direction. posthog.com and the product use the older tokens below.

## 1. Licences and usage terms

| Thing | Licence / terms | Source | Verdict for Kudos |
|---|---|---|---|
| posthog.com site code (everything outside `/contents/`) | "Please do not duplicate, copy, or use our website for commercial or non-commercial use… We're happy for you to use our logo for the purposes of referencing PostHog, but not for you to pretend to be us." | `posthog.com/LICENSE` | **Don't copy component code** (OSButton, AppWindow, …). Re-implement the ideas from scratch. Restating hex values and CSS techniques is low risk (our judgement; the licence doesn't address it). |
| posthog.com `/contents/` (markdown, handbook) | MIT | `posthog.com/LICENSE` | Text is quotable with attribution. It doesn't clearly cover images, which mostly live on Cloudinary anyway. |
| PostHog product (`PostHog/posthog`, outside `ee/`) | MIT (Expat) | `posthog/LICENSE`; `ee/LICENSE` is the proprietary Enterprise licence | Lemon UI tokens and SCSS techniques are MIT, so we may port them. The two PNGs left in `frontend/public/hedgehog/` are MIT by path, but see the brand-policy row. |
| `@posthog/brand`: 171 hoggies, 55 crests, logo component, RoundHog font, colour tokens | **PolyForm Strict 1.0.0**: "you may view it, but commercial use, use in your own projects, distribution, and derivative works are not licensed. The PostHog hedgehog illustrations are PostHog trademarks and brand assets." Contact hey@posthog.com. | [unpkg `@posthog/brand@0.12.3/LICENSE`](https://unpkg.com/@posthog/brand@0.12.3/LICENSE); GitHub `PostHog/brand` reports licence "Other" | **Not usable.** No install, no vendoring, no hotlinking, and no hex values lifted from the package into shipped code. The colour values are facts, but they're published only under this licence, so we use the posthog.com and Lemon values instead (§2). |
| `@posthog/hedgehog-mode` (renderer and sprite atlas) | `"license": "MIT"` in `package.json`; the repo README's `## License` section says "MIT — go forth and hedgehog." There is **no LICENSE file** in the repo or the tarball (GitHub reports `license: null`). | `hedgehog-mode/README.md:169-171`, `hedgehog-mode/package.json` | **Usable as a dependency**, with an attribution line. Sprites stay out of git; load them from the pinned CDN. The copyright grant is clear. The trademark caveat in the brand-policy row still applies, which is one reason to keep it out of git and easy to remove. |
| Brand policy (hedgehogs, logo) | "you may not use our hedgehog mascot or other illustrative brand assets in any commercial or marketing materials without explicit permission"; "use our logo or brand assets only in unmodified form, and not as the main branding for your own project". Don't: "Use AI-generated hedgehog art", "Modify existing hedgehog illustrations without approval", "Use our artwork … for anything that isn't PostHog-related. While our code is open source, our brand assets are property of PostHog." | `contents/handbook/brand/assets.md:8,18`; `contents/handbook/brand/visual-identity.md:124-127` | This demo is PostHog-related, since it's pitched as an Easter egg for PostHog's Slack app. It is still a pitch, i.e. marketing. **Use the logo only unmodified and only to reference PostHog. Use hoggies and crests only with written permission.** |
| Press-page banners | "You can use these banners anywhere you want." | `contents/media-contents.mdx` | Three blog banners only. They don't fit our UI and aren't worth it. |
| Logo files | Stable public URLs such as `https://posthog.com/brand/posthog-logo.svg` and the badge `…/brand/badge/posthog-badge-white-bg-color.svg`. The press page says "You don't have to negotiate legal agreements for them." | `static/brand/`, `src/components/BrandLogos/README.md`, `contents/media-contents.mdx` | OK for a "Built for PostHog" / "PostHog edition" mark, unmodified, never as our app's own logo. The 2026 gradient logo replaces the old ones (`visual-identity.md`). |

**Fonts**

| Font | Where it's used | Licence | Verdict |
|---|---|---|---|
| RoundHog | Body text on posthog.com and the product's `--font-sans` | Inside `@posthog/brand`, so PolyForm Strict | No. Substitute a free rounded sans: **Nunito** (OFL, `@fontsource-variable/nunito`). |
| Matter SQ | Only posthog.com's OG-image templates | Commercial [Displaay](https://displaay.net/typeface/matter) typeface | No. |
| Squeak and Loud Noises | Hedgehog art captions | Source files sit in `PostHog/company-internal` (proprietary; no licence text found) | No. |
| IBM Plex Sans | posthog.com's `font-button` / `font-nav` | SIL OFL (`@fontsource-variable/ibm-plex-sans`) | **Yes.** |
| Source Code Pro | posthog.com's code font | SIL OFL | **Yes.** |
| Inter | The product's fallback (`public/Inter.woff2`) | SIL OFL | **Yes.** |

The OFL status of IBM Plex Sans, Source Code Pro and Inter comes from their upstream projects; we didn't re-read the licence texts in this pass.

## 2. Design tokens

### posthog.com site (the look to borrow)

Sources: `tailwind.config.js` and `src/styles/global.css`.

**Page background** (`global.css:551-556`): light `#EEEFE9`, dark `#1D1F27`.

**Semantic schemes** (`global.css:178-420`). Values are RGB triplets used as `rgb(var(--x) / alpha)`; switch with `data-scheme`.

| Scheme | bg | accent | border | text-primary | text-secondary | text-muted |
|---|---|---|---|---|---|---|
| light primary | 253 253 248 | 229 231 224 | 191 193 183 | 17 17 17 | 101 103 94 | 158 160 150 |
| light secondary | 238 239 233 | 210 211 204 | 182 183 175 | 35 37 29 | 35 37 29 | 158 160 150 |
| light tertiary (windows) | 229 231 224 | 200 202 193 | 158 160 150 | 35 37 29 | 77 79 70 | 115 117 107 |
| dark primary | 30 31 35 | 45 46 55 | 62 66 79 | 250 250 250 | 174 179 194 | 98 102 116 |
| dark secondary | 37 38 43 | 50 52 63 | 74 78 92 | 237 238 244 | 176 180 196 | 110 114 129 |

**Tan ramp** (`light-1` … `light-12`): `#FDFDF8 #EEEFE9 #E5E7E0 #D2D3CC #C8CAC1 #BFC1B7 #B6B7AF #D0D1C9 #73756B #9EA096 #4D4F46 #23251D`

**Accents**:

| Name | Hex | Name | Hex |
|---|---|---|---|
| red | `#F54E00` | orange | `#EB9D2A` |
| yellow | `#F7A501` | blue | `#2F80FA` |
| teal | `#29DBBB` | salmon | `#F35454` |
| seagreen | `#30ABC6` | purple | `#B62AD9` |
| lilac | `#8567FF` | green | `#6AA84F` |
| navy | `#1E2F46` | gold | `#FFBA53` |
| creamsicle | `#FFD699` | pink | `#E34C6F` |
| burnt-orange | `#DF6133` | | |

**Button colours**:

| Token | Hex |
|---|---|
| `button-shadow` | `#CD8407` |
| `button-shadow-dark` | `#99660E` |
| `button` (border) | `#B17816` |
| `button-dark` (border) | `#835C19` |

**Dark surfaces**: `#1E1F23`, `#232429`.

**Handbook colour rules** (`contents/handbook/brand/assets.md#colors`, `visual-identity.md`):
- Links are red `#F54E00`.
- Don't use red for errors.
- Vary emphasis with opacity rather than new colours: text 90%, links 95%, hover 100%.
- "No gradient backgrounds by default".

### PostHog product: Lemon UI "3000"

Source: `frontend/src/styles/base.scss`. Hex values for the HSL tokens are our conversions.

| Token | Light | Dark |
|---|---|---|
| `--primary-3000` / accent | `#F54E01` (orange) | `#F7A503` (the dark theme swaps accent to yellow) |
| `--color-bg-3000` | `#F3F4EF` | `#1D1F27` |
| `--color-accent-3000` | `#EEEFE9` | `#21242B` |
| `--border-3000` / bold | `#DADBD2` / `#C1C2B9` | `#35373E` / `#3F4046` |
| `--text-3000` / muted | `#111` / `#111` at 60% | `#FFF` / `#FFF` at 50% |
| `--link` | `#F54E00` | `#F1A82C` |
| danger / warning / success | `#DB3707` / `#F7A501` / `#388600` | `#992705` / `#E09423` / `#245700` |

Other Lemon values:
- **Radii**: `--radius` .375rem, `-sm` .25rem, `-lg` .625rem.
- **Elevation**: `--shadow-elevation-3000: 0 3px 0 var(--border-3000)`.
- **Modal shadow**: `0 16px 16px -16px rgb(0 0 0 / 35%)`.
- **Disabled opacity**: `.65`.
- **Fonts**: RoundHog first, then the system stack with Inter; mono uses `ui-monospace`.

### `@posthog/brand` palette (2026, draft)

Reference only; it's under the PolyForm Strict licence (§1).

[brand.posthog.com/colors](https://brand.posthog.com/colors) lists 12 colours, each with core, lighter, darker and a gradient ([screenshot](posthog-brand/brand-colors.png)). They are useful to know as the direction the brand is heading. Map our tokens to the posthog.com and Lemon values above, which are equivalent in spirit.

### Type, radii, borders and motion on posthog.com

Sources: `tailwind.config.js`, `global.css`, `visual-identity.md`.

**Type**
- Headings are sentence case. Use bold for titles, semibold for paragraph links, regular for body.
- `.not-prose` heading sizes (`global.css:152-165`):
  - h1: 1.875rem / 2.25rem
  - h2: 1.5rem / 2rem
  - h3: 1.25rem / 1.75rem

**Radii**
- xs 2px, sm 4px, lg 20px.
- Buttons 6px; windows `rounded-lg`.

**Borders**
- Extra widths: half (0.5px), 3, 8, 12, 16.
- Buttons use 1.5px borders.

**Motion rules**
- "snappy, thus we don't use animation when hovering onto a button".
- "a slight zoom effect on hover and a 'pressing down' feel when clicking".
- "Animate in rather than looping constantly… ease out to a still final frame".

**Named keyframes**: wiggle ±6°, wobble, float −6px, breathe 1.03, and `hogfather-roll` / `hogfather-jump`.

### The 3D button: two implementations to learn from

We re-implement these, never copy them.

**posthog.com `OSButton` / `CallToAction`** (`src/components/OSButton/index.tsx:92-176`): an outer and an inner layer.
- **Outer shell**: `bg #CD8407` (dark `#99660E`), `border 1.5px #B17816`, radius 6px.
- **Inner face**: `bg #EB9D2A`, black bold text, same border.
- **Face offsets** (sm/md size):

  | State | Offset |
  |---|---|
  | rest | `translateY(-2px)` |
  | hover | `-3px` |
  | active | `-1.5px`, 100 ms |

- The lg size uses −2 / −4 / −1px.
- **Secondary variant**: white face on an orange shell.

**Lemon `LemonButton`** (`frontend/src/lib/lemon-ui/LemonButton/LemonButton.scss:254-345`, MIT):
- Chrome depth is `0.1875rem` (3px). A `::after` layer draws `box-shadow: 0 var(--depth) 0 -1px var(--frame)`.
- Hover lifts it by `-0.03125rem` and press sinks it by `+0.03125rem`, via `transform: translateY(var(--lemon-button-depth))`. The shadow offset shrinks to match.
- `transition: transform 200ms ease`.
- A flatter variant is in `frontend/src/styles/lemon-skin.scss:83-101`: `box-shadow: 0 .1875rem 0 0 frame` at rest, and on `:active` `box-shadow: none; translate: 0 .1875rem`.

In Tailwind v4 this is one `@utility btn-3d` with custom properties. No pseudo-element is needed if we use the `lemon-skin` variant.

### Window chrome: the "OS desktop" idiom

posthog.com renders pages as draggable windows on a desktop.

**`src/components/AppWindow/index.tsx`** (framer-motion `useDragControls`):
- Draggable, and snaps left and right.
- Frosted body: `bg-primary/75 backdrop-blur-3xl`, with a `reduce-transparency:` variant that falls back to solid backgrounds.
- `rounded-lg border shadow-md`.
- Slim title bar: `py-0.5 px-1`, `text-sm font-semibold` title, expand and close buttons on the right.
- Pop-in: `windowPopIn 0.2s cubic-bezier(0.34,1.56,0.64,1)`. Pop-out: 0.15s.

**Supporting pieces**:
- Desktop icons (`src/components/Desktop`).
- Taskbar: `bg-primary/50 backdrop-blur-3xl`.
- Skins `skin-modern` and `skin-classic`, and `wallpaper-*` variants.

Motion (our stack) does all of this natively: `drag`, `dragConstraints`, and spring pop-in. The spring `cubic-bezier(0.34,1.56,0.64,1)` is a standard ease-out-back and makes a good default for our celebration pop-ins.

### Voice and copy

Source: `contents/handbook/brand/tone.md`.

- Write "the way you'd explain something to a smart friend": clear, specific, direct, honest, conversational. Contractions are fine.
- "Clear beats clever." No forced humour.
- Active voice. Lead with the benefit, not "Introducing…".
- **"No emojis."** This clashes with our Slack rarity badges (`⚪ Common` … `🟠 *LEGENDARY*` in `convex/lib/messages.ts`). A PostHog skin should use words or our own custom emoji.
- Banned words: helps you to, empowers, **unlock**, leverages, utilize, streamline, robust, best-in-class, holistic, seamless, synergy. Our "unlocking quests" copy has to say "complete" or "earn".
- Error example: "Can't connect. Check your API key and try again."

### How Max the hedgehog is drawn

This is a rule, not art, recorded so reviewers can recognise a wrong-looking hog. Source: `assets.md`.

- Beige body with brown spines, arms and legs.
- Thick black monoline outline.
- Faces left, right or straight on only; never a side profile, never from behind.
- Emotion is carried by the eyebrows.

## 3. Asset inventory

Nothing below is committed to this repo. The two screenshots under `research/posthog-brand/` show only the palette and the unmodified logo.

| Asset | Where | Format | Licence | May we vendor? | What to do instead |
|---|---|---|---|---|---|
| **Hedgehog Mode sprite atlas**: 448 frames at 80×80 in a single 2000×1440 atlas (529 KB). Skins: default, robohog, spiderhog, hogzilla, ghost. | `@posthog/hedgehog-mode/assets/sprites.{png,json}`, served by pinned [jsDelivr](https://cdn.jsdelivr.net/npm/@posthog/hedgehog-mode@0.0.58/assets/sprites.png) and [unpkg](https://unpkg.com/@posthog/hedgehog-mode@0.0.58/assets/sprites.png) URLs (200, CORS `*`, immutable, one-year cache) | PNG + TexturePacker JSON | MIT, declared in `package.json` and README; no LICENSE file | **No** (keep it out of git) | Add it as an npm dependency and set `assetsUrl` to the pinned jsDelivr URL. Credit "Hedgehog Mode by PostHog (MIT)". Don't use `us.posthog.com/static/hedgehog-mode/…`, which has a 60 s cache and no stability promise. |
| Hedgehog Mode accessories: beret, cap, chef, cowboy, eyepatch, flag, glasses, graduation, parrot, **party**, pineapple, sunglasses, tophat, xmas-hat, xmas-antlers, xmas-scarf | same atlas, `accessories/*` | PNG frames | same as above | No | Same approach as the atlas. |
| Hedgehog Mode animations (frame counts, default skin): action 16, death 21, fall 9, **flag 25**, idle 25, inspect 36, jump 10, phone 28, **sign 33**, walk 11, **wave 26**. Also a 14-frame fire overlay. | `sprites.json` | — | same as above | — | — |
| Hedgehog Mode colour filters: green, red, blue, purple, dark, light, greyscale, sepia, invert, **rainbow** (hue +360°/s) | `hedgehog-mode/src/actors/hedgehog/colors.ts` (Pixi `ColorMatrixFilter`) | code | MIT | Technique only | CSS `filter: hue-rotate()` does the same for rarity tinting. |
| 171 hoggies, including `level-up`, `success`, `party`, `star`, `stamp-approved`, `pinata`, `explorer`, `magnifying-glass`, `cake`, `money`, `heart` and five `wizard` variants | `@posthog/brand` (`dist/generated/hoggies/{svg,png}`); browse at [brand.posthog.com/hoggies](https://brand.posthog.com/hoggies). The site's PNG URLs are content-hashed per deploy. | SVG, PNG, React | PolyForm Strict, and trademark | **No**, and no hotlinking | **Art slots** (§4): a named slot per moment, e.g. `levelUp` → `level-up`, `questComplete` → `stamp-approved`, `legendary` → `party`. Each slot renders our own non-hedgehog art until PostHog provides or approves hoggies. |
| 55 team crests in `full` and `mini` badge sizes (e.g. `a-default-crest`, `feature-flags`, `replay`) | `@posthog/brand` crests; [brand.posthog.com/crests](https://brand.posthog.com/crests); on posthog.com they come from the CMS (`src/hooks/useTeamCrestMap.ts`, `src/components/Team/Crest.tsx`) | SVG, PNG | PolyForm Strict, and trademark | **No** | Draw **original crests**: a generic heraldic shield, e.g. a tinctured field in a rarity colour with a chevron or bend and one of our own glyphs, in full and mini sizes. Heraldry is generic; avoid copying PostHog's shield outline, banner ribbon or hedgehog supporters. |
| About 140 hog images in the site repo (e.g. `src/images/explorer-hog.png`, `lost-hog.png`, `sales/shocked-hog.png`) | `posthog.com/src/images`, `static` | PNG, SVG | Site licence: "do not copy" | **No** | Art slots. |
| Product PNGs `hog-welder.png` and `self-driving-hog.png` | `posthog/frontend/public/hedgehog/` | PNG | MIT by path, but brand policy applies | No | Art slots. |
| Legacy HedgehogBuddy sprites: one PNG per animation, 80px frames, 8 per row, `FPS = 24` | `posthog` before `4fd983872a` (2026-02-17, "Hedgehog mode V2"), `frontend/src/lib/components/HedgehogBuddy/*` | PNG | MIT by path | No | Superseded by Hedgehog Mode; no reason to dig them up. |
| PostHog logo (2026 gradient) and "built with PostHog" badge | `https://posthog.com/brand/posthog-logo.svg`, `…/brand/badge/posthog-badge-*.svg` | SVG | Logo terms in §1 | Hotlink, unmodified | Use only as a small "PostHog edition" mark, never as Kudos' logo. |
| Lottie animations | posthog.com (`lottie-react`, `@dotlottie/react-player`) | JSON | Site licence | No | — |

### Asking PostHog

The demo is a pitch to PostHog, so asking costs nothing and unblocks the real hoggies and crests.

- Illustration library: joe@posthog.com (`assets.md:8`).
- Licensing: hey@posthog.com (brand LICENSE).
- New art: [/handbook/brand/art-requests](https://posthog.com/handbook/brand/art-requests).

The spec should build art slots so the real art drops in as configuration, served from an origin PostHog controls. It should never enter this repo.

## 4. Celebration ideas

Every moment follows PostHog's own motion rule: animate in, ease out, and end on a still frame. Nothing loops constantly. Everything respects our existing `<MotionConfig reducedMotion="user">` (`src/main.tsx`). The Pixi hog doesn't respect it by itself, so don't spawn it when `prefers-reduced-motion` is set.

Our rarity tiers are common 55% / uncommon 25% / rare 12% / epic 6% / legendary 2% (`convex/lib/messages.ts`). Suggested PostHog-skin tints from the posthog.com accents:

| Tier | Colour | Hex |
|---|---|---|
| common | tan `light-9` | `#73756B` |
| uncommon | green | `#6AA84F` |
| rare | blue | `#2F80FA` |
| epic | lilac / purple | `#8567FF` / `#B62AD9` |
| legendary | red→yellow | `#F54E00` → `#F7A501` |

Ranked by delight per effort:

1. **Discovery reveal as a window pop-in, escalating by rarity** (Discoveries, Playground, Me):
   - common: a card slides in.
   - uncommon: a 3D-button-style press-in (−3px → 0).
   - rare: the card opens as a mini `AppWindow` with a rarity-tinted title bar, popping in with the ease-out-back spring.
   - epic: add a Hedgehog Mode hog that **jumps onto the window's top edge**. The hog walks on DOM "platforms" via a CSS selector; PostHog's own is `.border, .LemonButton--primary, .LemonInput, …`. It plays `wave`, then idles.
   - legendary: the hog wears the `party` accessory with the `rainbow` colour filter, plays `flag`, and a `gameUI.flash({ words })` caption shows the message name.
   - *Feasible now with the MIT package.*
2. **Earned crest stamp on quest completion.** Our original crest drops in with a Motion spring: scale 1.6 → 1, a slight rotate, and a 60 ms "thunk" offset. The quest log becomes a crest cabinet, a window of mini crests where unearned ones are debossed outlines. This is the "stamp-approved" idea without their art. *Feasible now.*
3. **Level-up and streak milestone.** A hog double-jumps (`maxJumps: 2`) along the leaderboard row and lands next to the name. The row's 3D chrome sinks once, as if the hog landed on it. *Feasible now.*
4. **Store redemption states.**
   - Requested: the item card gets a tan "pending" chrome.
   - Approved: a hog plays `sign` beside the card while an HTML caption reads "Approved". The sign's own lettering is baked into the sprite, so the caption must be ours.
   - Fulfilled: a crest-style "Delivered" stamp.
   - *Feasible now; the `sign` frames need checking to see whether the sign is blank.*
5. **Easter-egg entry.** Mirror PostHog's `ToggleHedgehogMode`: typing `hedgehog` anywhere, or a hidden "PostHog edition" toggle in Me → Settings, swaps the skin (tokens, fonts, 3D buttons, window chrome) and enables hogs. The choice persists in `localStorage`, as posthog.com does with `hedgehog-mode-enabled`. The first time, a single hog walks in from the left and waves. *Feasible now.*
6. **Hog as avatar.** Use `StaticHedgehog` (a CSS sprite from the atlas: one `div` with `background-position` and `image-rendering: pixelated`, accessories stacked as divs) as the member avatar in the PostHog skin, with an accessory earned per quest crest. This mirrors PostHog's "Use as profile picture" setting. *Feasible now; ties quests to cosmetics without touching currency.*
7. **Slack side.** Slack can't animate, and image blocks need a public, permitted image URL. In the PostHog skin, Slack messages stay text-first: rarity in words and no emojis, per the voice rule. Hoggie art in Slack waits for PostHog's permission (art slots again).

## 5. Feasibility of HedgehogBuddy-style animation in React + Motion

**What PostHog runs today.** HedgehogBuddy (CSS sprite sheets on a `setTimeout` loop at 24 fps) was removed in `4fd983872a`. Its replacement is `@posthog/hedgehog-mode`:
- Rendering: a PixiJS v8 `AnimatedSprite` in a shadow-DOM canvas, with nearest-neighbour scaling for the pixelated look.
- Physics: Matter.js, with gravity y = 2, `jumpVelocity -15`, `maxJumps 2`.
- Tweens: gsap.
- Speed: Pixi `animationSpeed 0.5`, which should be about 30 fps on a 60 Hz ticker (our inference from Pixi's per-tick semantics).
- Core loop (`src/actors/Hedgehog.ts:394-481`): each tick sets the animation to fall when airborne, walk when |vx| > 0.1, and otherwise idle.
- AI (`ai.ts`): weighted random wait / jump / wave / walk, with 1-5 s pauses.
- Interaction: click opens a speech bubble, and hogs can be dragged and thrown.

**Exports and cost**:
- Exports: `HedgehogModeRenderer`, `StaticHedgehog`, `HedgehogCustomization` and the accessory, colour and skin option lists.
- Imperative API: `game.spawnHedgehog(options)`, `hedgehog.updateSprite(name, { loop, onComplete })`, `game.gameUI.flash({ words })`.
- Peer dependency: React 18 or 19, which fits our React 19.3.
- Bundle: the package's own chunk is 494 KB minified (97 KB gzip). `pixi.js` is external, so it's added on top, along with matter-js and gsap.
- **Lazy-load it behind the Easter-egg toggle**, as PostHog itself does (`frontend/src/lib/components/HedgehogMode/HedgehogMode.tsx`).

**Three ways to put a hog on screen**, from most to least fidelity:

1. **`HedgehogModeRenderer`, lazy-loaded.** You get physics, AI, drag and the full animation set for free. Costs: a WebGL canvas overlay at z-index 999998, and a heavier chunk. **Recommended for the epic and legendary moments and the Easter-egg idle hog.**
2. **CSS sprite from the atlas plus Motion.** Read frame rectangles from `sprites.json` at runtime and step `background-position` with Motion's `animate` driving a frame index at 24-30 fps. Motion springs handle the arcs: jump onto a card, drop in; flip direction with `scaleX(-1)`.
   - About 100 lines, with no Pixi, Matter or gsap.
   - Frames may not sit in one contiguous row per animation, so plain CSS `steps(n)` may not work; drive the frame index from JS.
   - **Recommended for small inline moments** such as the avatar, the quest crest cameo, and the store sign.
3. **Original art.** Our own pixel creature drawn as a sprite strip, animated with `steps(N)` and `image-rendering: pixelated`. It must **not be a hedgehog** (brand policy bans derivative hog styles and AI hog art). This is the fallback if PostHog ever asks us to drop Hedgehog Mode, and the default for the non-PostHog Kudos skin.

## Decisions taken (AFK) and rationale

1. **Nothing PostHog-drawn is committed to this repo.** The repo is public, and every PostHog illustration and crest is either PolyForm Strict or under the "property of PostHog" rule. Even the MIT-declared Hedgehog Mode atlas stays out of git, so dropping it is a one-line dependency change if PostHog objects. We dropped our own screenshots of the hoggies, crests and home pages for the same reason; the note links to the live pages instead.
2. **Hedgehog Mode is the one hog we use, via npm plus a pinned-CDN `assetsUrl`, with credit.** It's the only hog with an affirmative open licence from PostHog ("MIT — go forth and hedgehog"). The demo is PostHog-related, and it's the same toy PostHog ships inside its own product.
3. **Tokens come from posthog.com and Lemon, not from `@posthog/brand`.** The latter is PolyForm Strict and self-described as unfinished and AI-generated.
4. **Fonts:** IBM Plex Sans for UI and buttons, Nunito as the RoundHog stand-in for display, Source Code Pro for mono. RoundHog, Matter, Squeak and Loud Noises are not licensed to us.
5. **Crests are original heraldry, and hoggies are art slots.** No AI-drawn hedgehogs, per PostHog's explicit rule. Real art arrives only through a permission request.
6. **Copy follows PostHog's tone guide in the PostHog skin.** No emojis, and no "unlock"; rarity is spelled out in words.
