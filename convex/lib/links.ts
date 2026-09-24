/**
 * Links from Slack into the web app. Someone in several workspaces would otherwise open whichever
 * one they used last, so every link names the Slack workspace it was sent in; the app switches to
 * it on arrival when the viewer belongs there and ignores it otherwise (`src/lib/linkedWorkspace.ts`).
 * Shared with the frontend, so it stays free of server-only imports.
 */
export const WORKSPACE_PARAM = "ws";

/**
 * `path` (query and fragment allowed) on `site`, for `slackTeamId`; null while no site is configured.
 * Button `url`s take it as is. In mrkdwn (`<url|label>`) Slack wants `&` written as `&amp;`, which
 * only matters for a path with a query of its own: none of the mrkdwn links has one today.
 */
export function appLink(site: string, slackTeamId: string, path: string): string | null {
  if (!site) return null;
  const [beforeHash, hash] = splitOnce(path, "#");
  const [pathname, query] = splitOnce(beforeHash, "?");
  const params = new URLSearchParams(query);
  params.set(WORKSPACE_PARAM, slackTeamId);
  return `${site}${pathname}?${params}${hash === undefined ? "" : `#${hash}`}`;
}

function splitOnce(s: string, separator: string): [string, string | undefined] {
  const at = s.indexOf(separator);
  return at < 0 ? [s, undefined] : [s.slice(0, at), s.slice(at + 1)];
}
