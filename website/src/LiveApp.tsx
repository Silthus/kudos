import { ConvexAuthProvider, useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import { ConvexHttpClient } from "convex/browser";
import { useConvex, useConvexAuth, useMutation, useQueries, useQuery, type ConvexReactClient, type RequestForQueries } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { MyGroupBoards } from "../../convex/website/groupBoards";
import type { MyLeaderboard as MyEveryoneBoard } from "../../convex/website/leaderboard";
import type { Denial } from "../../convex/website/memberQuery";
import type { MyProfile } from "../../convex/website/profile";
import { App } from "./App";
import { BrowserAnalytics } from "./browserAnalytics/BrowserAnalytics";
import { ShellBoundary } from "./ShellBoundary";
import type { ActivityRead, ActivityShown } from "./activityRead";
import type { AlbumShown, BoardsShown } from "./album/answer";
import { albumOf } from "./album/liveAlbum";
import type { BoardAnswer } from "./boardRead";
import type { BookShown } from "./bookRead";
import type { CollectionShown } from "./collectionRead";
import { useCodeRedemptionFailed } from "./codeRedemption";
import { answerWithin } from "./commandAnswer";
import { useSocketUnreachable } from "./connection";
import type { ProfileCardShown } from "./profileCardRead";
import type { QuestsShown } from "./questsRead";
import type { Direction, RecentKudosShown } from "./recentKudosRead";
import type { SettingsShown } from "./settingsRead";
import type { SkillTreeShown } from "./skillTreeRead";
import type { ActivityFilter } from "./route";
import type { SpotlightDraw } from "./spotlightRead";
import type { Face, Leaderboard, LeaderboardRow, Period, ShellActions, Visitor } from "./shell";
import { forgetSignInStarted } from "./signInAttempt";

export function LiveShell({ client }: { client: ConvexReactClient }) {
  return (
    <ConvexAuthProvider client={client}>
      <BrowserAnalytics>
        <ShellBoundary>
          <LiveApp />
        </ShellBoundary>
      </BrowserAnalytics>
    </ConvexAuthProvider>
  );
}

function LiveApp() {
  const [signInFailed, setSignInFailed] = useState(false);
  const { isLoading } = useConvexAuth();
  const redemptionFailed = useCodeRedemptionFailed(isLoading);
  const unreachable = useSocketUnreachable();
  const profile = useQuery(api.website.profile.getMyProfile, {});
  const ownFace = ownFaceIn(useQuery(api.website.face.getMyFace, {}));
  const actions = useLiveActions(() => setSignInFailed(true));
  const readActivity = useLiveActivityRead();
  const drawSpotlight = useLiveSpotlight();
  if (signInFailed) throw new Error("The sign-in didn't start.");
  return (
    <App
      visitor={visitorOf({ authLoading: isLoading, redemptionFailed, unreachable, profile: withOwnFace(profile, ownFace) })}
      actions={actions}
      useLeaderboard={(period, withGroupBoards) => withOwnRowFace(useLiveLeaderboard(period, withGroupBoards, unreachable), ownFace)}
      useQuests={(asking) => useLiveQuests(asking, unreachable)}
      useBook={(asking) => useLiveBook(asking, unreachable)}
      useCollection={(asking) => useLiveCollection(asking, unreachable)}
      useSkillTree={(asking) => useLiveSkillTree(asking, unreachable)}
      useSettings={(asking) => useLiveSettings(asking, unreachable)}
      useAlbum={(asking) => useLiveAlbum(asking, unreachable)}
      useThoughtfulBoards={(asking) => useLiveThoughtfulBoards(asking, unreachable)}
      useProfileCard={useLiveProfileCard}
      useRecentKudos={useLiveRecentKudos}
      useActivityWatch={useLiveActivityWatch}
      readActivity={readActivity}
      drawSpotlight={drawSpotlight}
    />
  );
}

function useLiveLeaderboard(period: Period | undefined, withGroupBoards: boolean, unreachable: boolean): BoardAnswer | undefined {
  const request = useMemo((): RequestForQueries => {
    if (period === undefined) return {};
    const board = { query: api.website.leaderboard.getLeaderboard, args: { period } };
    return withGroupBoards ? { board, groupBoards: { query: api.website.groupBoards.getGroupBoards, args: { period } } } : { board };
  }, [period, withGroupBoards]);
  const { board, groupBoards } = useQueries(request) as { board: MyEveryoneBoard | Error | undefined; groupBoards: MyGroupBoards | Error | undefined };
  if (board instanceof Error || groupBoards instanceof Error) return { kind: "broken" };
  if (board === undefined && unreachable) return { kind: "connecting" };
  if (board?.kind !== "board") return board;
  if (!withGroupBoards) return { ...board, ...noGroupBoards };
  if (groupBoards === undefined) return unreachable ? { kind: "connecting" } : undefined;
  return { ...board, ...(groupBoards.kind === "boards" ? { groups: groupBoards.groups, myGroup: groupBoards.myGroup } : noGroupBoards) };
}

const noGroupBoards = { groups: null, myGroup: null };

const faceKinds = new Set<string>(["company-profile", "slack", "initials"] satisfies Face["kind"][]);

function ownFaceIn(answer: Face | Denial | undefined): Face | undefined {
  return answer !== undefined && faceKinds.has(answer.kind) ? (answer as Face) : undefined;
}

function withOwnFace(profile: MyProfile | undefined, face: Face | undefined): MyProfile | undefined {
  return profile?.kind === "member" && face !== undefined ? { ...profile, face } : profile;
}

function withOwnRowFace(answer: BoardAnswer | undefined, face: Face | undefined): BoardAnswer | undefined {
  if (answer?.kind !== "board" || face === undefined) return answer;
  const ownRowsWith = (rows: LeaderboardRow[]) => rows.map((row) => (row.you ? { ...row, face } : row));
  const board: Leaderboard = { ...answer, rows: ownRowsWith(answer.rows) };
  return answer.myGroup === null ? board : { ...board, myGroup: { ...answer.myGroup, rows: ownRowsWith(answer.myGroup.rows) } };
}

function useLiveQuests(asking: boolean, unreachable: boolean): QuestsShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { quests: { query: api.website.quests.getQuests, args: {} } } : {}), [asking]);
  const { quests } = useQueries(request);
  if (quests instanceof Error) return { kind: "broken" };
  if (quests === undefined && unreachable) return { kind: "connecting" };
  return quests;
}

