import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { focusPageTitle } from "../pageFocus";
import type { CrateAnswer, Feature, ShellActions } from "../shell";
import { rewardWords } from "../quests/QuestReward";
import { dropOf, type Drop } from "./drops";
import { rewardLabelOf, type QuestCrate, type ReadyCrate } from "./readyCrates";
import { climbRewardOf, type Climb, type OnTheWay, type Reward, type RewardKind } from "./rewards";
import { hasSeen, markSeen } from "./seen";

export type Attempt = "opening" | "refused" | "unreachable";

export type PopIn = "entry" | "chip";

export type Reveal = { crate: ReadyCrate; seenBefore: boolean; fromQuests: boolean; drop: Drop | null };

export type Flight = { crate: ReadyCrate; landed: RewardKind[]; setOut: boolean; reward?: Reward; climb?: Climb };

export type Moments = {
  attemptOf(crate: ReadyCrate): Attempt | undefined;
  opening: boolean;
  open(crate: ReadyCrate): void;
  reveal: Reveal | undefined;
  waitsToReveal(crate: ReadyCrate): boolean;
  flight: Flight | undefined;
  chart(rewards: Reward[]): void;
  setOut(crate: ReadyCrate): void;
  landed(crate: ReadyCrate, kind: RewardKind): void;
  finish(crate: ReadyCrate, drop: Drop | null): void;
  close(how: { returnFocus: boolean }): void;
  announcement: string;
  onTheWay: OnTheWay[];
  popsIn(feature: Feature, where: PopIn): boolean;
  poppedIn(feature: Feature, where: PopIn): void;
};

export const attemptMessages: Record<Exclude<Attempt, "opening">, string> = {
  refused: "That couldn't be opened.",
  unreachable: "Couldn't reach HedgeHug. Try again.",
};

const MomentsContext = createContext<Moments | undefined>(undefined);

export const MomentsProvider = MomentsContext.Provider;

export function useMoments() {
  return useContext(MomentsContext);
}

type Commands = Pick<ShellActions, "openFeature" | "openQuestCrate">;

type Shown = { signedOut: boolean; crates: string[] | undefined; onQuests: boolean };

