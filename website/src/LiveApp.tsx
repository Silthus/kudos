import { ConvexAuthProvider, useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import { ConvexHttpClient } from "convex/browser";
import { useConvex, useConvexAuth, useQueries, useQuery, type ConvexReactClient, type RequestForQueries } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { MyProfile } from "../../convex/website/profile";
import { App } from "./App";
import { BrowserAnalytics } from "./browserAnalytics/BrowserAnalytics";
import { ShellBoundary } from "./ShellBoundary";
import type { AlbumShown, BoardPeriod, BoardsShown, HoggiesShown, LevelUpShown, PersonShown, ProfileShown, WeekShown, XpMomentShown } from "./album/answer";
import { albumOf, openShown, putAllInShown, putInShown } from "./album/liveAlbum";
import { useCodeRedemptionFailed } from "./codeRedemption";
import { answerWithin } from "./commandAnswer";
import { useSocketUnreachable } from "./connection";
import type { EmojiMappingsShown } from "./emojiMappingsRead";
import type { AppEmojisShown, SlackEmojiMatchesShown } from "./emojiWizardReads";
import type { SettingsShown } from "./settingsRead";
import type { ShellActions, Visitor } from "./shell";
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
  const actions = useLiveActions(() => setSignInFailed(true));
  if (signInFailed) throw new Error("The sign-in didn't start.");
  return (
    <App
      visitor={visitorOf({ authLoading: isLoading, redemptionFailed, unreachable, profile })}
      actions={actions}
      useSettings={(asking) => useLiveSettings(asking, unreachable)}
      useEmojiMappings={(asking) => useLiveEmojiMappings(asking, unreachable)}
      useSlackEmojiMatches={(near, search) => useLiveSlackEmojiMatches(near, search, unreachable)}
      useAppEmojis={(asking) => useLiveAppEmojis(asking, unreachable)}
      useAlbum={(asking) => useLiveAlbum(asking, unreachable)}
      useThoughtfulBoards={(asking, period) => useLiveThoughtfulBoards(asking, period, unreachable)}
      useAlbumPerson={(asking, person) => useLiveAlbumPerson(asking, person, unreachable)}
      useAlbumWeek={(asking, week) => useLiveAlbumWeek(asking, week, unreachable)}
      useAlbumProfile={(asking) => useLiveAlbumProfile(asking, unreachable)}
      useAlbumHoggies={(asking) => useLiveAlbumHoggies(asking, unreachable)}
      useLevelUp={(level) => useLiveLevelUp(level, unreachable)}
      useXpMoment={(asking) => useLiveXpMoment(asking, unreachable)}
    />
  );
}

function useLiveAlbum(asking: boolean, unreachable: boolean): AlbumShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { album: { query: api.website.album.getAlbum, args: {} } } : {}), [asking]);
  const { album } = useQueries(request);
  if (album instanceof Error) return { kind: "broken" };
  if (album === undefined) return unreachable ? { kind: "connecting" } : undefined;
  return albumOf(album);
}

function useLiveThoughtfulBoards(asking: boolean, period: BoardPeriod, unreachable: boolean): BoardsShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { boards: { query: api.website.album.getThoughtfulBoards, args: period === "week" ? {} : { period } } } : {}), [asking, period]);
  const { boards } = useQueries(request);
  if (boards instanceof Error) return { kind: "broken" };
  if (boards === undefined) return unreachable ? { kind: "connecting" } : undefined;
  return boards;
}

function useLiveAlbumPerson(asking: boolean, person: string | null, unreachable: boolean): PersonShown | undefined {
  const request = useMemo((): RequestForQueries => (asking && person !== null ? { person: { query: api.website.album.getAlbumPerson, args: { person } } } : {}), [asking, person]);
  const { person: answer } = useQueries(request);
  if (answer instanceof Error) return { kind: "broken" };
  if (answer === undefined) return unreachable ? { kind: "connecting" } : undefined;
  return answer;
}

function useLiveAlbumWeek(asking: boolean, week: string | undefined, unreachable: boolean): WeekShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { week: { query: api.website.album.getAlbumWeek, args: week === undefined ? {} : { week } } } : {}), [asking, week]);
  const { week: answer } = useQueries(request);
  if (answer instanceof Error) return { kind: "broken" };
  if (answer === undefined) return unreachable ? { kind: "connecting" } : undefined;
  return answer;
}

function useLiveAlbumProfile(asking: boolean, unreachable: boolean): ProfileShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { profile: { query: api.website.album.getAlbumProfile, args: {} } } : {}), [asking]);
  const { profile: answer } = useQueries(request);
  if (answer instanceof Error) return { kind: "broken" };
  if (answer === undefined) return unreachable ? { kind: "connecting" } : undefined;
  return answer;
}

