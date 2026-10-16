import { useCallback, useRef, useState } from "react";
import { dropOf } from "../../crates/drops";
import { attemptMessages, type Attempt } from "../../crates/moments";
import type { BoughtCrate } from "../../crates/readyCrates";
import type { ShellActions } from "../../shell";
import { inTheBookWordsOf, openedWordsOf, packOf, type OpenedPack, type ScenePack } from "./packs";

export type Stage = { kind: "stack" } | { kind: "scene" } | { kind: "landing"; opened: OpenedPack[] };

export type PackSession = {
  stage: Stage;
  fanned: boolean;
  waiting: BoughtCrate[];
  scenePacks: ScenePack[];
  latest: OpenedPack | undefined;
  revealed: number;
  announcement: string;
  returnFocus: boolean;
  fan(): void;
  pick(crate: BoughtCrate): void;
  open(crate: string): void;
  reveal(crate: string): void;
  finish(): void;
  landed(): void;
  focused(): void;
};

export function usePackSession(crates: BoughtCrate[], openCrate: ShellActions["openCrate"]): PackSession {
  const [stage, setStage] = useState<Stage>({ kind: "stack" });
  const [fanned, setFanned] = useState(false);
  const [attempts, setAttempts] = useState<Partial<Record<string, Attempt>>>({});
  const [opened, setOpened] = useState<OpenedPack[]>([]);
  const [revealedCrates, setRevealedCrates] = useState<string[]>([]);
  const [gone, setGone] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [returnFocus, setReturnFocus] = useState(false);
  const sending = useRef(new Set<string>());
  const session = useRef(0);
  const cratesNow = useRef(crates);
  cratesNow.current = crates;
  const waiting = crates.filter(({ crate }) => !gone.includes(crate));

  const attemptIs = useCallback((crate: string, attempt: Attempt | undefined) => setAttempts((all) => ({ ...all, [crate]: attempt })), []);

  const open = useCallback(
    async (crate: string) => {
      const pack = cratesNow.current.find((waiting) => waiting.crate === crate);
      if (pack === undefined || sending.current.has(crate)) return;
      const sentIn = session.current;
      sending.current.add(crate);
      attemptIs(crate, "opening");
      try {
        const answer = await openCrate(crate);
        if (session.current !== sentIn) return;
        if (answer.kind === "opened") {
          const found = { ...packOf(pack), drop: dropOf(answer) };
          setOpened((before) => [...before, found]);
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
    (crate: BoughtCrate) => {
      setStage({ kind: "scene" });
      void open(crate.crate);
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
    setStage(opened.length === 0 ? { kind: "stack" } : { kind: "landing", opened });
  }, [opened]);

  const landed = useCallback(() => {
    if (stage.kind !== "landing") return;
    setGone((before) => [...before, ...stage.opened.map(({ crate }) => crate)]);
    setAnnouncement(inTheBookWordsOf(stage.opened));
    setStage({ kind: "stack" });
  }, [stage]);

  const scenePacks = waiting.map(({ crate, target }): ScenePack => {
    const found = opened.find((pack) => pack.crate === crate);
    const attempt = attempts[crate];
    return { crate, n: target.n, state: found !== undefined ? "opened" : attempt === "opening" ? "tearing" : "sealed", drop: found?.drop, message: attempt === undefined || attempt === "opening" ? undefined : attemptMessages[attempt] };
  });

  return {
    stage,
    fanned,
    waiting,
    scenePacks,
    latest: opened.filter(({ crate }) => revealedCrates.includes(crate)).at(-1),
    revealed: revealedCrates.length,
    announcement,
    returnFocus,
    fan: () => setFanned(true),
    pick,
    open: (crate) => void open(crate),
    reveal,
    finish,
    landed,
    focused: () => setReturnFocus(false),
  };
}
