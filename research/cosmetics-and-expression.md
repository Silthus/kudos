# Cosmetics and expression in Slack

Checked 2026-10-13. **Research and recommendations, not an approved spec.** Builds on [Octalysis progression](octalysis-progression.md); catalogue sizes and asset budgets below are proposals, not usage data.

**Start with original celebration cards attached to chosen quips, achievement-linked flair, and an App Home collection.** A “sticker” can be a transparent PNG or animated GIF, but Kudos must supply the collection, ownership and equip controls. Keep the member's thank-you central; cosmetics never change recognition value.

## Slack platform facts

### Surfaces

| Surface | What the app can render/do | Limits and implication |
| --- | --- | --- |
| Public thread reply | `chat.postMessage` with `thread_ts`: image/GIF, formatted text, context badges and buttons. Requires `chat:write` and conversation access. | Keep `reply_broadcast: false`; private-channel posting requires membership. This is an app message, not a decoration of the giver's original message. [S1][S3] |
| Giver ephemeral | `chat.postEphemeral` accepts blocks, including images; `chat:write`. | Delivery requires an active member and is not guaranteed. Disappears across sessions/reloads; thread ephemerals require an active thread. Docs advise messages ≤4,000 bytes. Use for brief feedback/preview, never the only unlock record. [S2] |
| App–member DM | `chat.postMessage` supports the same message blocks. Passing a member ID can open the app's DM. | Appropriate for level-up cards and unlock summaries; this does not grant access to arbitrary human–human DMs. [S1] |
| App Home | Private per-member Home tab, published with `views.publish`; images, text and equip controls. | Enable Home; publishing needs authentication but no method-specific OAuth scope. It is not a public Slack profile or a web page. Another member cannot browse someone's Home without an app-built interaction showing permitted information. [S3][S4][S4a] |

### Rendering and rarity

| Capability | Verified fact / practical choice |
| --- | --- |
| Image/GIF blocks | Available in messages and Home. Supported formats: PNG, JPG/JPEG, GIF. Supply public `image_url` (≤3,000 characters) or a supported `slack_file`; required `alt_text` ≤2,000 characters. [S5] |
| Animation and size | Slack supports animated GIFs; viewers can disable automatic animations. The image-block reference specifies **no byte, dimension, duration or frame-count ceiling**: do not invent a “Slack GIF limit.” Custom emoji instead recommend under 128 KB and allow GIFs up to 50 frames; legacy thumbnails have a 500 KB limit. [S5][S9][S11][S17][S17a] |
| Text/layout | `rich_text` supports structured text, mentions, emoji, lists and quotes. Ordinary text styling has no arbitrary foreground colour. A section supports a compatible accessory, including an image; context supports up to 10 image/text elements. Maximum 50 blocks/message, 100/Home. [S3][S6][S6a][S7][S7a] |
| Native colour detail | Current docs also expose `rich_text` **tags** with a fixed colour palette (including green, blue, purple, orange), and a separate hex-valued **color element**. These are not a `text.color` property. Consider tags for rarity labels after checking client rendering; ordinary coloured titles remain unavailable. [S8][S8a] |
| Reliable rarity display | Pair ◻️ Common, 🟩 Uncommon, 🟦 Rare, 🟪 Epic, 🟧 Legendary with words. Images can use exact WoW-style colours, e.g. `#FFFFFF`, `#1EFF00`, `#0070DD`, `#A335EE`, `#FF8000`, plus accessible labels/contrast. These hex values are proposed art tokens, not Slack's tag palette. |
| Colour bars and frames | Legacy message attachment `color` adds a hex-coloured **left border**, not text colour; attachments are not Home blocks. Slack discourages legacy presentation. Ephemeral docs reject attachments containing blocks. Use a pre-rendered illustrated border for an elaborate frame; no arbitrary CSS or overlay on a Slack avatar. [S9][S2][S3] |
| Native stickers | The documented app block/element catalogue has no sticker-pack installation or native sticker object. “Sticker” means an image posted by Kudos, with collection state in Kudos. Do not promise unlocks in Slack's emoji/GIF picker. [S3][S5] |

### Permissions and boundaries

