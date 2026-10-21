import { useCallback, useEffect, useRef, useState } from "react";
import type { XpMoment } from "../../../convex/website/xpMoment";
import type { ArrivalReply, ShellActions } from "../shell";
import type { AlbumShown, XpMomentShown } from "./answer";

export type XpMomentAhead = XpMoment | "reading" | null;

type Arrival = { arrive: () => Promise<ArrivalReply>; endTheMoment: (skipped: boolean) => void; moment: XpMomentAhead };

type Settled<T> = { promise: Promise<T>; settle: (value: T) => void };

const refused: ArrivalReply = { kind: "refused" };

export function useVisitArrival(album: AlbumShown | undefined, read: XpMomentShown | undefined, actions: Pick<ShellActions, "arrive" | "endXpMoment">): Arrival {
  const answered = useFirstAnswerOfTheVisit(read);
  const [arrival] = useState(settledLater<ArrivalReply>);
  const sent = useRef(false);
  const send = useCallback(
    (reply: () => Promise<ArrivalReply>) => {
      if (sent.current) return;
      sent.current = true;
      reply().then(arrival.settle, () => arrival.settle(refused));
    },
    [arrival],
  );
  const from = arrivalFromOf(album, answered);
  const { arrive } = actions;
  useEffect(() => {
    if (from !== undefined) send(() => arrive(from));
  }, [from, send, arrive]);
  const moment = answered?.kind === "moment" ? answered : null;
  const { endXpMoment } = actions;
  const endTheMoment = useCallback(
    (skipped: boolean) => {
      if (moment !== null) send(() => endXpMoment(moment.since, moment.until, skipped));
    },
    [moment, send, endXpMoment],
  );
  return { arrive: useCallback(() => arrival.promise, [arrival]), endTheMoment, moment: answered === undefined ? "reading" : moment };
}

function useFirstAnswerOfTheVisit(read: XpMomentShown | undefined): XpMomentShown | undefined {
  const [first, setFirst] = useState<XpMomentShown | undefined>(undefined);
  const settled = read !== undefined && read.kind !== "connecting";
  useEffect(() => {
    if (settled) setFirst((kept) => kept ?? read);
  }, [settled, read]);
  return first ?? (settled ? read : undefined);
}

function arrivalFromOf(album: AlbumShown | undefined, moment: XpMomentShown | undefined): number | null | undefined {
  if (moment === undefined || moment.kind === "moment") return undefined;
  if (moment.kind === "none") return moment.lastVisit;
  return album?.kind === "album" ? album.lastVisit : undefined;
}

function settledLater<T>(): Settled<T> {
  let settle: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => (settle = resolve));
  return { promise, settle };
}
