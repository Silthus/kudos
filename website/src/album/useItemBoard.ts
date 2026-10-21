import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Unlocked } from "../../../convex/items/turn";
import type { AppliedReward } from "../../../convex/progression/rewards";
import type { ItemBoard, LoopLesson, TurnedFaceShown } from "../../../convex/website/album";
import { useNavigate } from "../AppLink";
import { prefersReducedMotion } from "../reducedMotion";
import type { TurnReply } from "../shell";
import type { AlbumLevel } from "./answer";
import { hrefOf, type Place } from "./place";
import type { Turned } from "./turnSequence";
import { useTurnFlight, type Flight, type FlightBoxes } from "./useTurnFlight";

export type LandingPhase = "arriving" | "landed" | "done";

export type Landing = { item: string; face: TurnedFaceShown; applied: AppliedReward | null; unlocked: Unlocked; teaches: LoopLesson | null; turn: number; phase: LandingPhase; flown: boolean; teamsShown: number; medalsShown: number };

type Shown = "board" | "later" | "landed";

export type TurnedItem = { item: string; face: TurnedFaceShown };

export type ItemTurns = {
  board: ItemBoard | null;
  turnedThisVisit: TurnedItem[];
  shown: Shown;
  turning: boolean;
  trouble: string | null;
  landing: Landing | null;
  closedByLater: boolean;
  flight: Flight | null;
  boxes: FlightBoxes;
  heldLevel: AlbumLevel | null;
  show: () => void;
  later: () => void;
  turn: (item: string, from: HTMLElement | null) => void;
};

const LandingContext = createContext<Landing | null>(null);

export const LandingProvider = LandingContext.Provider;

export function useLanding() {
  return useContext(LandingContext);
}

export type ShownTurns = ItemTurns & { open: boolean; offered: boolean };

export function shownUnless(turns: ItemTurns, waits: boolean): ShownTurns {
  const waiting = (turns.board?.items.length ?? 0) > 0 && !waits;
  return { ...turns, open: waiting && turns.shown === "board", offered: waiting && turns.shown !== "board" };
}

