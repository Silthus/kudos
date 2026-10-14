import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { focusPageTitle } from "../pageFocus";
import { prefersReducedMotion } from "../reducedMotion";
import type { Feature, ShellActions } from "../shell";
import { rewardLabelOf, type QuestCrate, type ReadyCrate } from "./readyCrates";
import { rewardChipOrigin, type Origin } from "./RewardFlight";
import { hasSeen, markSeen } from "./seen";

export type Attempt = "opening" | "refused" | "unreachable";

export type Reveal = { crate: ReadyCrate; seenBefore: boolean; fromQuests: boolean; claimedFrom: Origin | undefined };

export type Flight = { crate: QuestCrate; from: Origin };

export type Moments = {
  attemptOf(crate: ReadyCrate): Attempt | undefined;
  open(crate: ReadyCrate): void;
  claim(crate: QuestCrate): void;
  reveal: Reveal | undefined;
  flight: Flight | undefined;
  land(): void;
  finish(crate: ReadyCrate): void;
  close(how: { returnFocus: boolean }): void;
  announcement: string;
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
  const [flight, setFlight] = useState<Flight>();
  const sending = useRef(new Set<string>());
  const focusAfterClose = useRef<ReadyCrate | undefined>(undefined);
  const flightAfterClose = useRef<Flight | undefined>(undefined);
  const session = useRef(0);
  const membersShown = useMembersShown(crates);
  const reveal = reveals[0];

  const forgetEverything = useCallback(() => {
    session.current += 1;
    sending.current.clear();
    focusAfterClose.current = undefined;
    flightAfterClose.current = undefined;
    setAttempts({});
    setReveals([]);
    setAnnouncement("");
    setFlight(undefined);
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

  const open = useCallback(
    async (crate: ReadyCrate, claimedFrom: Origin | undefined) => {
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
        if (answer.kind === "opened") setReveals((queued) => [...queued, { crate, seenBefore: hasSeen(seen), fromQuests, claimedFrom }]);
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
    [commands, attemptIs],
  );

  const land = useCallback(() => setFlight(undefined), []);

  const finish = useCallback((crate: ReadyCrate) => {
    markSeen(crate.seen);
    setAnnouncement(openedAnnouncementOf(crate));
  }, []);

  const close = useCallback(
    ({ returnFocus }: { returnFocus: boolean }) => {
      focusAfterClose.current = returnFocus ? reveal?.crate : undefined;
      flightAfterClose.current = flightOf(reveal);
      setReveals((queued) => queued.slice(1));
      setAnnouncement("");
    },
    [reveal],
  );

  useEffect(() => {
    if (reveal !== undefined) return;
    const crate = focusAfterClose.current;
    const launched = flightAfterClose.current;
    focusAfterClose.current = undefined;
    flightAfterClose.current = undefined;
    if (crate !== undefined) focusCrateHomeOrTitle(crate);
    if (launched !== undefined) setFlight(launched);
  }, [reveal]);

  return {
    attemptOf: (crate) => attempts[crate.seen],
    open: (crate) => void open(crate, undefined),
    claim: (crate) => void open(crate, rewardChipOrigin(crate.seen)),
    reveal,
    flight,
    land,
    finish,
    close,
    announcement,
  };
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

function flightOf(reveal: Reveal | undefined): Flight | undefined {
  if (reveal?.claimedFrom === undefined || reveal.crate.kind !== "quest" || prefersReducedMotion()) return undefined;
  return { crate: reveal.crate, from: reveal.claimedFrom };
}

function openedAnnouncementOf(crate: ReadyCrate) {
  if (crate.kind === "feature") return `You opened ${crate.card.name}.`;
  return crate.quest.kind === "journey" ? `You opened your ${rewardLabelOf(crate)}.` : `You opened your ${rewardLabelOf(crate).toLowerCase()}.`;
}

function focusCrateHomeOrTitle(crate: ReadyCrate) {
  const selector = crate.kind === "feature" ? `[data-feature-card="${crate.card.feature}"]` : `[data-quest-crate="${crate.seen}"]`;
  const home = document.querySelector<HTMLElement>(`main ${selector}`);
  if (home === null) focusPageTitle();
  else home.focus();
}
