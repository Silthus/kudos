import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { board, placesClimbed, ranking, type BoardView, type Entry } from "./board";
import { isOnTheBoards } from "./visibility";

export type RankedRow = {
  position: number;
  rank: number;
  tied: boolean;
  member: MemberId;
  name: string | undefined;
  picture: string | null;
  kudos: number;
  viewer: boolean;
  climbed: number | null;
};

export type Standing = { kind: "ranked"; position: number; rank: number } | { kind: "not-ranked" } | { kind: "left" };

export type Ranked = { rows: RankedRow[]; window: number[]; standing: Standing };

export type Giver = Entry & { member: MemberId; displayName: string | undefined; picture: string | null };

export type KudosByMember = Map<MemberId, number>;

export type BoardMemberOf = (member: MemberId) => Promise<Giver | null>;

export type IndividualBoardFacts = { givers: Giver[]; before: Giver[]; viewer: string; viewerLeft: boolean };

export function rankedOf({ givers, before, viewer, viewerLeft }: IndividualBoardFacts): Ranked {
  const { rows, window } = ranking(givers, viewer);
  const climbed = placesClimbed(givers, before);
  return {
    rows: rows.map(({ position, rank, tied, id, member, displayName, picture, value, viewer }) => ({
      position,
      rank,
      tied,
      member,
      name: displayName,
      picture,
      kudos: value,
      viewer,
      climbed: climbed.get(id) ?? null,
    })),
    window,
    standing: viewerLeft ? { kind: "left" } : standingOf(rows),
  };
}

export function boardViewOf({ givers, viewer, viewerLeft }: IndividualBoardFacts): BoardView {
  const view = board(givers, viewer);
  return viewerLeft ? { rows: view.rows, viewerAbsent: "left" } : view;
}

export function withoutViewer(entries: Giver[], viewer: string) {
  return entries.filter((entry) => entry.id !== viewer);
}

export async function giversAmong(kudosByMember: KudosByMember, boardMemberOf: BoardMemberOf): Promise<Giver[]> {
  const givers = await Promise.all([...kudosByMember].filter(([, kudos]) => kudos > 0).map(([member, kudos]) => giverOf(boardMemberOf, member, kudos)));
  return givers.filter((giver) => giver !== null);
}

export function boardMembers(ctx: QueryCtx, viewer: MemberId | undefined): BoardMemberOf {
  const known = new Map<MemberId, Promise<Giver | null>>();
  return (member) => {
    if (!known.has(member)) known.set(member, boardMemberOf(ctx, member, viewer));
    return known.get(member)!;
  };
}

function standingOf(rows: Array<{ position: number; rank: number; viewer: boolean }>): Standing {
  const mine = rows.find((row) => row.viewer);
  return mine === undefined ? { kind: "not-ranked" } : { kind: "ranked", position: mine.position, rank: mine.rank };
}

async function giverOf(boardMemberOf: BoardMemberOf, member: MemberId, kudos: number): Promise<Giver | null> {
  const giver = await boardMemberOf(member);
  return giver === null ? null : { ...giver, value: kudos };
}

async function boardMemberOf(ctx: QueryCtx, member: MemberId, viewer: MemberId | undefined): Promise<Giver | null> {
  const row = await ctx.db.get(member);
  if (row?.kind !== "member") return null;
  if (member !== viewer && !(await isOnTheBoards(ctx, member))) return null;
  return { id: row.user, name: row.name ?? row.user, value: 0, member, displayName: row.name, picture: row.picture ?? null };
}
