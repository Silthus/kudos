# The website is PostHog-branded and PostHog-sourced

The website is built from PostHog's own parts. Components and colour tokens come from PostHog's design system, Quill (`@posthog/quill`), icons from `@posthog/icons`, and the hedgehog art and the RoundHog font from `@posthog/brand`. The faces of members, and each group's team photo and crest, come from posthog.com's public team pages: a website-owned adapter syncs them daily and the browser loads the images from posthog.com's Cloudinary.

We chose this over a neutral, portable look with commissioned art and over Slack photos with member uploads. The website is an internal PostHog product, and PostHog's own system, art and team pages give it the brand and real faces with no design or upload work. Michael confirmed the `@posthog/brand` licence (PolyForm Strict) is cleared for this internal use.

The cost is that the website only fits PostHog's own workspace as it stands. A public product, or any other company, would need its own art, display font and source of faces and team photos. A member whose Slack name matches no posthog.com profile falls back to their Slack photo, then initials, and a group that maps to no posthog.com team falls back to a hedgehog crest. So the website still works off PostHog, just without those faces and photos.

Settled in grilling [#63](https://github.com/Silthus/kudos/issues/63), on the direction accepted in [#62](https://github.com/Silthus/kudos/issues/62). Coherence journal decision: `d-2eb4c569`.