| Idea | Availability / recommendation |
| --- | --- |
| Add custom Slack emoji | `admin.emoji.add` is an **Enterprise organization** Admin API (Enterprise Grid context), not a normal workspace bot API. It currently requires a **user token with `admin.teams:write`**, org-wide installation by an authorized Org Admin/Owner, and documented admin-role permissions. Do not assume an `admin.emoji:write` scope. [S10] |
| Curate existing emoji | `emoji.list` uses `emoji:read`; admins can select existing workspace emoji, or authorized people upload them manually. Workspace custom emoji are usable by everyone: exclusivity can only mean **Kudos entitlement**, not exclusive Slack use. Unicode is likewise unrestricted. Handle deleted/renamed custom emoji gracefully. [S11][S12] |
| Cosmetic reactions | `reactions.add` needs `reactions:write` and a named available emoji; reaction belongs to the bot, not the giver. One bot/emoji/message combination; duplicates return `already_reacted`. Slack enforces distinct-emoji and per-actor limits (`too_many_emoji`, `too_many_reactions`), without numerical caps in this reference. Tier 3 is 50+ calls/minute; respect rate-limit responses. Keep the existing kudos acknowledgement and at most one optional cosmetic reaction. [S13] |
| Custom bot identity | `chat:write.customize` permits per-message `username`, `icon_url`, `icon_emoji`. Slack requires user permission and an initiating action, with clear expectations. Avoid it initially: retain Kudos attribution and put the member's title in the body. [S1] |
| Actual profile/title/status | `users.profile.set` requires a **user token**, `users.profile:write`, and field/admin/plan restrictions; it cannot create custom field definitions. Custom fields must already be configured by admins. A bot token cannot silently equip a title on a person's real profile or overwrite their status. Keep flair inside Kudos. [S14] |
| Hosting | Convex `storage.getUrl` yields a file URL accessible without further app authentication to anyone holding it, suitable in principle for Slack's public image fetch. Use generic art only; retain URLs/assets needed by historical messages and confirm Slack fetch/render before shipping. No web UI is required. Slack-hosted files are an alternative with upload scopes and file-access considerations. [S5][S15] |
| Unfurls | Prefer explicit image blocks. Custom app unfurls require registered domains, `link_shared`, `links:read` and `links:write`. Disable incidental link/media unfurls on posted messages to avoid duplicate previews. [S1][S16] |
| GIPHY | Slack's current native GIF picker is GIPHY-powered. Its existence neither gives Kudos an API licence nor lets a bot operate that picker. Self-hosted art needs no GIPHY installation. [S17][S18] |

The first set needs no new identity, profile, emoji-upload, file-upload or unfurl scopes. Ordinary app installation remains subject to each workspace's approval policy.

## Cosmetic catalogue

**Easy** = existing text/emoji blocks and entitlement selection; **medium** = original assets or collection/selection flow; **hard** = generated compositions, extra permissions or significant moderation. Ratings assume the planned progression/entitlement foundation exists. Rarity describes the item's design/provenance, never appreciation's value. Every public effect is optional; images have descriptive alt text and a useful static first frame.

### Quip thread reply

| Unlockable / why it is fun | Feasibility | Rarity fit | Unlock source fit |
| --- | --- | --- | --- |
| **Celebration cards:** tiny taco taking a bow, paper high-five, sprout blooming, constellation connecting. Quip plus one PNG/GIF feels like a chosen greeting card. | Medium | Common–legendary; prestige through distinctive art, not larger animation | Perk chooses a starter pack; reserved achievement editions; later drops/store variants |
| **Titles/flair:** “the Generous”, “Bridge Builder”, “Keeper of the Flame”; display “<member> · Bridge Builder” in context. Identity with a story. | Easy | Uncommon–epic, legendary for long-lived milestones | Achievements first; playful non-status titles in coin store |
| **Rarity badge / maker's seal:** ribbon, wax seal, tiny constellation medal alongside the title. Recognizable without occupying the channel. | Easy text; medium art | All five | Derived from owned item/achievement; do not sell fake achievement badges |
| **Quip frames:** postcard edge, origami corners, botanical border, star-map border baked into the card. A cohesive stationery style. | Medium static; hard personalized composition | Uncommon–epic | Coin store later; achievement-specific art exclusive |
| **Signature sign-offs:** “With a paper high-five.” / “Filed under: well deserved.” Choose instead of, or within, a quip. A recognizable voice. | Easy | Common–rare | Signature/Repertoire perks; deterministic coin-store packs later |
| **Sound-free celebration sets:** slow confetti, gently orbiting stars, a tiny standing ovation. Delight without audio or flashing. | Medium | Rare–legendary | Drops/store for general sets; exclusive achievement sets |
| **Seasonal editions:** rainy-day gratitude, summer postcards, cozy lanterns; alternatives to region-specific holidays. Collections tell time. | Medium | Uncommon–epic | Store/event unlock later; recurring availability, permanent ownership, no countdown pressure |

