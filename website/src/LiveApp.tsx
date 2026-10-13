import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery, type ConvexReactClient } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import type { MyProfile } from "../../convex/website/profile";
import { App } from "./App";
import type { ShellActions, Visitor } from "./shell";

export function LiveShell({ client }: { client: ConvexReactClient }) {
  return (
    <ConvexAuthProvider client={client}>
      <LiveApp />
    </ConvexAuthProvider>
  );
}

function LiveApp() {
  const { isLoading } = useConvexAuth();
  const profile = useQuery(api.website.profile.getMyProfile, {});
  return <App visitor={visitorOf(isLoading, profile)} actions={useLiveActions()} />;
}

function visitorOf(authLoading: boolean, profile: MyProfile | undefined): Visitor {
  return authLoading || profile === undefined ? { kind: "loading" } : profile;
}

function useLiveActions(): ShellActions {
  const { signIn, signOut } = useAuthActions();
  return useMemo(
    () => ({
      signIn: () => void signIn("slack", { redirectTo: "/" }),
      signOut: () => void signOut(),
    }),
    [signIn, signOut],
  );
}
