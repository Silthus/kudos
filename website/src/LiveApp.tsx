import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery, type ConvexReactClient } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { MyProfile } from "../../convex/website/profile";
import { App } from "./App";
import type { ShellActions, Visitor } from "./shell";
import { forgetSignInStarted } from "./signInAttempt";

export function LiveShell({ client }: { client: ConvexReactClient }) {
  return (
    <ConvexAuthProvider client={client}>
      <LiveApp />
    </ConvexAuthProvider>
  );
}

function LiveApp() {
  const [actionFailed, setActionFailed] = useState(false);
  const { isLoading } = useConvexAuth();
  const profile = useQuery(api.website.profile.getMyProfile, {});
  const actions = useLiveActions(setActionFailed);
  if (actionFailed) throw new Error("A sign-in or sign-out didn't go through.");
  return <App visitor={visitorOf(isLoading, profile)} actions={actions} />;
}

function visitorOf(authLoading: boolean, profile: MyProfile | undefined): Visitor {
  return authLoading || profile === undefined ? { kind: "loading" } : profile;
}

function useLiveActions(failed: (actionFailed: true) => void): ShellActions {
  const { signIn, signOut } = useAuthActions();
  return useMemo(
    () => ({
      signIn: () =>
        void signIn("slack", { redirectTo: "/" }).catch(() => {
          forgetSignInStarted();
          failed(true);
        }),
      signOut: () => void signOut().catch(() => failed(true)),
    }),
    [signIn, signOut, failed],
  );
}
