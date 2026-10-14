import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQueries, useQuery, type ConvexReactClient, type RequestForQueries } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { MyProfile } from "../../convex/website/profile";
import { App } from "./App";
import type { BoardAnswer } from "./boardRead";
import { useCodeRedemptionFailed } from "./codeRedemption";
import { answerWithin } from "./commandAnswer";
import { useSocketUnreachable } from "./connection";
import type { QuestsShown } from "./questsRead";
import type { SkillTreeShown } from "./skillTreeRead";
import type { Period, ShellActions, Visitor } from "./shell";
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
  const redemptionFailed = useCodeRedemptionFailed(isLoading);
  const unreachable = useSocketUnreachable();
  const profile = useQuery(api.website.profile.getMyProfile, {});
  const actions = useLiveActions(() => setSignInFailed(true));
  if (signInFailed) throw new Error("The sign-in didn't start.");
  return (
    <App
      visitor={visitorOf({ authLoading: isLoading, redemptionFailed, unreachable, profile })}
      actions={actions}
      useLeaderboard={(period) => useLiveLeaderboard(period, unreachable)}
      useQuests={(asking) => useLiveQuests(asking, unreachable)}
      useSkillTree={(asking) => useLiveSkillTree(asking, unreachable)}
    />
  );
}

function useLiveLeaderboard(period: Period | undefined, unreachable: boolean): BoardAnswer | undefined {
  const request = useMemo((): RequestForQueries => (period === undefined ? {} : { board: { query: api.website.leaderboard.getLeaderboard, args: { period } } }), [period]);
  const { board } = useQueries(request);
  if (board instanceof Error) return { kind: "broken" };
  if (board === undefined && unreachable) return { kind: "connecting" };
  return board;
}

function useLiveQuests(asking: boolean, unreachable: boolean): QuestsShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { quests: { query: api.website.quests.getQuests, args: {} } } : {}), [asking]);
  const { quests } = useQueries(request);
  if (quests instanceof Error) return { kind: "broken" };
  if (quests === undefined && unreachable) return { kind: "connecting" };
  return quests;
}

function useLiveSkillTree(asking: boolean, unreachable: boolean): SkillTreeShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { skillTree: { query: api.website.skillTree.getSkillTree, args: {} } } : {}), [asking]);
  const { skillTree } = useQueries(request);
  if (skillTree instanceof Error) return { kind: "broken" };
  if (skillTree === undefined && unreachable) return { kind: "connecting" };
  return skillTree;
}

type Answers = { authLoading: boolean; redemptionFailed: boolean; unreachable: boolean; profile: MyProfile | undefined };

function visitorOf({ authLoading, redemptionFailed, unreachable, profile }: Answers): Visitor {
  if (redemptionFailed && profile !== undefined) return profile.kind === "signed-out" ? { kind: "sign-in-unfinished" } : profile;
  if (authLoading || profile === undefined) return unreachable ? { kind: "connecting" } : { kind: "loading" };
  return profile;
}

const commandAnswerBudgetMs = 10_000;

function useLiveActions(onSignInFailure: () => void): ShellActions {
  const { signIn, signOut } = useAuthActions();
  const openFeature = useMutation(api.website.commands.openFeature);
  const openQuestCrate = useMutation(api.website.commands.openQuestCrate);
  return useMemo(
    () => ({
      openFeature: (feature) => answerWithin(commandAnswerBudgetMs, openFeature({ feature })),
      openQuestCrate: (quest) => answerWithin(commandAnswerBudgetMs, openQuestCrate({ quest })),
      signIn: (returnTo) =>
        void signIn("slack", { redirectTo: returnTo }).catch(() => {
          forgetSignInStarted();
          onSignInFailure();
        }),
      signOut: () => void signOut(),
    }),
    [signIn, signOut, openFeature, openQuestCrate, onSignInFailure],
  );
}
