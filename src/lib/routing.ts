/** `useConvexAuth()`: whether the backend has accepted (or rejected) the stored session yet. */
export type AuthState = { isLoading: boolean; isAuthenticated: boolean };
export type AppScreen = "loading" | "signedOut" | "notInstalled" | "ready";

/**
 * Which top-level screen to show. Only a settled auth state may say "signed out": the viewer
 * query answers `signedOut` for any request sent before the token reached the server, and
 * trusting that answer used to redirect deep links away while the session was being restored.
 */
export function appScreen(auth: AuthState, viewer: { status: AppScreen } | undefined): AppScreen {
  if (auth.isLoading) return "loading";
  if (!auth.isAuthenticated) return "signedOut";
  if (!viewer || viewer.status === "signedOut") return "loading";
  return viewer.status;
}

const DASHBOARD = "/me";
/** Public pages whose sign-in button should open the dashboard rather than come back. */
const ENTRY_PAGES = new Set(["/", "/setup"]);

/**
 * Where "Sign in with Slack" returns to: the page the visitor asked for, query and fragment
 * included, so links from Slack DMs and App Home land where they point after signing in.
 */
export function signInRedirect(location: { pathname: string; search: string; hash: string }): string {
  const { pathname, hash } = location;
  // Convex Auth appends the target to SITE_URL; only a plain path keeps that on this site.
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname.includes("\\")) return DASHBOARD;
  if (ENTRY_PAGES.has(pathname)) return DASHBOARD;
  return `${pathname}${withoutCode(location.search)}${hash}`;
}

/** Convex Auth adds its own one-time `code` on the way back; a stale one would be replayed. */
function withoutCode(search: string) {
  const params = new URLSearchParams(search);
  if (!params.has("code")) return search;
  params.delete("code");
  return params.size ? `?${params}` : "";
}
