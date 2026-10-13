# Slack Block Kit for App Home and website links

Research for [#59](https://github.com/Silthus/kudos/issues/59), under [website map #57][map]. Checked against live first-party documentation and Slack's public validation endpoint on **2026-10-13**. This report proposes choices for #62, #63, #64 and #65; it does not lock product decisions. All sample values and identifiers are synthetic.

## Findings that matter next

- **A styled Home can stay native.** Headers, compact fields, images and buttons are available, and current Slack also supports native cards, containers and carousels on Home. The older claim that Home is only a stack of ungrouped sections is outdated. [Headers][header] [Sections][section] [Cards][card] [Containers][container] [Carousels][carousel]
- **Keep full brand styling on the website.** Home's documented schemas expose constrained layout and formatting, without arbitrary fonts, CSS or section text colours. There are narrower colour features: button styles, rich-text tags and hex swatches. [Home view][home-view] [Buttons][button] [Tags][tag] [Swatches][color]
- **Start with durable, ordinary HTTPS links plus website authentication.** Route parameters select a workspace, member and view; permission comes from the authenticated viewer. This follows the map's same-workspace and private-view rules. A URL containing a member ID is not proof of the opener's identity. [Map decisions][map] [Authorization][authz]
- **A signed URL can skip login only if we deliberately make possession a credential.** That is a custom bearer-login design with forwarding, leakage and replay risks, not a property of Block Kit. Slack separately offers paid **Sign in with Slack links**, requiring Slack enablement and domain verification. [Bearer-token risks][bearer] [Slack identity links][siws]
- **Use external images for decorative art first.** A member's rendered PNG can be displayed, but a private Home does not make its publicly hosted image private. Cache lifetime, refresh and revocation are not guaranteed by the image reference. [Image blocks][image] [Static-resource authorization][authz]

## 1. Existing Home and the smallest change

Build on [earlier Slack research §5 and §6][earlier], which already covers Home setup and the separation between bot installation and OIDC sign-in. This report does not repeat that setup.

The inspected core-loop branch publishes on `app_home_opened` for the Home tab, gets `HomeFacts`, runs `renderHome`, and wraps each returned line in a `section` using `mrkdwn`. It publishes with `user_id` and no `hash`. The member view currently contains four sections: daily allowance, weekly and lifetime given/received totals, giving instructions, and channel onboarding. The non-member view contains one eligibility sentence. Its existing `appHomeLink` points **into Slack**, using `slack://app?...&tab=home`; it is not a website link. [Adapter at inspected commit][existing-home] [Renderer at inspected commit][existing-renderer]

**Recommendation:** add structured presentation in the Slack adapter, keeping engine facts and game rules unchanged. For the first website slice, present the existing allowance and recognition totals with one profile link. Later XP, level and collection summaries wait for their map #1 stopping points. This follows the website map's thin-slice and shared-command decisions. [Map][map]

## 2. Layout capabilities and limits

| Building block | What Home can do | Constraint and design consequence |
| --- | --- | --- |
| `section` | Text, fields, and one compatible accessory beside the text | Text: 3,000 characters. Up to 10 fields, 2,000 characters each, in a compact two-column layout. This is not an arbitrary responsive grid. [Reference][section] |
| `header` | A larger bold heading | `plain_text`, up to 150 characters. Current schema also exposes heading `level` 1–4; it does not expose a font family or pixel size. [Reference][header] |
| `divider` | A horizontal separator | No general margin, padding or border styling interface. [Reference][divider] |
| `context` | Secondary text and small images | Up to 10 text/image elements. Keep primary totals in sections, rather than hiding them in context. [Reference][context] |
| `actions` | A row of interactive elements | Up to 25 elements; that is a payload ceiling, not a sensible navigation count. [Reference][actions] |
| `card` | Native title, subtitle, body, icon, hero image and action buttons | Up to 3 buttons; title/subtitle 150 characters, body/subtext 200. No card-size attribute. The examples use text objects despite the fields table describing some text fields as strings. Both report samples use the example shape and were validated. [Reference][card] |
| `container` | Group child blocks under a title, optionally collapsible | Up to 10 supported child blocks. Width is `narrow`, `standard`, `wide` or `full`; constrained sizes are platform-defined. Supports header divider and default collapsed state. It is not a CSS container. [Reference][container] |
| `carousel` | A horizontally scrolling set of cards | 1–10 cards. Useful to explore later collection previews, rather than making the first profile slice scroll sideways. [Reference][carousel] |
| `table` | Real rows and columns | Up to 100 rows and 20 cells per row; column alignment/wrapping settings. This is tabular content, not a layout hack for arbitrary controls. [Reference][table] |
| `data_table` | Rich tables with pagination, sorting and filtering | Up to 200 data rows plus the header, 20 columns; supports button cells. A later board option, subject to the map's leaderboard visibility rules. [Reference][data-table] [Map dependency G45][map] |
| `data_visualization` | Native bar, line, area and pie charts | Chart schema has no custom colour field or progress-bar block. It can show data, but does not reproduce a branded XP meter. [Reference][chart] |
| Complete view | One `type: "home"` view with a `blocks` array | Home and modals allow 100 blocks; messages allow 50. Keep the Home compact rather than treating 100 as a target. [Home view][home-view] [Blocks][blocks] |

Cards and carousels were announced on **2026-04-16**. Check current docs rather than older Block Kit summaries when designing #62. Alerts are documented for modals only; the separate standard `markdown` block is documented for messages only. Use `mrkdwn` or structured `rich_text` for Home. [Changelog][new-blocks] [Alerts][alert] [Markdown block][markdown] [Rich text][rich-text]

### Publishing and `hash`

`views.publish` creates or replaces a user's Home. Its optional **top-level request** `hash` is Slack's view-state concurrency token, not a checksum to compute from our blocks and not an image-cache key. Slack returns a hash with a published view and includes view state in interactions; a mismatched publish hash returns `hash_conflict`. [Publish method][publish] [Action payload][block-actions]

**Recommendation:** if refresh-on-open and interactive/background refreshes can overlap, carry the hash associated with the view being changed. On conflict, rebuild from current authoritative facts or let the next open refresh it; do not retry stale blocks without the hash. Keep initial publication without a known hash. Hash protection does not replace ordering/versioning of the domain facts being rendered. This is an application proposal based on Slack's concurrency contract. [Publish][publish]

## 3. Colour, typography and brand

`mrkdwn` supports emphasis, strike, code, quotes, line breaks, links and emoji using Slack's syntax, for example `*bold*`, `_italic_`, and `<https://example.com/me|Open my profile>`. It is not HTML or standard Markdown. Structured rich text also supports lists and styled text. Neither gives the Home renderer a general font or CSS interface. [Formatting][formatting] [Rich text][rich-text] [Home view schema][home-view]

The practical colour options are limited and distinct:

- Buttons offer default, `primary` and `danger` styles, with Slack-controlled treatments. They are not a brand-palette input. [Buttons][button]
- Rich-text `tag` elements offer named colours: gray, brown, purple, indigo, blue, green, yellow, orange and red. They cannot take an arbitrary WoW rarity hex. [Tags][tag]
- Rich-text `color` elements display a **hex swatch**. They do not colour surrounding text. [Swatches][color]
- Legacy message attachments offer a coloured **left border**, including custom hex colours. Attachments belong to message payloads, not the Home view schema, and Slack recommends Block Kit instead. Do not use that message feature as a Home styling plan. [Attachments][attachments] [Home fields][home-view]

**Recommendation for #63:** express the PostHog brand through approved mascot art, copy and hierarchy in Slack, and through full light/dark styling on the website. Keep exact rarity colours on the website or in approved image art; a named native tag can also spell out a rarity, but is not an exact palette match. The map already restricts WoW colours to rarities. [Brand decision][map]

Slack recommends testing both light and dark mode and never conveying meaning by colour alone. Emoji aliases are read by screen readers and users can disable emoji rendering; pair meaningful emoji with text rather than building a colour-only or emoji-only progress meter. [Design guidance][design]

## 4. Images, generated cards and progress PNGs

An `image` block displays a standalone image. An image element can appear as a section accessory or in context; cards additionally support hero and icon image fields. Blocks support PNG, JPG/JPEG and GIF, with either an external `image_url` or a `slack_file` source. External URLs are documented as **publicly hosted**; the payload has no browser-session cookie or custom authorization-header field for fetching them. [Image block][image] [Image element][image-element] [Card][card]

**Inference:** a server-generated profile card or progress bar is viable if the server produces a supported raster image and Slack can fetch the bytes. The generation tool is irrelevant to Block Kit. A PNG has its own colours and typography, but those pixels are not selectable text or independently clickable controls; place the website link in an adjacent native button. The image schema offers no per-region actions. [Image schema][image] [Button][button]

### Hosting and privacy

| Image source | Consequence | Proposal |
| --- | --- | --- |
| External decorative asset | Public delivery is compatible with the image contract | Use a versioned HTTPS URL for approved mascot art. Keep member data out of it. [Image][image] |
| Publicly hosted personalized PNG | Whoever has the URL can obtain the image; Home's private surface does not authorize that external request | Do not make this the default for member data. The map allows no public member pages. [Image][image] [Map audience][map] |
| Expiring signed image URL | Signature/expiry can limit origin access, but URL possession still conveys access while valid | Requires an explicit privacy trade-off. It does not guarantee deletion of copies already fetched. Treat cache refresh/revocation as unverified. [Bearer principles][bearer] |
| `slack_file` image | Requires a Slack image file ID or URL and access for the posting identity | Test the intended viewer's access before adopting it. Docs do not prove that a bot-private upload automatically becomes readable to the Home viewer. [Slack file object][slack-file] |

Slack's upload completion method requires `files:write`; when no `channel_id` is specified, the file remains private. Sharing a rendered personal image to a broad channel solely to make Home render would undermine the audience rule. The upload/access arrangement is a prototype question, not resolved by this research. [Upload completion][upload] [Map][map]

### Caching and accessibility

The image references do **not** promise a cache TTL, same-URL refetch schedule, cache purge API, or reliable behaviour after a signed URL expires. Those claims remain **unverified**. Recommendation: use immutable, revisioned image URLs, republish the changed URL with the view, and keep the authoritative totals in native text. A new URL is a freshness strategy to test, not a guarantee that every client immediately refreshes. [Image reference checked][image] [Publishing][publish]

Every image needs plain, descriptive `alt_text`; image blocks allow up to 2,000 characters. Describe information, such as “Level 4; 60 of 200 XP toward the next level”, rather than only “profile card”. Repeat essential progress as native text so broken image delivery does not hide it. Avoid redundant decorative images because their alt text also gets read. Slack's chart accessibility guidance additionally recommends an accessible PDF with a tagged data table for chart screenshots; a chart-heavy design needs that considered. The quoted progress is a synthetic future example, not existing data. [Image fields][image] [Accessibility][design]

## 5. Interactivity from Home

Buttons, overflow menus and selects are supported on Home. URL buttons load the specified URL in the browser, but Slack **still sends an interaction payload that needs acknowledgement**. `value`, `action_id`, and view `private_metadata` go back to the app in Slack payloads; they are not automatically appended to the browser URL. Put navigation context in `url` explicitly. [Button][button] [Action payload][block-actions] [Home metadata][home-view]

Overflow menus have up to five options and can open URLs. Select menus support static options, externally loaded options, users, conversations and public channels. Static selects allow up to 100 options. An option's `url` is available only for overflow menus, so do not design a static select as a website navigation menu by adding URLs to its options. External selects require an Options Load URL. [Overflow][overflow] [Options][option] [Selects][select] [Interactivity setup][interactivity]

To open a modal from Home, handle a user interaction and call `views.open` with its `trigger_id`. Triggers expire after **three seconds** and can be exchanged once; Home opening alone is not a substitute for the user interaction. HTTP interaction requests must separately receive a 200 acknowledgement within three seconds. Open a lightweight modal promptly rather than waiting for expensive rendering or backend work. [Modals][modals] [Interaction deadlines][interactivity]

Verify Slack's signature against the raw form body before interpreting its JSON `payload`; derive the actor from the verified interaction. A button label, option value or URL does not independently authorize an operation. Recommendation: future actions use the same platform-neutral commands as the website, as required by the map. Plain `mrkdwn` links can be the initial navigation choice if the interaction endpoint is not yet configured. [Request verification][signatures] [Payload encoding][interactivity] [Map commands][map]

## 6. Deep links into the website

### Navigation contract to explore in #64

Slack supports URL buttons and explicit links in `mrkdwn`; these work in Home and message layouts, including DMs and thread replies. Ephemeral messages also accept blocks and formatted text, with their existing best-effort delivery constraints. A website click is ordinary browser navigation, separate from the app's signed Slack callback. [Buttons][button] [Formatting][formatting] [Posting messages][post] [Ephemerals][ephemeral]

Proposed synthetic routes, not locked endpoints:

```text
https://example.com/me?workspace=TEXAMPLE&view=profile&source=slack-home
https://example.com/w/TEXAMPLE/m/UEXAMPLE?view=profile&source=kudos-message
https://example.com/me?workspace=TEXAMPLE&view=collection&source=slack-dm
```

Use `me` for the **authenticated opener's** private views. Use a member target for another member's permitted profile card. Carry opaque workspace/member IDs and a small allowlisted view, not names, email addresses, hidden progress, bot tokens or sessions. The workspace hint helps choose the destination and OIDC flow; the backend must compare it with the authenticated identity and current membership. The map's profile-card projection excludes XP, coins, perks, streaks and kudos received. [Map audience][map] [Profile-card vocabulary][lexicon] [Per-request authorization][authz]

**Recommended click flow:** valid website session → authorize the requested workspace/view → open it; otherwise → Sign in with Slack → validate identity and membership → restore the intended relative destination. Store that destination with random OAuth `state`, validate `state`/`nonce` and the ID token, and allow only internal destinations. Signing a destination prevents tampering but does not authenticate the person who clicks it. The flow is a proposal based on Slack's OIDC and authorization contracts. [OIDC][oidc] [Authorization][authz]

A `#fragment` can carry browser-local navigation state, but fragments are not sent in the HTTP request to the server. They are not an authentication or secrecy mechanism: a copied link still contains the fragment, and client code can read it. Prefer paths/query parameters for the first destination contract. [URI fragments][fragment]

### Surface-specific link choices

| Surface | Link target and audience proposal |
| --- | --- |
| Own Home | `me` profile; later private collection/progress views. No static login credential in the URL. |
| Personal DM or ephemeral | `me` when wording means “your profile”; a target member route when wording means “their profile”. Keep private information in a personal surface. |
| Shared kudos message or thread | A target member's permitted profile card, or a `me` link that resolves independently for each opener. Never a giver's personal dashboard credential. |

These are product proposals derived from the map's privacy model. A normal thread reply shares the conversation's audience; an ephemeral is recipient-specific but not a durable receipt. [Map][map] [Earlier surface research §3][earlier]

For the reverse trip, the existing `slack://app?team={TEAM_ID}&id={APP_ID}&tab=home` is Slack's documented native-client link. `https://slack.com/app_redirect?app={APP_ID}&team={TEAM_ID}` is an HTTPS route to the app-user conversation, not the same exact Home-tab destination. Test the desired return behaviour on desktop and mobile. [Deep linking into Slack][deep-links]

### Unfurls

Classic unfurling crawls message URLs and reads preview metadata. For messages sent with `chat.postMessage`, setting **both** `unfurl_links: false` and `unfurl_media: false` suppresses the respective unfurls; Slack documents this as stopping its crawl. These are message fields, not Home-view fields. `chat.postEphemeral` does not document those suppression arguments, so do not assume it accepts the same flags. [Unfurling][unfurls] [Ephemeral arguments][ephemeral]

**Recommendation:** use generic website metadata for signed-out requests and disable previews on app-posted profile links. Do not embed private member facts in OpenGraph images or a signed-out HTML response. Even with suppression on our posts, users can copy and repost a link, so destination authorization remains essential. Native URL buttons offer compact navigation; whether every client/crawler treats button URLs and ephemerals identically is **unverified**. Never rely on absence of an unfurl to protect a credential. [Unfurls][unfurls] [Authorization][authz]

Custom app unfurls require registered domains, `links:read`, `links:write`, `link_shared`, and `chat.unfurl`. The docs limit domain registration to five and warn that everyone in the conversation can see an unfurl even if the posting person authenticated first. The docs also say apps do not receive `link_shared` for their own messages, with differing wording elsewhere about app/integration messages; do not depend on an event to decorate our own posts. This is extra scope for later, not needed to ship a button. [Unfurl setup and caveats][unfurls]

### Can a signed link skip another login?

| Mechanism | What it proves | Implication |
| --- | --- | --- |
| Ordinary route plus existing authenticated website session | The session identifies the browser viewer; the route selects content | Simplest first slice. Without a website session, use OIDC. [OIDC][oidc] [Authorization][authz] |
| Signed navigation parameters | The issuer approved the parameters | Still needs viewer authentication; a signature does not prove who clicked. [Bearer-security principles][bearer] |
| Custom signed/opaque login token in a URL | Whoever opens it possesses the token | Can issue a session without OIDC only by deliberately accepting possession as identity. Forwarding can sign another browser in as the original member. URL credentials can leak through history and logs. [RFC 6750 §5.3][bearer] |
| Slack **Sign in with Slack links** | Slack transfers the clicking user's identity through its OIDC integration | Paid feature with Slack enablement/domain verification and ordinary OIDC prerequisites. It can begin a login on link click, including when the app is not installed. It is not enabled automatically by putting `team`/`user` in a URL. [Setup][siws] [Flow details][siws-auth0] |

**Recommendation:** do not use custom bearer-login links in the first slice. If later grilling chooses them, use fresh, short-lived, single-use tokens with a server-side one-way verifier or replay ledger, bind issuer/audience/workspace/member/purpose/destination, recheck current membership at redemption, and exchange into a normal protected session. A signature and expiry alone do not make a token single-use. Never post such tokens to a shared thread, never redeem on a crawler's GET, suppress/refuse unfurls, avoid third-party resources and token logging at the redemption page, use `Referrer-Policy: no-referrer`, and redirect to a clean URL after redemption. Handle expired links with OIDC rather than breaking navigation. These are security proposals adapted from OWASP's URL-token guidance and bearer-token risks; the actual flow would need a separate reviewed design. [URL-token guidance][url-tokens] [Bearer risks][bearer] [Session protection][session]

The paid SIWS feature remains an optional future route to explore if click-to-login matters enough. Availability for the intended app/domain, price, and exact consent experience are **unverified**. Do not treat a decoded `login_hint` as a newly authenticated browser session; the guide describes it for checking an already signed-in identity and otherwise initiating OIDC. [SIWS setup][siws] [SIWS login flow][siws-auth0]

## 7. Samples and validation evidence

The following complete Home payloads use only synthetic data and `example.com`. They were submitted without credentials to `https://slack.com/api/blocks.validate` as form-encoded `view` values; both returned `{"ok":true}`. They were **not published to Slack**. The available browser was redirected from Builder to workspace sign-in, so visual rendering, mobile layout and theme appearance remain **unverified**. [Validation method][validate]

### Sample A: compact first-slice Home

[Open Sample A in Builder](https://app.slack.com/block-kit-builder/#%7B%22type%22%3A%22home%22%2C%22blocks%22%3A%5B%7B%22type%22%3A%22header%22%2C%22text%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Your%20Kudos%22%7D%7D%2C%7B%22type%22%3A%22section%22%2C%22text%22%3A%7B%22type%22%3A%22mrkdwn%22%2C%22text%22%3A%22%2A3%20kudos%20left%20today%2A%5CnYour%20daily%20allowance%20resets%20at%20midnight%20in%20your%20time%20zone.%22%7D%7D%2C%7B%22type%22%3A%22section%22%2C%22fields%22%3A%5B%7B%22type%22%3A%22mrkdwn%22%2C%22text%22%3A%22%2AGiven%20this%20week%2A%5Cn12%22%7D%2C%7B%22type%22%3A%22mrkdwn%22%2C%22text%22%3A%22%2AReceived%20this%20week%2A%5Cn8%22%7D%2C%7B%22type%22%3A%22mrkdwn%22%2C%22text%22%3A%22%2AGiven%20in%20total%2A%5Cn42%22%7D%2C%7B%22type%22%3A%22mrkdwn%22%2C%22text%22%3A%22%2AReceived%20in%20total%2A%5Cn27%22%7D%5D%7D%2C%7B%22type%22%3A%22actions%22%2C%22elements%22%3A%5B%7B%22type%22%3A%22button%22%2C%22action_id%22%3A%22open_my_profile%22%2C%22text%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Open%20my%20profile%22%7D%2C%22url%22%3A%22https%3A%2F%2Fexample.com%2Fme%3Fworkspace%3DTEXAMPLE%26source%3Dslack-home%22%7D%5D%7D%2C%7B%22type%22%3A%22divider%22%7D%2C%7B%22type%22%3A%22section%22%2C%22text%22%3A%7B%22type%22%3A%22mrkdwn%22%2C%22text%22%3A%22To%20give%20kudos%2C%20mention%20a%20teammate%20and%20add%20%3Ataco%3A%20to%20your%20message.%5CnTo%20add%20Kudos%20to%20a%20channel%2C%20type%20%60%2Fkudos%60%20there.%22%7D%7D%2C%7B%22type%22%3A%22context%22%2C%22elements%22%3A%5B%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Synthetic%20research%20example.%20The%20website%20uses%20Sign%20in%20with%20Slack.%22%7D%5D%7D%5D%7D)

```json
{
  "type": "home",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "Your Kudos"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*3 kudos left today*\nYour daily allowance resets at midnight in your time zone."
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Given this week*\n12"
        },
        {
          "type": "mrkdwn",
          "text": "*Received this week*\n8"
        },
        {
          "type": "mrkdwn",
          "text": "*Given in total*\n42"
        },
        {
          "type": "mrkdwn",
          "text": "*Received in total*\n27"
        }
      ]
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "action_id": "open_my_profile",
          "text": {
            "type": "plain_text",
            "text": "Open my profile"
          },
          "url": "https://example.com/me?workspace=TEXAMPLE&source=slack-home"
        }
      ]
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "To give kudos, mention a teammate and add :taco: to your message.\nTo add Kudos to a channel, type `/kudos` there."
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "plain_text",
          "text": "Synthetic research example. The website uses Sign in with Slack."
        }
      ]
    }
  ]
}
```

### Sample B: native card and grouped facts

[Open Sample B in Builder](https://app.slack.com/block-kit-builder/#%7B%22type%22%3A%22home%22%2C%22blocks%22%3A%5B%7B%22type%22%3A%22card%22%2C%22title%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Your%20Kudos%22%7D%2C%22body%22%3A%7B%22type%22%3A%22mrkdwn%22%2C%22text%22%3A%22%2A3%20kudos%20left%20today%2A%5CnYour%20daily%20allowance%20resets%20at%20midnight%20in%20your%20time%20zone.%22%7D%2C%22actions%22%3A%5B%7B%22type%22%3A%22button%22%2C%22action_id%22%3A%22open_my_profile%22%2C%22text%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Open%20my%20profile%22%7D%2C%22url%22%3A%22https%3A%2F%2Fexample.com%2Fme%3Fworkspace%3DTEXAMPLE%26source%3Dslack-home%22%7D%5D%7D%2C%7B%22type%22%3A%22container%22%2C%22title%22%3A%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Your%20recognition%22%7D%2C%22width%22%3A%22full%22%2C%22has_header_divider%22%3Atrue%2C%22child_blocks%22%3A%5B%7B%22type%22%3A%22section%22%2C%22fields%22%3A%5B%7B%22type%22%3A%22mrkdwn%22%2C%22text%22%3A%22%2AGiven%20this%20week%2A%5Cn12%22%7D%2C%7B%22type%22%3A%22mrkdwn%22%2C%22text%22%3A%22%2AReceived%20this%20week%2A%5Cn8%22%7D%2C%7B%22type%22%3A%22mrkdwn%22%2C%22text%22%3A%22%2AGiven%20in%20total%2A%5Cn42%22%7D%2C%7B%22type%22%3A%22mrkdwn%22%2C%22text%22%3A%22%2AReceived%20in%20total%2A%5Cn27%22%7D%5D%7D%5D%7D%2C%7B%22type%22%3A%22context%22%2C%22elements%22%3A%5B%7B%22type%22%3A%22plain_text%22%2C%22text%22%3A%22Synthetic%20research%20example.%20Card%20and%20container%20alternative.%22%7D%5D%7D%5D%7D)

```json
{
  "type": "home",
  "blocks": [
    {
      "type": "card",
      "title": {
        "type": "plain_text",
        "text": "Your Kudos"
      },
      "body": {
        "type": "mrkdwn",
        "text": "*3 kudos left today*\nYour daily allowance resets at midnight in your time zone."
      },
      "actions": [
        {
          "type": "button",
          "action_id": "open_my_profile",
          "text": {
            "type": "plain_text",
            "text": "Open my profile"
          },
          "url": "https://example.com/me?workspace=TEXAMPLE&source=slack-home"
        }
      ]
    },
    {
      "type": "container",
      "title": {
        "type": "plain_text",
        "text": "Your recognition"
      },
      "width": "full",
      "has_header_divider": true,
      "child_blocks": [
        {
          "type": "section",
          "fields": [
            {
              "type": "mrkdwn",
              "text": "*Given this week*\n12"
            },
            {
              "type": "mrkdwn",
              "text": "*Received this week*\n8"
            },
            {
              "type": "mrkdwn",
              "text": "*Given in total*\n42"
            },
            {
              "type": "mrkdwn",
              "text": "*Received in total*\n27"
            }
          ]
        }
      ]
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "plain_text",
          "text": "Synthetic research example. Card and container alternative."
        }
      ]
    }
  ]
}
```

These are layout candidates, not approved designs. Replace `example.com` with the deployed website and `TEXAMPLE` with the appropriate workspace hint, retaining server authorization. Builder needs a signed-in Slack browser. If an encoded Builder link does not load its payload, paste the full JSON into [Block Kit Builder](https://app.slack.com/block-kit-builder).

### What was actually checked

| Request to the public validator | Observed result |
| --- | --- |
| Sample A and Sample B as Home views | `ok: true` for both |
| Home with 100 sections / 101 sections | Accepted / rejected with `max_items`, expected 100, got 101 |
| `blocks` with 50 sections / 51 sections | Accepted / rejected with `max_items`, expected 50, got 51 |
| Section with custom `color` / Home view with CSS-like `style` | Rejected as additional properties |
| Home with a modal-only `alert` | **Accepted despite the documented surface restriction** |
| `message` containing `text` plus `blocks` | Rejected with “invalid additional property: text”; `message` containing only `blocks` was accepted |

The last two results mean schema acceptance does not prove a block works on a surface, and the validator's message schema is not the complete posting-method contract. Keep a top-level accessible `text` fallback when actually sending a block message; `chat.postMessage` documents it even though this validation path rejected it. Use the `blocks` argument for message-block validation and verify sending separately. No production API writes were made. [Validator][validate] [Alert surfaces][alert] [Posting accessibility contract][post]

To reproduce a sample check, save its JSON as `home.json` and run:

```bash
curl --silent --show-error --max-time 30 \
  --request POST https://slack.com/api/blocks.validate \
  --data-urlencode view@home.json
```

Research calls included GitHub reads of #57/#59 and pinned branch source, Coherence queries (`practice`, `component research`, `status`, `invariants research/slack-block-kit.md`), official Slack Markdown pages, first-party security guidance, the public schema checks above, and a read-only Builder visit. The source is Slack's live `.md` docs, including surface metadata absent from some HTML extracts. The local Slack docs and Block Kit skill copies supplied that discovery/validation workflow. No installation, identity-link enablement or member-data access was performed.

Artifact checks: both embedded JSON samples parse and match their encoded Builder URLs; all citation identifiers resolve; no bare mentions appear. `coherence spec --check` passed with no components/specs on this branch. `coherence lexicon --check` exited 1 on seven unknown technical nouns in this report, including Home, Block Kit and source-link labels. With this report temporarily outside the worktree, the baseline check exited 0; its 17 historical journal-name records are advisory. The research report's vocabulary check remains a recorded limitation, not a green ship-to-main gate; no vocabulary policy was changed for a throwaway research report.

## 8. Handoff to the next tickets

- **#62, UI prototype:** show Sample A and Sample B as alternatives. Design the website freely within the brand, while Home remains a compact summary. Exercise long text, narrow clients, light/dark mode and image failure before treating a Builder preview as ship proof. [Layout limits][section] [Design guidance][design]
- **#63, visual-language grilling:** decide how much mascot imagery belongs in Home, whether native cards/containers feel appropriate, and whether exact rarity colour needs image art in Slack. No need to decide authentication shortcuts merely to pick colours. [Cards][card] [Containers][container] [Map brand][map]
- **#64, architecture prototype:** test restoration of a destination through OIDC, workspace mismatch, a forwarded link, other-member profile projection, stale Home updates, and image viewer access if personal PNGs are retained. Keep Slack formatting/deep links in the adapter and permission checks on the server. These checks prove the proposed navigation/privacy contract. [Map][map] [Authorization][authz]
- **#65, first-slice spec:** specify the canonical own-profile route, sign-in fallback, member/installation eligibility, totals available today, generic unfurl policy and cross-map link integration. Defer progression screens and actions until their data/commands exist. [Map pacing][map] [Existing facts][existing-renderer]

## References

[map]: https://github.com/Silthus/kudos/issues/57
[earlier]: https://github.com/Silthus/kudos/blob/579c1e258d125a20e2f4116ca8a61625ae8d9e5c/research/slack-platform.md
[existing-home]: https://github.com/Silthus/kudos/blob/b0a1406f42d0b7a755ae0c569d6745b3bdbba518/convex/slack/appHome.ts
[existing-renderer]: https://github.com/Silthus/kudos/blob/b0a1406f42d0b7a755ae0c569d6745b3bdbba518/convex/feedback/home.ts
[lexicon]: https://github.com/Silthus/kudos/blob/63f458b165ac84b8da33e3a4ebdfc1e5d9369878/lexicon.json
[home-view]: https://docs.slack.dev/reference/views/home-tab-views/
[blocks]: https://docs.slack.dev/reference/block-kit/blocks/
[header]: https://docs.slack.dev/reference/block-kit/blocks/header-block/
[section]: https://docs.slack.dev/reference/block-kit/blocks/section-block/
[divider]: https://docs.slack.dev/reference/block-kit/blocks/divider-block/
[context]: https://docs.slack.dev/reference/block-kit/blocks/context-block/
[actions]: https://docs.slack.dev/reference/block-kit/blocks/actions-block/
[card]: https://docs.slack.dev/reference/block-kit/blocks/card-block/
[container]: https://docs.slack.dev/reference/block-kit/blocks/container-block/
[carousel]: https://docs.slack.dev/reference/block-kit/blocks/carousel-block/
[table]: https://docs.slack.dev/reference/block-kit/blocks/table-block/
[data-table]: https://docs.slack.dev/reference/block-kit/blocks/data-table-block/
[chart]: https://docs.slack.dev/reference/block-kit/blocks/data-visualization-block/
[new-blocks]: https://docs.slack.dev/changelog/2026/04/16/block-kit-new-blocks/
[alert]: https://docs.slack.dev/reference/block-kit/blocks/alert-block/
[markdown]: https://docs.slack.dev/reference/block-kit/blocks/markdown-block/
[rich-text]: https://docs.slack.dev/reference/block-kit/blocks/rich-text-block/
[tag]: https://docs.slack.dev/reference/block-kit/block-elements/tag-element/
[color]: https://docs.slack.dev/reference/block-kit/block-elements/color-element/
[publish]: https://docs.slack.dev/reference/methods/views.publish/
[formatting]: https://docs.slack.dev/messaging/formatting-message-text/
[attachments]: https://docs.slack.dev/legacy/legacy-messaging/legacy-secondary-message-attachments/
[design]: https://docs.slack.dev/concepts/designing-with-block-kit/
[image]: https://docs.slack.dev/reference/block-kit/blocks/image-block/
[image-element]: https://docs.slack.dev/reference/block-kit/block-elements/image-element/
[slack-file]: https://docs.slack.dev/reference/block-kit/composition-objects/slack-file-object/
[upload]: https://docs.slack.dev/reference/methods/files.completeUploadExternal/
[button]: https://docs.slack.dev/reference/block-kit/block-elements/button-element/
[overflow]: https://docs.slack.dev/reference/block-kit/block-elements/overflow-menu-element/
[select]: https://docs.slack.dev/reference/block-kit/block-elements/select-menu-element/
[option]: https://docs.slack.dev/reference/block-kit/composition-objects/option-object/
[interactivity]: https://docs.slack.dev/interactivity/handling-user-interaction/
[block-actions]: https://docs.slack.dev/reference/interaction-payloads/block_actions-payload/
[modals]: https://docs.slack.dev/surfaces/modals/
[signatures]: https://docs.slack.dev/authentication/verifying-requests-from-slack/
[post]: https://docs.slack.dev/reference/methods/chat.postMessage/
[ephemeral]: https://docs.slack.dev/reference/methods/chat.postEphemeral/
[deep-links]: https://docs.slack.dev/interactivity/deep-linking/
[oidc]: https://docs.slack.dev/authentication/sign-in-with-slack/
[siws]: https://docs.slack.dev/authentication/sign-in-with-slack/setting-up-sign-in-with-slack-links/
[siws-auth0]: https://docs.slack.dev/authentication/sign-in-with-slack/using-auth0-for-sign-in-with-slack-links/
[unfurls]: https://docs.slack.dev/messaging/unfurling-links-in-messages/
[fragment]: https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment
[bearer]: https://www.rfc-editor.org/rfc/rfc6750.html#section-5.3
[authz]: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
[url-tokens]: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html#url-tokens
[session]: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
[validate]: https://docs.slack.dev/reference/methods/blocks.validate/

## Cross-map note: what styled App Home #56 could use

This is a handoff only; #56 and map #1 were not edited.

- Restyle the existing facts with a header, fields and one website link. Preserve the non-member eligibility view. [Existing renderer][existing-renderer]
- Consider the validated native card/container alternative. Use images for approved mascot art, with meaningful alt text and native text carrying essential totals. [Cards][card] [Containers][container] [Design][design]
- Use ordinary authenticated website routes. Personal Home can link to `me`; shared messages should link only to permitted target profile cards or an opener-relative `me` view. [Map audience][map]
- Acknowledge URL-button callbacks and use Slack's `hash` when concurrent Home updates arrive. [Buttons][button] [Publish][publish]
- Wait for the website route/deployment contract from #64/#65 before shipping actual links; keep later progression facts behind their map #1 stopping points. [Cross-map dependencies][map]
- If choosing personalized PNGs, resolve Slack-file viewer access and cache/privacy behaviour in a sandbox first. This research validates schemas, not that access arrangement or rendering. [Slack file][slack-file]