function useLiveAlbum(asking: boolean, unreachable: boolean): AlbumShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { album: { query: api.website.album.getAlbum, args: {} } } : {}), [asking]);
  const { album } = useQueries(request);
  if (album instanceof Error) return { kind: "broken" };
  if (album === undefined) return unreachable ? { kind: "connecting" } : undefined;
  return albumOf(album);
}

function useLiveThoughtfulBoards(asking: boolean, unreachable: boolean): BoardsShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { boards: { query: api.website.album.getThoughtfulBoards, args: {} } } : {}), [asking]);
  const { boards } = useQueries(request);
  if (boards instanceof Error) return { kind: "broken" };
  if (boards === undefined) return unreachable ? { kind: "connecting" } : undefined;
  return boards;
}

function useLiveCollection(asking: boolean, unreachable: boolean): CollectionShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { collection: { query: api.website.collection.getCollection, args: {} } } : {}), [asking]);
  const { collection } = useQueries(request);
  if (collection instanceof Error) return { kind: "broken" };
  if (collection === undefined && unreachable) return { kind: "connecting" };
  return collection;
}

function useLiveBook(asking: boolean, unreachable: boolean): BookShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { book: { query: api.website.book.getBook, args: {} } } : {}), [asking]);
  const { book } = useQueries(request);
  if (book instanceof Error) return { kind: "broken" };
  if (book === undefined && unreachable) return { kind: "connecting" };
  return book;
}

function useLiveSkillTree(asking: boolean, unreachable: boolean): SkillTreeShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { skillTree: { query: api.website.skillTree.getSkillTree, args: {} } } : {}), [asking]);
  const { skillTree } = useQueries(request);
  if (skillTree instanceof Error) return { kind: "broken" };
  if (skillTree === undefined && unreachable) return { kind: "connecting" };
  return skillTree;
}

function useLiveSettings(asking: boolean, unreachable: boolean): SettingsShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { settings: { query: api.website.settings.getSettings, args: {} } } : {}), [asking]);
  const { settings } = useQueries(request);
  if (settings instanceof Error) return { kind: "broken" };
  if (settings === undefined && unreachable) return { kind: "connecting" };
  return settings;
}

function useLiveProfileCard(asking: boolean): ProfileCardShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { card: { query: api.website.profileCard.getProfileCard, args: {} } } : {}), [asking]);
  const { card } = useQueries(request);
  if (card instanceof Error) return { kind: "broken" };
  return card;
}

function useLiveRecentKudos(direction: Direction): RecentKudosShown | undefined {
  const request = useMemo((): RequestForQueries => ({ recent: { query: api.website.activity.getRecentKudos, args: { direction, limit: 3 } } }), [direction]);
  const { recent } = useQueries(request);
  return recent instanceof Error ? { kind: "broken" } : recent;
}

function useLiveSpotlight(): SpotlightDraw {
  const convex = useConvex();
  return useCallback((ask) => answerWithin(commandAnswerBudgetMs, convex.query(api.website.activity.getSpotlight, ask)), [convex]);
}

const activityPage = 20;