### App Home profile and collection

| Unlockable / why it is fun | Feasibility | Rarity fit | Unlock source fit |
| --- | --- | --- | --- |
| **Banner/theme packs:** botanical desk, night sky, paper workshop; header artwork plus matching small icons. A personal corner of Slack. | Medium; no Slack-wide theme changes | Common–epic | Coin store; one free baseline; achievement banner editions |
| **Sticker book:** named albums, owned previews, silhouettes with visible unlock criteria, favourite shelf. Collecting stays quiet. | Medium | All; album UI itself free | Album contains rewards from every source; completion badge is cosmetic only |
| **Loadout:** title + card + kudos emoji, with one small preview and “None”. Choice becomes tangible. | Easy/medium | Inherit equipped items' rarities | Equip UI free; slots and accessibility settings never perks/store items |
| **Achievement trophy shelf:** choose three earned medals to feature privately; optional public flair. Personal pride without a score wall. | Easy text; medium illustrated | Rare–legendary | Achievements only; achievement tier and item rarity are separate labels |
| **Collection companion:** a tiny original mascot on the banner with different poses, costumes and idle GIFs. “My little cheering squad.” | Medium fixed poses; hard compositing | Uncommon–legendary | Store outfits, achievement accessories, later drops; no pet-care obligations |

### DM, ephemeral and reactions

| Unlockable / why it is fun | Feasibility | Rarity fit | Unlock source fit |
| --- | --- | --- | --- |
| **Level-up celebration style:** sprout becomes a tree, ticket gets a gold stamp, constellation gains a star. A chosen moment of progress. | Medium | Common–epic; legendary milestone edition | Baseline free; achievements/store variants, no XP bonus |
| **Unlock reveal envelope:** card slides from an envelope in a DM; plain unlock name and equip button stay visible. A satisfying reveal. | Medium | Rare–legendary | Presentation of any unlock, not an extra paid draw; optional static mode |
| **Ephemeral stationery:** compact icon/sign-off on the existing giver receipt, e.g. “Thanks delivered 🌱”. Personal feedback without another message. | Easy | Common–rare | Perk/store theme pack; allowance/outcome text always clear |
| **Bot celebration reaction:** one chosen 🌟/👏 or existing approved custom emoji next to the required acknowledgement. Small public signature. | Easy; admin upload path hard | Common–rare | Perk/store variants; default off, never substitute for the success reaction |

**Noise rule:** one consolidated app thread reply per kudos message, no cosmetic channel broadcasts, no auto-play chains, no extra mentions solely for flair. Quips/cards default to none; offer workspace public-media disable and member static mode. A giver's private preference cannot guarantee motion-free viewing for everyone, so default public art to static. Keep private recognition context out of public level-up/achievement notices; cosmetics do not widen an announcement's audience.

## Content, rights and delivery

