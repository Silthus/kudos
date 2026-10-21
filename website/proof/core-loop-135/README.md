# Proof for Silthus/personal#135: link previews

Made-up sandbox members only (Juno Proofwell, Bram Proofwell). The team is a posthog.com team from the public company directory.

## Seam 1: `link_shared` drives `chat.unfurl`

`convex/slack/linkPreviews.test.ts`: signed `link_shared` events through `/slack/events`, the fake Slack and the fake PostHog. The person card, the team card, several links in one call, the retry after a rate limit, the logged refusal, the redelivery, every link that gets no card (other sites, other album places, unknown teams and IDs, bots, other workspaces, composer drafts, shared channels, an unsaid sharing field the channel lookup answers), the privacy check and the flag (off, sandbox-only in the sandbox and in production, a sharer the directory doesn't know). Refutation: with the event route disabled, 12 of 20 tests went red. The 8 that stayed green are the "no card" tests.

## Seam 2: Share

`website/src/album/linkShare.test.tsx`: Share on a person page, a team page and my own page copies the canonical URL and says so. A refused clipboard shows the link to copy by hand. With the flag off, none of the three pages has a Share button. 5 of 7 were red before the button existed.

## Sandbox (different-dog-467, branch head a0c0836, deployed by deploy-sandbox.yml)

1. `convex run website/linkPreviews:linkPreviewsOf` for Bram sharing Juno's person link, the Workflows team link and `/leaderboard`. It answers two cards: Juno (level 1, no medals, no teams, no picture) and Workflows (4 people, with its crest picture). The leaderboard gets no card:

```json
[
  {
    "kind": "person",
    "level": 1,
    "medals": [],
    "name": "Juno Proofwell",
    "page": "https://different-dog-467.convex.site/book#people/js7adqgcetzj8mz68gkd22t22s8gp06m",
    "picture": null,
    "teams": [],
    "url": "https://different-dog-467.convex.site/book#people/js7adqgcetzj8mz68gkd22t22s8gp06m"
  },
  {
    "kind": "team",
    "name": "Workflows",
    "page": "https://different-dog-467.convex.site/book#teams/workflows",
    "people": 4,
    "picture": "https://res.cloudinary.com/dmukukwp6/image/upload/c_limit,w_160,f_auto,q_auto/v1743523365/messaging_crest_8de90d3c39.png",
    "url": "https://different-dog-467.convex.site/book#teams/workflows"
  }
]
```

2. A `link_shared` event, signed by hand with the sandbox's signing secret (not a Slack paste), for the same two links went to `https://different-dog-467.convex.site/slack/events`. It got `200`. The receipt scheduled `slack/linkPreviews:unfoldLinks`, which called the real Slack `chat.unfurl`. The sandbox app has no `links:write` yet, so Slack answered `missing_scope`:

```
[CONVEX A(slack/linkPreviews:unfoldLinks)] [WARN] 'link previews: chat.unfurl failed: missing_scope'
```

## Block Kit preview

- [The two sandbox cards in Block Kit Builder](https://app.slack.com/block-kit-builder#%7B%22blocks%22%3A%20%5B%7B%22type%22%3A%20%22section%22%2C%20%22text%22%3A%20%7B%22type%22%3A%20%22mrkdwn%22%2C%20%22text%22%3A%20%22%2A%3Chttps%3A%2F%2Fdifferent-dog-467.convex.site%2Fbook%23people%2Fjs7adqgcetzj8mz68gkd22t22s8gp06m%7CJuno%20Proofwell%3E%2A%5CnLevel%201%22%2C%20%22verbatim%22%3A%20true%7D%7D%2C%20%7B%22type%22%3A%20%22context%22%2C%20%22elements%22%3A%20%5B%7B%22type%22%3A%20%22mrkdwn%22%2C%20%22text%22%3A%20%22HedgeHug%20album%20%5Cu00b7%20person%20page%22%7D%5D%7D%2C%20%7B%22type%22%3A%20%22divider%22%7D%2C%20%7B%22type%22%3A%20%22section%22%2C%20%22text%22%3A%20%7B%22type%22%3A%20%22mrkdwn%22%2C%20%22text%22%3A%20%22%2A%3Chttps%3A%2F%2Fdifferent-dog-467.convex.site%2Fbook%23teams%2Fworkflows%7CWorkflows%3E%2A%5Cn4%20people%22%2C%20%22verbatim%22%3A%20true%7D%2C%20%22accessory%22%3A%20%7B%22type%22%3A%20%22image%22%2C%20%22image_url%22%3A%20%22https%3A%2F%2Fres.cloudinary.com%2Fdmukukwp6%2Fimage%2Fupload%2Fc_limit%2Cw_160%2Cf_auto%2Cq_auto%2Fv1743523365%2Fmessaging_crest_8de90d3c39.png%22%2C%20%22alt_text%22%3A%20%22Workflows%22%7D%7D%2C%20%7B%22type%22%3A%20%22context%22%2C%20%22elements%22%3A%20%5B%7B%22type%22%3A%20%22mrkdwn%22%2C%20%22text%22%3A%20%22HedgeHug%20album%20%5Cu00b7%20team%20page%22%7D%5D%7D%5D%7D) (in Slack each card unfolds under its own link, so the divider only separates them here).
- [A fixture person card with teams, level and medals](https://app.slack.com/block-kit-builder#%7B%22blocks%22%3A%20%5B%7B%22type%22%3A%20%22section%22%2C%20%22text%22%3A%20%7B%22type%22%3A%20%22mrkdwn%22%2C%20%22text%22%3A%20%22%2A%3Chttps%3A%2F%2Fdifferent-dog-467.convex.site%2Fbook%23people%2Fjuno%7CJuno%20Park%3E%2A%5CnLevel%203%20%5Cu00b7%20Kettle%20Works%2C%20Lanterns%5Cn%5Cud83e%5Cudd47%20Pillar%20%5Cu00b7%20%5Cud83e%5Cudd49%20First%20Thanks%22%2C%20%22verbatim%22%3A%20true%7D%2C%20%22accessory%22%3A%20%7B%22type%22%3A%20%22image%22%2C%20%22image_url%22%3A%20%22https%3A%2F%2Favatars.slack-edge.com%2F2026-01-01%2Fplaceholder_192.png%22%2C%20%22alt_text%22%3A%20%22Juno%20Park%22%7D%7D%2C%20%7B%22type%22%3A%20%22context%22%2C%20%22elements%22%3A%20%5B%7B%22type%22%3A%20%22mrkdwn%22%2C%20%22text%22%3A%20%22HedgeHug%20album%20%5Cu00b7%20person%20page%22%7D%5D%7D%5D%7D).

## Gap

A real unfold in a Slack client can't be captured until the app is reinstalled with `links:read`, `links:write`, the `link_shared` event and `unfurl_domains`. That reinstall is Michael's to-do. Unfolds start after it.