function useLiveAlbumHoggies(asking: boolean, unreachable: boolean): HoggiesShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { hoggies: { query: api.website.album.getAlbumHoggies, args: {} } } : {}), [asking]);
  const { hoggies: answer } = useQueries(request);
  if (answer instanceof Error) return { kind: "broken" };
  if (answer === undefined) return unreachable ? { kind: "connecting" } : undefined;
  return answer;
}

function useLiveLevelUp(level: number | null, unreachable: boolean): LevelUpShown | undefined {
  const request = useMemo((): RequestForQueries => (level === null ? {} : { levelUp: { query: api.website.album.getLevelUp, args: { level } } }), [level]);
  const { levelUp: answer } = useQueries(request);
  if (answer instanceof Error) return { kind: "broken" };
  if (answer === undefined) return unreachable ? { kind: "connecting" } : undefined;
  return answer;
}

function useLiveXpMoment(asking: boolean, unreachable: boolean): XpMomentShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { moment: { query: api.website.xpMoment.getXpMoment, args: {} } } : {}), [asking]);
  const { moment } = useQueries(request);
  if (moment instanceof Error) return { kind: "broken" };
  if (moment === undefined) return unreachable ? { kind: "connecting" } : undefined;
  return moment;
}

function useLiveSettings(asking: boolean, unreachable: boolean): SettingsShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { settings: { query: api.website.settings.getSettings, args: {} } } : {}), [asking]);
  const { settings } = useQueries(request);
  if (settings instanceof Error) return { kind: "broken" };
  if (settings === undefined && unreachable) return { kind: "connecting" };
  return settings;
}

function useLiveEmojiMappings(asking: boolean, unreachable: boolean): EmojiMappingsShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { mappings: { query: api.website.emojiMappings.getEmojiMappings, args: {} } } : {}), [asking]);
  const { mappings } = useQueries(request);
  if (mappings instanceof Error) return { kind: "broken" };
  if (mappings === undefined && unreachable) return { kind: "connecting" };
  return mappings;
}

function useLiveSlackEmojiMatches(near: string, search: string, unreachable: boolean): SlackEmojiMatchesShown | undefined {
  const request = useMemo((): RequestForQueries => ({ matches: { query: api.website.emojiWizard.findSlackEmojis, args: { near, search } } }), [near, search]);
  const { matches } = useQueries(request);
  if (matches instanceof Error) return { kind: "broken" };
  if (matches === undefined && unreachable) return { kind: "connecting" };
  return matches;
}

function useLiveAppEmojis(asking: boolean, unreachable: boolean): AppEmojisShown | undefined {
  const request = useMemo((): RequestForQueries => (asking ? { emojis: { query: api.website.emojiWizard.getAppEmojis, args: {} } } : {}), [asking]);
  const { emojis } = useQueries(request);
  if (emojis instanceof Error) return { kind: "broken" };
  if (emojis === undefined && unreachable) return { kind: "connecting" };
  return emojis;
}

type Answers = { authLoading: boolean; redemptionFailed: boolean; unreachable: boolean; profile: MyProfile | undefined };

function visitorOf({ authLoading, redemptionFailed, unreachable, profile }: Answers): Visitor {
  if (redemptionFailed && profile !== undefined) return profile.kind === "signed-out" ? { kind: "sign-in-unfinished" } : visitorShownFor(profile);
  if (authLoading || profile === undefined) return unreachable ? { kind: "connecting" } : { kind: "loading" };
  return visitorShownFor(profile);
}

function visitorShownFor(profile: MyProfile): Visitor {
  return profile.kind === "member" ? { kind: "member" } : profile;
}

const commandAnswerBudgetMs = 10_000;