| Option/risk | Recommendation |
| --- | --- |
| GIPHY API in a bot | API terms require GIPHY attribution/logo and permit revocable API integration. Current standard guidelines require client-side requests and prohibit proxying and unapproved caching/storage of media and media URLs. **Inference:** a Convex-only bot, durable curated inventory and Slack-mediated fetching do not straightforwardly fit those rules; obtain written integration approval before adopting it. Slack's own integration is not permission for ours. [S18][S19] |
| Downloading internet GIFs | A GIF being searchable is not a blanket licence to rehost, edit, sell or brand it as an exclusive unlock. GIPHY's user terms restrict copying/commercial exploitation without applicable permission. Do not put movie clips, celebrity reactions or scraped “stickers” in the store. [S20] |
| Original artwork | Commission a small coherent pack with explicit commercial display, modification, distribution and hosting rights; retain licence/provenance. AI-assisted art is an option after checking provider terms and reviewing for likenesses/brands. US copyright protection requires sufficient human authorship; prompts alone are insufficient. Platform entitlement can still be exclusive without claiming exclusive copyright. [S21] |
| Tenor | **Not a viable API dependency:** Google says new keys/integrations ended January 13, 2026 and the public API was decommissioned June 30, 2026; subsequent requests fail. Continued Tenor access in Google-owned apps is a separate matter. [S22] |
| Moderation | Launch only a human-reviewed allowlist: kind, culturally broad, workplace-safe, no violence, sexual content, ridicule, politics, employee photos or personal data. No runtime GIF search or member-uploaded art initially. Preview every asset/text combination; retire problematic art while preserving entitlement with an equivalent safe replacement. |
| File size/performance | Proposed asset budget: ≤200 KB PNG, ≤1 MB GIF, ~320–480 px wide, 2–3 seconds of gentle motion, no flashing; static first frame and separate PNG. These are **Kudos budgets**, not Slack limits. Use compact thumbnails in context/accessories and paged Home albums; one image per reply. GIFs have no audio. |
| Accessibility/reliability | Put titles, rarity and unlock criteria in real text, not only pixels/colour. Include equivalent essential message content in top-level `text` for screen readers, plus image alt text. Render success/allowance/unlock text even when art is unavailable. Use stable versioned assets; measure fetch/render on desktop/mobile, light/dark mode and animations disabled before release. [S1][S5] |

No real-money purchases, tradeable assets, paid random draws or cosmetic-driven XP. Never spend coins to send an already-owned card: expression should remain reusable.

## First set and unlock allocation

**This map:** keep Palette/Palette Plus for curated kudos emoji, Signature/Repertoire for known quips. Add **three static card designs** (paper high-five, botanical thanks, star postcard), tied to specific Signature/Repertoire quips, plus **one gentle GIF with a PNG counterpart**, initially in private previews/DMs. Reuse the art in Home; free equip/unequip, preview and a small owned-items list. No independent frame engine, wallet, randomized card pool or asset generator.

Give achievement quips matching exclusive card artwork. Show earned milestone labels as optional flair derived from the achievement. The prior research restricts achievement rewards and drops to quips/emoji: **independent title/card entitlements and expanded drop pools are proposed extensions**, requiring an explicit catalogue decision. Do not silently replace existing rewards, reroll outcomes or change achievement criteria. This keeps the initial artwork as presentation of existing rewards.

| Source | Best job | First versus later |
| --- | --- | --- |
| Perks / skill points | Deterministic expression choices, as in Palette and Signature; themed quip packs with coherent card art | First. No perk needed to equip, turn animation off or hide flair |
| Achievements | Exclusive milestone quips/emoji and associated art/flair with visible provenance | First derived presentation; independently equippable titles/badges later if approved |
| Drops | Surprise variants of general cards/quips, never achievement-exclusive editions | Later. Preserve prior odds, persisted outcomes, duplicate protection, guarantees and known-reward mode; no new reward table by implication |
| Coin store | Fixed-price named reusable cosmetics: banners, stationery, mascot outfits, ordinary titles | Later coins feature. Preview full item; separate store catalogue from exclusive achievement rewards; no purchasable roll attempts |

Later: independent title/card inventory, paged sticker albums, banners, store packs, recurring seasonal collections, then mascot poses. Legendary should mean distinctive, hard-earned provenance, not louder effects or a larger occupied area.

## Open questions for Michael

| Question | Recommended answer |
| --- | --- |
| Are cards/titles separate rewards in this map? | Start as presentation of quips/achievements; approve independent cosmetic types as a later catalogue extension |
| May public quips animate? | Static by default; optional one small GIF only where workspace policy allows, with static mode; never automatic confetti for every award |
| Who owns the art? | Kudos commissions/creates a small original pack and hosts generic assets in Convex; skip GIPHY/Tenor dependencies |
| What does “exclusive” mean? | Exclusive entitlement inside Kudos; no claim to lock Unicode/custom Slack emoji or prevent image copying |
| Are achievement tier and rarity the same? | No: bronze/silver/gold/diamond indicate ladder progress; white/green/blue/purple/orange classify cosmetic items |
| Are collections and loadout slots paid? | No; baseline Home collection, equip controls and accessibility settings are free |
| Do seasonal items disappear or never return? | Earned items stay; recur on a predictable schedule, with no countdown sales or attendance pressure |
| Can public notices use private-message details? | No; announce only permitted progression facts through the configured route, never the private thank-you or recipient context |

