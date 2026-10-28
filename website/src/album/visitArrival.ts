import { useCallback, useEffect, useRef, useState } from "react";
import type { XpMoment } from "../../../convex/website/xpMoment";
import type { ArrivalReply, ShellActions } from "../shell";
import type { AlbumShown, XpMomentShown } from "./answer";

export type XpMomentAhead = XpMoment | "reading" | null;

export type MissedXpMoment = { glows: boolean; moment: XpMoment | null; start: () => void };

type ArrivedAt = number | null | undefined;

type Arrival = { arrivedAt: ArrivedAt; endTheMoment: (skipped: boolean) => void; moment: XpMomentAhead; missed: MissedXpMoment };

export function useVisitArrival(album: AlbumShown | undefined, answer: XpMomentShown | undefined, actions: Pick<ShellActions, "arrive" | "endXpMoment">): Arrival {
  const read = withBeatsOf(answer);
  const answered = useFirstAnswerOfTheVisit(read);
  const [startedLater, setStartedLater] = useState<XpMoment | null>(null);
  const [arrivedAt, setArrivedAt] = useState<ArrivedAt>(undefined);
  const listen = useCallback((reply: Promise<ArrivalReply>) => {
    reply.then(
      (answer) => answer.kind === "arrived" && setArrivedAt(answer.lastVisit),
      () => undefined,
    );
  }, []);
  const arrived = useRef(false);
  const from = arrivalFromOf(album, answered);
  const { arrive } = actions;
  useEffect(() => {
    if (from === undefined || arrived.current) return;
    arrived.current = true;
    listen(arrive(from));
  }, [from, listen, arrive]);
  const moment = startedLater ?? (answered?.kind === "moment" ? answered : null);
  const ended = useRef<XpMoment | null>(null);
  const { endXpMoment } = actions;
  const endTheMoment = useCallback(
    (skipped: boolean) => {
      if (moment === null || ended.current === moment) return;
      ended.current = moment;
      listen(endXpMoment(moment.since, moment.until, skipped, { shown: moment.excerpts.length, folded: moment.fold?.count ?? 0 }));
    },
    [moment, listen, endXpMoment],
  );
  const missed = read?.kind === "moment" && read.since !== moment?.since ? read : null;
  const start = useCallback(() => setStartedLater((started) => missed ?? started), [missed]);
  const glows = answered?.kind === "moment" || answered?.kind === "none";
  return { arrivedAt, endTheMoment, moment: answered === undefined ? "reading" : moment, missed: { glows, moment: missed, start } };
}

function withBeatsOf(answer: XpMomentShown | undefined): XpMomentShown | undefined {
  if (answer?.kind !== "moment" || (answer.quests !== undefined && answer.progressed !== undefined)) return answer;
  return { ...answer, quests: answer.quests ?? [], progressed: answer.progressed ?? [] };
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
