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
  const [signInFailed, setSignInFailed] = useState(false);
  const { isLoading } = useConvexAuth();
  const profile = useQuery(api.website.profile.getMyProfile, {});
  const actions = useLiveActions(() => setSignInFailed(true));
  if (signInFailed) throw new Error("The sign-in didn't start.");
  return <App visitor={visitorOf(isLoading, profile)} actions={actions} />;
}

function visitorOf(authLoading: boolean, profile: MyProfile | undefined): Visitor {
  return authLoading || profile === undefined ? { kind: "loading" } : profile;
}

function useLiveActions(onSignInFailure: () => void): ShellActions {
  const { signIn, signOut } = useAuthActions();
  return useMemo(
    () => ({
      signIn: () =>
        void signIn("slack", { redirectTo: "/" }).catch(() => {
          forgetSignInStarted();
          onSignInFailure();
        }),
      signOut: () => void signOut(),
    }),
    [signIn, signOut, onSignInFailure],
  );
}
