import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { focusPageTitle } from "../pageFocus";
import type { Feature, FeatureCard, ShellActions } from "../shell";
import { hasSeen, markSeen } from "./seen";

export type Attempt = "opening" | "refused" | "unreachable";

export type Reveal = { card: FeatureCard; seenBefore: boolean };

export type Moments = {
  attemptOf(feature: Feature): Attempt | undefined;
  open(card: FeatureCard): void;
  reveal: Reveal | undefined;
  finish(card: FeatureCard): void;
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

type Shown = { signedOut: boolean; crates: string[] };

export function useCrateMoments(openFeature: ShellActions["openFeature"], { signedOut, crates }: Shown): Moments {
  const [attempts, setAttempts] = useState<Partial<Record<Feature, Attempt>>>({});
  const [reveals, setReveals] = useState<Reveal[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const sending = useRef(new Set<Feature>());
  const focusAfterClose = useRef<Feature | undefined>(undefined);
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
  }, []);

  useEffect(() => {
    if (signedOut) forgetEverything();
  }, [signedOut, forgetEverything]);

  useEffect(() => {
    if (membersShown > 1) forgetEverything();
  }, [membersShown, forgetEverything]);

  const attemptIs = useCallback((feature: Feature, attempt: Attempt | undefined) => setAttempts((all) => ({ ...all, [feature]: attempt })), []);

  const open = useCallback(
    async (card: FeatureCard) => {
      const { feature } = card;
      if (sending.current.has(feature)) return;
      const sentIn = session.current;
      sending.current.add(feature);
      attemptIs(feature, "opening");
      setAnnouncement("");
      try {
        const answer = await openFeature(feature);
        if (session.current !== sentIn) return;
        if (answer.kind === "opened") setReveals((queued) => [...queued, { card, seenBefore: hasSeen(card.seen) }]);
        attemptIs(feature, answer.kind === "refused" ? "refused" : undefined);
        if (answer.kind === "refused") setAnnouncement(attemptMessages.refused);
      } catch {
        if (session.current !== sentIn) return;
        attemptIs(feature, "unreachable");
        setAnnouncement(attemptMessages.unreachable);
      } finally {
        if (session.current === sentIn) sending.current.delete(feature);
      }
    },
    [openFeature, attemptIs],
  );

  const finish = useCallback((card: FeatureCard) => {
    markSeen(card.seen);
    setAnnouncement(`You opened ${card.name}.`);
  }, []);

  const close = useCallback(
    ({ returnFocus }: { returnFocus: boolean }) => {
      focusAfterClose.current = returnFocus ? reveal?.card.feature : undefined;
      setReveals((queued) => queued.slice(1));
    },
    [reveal],
  );

  useEffect(() => {
    const feature = focusAfterClose.current;
    if (reveal !== undefined || feature === undefined) return;
    focusAfterClose.current = undefined;
    focusFeatureCardOrTitle(feature);
  }, [reveal]);

  return {
    attemptOf: (feature) => attempts[feature],
    open: (card) => void open(card),
    reveal,
    finish,
    close,
    announcement,
  };
}

function useMembersShown(crates: string[]) {
  const lastCrates = useRef<string[]>([]);
  const members = useRef(1);
  if (crates.length > 0) {
    if (lastCrates.current.length > 0 && !crates.some((key) => lastCrates.current.includes(key))) members.current += 1;
    lastCrates.current = crates;
  }
  return members.current;
}

export function featureCardAttributes(feature: Feature) {
  return { "data-feature-card": feature };
}

function focusFeatureCardOrTitle(feature: Feature) {
  const card = document.querySelector<HTMLElement>(`main [data-feature-card="${feature}"]`);
  if (card === null) focusPageTitle();
  else card.focus();
}