## Sources

Primary sources accessed 2026-10-13. Platform capabilities are documented, **not tested in a live workspace**; feasibility and catalogue choices are design judgments.

- [S1 — Slack: chat.postMessage][S1]
- [S2 — Slack: chat.postEphemeral][S2]
- [S3 — Slack: Block Kit and surface limits][S3]
- [S4 — Slack: App Home and views.publish][S4] · [publishing API][S4a]
- [S5 — Slack: image block][S5]
- [S6 — Slack: rich text and text styling][S6] · [text element][S6a]
- [S7 — Slack: section/accessories and context][S7] · [context block][S7a]
- [S8 — Slack: coloured tags and color elements][S8] · [color element][S8a]
- [S9 — Slack: legacy attachment colours and thumbnail limits][S9]
- [S10 — Slack: admin.emoji.add][S10]
- [S11 — Slack: custom emoji permissions and shared availability][S11]
- [S12 — Slack: emoji.list][S12]
- [S13 — Slack: reactions.add, limits and errors][S13]
- [S14 — Slack: users.profile.set][S14]
- [S15 — Convex: serving files and public URL access][S15]
- [S16 — Slack: unfurling links][S16]
- [S17 — Slack: native GIF picker][S17] · [animation preferences][S17a]
- [S18 — GIPHY: API terms][S18]
- [S19 — GIPHY: integration and caching rules][S19]
- [S20 — GIPHY: user terms and content rights][S20]
- [S21 — US Copyright Office: AI output copyrightability][S21]
- [S22 — Google: Tenor API sunset FAQ][S22]

[S1]: https://docs.slack.dev/reference/methods/chat.postMessage/
[S2]: https://docs.slack.dev/reference/methods/chat.postEphemeral/
[S3]: https://docs.slack.dev/block-kit/
[S4]: https://docs.slack.dev/surfaces/app-home/
[S4a]: https://docs.slack.dev/reference/methods/views.publish/
[S5]: https://docs.slack.dev/reference/block-kit/blocks/image-block/
[S6]: https://docs.slack.dev/reference/block-kit/blocks/rich-text-block/
[S6a]: https://docs.slack.dev/reference/block-kit/block-elements/text-element/
[S7]: https://docs.slack.dev/reference/block-kit/blocks/section-block/
[S7a]: https://docs.slack.dev/reference/block-kit/blocks/context-block/
[S8]: https://docs.slack.dev/reference/block-kit/block-elements/tag-element/
[S8a]: https://docs.slack.dev/reference/block-kit/block-elements/color-element/
[S9]: https://docs.slack.dev/legacy/legacy-messaging/legacy-secondary-message-attachments/
[S10]: https://docs.slack.dev/reference/methods/admin.emoji.add/
[S11]: https://slack.com/help/articles/206870177-Add-custom-emoji-and-aliases-to-your-workspace
[S12]: https://docs.slack.dev/reference/methods/emoji.list/
[S13]: https://docs.slack.dev/reference/methods/reactions.add/
[S14]: https://docs.slack.dev/reference/methods/users.profile.set/
[S15]: https://docs.convex.dev/file-storage/serve-files
[S16]: https://docs.slack.dev/messaging/unfurling-links-in-messages/
[S17]: https://slack.com/help/articles/26860009071251-Add-GIFs-to-a-message-in-Slack
[S17a]: https://slack.com/help/articles/228023907-Manage-animated-images-and-emoji
[S18]: https://support.giphy.com/hc/en-us/articles/360028134111-GIPHY-API-Terms-of-Service
[S19]: https://developers.giphy.com/docs/api/best-practices/
[S20]: https://support.giphy.com/hc/en-us/articles/360020027752-GIPHY-User-Terms-of-Service
[S21]: https://www.copyright.gov/newsnet/2025/1060.html
[S22]: https://support.google.com/tenor/answer/10455265?hl=en
