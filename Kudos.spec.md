# Kudos

Peer recognition for Slack on one Convex deployment per workspace; the product rules are spec issue #28.

## trust levels
- slack-request (outside): what anyone on the internet sends to the deployment's Slack routes, claiming to be Slack
- browser (outside): what anyone on the internet sends to the website's public functions, the sign-in routes and the static pages
- domain: the deployment's internal functions and the rows they keep
- operator: a maintainer running the project's scripts on their own machine

## entrances
- render manifest: a maintainer renders the Slack app manifest for the sandbox or the real app to install it
  handler: slack-app/render-manifest.ts
  trust: operator
  control: none — it reads only its two arguments and prints a manifest that holds no secret; it reaches no deployment

## invariants
