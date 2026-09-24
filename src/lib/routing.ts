/** `useConvexAuth()`: whether the backend has accepted (or rejected) the stored session yet. */
export type AuthState = { isLoading: boolean; isAuthenticated: boolean };
export type AppScreen = "loading" | "signedOut" | "notInstalled" | "ready";

/**
 * Which top-level screen to show. Only a settled auth state may say "signed out": the viewer
 * query answers `signedOut` to anything sent before the token reached the server, and trusting
 * that answer used to redirect deep links away while the session was being restored. So the
 * viewer is only asked once the session is confirmed (see `App`).
 */
export function appScreen(auth: AuthState, viewer: { status: AppScreen } | undefined): AppScreen {
  if (auth.isLoading) return "loading";
  if (!auth.isAuthenticated) return "signedOut";
  return viewer?.status ?? "loading";
}

const DASHBOARD = "/me";

/**
 * Where "Sign in with Slack" returns to: the page the visitor asked for, query and fragment
 * included, so links from Slack DMs and App Home land where they point after signing in.
 */
export function signInRedirect(location: { pathname: string; search: string; hash: string }): string {
  const { pathname, hash } = location;
  // Convex Auth appends this to SITE_URL; anything but a plain path isn't one of our pages.
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return DASHBOARD;
  if (pathname === "/") return DASHBOARD;
  return `${pathname}${withoutCode(location.search)}${hash}`;
}

/** Convex Auth adds its own one-time `code` on the way back; a stale one would be replayed. */
function withoutCode(search: string) {
  const params = new URLSearchParams(search);
  if (!params.has("code")) return search;
  params.delete("code");
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}
