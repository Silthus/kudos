import type { QueryCtx } from "../_generated/server";
import { countingPrimaryGroupOf, groupsShownTo, primaryMembersOf, type GroupRef } from "../groups/groups";
import type { MemberId } from "../workspace/directory";
import type { KudosByMember } from "./rankedBoard";

export type Peer = { percent: number; group: GroupRef };

export type Gains = { now: KudosByMember; before: KudosByMember };

const fewestOtherMembers = 3;

export function peerPercent(gain: number, othersGains: number[]): number | null {
  if (gain <= 0 || othersGains.length < fewestOtherMembers) return null;
  const smaller = othersGains.filter((other) => other < gain).length;
  if (smaller * 2 <= othersGains.length) return null;
  return Math.floor((smaller * 10) / othersGains.length) * 10;
}

export async function peerOf(ctx: QueryCtx, viewer: MemberId, { now, before }: Gains): Promise<Peer | null> {
  const gainOf = (member: MemberId) => (now.get(member) ?? 0) - (before.get(member) ?? 0);
  if (gainOf(viewer) <= 0 || !(await groupsShownTo(ctx, viewer))) return null;
  const group = await countingPrimaryGroupOf(ctx, viewer);
  if (group === null) return null;
  const others = (await primaryMembersOf(ctx, group.group)).filter((member) => member !== viewer);
  const percent = peerPercent(gainOf(viewer), others.map(gainOf));
  return percent === null ? null : { percent, group };
}
