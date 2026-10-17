import { useCallback, useRef, useState } from "react";
import { dropOf } from "../../crates/drops";
import { attemptMessages, type Attempt } from "../../crates/moments";
import type { PackHold, RewardKind } from "../../crates/rewards";
import type { ShellActions } from "../../shell";
import { inTheBookWordsOf, openedWordsOf, packOf, type OpenedPack, type ScenePack, type WaitingPack, type WaitingPacks } from "./packs";

export type Stage = { kind: "stack" } | { kind: "scene" } | { kind: "landing"; opened: OpenedPack[] };

type Held = PackHold & { crate: string };

export type PackSession = {
  stage: Stage;
  fanned: boolean;
  listed: boolean;
  more: boolean;
  waiting: WaitingPack[];
  scenePacks: ScenePack[];
  latest: OpenedPack | undefined;
  revealed: number;
  opened: OpenedPack[];
  opening: boolean;
  holds: PackHold[];
  announcement: string;
  returnFocus: boolean;
  has(crate: string): boolean;
  fan(): void;
  pick(crate: string): void;
  open(crate: string): void;
  reveal(crate: string): void;
  finish(): void;
  rewardLanded(crate: string, kind: RewardKind): void;
  landed(): void;
  focused(): void;
};

export function usePackSession({ packs, listed, more }: WaitingPacks, openCrate: ShellActions["openCrate"]): PackSession {
  const [stage, setStage] = useState<Stage>({ kind: "stack" });
  const [inTheScene, setInTheScene] = useState<WaitingPack[]>([]);
  const [fanned, setFanned] = useState(false);
  const [attempts, setAttempts] = useState<Partial<Record<string, Attempt>>>({});
  const [opened, setOpened] = useState<OpenedPack[]>([]);
  const [held, setHeld] = useState<Held[]>([]);
  const [revealedCrates, setRevealedCrates] = useState<string[]>([]);
  const [gone, setGone] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [returnFocus, setReturnFocus] = useState(false);
  const sending = useRef(new Set<string>());
  const session = useRef(0);
  const waiting = packs.filter(({ crate }) => !gone.includes(crate));
  const waitingNow = useRef(waiting);
  waitingNow.current = waiting;
  const inTheSceneNow = useRef(inTheScene);
  inTheSceneNow.current = inTheScene;

  const attemptIs = useCallback((crate: string, attempt: Attempt | undefined) => setAttempts((all) => ({ ...all, [crate]: attempt })), []);

  const open = useCallback(
    async (crate: string) => {
      const pack = inTheSceneNow.current.find((shown) => shown.crate === crate);
      if (pack === undefined || sending.current.has(crate)) return;
      const sentIn = session.current;
      sending.current.add(crate);
      attemptIs(crate, "opening");
      try {
        const answer = await openCrate(crate);
        if (session.current !== sentIn) return;
        if (answer.kind === "opened") {
          const found: OpenedPack = { ...packOf(pack), drop: dropOf(answer), applied: answer.applied ?? null };
          setOpened((before) => [...before, found]);
          if (found.applied !== null) setHeld((before) => [...before, { crate, applied: found.applied!, landed: [] }]);
          setAnnouncement(openedWordsOf(found));
        }
        attemptIs(crate, answer.kind === "refused" ? "refused" : undefined);
        if (answer.kind === "refused") setAnnouncement(attemptMessages.refused);
      } catch {
        if (session.current !== sentIn) return;
        attemptIs(crate, "unreachable");
        setAnnouncement(attemptMessages.unreachable);
      } finally {
        if (session.current === sentIn) sending.current.delete(crate);
      }
    },
    [openCrate, attemptIs],
  );

  const pick = useCallback(
    (crate: string) => {
      const shown = waitingNow.current;
      if (!shown.some((pack) => pack.crate === crate)) return;
      inTheSceneNow.current = shown;
      setInTheScene(shown);
      setStage({ kind: "scene" });
      void open(crate);
    },
    [open],
  );

  const reveal = useCallback((crate: string) => setRevealedCrates((before) => (before.includes(crate) ? before : [...before, crate])), []);

  const finish = useCallback(() => {
    session.current += 1;
    sending.current.clear();
    setAttempts({});
    setRevealedCrates([]);
    setOpened([]);
    setFanned(false);
    setReturnFocus(true);
    setGone((before) => [...before, ...opened.map(({ crate }) => crate)]);
    setStage(opened.length === 0 ? { kind: "stack" } : { kind: "landing", opened });
  }, [opened]);

  const rewardLanded = useCallback((crate: string, kind: RewardKind) => setHeld((before) => before.map((hold) => (hold.crate === crate && !hold.landed.includes(kind) ? { ...hold, landed: [...hold.landed, kind] } : hold))), []);

  const landed = useCallback(() => {
    if (stage.kind !== "landing") return;
    setAnnouncement(inTheBookWordsOf(stage.opened));
    setHeld([]);
    setStage({ kind: "stack" });
  }, [stage]);

  const scenePacks = inTheScene.map(({ crate, n }): ScenePack => {
    const found = opened.find((pack) => pack.crate === crate);
    const attempt = attempts[crate];
    return { crate, n, state: found !== undefined ? "opened" : attempt === "opening" ? "tearing" : "sealed", revealed: revealedCrates.includes(crate), drop: found?.drop, applied: found?.applied, message: attempt === undefined || attempt === "opening" ? undefined : attemptMessages[attempt] };
  });

  return {
    stage,
    fanned,
    listed,
    more,
    waiting,
    scenePacks,
    latest: opened.filter(({ crate }) => revealedCrates.includes(crate)).at(-1),
    revealed: revealedCrates.length,
    opened,
    opening: Object.values(attempts).includes("opening"),
    holds: held,
    announcement,
    returnFocus,
    has: (crate) => waiting.some((pack) => pack.crate === crate),
    fan: () => setFanned(true),
    pick,
    open: (crate) => void open(crate),
    reveal,
    finish,
    rewardLanded,
    landed,
    focused: () => setReturnFocus(false),
  };
}