export function useCrateMoments(commands: Commands, { signedOut, crates, onQuests }: Shown): Moments {
  const [attempts, setAttempts] = useState<Partial<Record<string, Attempt>>>({});
  const [reveals, setReveals] = useState<Reveal[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [popIns, setPopIns] = useState<string[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const sending = useRef(new Set<string>());
  const focusAfterClose = useRef<ReadyCrate | undefined>(undefined);
  const session = useRef(0);
  const membersShown = useMembersShown(crates);
  const reveal = reveals[0];

  const forgetEverything = useCallback(() => {
    session.current += 1;
    sending.current.clear();
    focusAfterClose.current = undefined;
    setAttempts({});
    setReveals([]);
    setAnnouncement("");
    setPopIns([]);
    setFlights([]);
  }, []);

  useEffect(() => {
    if (signedOut) forgetEverything();
  }, [signedOut, forgetEverything]);

  useEffect(() => {
    if (membersShown > 1) forgetEverything();
  }, [membersShown, forgetEverything]);

  const attemptIs = useCallback((seen: string, attempt: Attempt | undefined) => setAttempts((all) => ({ ...all, [seen]: attempt })), []);
  const onQuestsNow = useRef(onQuests);
  onQuestsNow.current = onQuests;

  const queue = useCallback((crate: ReadyCrate, fromQuests: boolean, drop: Drop | null, climb: Climb | undefined) => {
    const seenBefore = hasSeen(crate.seen);
    setReveals((queued) => (queued.some((shown) => shown.crate.seen === crate.seen) ? queued : [...queued, { crate, seenBefore, fromQuests, drop }]));
    if (!seenBefore) setFlights((queued) => (queued.some((flying) => flying.crate.seen === crate.seen) ? queued : [...queued, flightOf(crate, climb)]));
  }, []);

  const open = useCallback(
    async (crate: ReadyCrate) => {
      const { seen } = crate;
      if (sending.current.has(seen)) return;
      const sentIn = session.current;
      const fromQuests = onQuestsNow.current;
      sending.current.add(seen);
      attemptIs(seen, "opening");
      setAnnouncement("");
      try {
        const answer = await (crate.kind === "feature" ? commands.openFeature(crate.card.feature) : commands.openQuestCrate(crate.quest));
        if (session.current !== sentIn) return;
        if (answer.kind === "opened") queue(crate, fromQuests, dropOf(answer), climbOf(answer));
        if (answer.kind === "opened" && crate.kind === "feature") setPopIns((waiting) => [...waiting, popInKey(crate.card.feature, "entry"), popInKey(crate.card.feature, "chip")]);
        attemptIs(seen, answer.kind === "refused" ? "refused" : undefined);
        if (answer.kind === "refused") setAnnouncement(attemptMessages.refused);
      } catch {
        if (session.current !== sentIn) return;
        attemptIs(seen, "unreachable");
        setAnnouncement(attemptMessages.unreachable);
      } finally {
        if (session.current === sentIn) sending.current.delete(seen);
      }
    },
    [commands, attemptIs, queue],
  );

  const chart = useCallback(
    (rewards: Reward[]) => setFlights((queued) => (queued.some(uncharted) ? queued.map((flight, at) => (uncharted(flight) ? { ...flight, reward: rewards[at] } : flight)) : queued)),
    [],
  );

  const setOut = useCallback((crate: ReadyCrate) => setFlights((queued) => queued.map((flight) => (flight.crate.seen === crate.seen && !flight.setOut ? { ...flight, setOut: true } : flight))), []);

  const landed = useCallback(
    (crate: ReadyCrate, kind: RewardKind) => setFlights((queued) => queued.map((flight, at) => (at === 0 && flight.crate.seen === crate.seen ? { ...flight, landed: [...flight.landed, kind] } : flight))),
    [],
  );

  const land = useCallback((crate: ReadyCrate) => setFlights((queued) => (queued[0]?.crate.seen === crate.seen ? queued.slice(1) : queued)), []);

  const finish = useCallback((crate: ReadyCrate, drop: Drop | null) => {
    markSeen(crate.seen);
    setAnnouncement(openedAnnouncementOf(crate, drop));
  }, []);

  const close = useCallback(
    ({ returnFocus }: { returnFocus: boolean }) => {
      focusAfterClose.current = returnFocus ? reveal?.crate : undefined;
      if (reveal !== undefined) land(reveal.crate);
      setReveals((queued) => queued.slice(1));
      setAnnouncement("");
    },
    [reveal, land],
  );

  useEffect(() => {
    if (reveal !== undefined) return;
    const crate = focusAfterClose.current;
    focusAfterClose.current = undefined;
    if (crate !== undefined) focusCrateHomeOrTitle(crate);
  }, [reveal]);

  return {
    attemptOf: (crate) => attempts[crate.seen],
    opening: Object.values(attempts).includes("opening"),
    open: (crate) => void open(crate),
    reveal,
    waitsToReveal: (crate) => reveals.slice(1).some((queued) => queued.crate.seen === crate.seen),
    flight: flights[0],
    chart,
    setOut,
    landed,
    finish,
    close,
    announcement,
    onTheWay: flights,
    popsIn: (feature, where) => popIns.includes(popInKey(feature, where)),
    poppedIn: (feature, where) => setPopIns((waiting) => waiting.filter((key) => key !== popInKey(feature, where))),
  };
}

function uncharted({ setOut, reward }: Flight) {
  return setOut && reward === undefined;
}

function flightOf(crate: ReadyCrate, climb: Climb | undefined): Flight {
  const idle = { crate, landed: [], setOut: false };
  if (climb === undefined) return idle;
  return climb === null ? { ...idle, climb } : { ...idle, climb, setOut: true, reward: climbRewardOf(climb) };
}

function climbOf(answer: { kind: "opened" } & Partial<Pick<Extract<CrateAnswer, { kind: "opened" }>, "applied">>): Climb | undefined {
  return answer.applied;
}

function popInKey(feature: Feature, where: PopIn) {
  return `${where}:${feature}`;
}

export function useMembersShown(crates: string[] | undefined) {
  const lastCrates = useRef<string[] | undefined>(undefined);
  const members = useRef(1);
  if (crates !== undefined) {
    if (lastCrates.current !== undefined && !sameMember(lastCrates.current, crates)) members.current += 1;
    lastCrates.current = crates;
  }
  return members.current;
}

function sameMember(before: string[], now: string[]) {
  return now.some((key) => before.includes(key)) || (before.length === 0 && now.length === 0);
}

export function featureCardAttributes(feature: Feature) {
  return { "data-feature-card": feature };
}

export function questCrateHomeAttributes(seen: string | null) {
  return seen === null ? {} : { "data-quest-crate": seen, tabIndex: -1 };
}

function openedAnnouncementOf(crate: ReadyCrate, drop: Drop | null) {
  const opened = crate.kind === "feature" ? `You opened ${crate.card.name}.` : questOpenedWordsOf(crate);
  return drop === null ? opened : `${opened} ${foundWordsOf(drop)}`;
}

function questOpenedWordsOf(crate: QuestCrate) {
  const label = crate.quest.kind === "journey" ? rewardLabelOf(crate) : rewardLabelOf(crate).toLowerCase();
  const words = rewardWords(crate.reward);
  return words === undefined ? `You opened your ${label}.` : `You opened your ${label}. You earned ${words}.`;
}

function foundWordsOf(drop: Drop) {
  const article = /^[aeiou]/.test(drop.rarity) ? "an" : "a";
  const found = `You found ${article} ${drop.rarity} ${drop.name}.`;
  return drop.crest ? `${found} It completed the ${drop.crest.name} crest.` : found;
}

function focusCrateHomeOrTitle(crate: ReadyCrate) {
  const selector = crate.kind === "feature" ? `[data-feature-card="${crate.card.feature}"]` : `[data-quest-crate="${crate.seen}"]`;
  const home = document.querySelector<HTMLElement>(`main ${selector}`);
  if (home === null) focusPageTitle();
  else home.focus();
}
