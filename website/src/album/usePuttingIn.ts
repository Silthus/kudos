import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { prefersReducedMotion } from "../reducedMotion";
import type { Album, PutAllInReply, PutInReply, TrayItem } from "./answer";
import { plural } from "./facts";
import { albumWithLanded, slotOf, withTrayItems, type Slot } from "./tray";

export const putInFlightMs = 1100;

const touchdownMs = 700;

export function putInGapMs(items: number) {
  return Math.min(400, Math.round(4000 / Math.max(1, items)));
}

export type Box = { left: number; top: number; width: number; height: number };

export type Flight = { key: string; item: TrayItem; to: Slot; from: Box; target: Box };

export type Touchdown = { key: string; item: TrayItem; target: Box };

export type PutInCommands = { putIn: (item: string) => Promise<PutInReply>; putAllIn: () => Promise<PutAllInReply> };

type Problem = "refused" | "unreachable";

type Page = { items: TrayItem[]; more: boolean } | Problem;

export type PuttingIn = {
  album: Album;
  busy: boolean;
  flights: Flight[];
  touchdowns: Touchdown[];
  said: string;
  trouble: string | null;
  putIn: (item: string) => void;
  putAllIn: () => void;
};

export function usePuttingIn(answered: Album, commands: PutInCommands, trayButton: RefObject<HTMLElement | null>): PuttingIn {
  const [before, setBefore] = useState<Album | null>(null);
  const [landed, setLanded] = useState<TrayItem[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [touchdowns, setTouchdowns] = useState<Touchdown[]>([]);
  const [said, setSaid] = useState("");
  const [trouble, setTrouble] = useState<string | null>(null);
  const clock = useSkippableClock();
  const album = useMemo(() => (before === null ? albumWithLanded(answered, landed.filter((item) => answered.tray.some(({ item: waiting }) => waiting === item.item))) : albumWithLanded(before, landed)), [answered, before, landed]);
  const shown = useRef(album);
  shown.current = album;

  const land = useCallback((items: TrayItem[]) => setLanded((already) => [...already, ...items]), []);

  const flyIn = async (items: TrayItem[], into: Album) => {
    if (prefersReducedMotion() || clock.skipping()) return land(items);
    const gap = putInGapMs(items.length);
    await Promise.all(
      items.map(async (item, index) => {
        await clock.pause(index * gap);
        if (clock.cancelled()) return;
        if (clock.skipping()) return land([item]);
        const flight = launchedFlight(item, slotOf(into, item), trayButton.current);
        setFlights((flying) => [...flying, flight]);
        await clock.pause(putInFlightMs);
        if (clock.cancelled()) return;
        setFlights((flying) => flying.filter(({ key }) => key !== flight.key));
        land([item]);
        if (!clock.skipping()) touchDown(flight);
      }),
    );
  };

  const touchDown = ({ key, item, target }: Flight) => {
    setTouchdowns((marks) => [...marks, { key, item, target }]);
    window.setTimeout(() => setTouchdowns((marks) => marks.filter((mark) => mark.key !== key)), touchdownMs);
  };

  const run = async (nextPage: () => Promise<Page>) => {
    if (before !== null) return;
    const into = shown.current;
    setBefore(into);
    setSaid("");
    setTrouble(null);
    clock.start();
    let placed = 0;
    let problem: Problem | null = null;
    for (;;) {
      const page = await nextPage();
      if (clock.cancelled()) return;
      if (typeof page === "string") {
        problem = page;
        break;
      }
      setBefore((held) => held && withTrayItems(held, page.items));
      await flyIn(page.items, into);
      if (clock.cancelled()) return;
      placed += page.items.length;
      if (!page.more || page.items.length === 0) break;
    }
    setBefore(null);
    setFlights([]);
    setSaid(saidAfter(placed, problem));
    setTrouble(problem === null ? null : troubleOf(placed, problem));
  };

  const putIn = (item: string) => void run(() => pageOf(commands.putIn(item), (reply) => ({ items: [reply.item], more: false })));

  const putAllIn = () => void run(() => pageOf(commands.putAllIn(), ({ items, more }) => ({ items, more })));

  useEscapeWhile(before !== null, clock.skip);

  return { album, busy: before !== null, flights, touchdowns, said, trouble, putIn, putAllIn };
}

async function pageOf<Reply extends { kind: string }>(sent: Promise<Reply>, placed: (reply: Extract<Reply, { kind: "placed" }>) => { items: TrayItem[]; more: boolean }): Promise<Page> {
  try {
    const reply = await sent;
    return reply.kind === "placed" ? placed(reply as Extract<Reply, { kind: "placed" }>) : "refused";
  } catch {
    return "unreachable";
  }
}

function saidAfter(placed: number, problem: Problem | null) {
  const done = placed === 0 ? "" : `${plural(placed, "card", "cards")} put in your album.`;
  return [done, problem === null ? "" : troubleOf(placed, problem)].filter((words) => words !== "").join(" ");
}

function troubleOf(placed: number, problem: Problem) {
  if (problem === "unreachable") return "Can't reach HedgeHug. Try again.";
  return placed === 0 ? "That couldn't be put in. It may already be in your album." : "The rest couldn't be put in. Try again.";
}

function launchedFlight(item: TrayItem, to: Slot, tray: HTMLElement | null): Flight {
  return { key: `${item.item}:${performance.now()}`, item, to, from: boxOf(shownOrNull(tray)), target: boxOf(slotElementOf(to)) };
}

function slotElementOf(slot: Slot): Element | null {
  return shownOrNull(document.querySelector(`[data-slot="${CSS.escape(slot)}"]`)) ?? shownOrNull(document.querySelector(".al-side-toggle")) ?? document.querySelector(".al-brand");
}

function shownOrNull(element: Element | null) {
  return element !== null && element.getClientRects().length > 0 ? element : null;
}

function boxOf(element: Element | null): Box {
  if (element === null) return { left: 0, top: 0, width: 0, height: 0 };
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
}

function useSkippableClock() {
  const state = useRef({ skipping: false, cancelled: false, waking: new Set<() => void>() });
  const clock = useMemo(() => {
    const wakeEveryPause = () => state.current.waking.forEach((wake) => wake());
    return {
      skipping: () => state.current.skipping,
      cancelled: () => state.current.cancelled,
      start: () => {
        state.current.skipping = false;
      },
      skip: () => {
        state.current.skipping = true;
        wakeEveryPause();
      },
      mount: () => {
        state.current.cancelled = false;
      },
      cancel: () => {
        state.current.cancelled = true;
        wakeEveryPause();
      },
      pause: (ms: number) =>
        new Promise<void>((resolve) => {
          if (ms <= 0 || state.current.skipping || state.current.cancelled) return resolve();
          const wake = () => {
            window.clearTimeout(timer);
            state.current.waking.delete(wake);
            resolve();
          };
          const timer = window.setTimeout(wake, ms);
          state.current.waking.add(wake);
        }),
    };
  }, []);
  useEffect(() => {
    clock.mount();
    return clock.cancel;
  }, [clock]);
  return clock;
}

function useEscapeWhile(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, onEscape]);
}