function useLiveActivityWatch(filter: ActivityFilter | undefined): ActivityShown | undefined {
  const request = useMemo((): RequestForQueries => (filter === undefined ? {} : { watch: { query: api.website.activity.getActivity, args: { filter, cursor: null, limit: activityPage } } }), [filter]);
  const { watch } = useQueries(request);
  return watch instanceof Error ? { kind: "broken" } : watch;
}

function useLiveActivityRead(): ActivityRead {
  const convex = useConvex();
  return useCallback(({ filter, cursor }) => convex.query(api.website.activity.getActivity, { filter, cursor, limit: activityPage }), [convex]);
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
  const buyPerk = useMutation(api.website.commands.buyPerk);
  const swapQuest = useMutation(api.website.commands.swapQuest);
  const buyItem = useSentOnce(api.website.commands.buyItem);
  const buyCrate = useSentOnce(api.website.commands.buyCrate);
  const openCrate = useSentOnce(api.website.commands.openCrate);
  const setBoardVisibility = useSentOnce(api.website.commands.setBoardVisibility);
  const setMessageSetting = useSentOnce(api.website.commands.setMessageSetting);
  const pickPrimaryGroup = useSentOnce(api.website.commands.pickPrimaryGroup);
  const linkMyCompanyProfile = useSentOnce(api.website.commands.linkMyCompanyProfile);
  const linkCompanyProfile = useSentOnce(api.website.commands.linkCompanyProfile);
  const setWorkspaceSettings = useSentOnce(api.website.commands.setWorkspaceSettings);
  const setAvatar = useSentOnce(api.website.commands.setAvatar);
  const openThoughtfulPack = useSentOnce(api.website.album.openThoughtfulPack);
  const putIn = useSentOnce(api.website.album.putIn);
  const putAllIn = useSentOnce(api.website.album.putAllIn);
  return useMemo(
    () => ({
      openFeature: (feature) => answerWithin(commandAnswerBudgetMs, openFeature({ feature })),
      openQuestCrate: (quest) => answerWithin(commandAnswerBudgetMs, openQuestCrate({ quest })),
      buyPerk: ({ perk, request }) => answerWithin(commandAnswerBudgetMs, buyPerk({ perk, request })),
      buyItem: ({ item, request }) => answerWithin(commandAnswerBudgetMs, buyItem({ item, request })),
      buyCrate: (next) => answerWithin(commandAnswerBudgetMs, buyCrate({ next })),
      openCrate: (crate) => answerWithin(commandAnswerBudgetMs, openCrate({ crate })),
      swapQuest: (quest) => answerWithin(commandAnswerBudgetMs, swapQuest({ quest })),
      setBoardVisibility: (visible) => answerWithin(commandAnswerBudgetMs, setBoardVisibility({ visible })),
      setMessageSetting: (kind, place) => answerWithin(commandAnswerBudgetMs, setMessageSetting({ kind, place })),
      pickPrimaryGroup: (group) => answerWithin(commandAnswerBudgetMs, pickPrimaryGroup({ group })),
      linkMyCompanyProfile: (profile) => answerWithin(commandAnswerBudgetMs, linkMyCompanyProfile({ profile })),
      linkCompanyProfile: (member, profile) => answerWithin(commandAnswerBudgetMs, linkCompanyProfile({ member, profile })),
      setWorkspaceSettings: (settings) => answerWithin(commandAnswerBudgetMs, setWorkspaceSettings(settings)),
      setAvatar: (hoggie) => answerWithin(commandAnswerBudgetMs, setAvatar({ hoggie })),
      openThoughtfulPack: (pack) => answerWithin(commandAnswerBudgetMs, openThoughtfulPack({ pack: pack as Id<"thoughtfulPacks"> })),
      putIn: (item) => answerWithin(commandAnswerBudgetMs, putIn({ item: item as Id<"trayItems"> })),
      putAllIn: () => answerWithin(commandAnswerBudgetMs, putAllIn({})),
      signIn: (returnTo) =>
        void signIn("slack", { redirectTo: returnTo }).catch(() => {
          forgetSignInStarted();
          onSignInFailure();
        }),
      signOut: () => void signOut(),
    }),
    [signIn, signOut, openFeature, openQuestCrate, buyPerk, buyItem, buyCrate, openCrate, swapQuest, setBoardVisibility, setMessageSetting, pickPrimaryGroup, linkMyCompanyProfile, linkCompanyProfile, setWorkspaceSettings, setAvatar, openThoughtfulPack, putIn, putAllIn, onSignInFailure],
  );
}

function useSentOnce<Mutation extends FunctionReference<"mutation">>(mutation: Mutation) {
  const { url } = useConvex();
  const token = useAuthToken();
  return useCallback(
    (args: FunctionArgs<Mutation>): Promise<FunctionReturnType<Mutation>> => {
      const once = new ConvexHttpClient(url);
      if (token !== null) once.setAuth(token);
      return once.mutation(mutation, args);
    },
    [url, token, mutation],
  );
}