export function useItemBoard(answered: ItemBoard | null, turnItem: (item: string) => Promise<TurnReply>, level: AlbumLevel): ItemTurns {
  const navigate = useNavigate();
  const [shown, setShown] = useState<Shown>("board");
  const [turnedOver, setTurnedOver] = useState<ReadonlyMap<string, TurnedFaceShown>>(() => new Map());
  const [turning, setTurning] = useState(false);
  const sending = useRef(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [landing, setLanding] = useState<Landing | null>(null);
  const [heldLevel, setHeldLevel] = useState<AlbumLevel | null>(null);
  const { flight, boxes, fly } = useTurnFlight();
  const board = useMemo(() => (answered === null ? null : withoutTurned(answered, turnedOver)), [answered, turnedOver]);
  const turnedThisVisit = useMemo(() => [...turnedOver].map(([item, face]) => ({ item, face })), [turnedOver]);
  const remaining = useRef(0);
  remaining.current = board?.items.length ?? 0;
  const land = useCallback(
    (item: string, { face, applied, unlocked, page, teaches }: Turned, flown: boolean) => {
      setTurnedOver((turned) => new Map(turned).set(item, face));
      setLanding((last) => ({ item, face, applied, unlocked, teaches: teaches ?? null, turn: (last?.turn ?? 0) + 1, phase: flown ? "arriving" : "done", flown, teamsShown: flown ? 0 : unlocked.teamStickers.length, medalsShown: flown ? 0 : unlocked.milestones.length }));
      navigate(hrefOf(placeOf(page)));
    },
    [navigate],
  );
  const phase = useCallback((next: LandingPhase) => setLanding((last) => (last === null ? null : { ...last, phase: next })), []);
  const medalShown = useCallback((shown: (last: Landing) => number) => setLanding((last) => (last === null ? null : { ...last, medalsShown: shown(last) })), []);
  const teamShown = useCallback((shown: (last: Landing) => number) => setLanding((last) => (last === null ? null : { ...last, phase: "done", teamsShown: shown(last) })), []);
  const flyIn = useCallback(
    async (item: string, from: HTMLElement, answer: Promise<Turned | null>) => {
      setHeldLevel(level);
      const arrival = {
        land: (turned: Turned) => land(item, turned, true),
        landed: () => phase("landed"),
        teamUnlocked: () => teamShown(({ teamsShown }) => teamsShown + 1),
        toTheTeam: (team: string) => navigate(hrefOf({ kind: "team", team })),
        toTheMilestones: () => navigate(hrefOf({ kind: "milestones" })),
        medalShown: () => medalShown(({ medalsShown }) => medalsShown + 1),
        paid: () => setHeldLevel(null),
        nothingWaits: () => remaining.current === 0,
      };
      const turned = await fly(item, from.getBoundingClientRect(), answer, arrival);
      setHeldLevel(null);
      if (turned !== null) teamShown(({ unlocked }) => unlocked.teamStickers.length);
      if (turned !== null) medalShown(({ unlocked }) => unlocked.milestones.length);
      if (turned !== null && remaining.current === 0) setShown("landed");
    },
    [fly, land, phase, teamShown, medalShown, navigate, level],
  );
  const turn = useCallback(
    async (item: string, from: HTMLElement | null) => {
      if (sending.current) return;
      sending.current = true;
      setTurning(true);
      setTrouble(null);
      const answer = turnedOf(turnItem(item), setTrouble);
      if (from === null || prefersReducedMotion()) {
        const turned = await answer;
        if (turned !== null) {
          land(item, turned, false);
          setShown("landed");
        }
      } else await flyIn(item, from, answer);
      sending.current = false;
      setTurning(false);
    },
    [turnItem, land, flyIn],
  );
  const show = useCallback(() => {
    setTrouble(null);
    setShown("board");
  }, []);
  const later = useCallback(() => setShown("later"), []);
  return { board, turnedThisVisit, shown, turning, trouble, landing, closedByLater: shown === "later", flight, boxes, heldLevel, show, later, turn: (item, from) => void turn(item, from) };
}

async function turnedOf(sent: Promise<TurnReply>, say: (trouble: string) => void): Promise<Turned | null> {
  const reply = await replyOf(sent);
  if (reply.kind === "turned") return reply;
  say(troubleOf(reply.kind));
  return null;
}

function placeOf(page: Turned["page"]): Place {
  return page.kind === "hoggies" ? { kind: "hoggies", hoggie: null } : page;
}

export function useLandedSticker(person: string): Landing | null {
  const landing = useLanding();
  return landing?.face.kind === "sticker" && landing.face.person === person ? landing : null;
}

export function landedMarksOf(landing: Landing | null) {
  if (landing === null) return {};
  return { "data-landed": "", "data-arriving": landing.phase === "arriving" ? "" : undefined };
}

export function useBroughtIntoViewOnLanding(landed: RefObject<HTMLElement | null>, landing: Landing | null) {
  const plainTurn = landing === null || landing.flown ? null : landing.turn;
  useEffect(() => {
    if (plainTurn === null) return;
    const frame = requestAnimationFrame(() => landed.current?.scrollIntoView({ block: "center", behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [landed, plainTurn]);
}

function withoutTurned(board: ItemBoard, turnedOver: ReadonlyMap<string, TurnedFaceShown>): ItemBoard {
  return turnedOver.size === 0 ? board : { ...board, items: board.items.filter(({ item }) => !turnedOver.has(item)) };
}

async function replyOf(sent: Promise<TurnReply>): Promise<TurnReply | { kind: "unreachable" }> {
  try {
    return await sent;
  } catch {
    return { kind: "unreachable" };
  }
}

function troubleOf(kind: string) {
  return kind === "unreachable" ? "Can't reach HedgeHug. Try again." : "That item couldn't be turned over. Try again.";
}
