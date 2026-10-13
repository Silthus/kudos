# Website

The browser package, the signed-in surface where a member sees their kudos beside App Home: a React shell in the PostHog brand, light and dark, built by Vite and served from the deployment's own `*.convex.site` root by the static hosting component, after Slack's routes, with a strict Content Security Policy header on every HTML response. The shell holds no member data: it signs in with Slack through Convex Auth's React client, renders one page from the one answer getMyProfile gives (closed, signed-out, verifying, unverified, not-a-member or member), where a member's home leads with thanking someone in Slack, then the kudos left and the refill time, Max's line on this week, the counters, the profile card that keeps received kudos private, and the later features as plain locked cards, shows "Sign-in didn't finish" when a sign-in this browser started comes back signed out or the one-time code Slack's return brings fails to redeem (the shell redeems that code itself, once), shows "Can't reach HedgeHug" when the socket to the deployment stays unconnected for five seconds while the answer is still loading, sets the theme from a blocking script in the page's head before the first paint, signs out from the avatar menu, and moves focus to the page title when the answer changes; a fixture build renders the same pages from typed fixtures.

## entrances
- route GET /*: a browser asks for a page or a built asset of the website; a path without a file falls back to the shell
  handler: registerWebsite in convex/website/hosting.ts
  trust: browser
  control: none — it serves public static bytes built from this repository, which hold no member data and no secret; every HTML response carries the Content Security Policy header that forbids framing and foreign scripts (WS25)
