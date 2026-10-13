import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery, type ConvexReactClient } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { MyProfile } from "../../convex/website/profile";
import { App } from "./App";
import { useCodeRedemption, type Redemption } from "./codeRedemption";
import { useSocketUnreachable } from "./connection";
import type { ShellActions, Visitor } from "./shell";
import { forgetSignInStarted } from "./signInAttempt";

export function LiveShell({ client }: { client: ConvexReactClient }) {
  return (
    <ConvexAuthProvider client={client} shouldHandleCode={false}>
      <LiveApp />
    </ConvexAuthProvider>
  );
}

function LiveApp() {
  const [signInFailed, setSignInFailed] = useState(false);
  const { isLoading } = useConvexAuth();
  const redemption = useCodeRedemption();
  const unreachable = useSocketUnreachable();
  const profile = useQuery(api.website.profile.getMyProfile, {});
  const actions = useLiveActions(() => setSignInFailed(true));
  if (signInFailed) throw new Error("The sign-in didn't start.");
  return <App visitor={visitorOf({ authLoading: isLoading, redemption, unreachable, profile })} actions={actions} />;
}

type Answers = { authLoading: boolean; redemption: Redemption; unreachable: boolean; profile: MyProfile | undefined };

function visitorOf({ authLoading, redemption, unreachable, profile }: Answers): Visitor {
  if (authLoading || redemption === "redeeming" || profile === undefined) return unreachable ? { kind: "connecting" } : { kind: "loading" };
  if (redemption === "failed" && profile.kind === "signed-out") return { kind: "sign-in-unfinished" };
  return profile;
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
