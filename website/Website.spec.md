# Website

The browser package, the signed-in surface where a member sees their kudos beside App Home: a React shell in the PostHog brand, light and dark, built by Vite and served from the deployment's own `*.convex.site` root by the static hosting component, after Slack's routes, with a strict Content Security Policy header on every HTML response. The shell holds no member data; this slice renders its pages from typed fixtures and calls no Convex function.

## entrances
- route GET /*: a browser asks for a page or a built asset of the website; a path without a file falls back to the shell
  handler: registerWebsite in convex/website/hosting.ts
  trust: browser
  control: none — it serves public static bytes built from this repository, which hold no member data and no secret; every HTML response carries the Content Security Policy header that forbids framing and foreign scripts (WS25)
