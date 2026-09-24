import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import type { ConvexReactClient } from "convex/react";

/**
 * Whether this browser is coming back from a Slack sign-in it started: Convex Auth keeps the PKCE
 * verifier (keyed by deployment) from the redirect until it exchanges the returned `code`.
 */
export function oauthReturnPending(storage: Pick<Storage, "getItem">, address: string): boolean {
  return storage.getItem(`__convexAuthOAuthVerifier_${address.replace(/[^a-zA-Z0-9]/g, "")}`) !== null;
}

/**
 * Convex Auth wired to the router:
 * - The one-time `code` is stripped from the URL through the router, keeping its location in step.
 *   A bare `history.replaceState` would leave the spent code for the next `setSearchParams` to write back.
 * - A `code` is only exchanged when a sign-in is pending. A stale one (a link, the address bar's
 *   history) would otherwise be rejected and erase a perfectly good session.
 */
export function AuthProvider({ client, children }: { client: ConvexReactClient; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <ConvexAuthProvider
      client={client}
      replaceURL={(url) => navigate(url, { replace: true })}
      shouldHandleCode={() => oauthReturnPending(window.localStorage, client.url)}
    >
      {children}
    </ConvexAuthProvider>
  );
}