function useLiveActions(onSignInFailure: () => void): ShellActions {
  const { signIn, signOut } = useAuthActions();
  const setBoardVisibility = useSentOnce(api.website.commands.setBoardVisibility);
  const setMessageSetting = useSentOnce(api.website.commands.setMessageSetting);
  const pickPrimaryGroup = useSentOnce(api.website.commands.pickPrimaryGroup);
  const linkMyCompanyProfile = useSentOnce(api.website.commands.linkMyCompanyProfile);
  const linkCompanyProfile = useSentOnce(api.website.commands.linkCompanyProfile);
  const setWorkspaceSettings = useSentOnce(api.website.commands.setWorkspaceSettings);
  const setWeeklyPost = useSentOnce(api.website.commands.setWeeklyPost);
  const pickWeeklyPostChannel = useSentOnce(api.website.commands.pickWeeklyPostChannel);
  const setPublicCelebrations = useSentOnce(api.website.commands.setPublicCelebrations);
  const mapSlackEmoji = useSentOnce(api.website.emojiMappings.mapSlackEmoji);
  const mapMyEmoji = useSentOnce(api.website.emojiWizard.mapMyEmoji);
  const pickMyHypeEmoji = useSentOnce(api.website.emojiMappings.pickMyHypeEmoji);
  const openThoughtfulPack = useSentOnce(api.website.album.openThoughtfulPack);
  const unlockTeamSticker = useSentOnce(api.website.album.unlockTeamSticker);
  const putIn = useSentOnce(api.website.album.putIn);
  const putAllIn = useSentOnce(api.website.album.putAllIn);
  const markEmojisSeen = useSentOnce(api.website.album.markEmojisSeen);
  const turnItem = useSentOnce(api.website.album.turnItem);
  const shareItem = useSentOnce(api.website.itemShare.shareItem);
  const arrive = useSentOnce(api.website.lastVisit.arrive);
  const makePet = useSentOnce(api.website.album.makePet);
  const forgeHoggie = useSentOnce(api.website.album.forgeHoggie);
  const endXpMoment = useSentOnce(api.website.xpMoment.endXpMoment);
  const closeHowItWorks = useSentOnce(api.website.onboarding.closeHowItWorks);
  return useMemo(
    () => ({
      setBoardVisibility: (visible) => answerWithin(commandAnswerBudgetMs, setBoardVisibility({ visible })),
      setMessageSetting: (kind, place) => answerWithin(commandAnswerBudgetMs, setMessageSetting({ kind, place })),
      pickPrimaryGroup: (group) => answerWithin(commandAnswerBudgetMs, pickPrimaryGroup({ group })),
      linkMyCompanyProfile: (profile) => answerWithin(commandAnswerBudgetMs, linkMyCompanyProfile({ profile })),
      linkCompanyProfile: (member, profile) => answerWithin(commandAnswerBudgetMs, linkCompanyProfile({ member, profile })),
      setWorkspaceSettings: (settings) => answerWithin(commandAnswerBudgetMs, setWorkspaceSettings(settings)),
      setWeeklyPost: (on) => answerWithin(commandAnswerBudgetMs, setWeeklyPost({ on })),
      pickWeeklyPostChannel: (link) => answerWithin(commandAnswerBudgetMs, pickWeeklyPostChannel({ link })),
      setPublicCelebrations: (on) => answerWithin(commandAnswerBudgetMs, setPublicCelebrations({ on })),
      mapSlackEmoji: (emoji, to) => answerWithin(commandAnswerBudgetMs, mapSlackEmoji({ emoji, to })),
      mapMyEmoji: (emoji, to) => answerWithin(commandAnswerBudgetMs, mapMyEmoji({ emoji, to })),
      pickMyHypeEmoji: (emoji) => answerWithin(commandAnswerBudgetMs, pickMyHypeEmoji({ emoji })),
      openThoughtfulPack: (pack) => answerWithin(commandAnswerBudgetMs, openThoughtfulPack({ pack: pack as Id<"thoughtfulPacks"> })).then(openShown),
      unlockTeamSticker: (team) => answerWithin(commandAnswerBudgetMs, unlockTeamSticker({ team })),
      putIn: (item) => answerWithin(commandAnswerBudgetMs, putIn({ item: item as Id<"trayItems"> })).then(putInShown),
      putAllIn: () => answerWithin(commandAnswerBudgetMs, putAllIn({})).then(putAllInShown),
      markEmojisSeen: (ids) => answerWithin(commandAnswerBudgetMs, markEmojisSeen({ ids })),
      turnItem: (item) => answerWithin(commandAnswerBudgetMs, turnItem({ item: item as Id<"items"> })),
      shareItem: (item) => answerWithin(commandAnswerBudgetMs, shareItem({ item: item as Id<"items"> })),
      arrive: (from) => answerWithin(commandAnswerBudgetMs, arrive({ from })),
      makePet: (hoggie) => answerWithin(commandAnswerBudgetMs, makePet({ hoggie })),
      forgeHoggie: (hoggie, request) => answerWithin(commandAnswerBudgetMs, forgeHoggie({ hoggie, request })),
      endXpMoment: (from, until, skipped) => answerWithin(commandAnswerBudgetMs, endXpMoment({ from, until, skipped })),
      closeHowItWorks: (triedSlack) => answerWithin(commandAnswerBudgetMs, closeHowItWorks({ triedSlack })),
      signIn: (returnTo) =>
        void signIn("slack", { redirectTo: returnTo }).catch(() => {
          forgetSignInStarted();
          onSignInFailure();
        }),
      signOut: () => void signOut(),
    }),
    [signIn, signOut, setBoardVisibility, setMessageSetting, pickPrimaryGroup, linkMyCompanyProfile, linkCompanyProfile, setWorkspaceSettings, setWeeklyPost, pickWeeklyPostChannel, setPublicCelebrations, mapSlackEmoji, mapMyEmoji, pickMyHypeEmoji, openThoughtfulPack, unlockTeamSticker, putIn, putAllIn, markEmojisSeen, turnItem, shareItem, makePet, forgeHoggie, arrive, endXpMoment, closeHowItWorks, onSignInFailure],
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
