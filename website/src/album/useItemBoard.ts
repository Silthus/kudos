import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { Drop } from "../../../convex/hoggies/drops";
import type { AppliedReward } from "../../../convex/progression/rewards";
import type { ItemBoard, LoopLesson, TurnAnswer } from "../../../convex/website/album";
import { useNavigate } from "../AppLink";
import type { TurnReply } from "../shell";
import { hrefOf } from "./place";

export type Landing = { drop: Drop; applied: AppliedReward | null; teaches: LoopLesson | null; turn: number };

type Shown = "board" | "later" | "landed";

export type ItemTurns = { board: ItemBoard | null; open: boolean; offered: boolean; turning: boolean; trouble: string | null; landing: Landing | null; closedByLater: boolean; show: () => void; later: () => void; turn: (item: string) => void };

const LandingContext = createContext<Landing | null>(null);

export const LandingProvider = LandingContext.Provider;

export function useLanding() {
  return useContext(LandingContext);
}

export function useItemBoard(answered: ItemBoard | null, turnItem: (item: string) => Promise<TurnReply>, waits: boolean): ItemTurns {
  const navigate = useNavigate();
  const [shown, setShown] = useState<Shown>("board");
  const [turnedOver, setTurnedOver] = useState<ReadonlySet<string>>(() => new Set());
  const [turning, setTurning] = useState(false);
  const sending = useRef(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [landing, setLanding] = useState<Landing | null>(null);
  const board = useMemo(() => (answered === null ? null : withoutTurned(answered, turnedOver)), [answered, turnedOver]);
  const waiting = (board?.items.length ?? 0) > 0 && !waits;
  const land = useCallback(
    (item: string, { face, applied, page, teaches }: Extract<TurnAnswer, { kind: "turned" }>) => {
      setTurnedOver((turned) => new Set(turned).add(item));
      setShown("landed");
      setLanding((last) => ({ drop: face.drop, applied, teaches: teaches ?? null, turn: (last?.turn ?? 0) + 1 }));
      navigate(hrefOf({ kind: page.kind, hoggie: null }));
    },
    [navigate],
  );
  const turn = useCallback(
    async (item: string) => {
      if (sending.current) return;
      sending.current = true;
      setTurning(true);
      setTrouble(null);
      const reply = await replyOf(turnItem(item));
      sending.current = false;
      setTurning(false);
      if (reply.kind === "turned") land(item, reply);
      else setTrouble(troubleOf(reply.kind));
    },
    [turnItem, land],
  );
  const show = useCallback(() => {
    setTrouble(null);
    setShown("board");
  }, []);
  const later = useCallback(() => setShown("later"), []);
  return { board, open: waiting && shown === "board", offered: waiting && shown !== "board", turning, trouble, landing, closedByLater: shown === "later", show, later, turn: (item) => void turn(item) };
}

function withoutTurned(board: ItemBoard, turnedOver: ReadonlySet<string>): ItemBoard {
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
