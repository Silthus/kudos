import type { QueryCtx } from "../_generated/server";
import { drawFrom, type DrawableKudos } from "../engine/spotlight";
import { beforeEveryDrawAt, type DrawPoint, type DrawWalk, type Drawn } from "../engine/spotlightDraws";
import type { Spotlight } from "./entries";
import { mentionsOfOnePage, permalinkOfMessage, personOf, readableSegmentsOf } from "./kudos";

export type SpotlightFrom = { seed: number } | { after: string };

const number = String.raw`\d+(?:\.\d+)?(?:e-\d+)?`;
const encodedPoint = String.raw`(${number})_(${number})`;
const encodedCursor = new RegExp(`^${encodedPoint}(?:~${encodedPoint})?$`);

export async function spotlightOf(ctx: QueryCtx, workspace: string, from: SpotlightFrom): Promise<Spotlight> {
  const walk = walkOf(from);
  const draw = await drawFrom(ctx, workspace, walk);
  if (draw.kind === "empty") return draw;
  if (draw.kind === "skipped") return { kind: "skipped", after: encodeCursor({ after: draw.at, through: walk.through }) };
  return kudosAnswer(ctx, draw.drawn, draw.kudos);
}

async function kudosAnswer(ctx: QueryCtx, drawn: Drawn, { at, giver, recipients, segments, edited }: DrawableKudos): Promise<Spotlight> {
  const [giverPerson, recipientPeople, readable, permalink] = await Promise.all([
    personOf(ctx, giver),
    Promise.all(recipients.map((recipient) => personOf(ctx, recipient))),
    readableSegmentsOf(mentionsOfOnePage(ctx), drawn.ref.workspace, segments),
    permalinkOfMessage(ctx, drawn.ref),
  ]);
  const after = encodeCursor({ after: drawn, through: drawn });
  return { kind: "kudos", after, at, giver: giverPerson, recipients: recipientPeople, permalink, message: { kind: "text", segments: readable, edited } };
}

function walkOf(from: SpotlightFrom): DrawWalk {
  if ("after" in from) return decodeCursor(from.after);
  const seed = beforeEveryDrawAt(isDrawPosition(from.seed) ? from.seed : 0);
  return { after: seed, through: seed };
}

function encodeCursor({ after, through }: DrawWalk): string {
  const point = ({ position, created }: DrawPoint) => `${position}_${created}`;
  return isSamePoint(after, through) ? point(after) : `${point(after)}~${point(through)}`;
}

function decodeCursor(cursor: string): DrawWalk {
  const parts = encodedCursor.exec(cursor);
  if (parts === null) throw new Error("unreadable spotlight cursor");
  const after = { position: Number(parts[1]), created: Number(parts[2]) };
  const through = parts[3] === undefined ? after : { position: Number(parts[3]), created: Number(parts[4]) };
  if (!isDrawPoint(after) || !isDrawPoint(through)) throw new Error("unreadable spotlight cursor");
  return { after, through };
}

function isSamePoint(one: DrawPoint, other: DrawPoint) {
  return one.position === other.position && one.created === other.created;
}

function isDrawPoint({ position, created }: DrawPoint) {
  return isDrawPosition(position) && Number.isFinite(created) && created >= 0;
}

function isDrawPosition(position: number) {
  return Number.isFinite(position) && position >= 0 && position < 1;
}
