import type { QueryCtx } from "../_generated/server";
import { drawableKudosOf, type DrawableKudos } from "../engine/spotlight";
import { drawnOnceAround, type DrawPoint, type DrawStart, type Drawn } from "../engine/spotlightDraws";
import type { Spotlight } from "./entries";
import { mentionsOfOnePage, permalinkOfMessage, personOf, readableSegmentsOf } from "./kudos";

export type SpotlightFrom = { seed: number } | { after: string };

const rejectedAtMost = 25;

const encodedPoint = /^(\d+(?:\.\d+)?(?:e-\d+)?)_(\d+(?:\.\d+)?)$/;

export async function spotlightOf(ctx: QueryCtx, workspace: string, from: SpotlightFrom): Promise<Spotlight> {
  let lastRejected: Drawn | null = null;
  let rejected = 0;
  for await (const drawn of drawnOnceAround(ctx, workspace, startOf(from))) {
    if (lastRejected !== null && rejected === rejectedAtMost) return { kind: "skipped", after: encodePoint(lastRejected) };
    const kudos = await drawableKudosOf(ctx, drawn.ref);
    if (kudos !== null) return kudosAnswer(ctx, drawn, kudos);
    lastRejected = drawn;
    rejected += 1;
  }
  return { kind: "empty" };
}

async function kudosAnswer(ctx: QueryCtx, drawn: Drawn, { at, giver, recipients, segments, edited }: DrawableKudos): Promise<Spotlight> {
  const workspace = drawn.ref.workspace;
  const [giverPerson, recipientPeople, readable, permalink] = await Promise.all([
    personOf(ctx, giver),
    Promise.all(recipients.map((recipient) => personOf(ctx, recipient))),
    readableSegmentsOf(mentionsOfOnePage(ctx), workspace, segments),
    permalinkOfMessage(ctx, drawn.ref),
  ]);
  return { kind: "kudos", after: encodePoint(drawn), at, giver: giverPerson, recipients: recipientPeople, permalink, message: { kind: "text", segments: readable, edited } };
}

function startOf(from: SpotlightFrom): DrawStart {
  if ("after" in from) return { kind: "after", point: decodePoint(from.after) };
  return { kind: "at", position: isDrawPosition(from.seed) ? from.seed : 0 };
}

function encodePoint({ position, created }: DrawPoint): string {
  return `${position}_${created}`;
}

function decodePoint(cursor: string): DrawPoint {
  const parts = encodedPoint.exec(cursor);
  const point = parts === null ? null : { position: Number(parts[1]), created: Number(parts[2]) };
  if (point === null || !isDrawPosition(point.position) || !Number.isFinite(point.created)) throw new Error("unreadable spotlight cursor");
  return point;
}

function isDrawPosition(position: number) {
  return Number.isFinite(position) && position >= 0 && position < 1;
}
