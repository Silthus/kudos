import { exposed, memberDecision, memberDecisionWithoutWriting, type Flag } from "../analytics/flags";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const collectionFlag = { key: "collection", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export const crestsFlag = { key: "crests", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export const crateStoreFlag = { key: "crate-store", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export const hoggieAvatarFlag = { key: "hoggie-avatar", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function hoggiesShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecision(ctx, collectionFlag, member);
}

export async function hoggiesDropFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const drops = await memberDecision(ctx, collectionFlag, member);
  await exposed(ctx, collectionFlag, member, drops);
  return drops;
}

export function crateStoreShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecision(ctx, crateStoreFlag, member);
}

export async function crateStoreOpenFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const open = await memberDecision(ctx, crateStoreFlag, member);
  await exposed(ctx, crateStoreFlag, member, open);
  return open;
}

export function crestsShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecision(ctx, crestsFlag, member);
}

export async function crestsShownFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const shown = await memberDecision(ctx, crestsFlag, member);
  await exposed(ctx, crestsFlag, member, shown);
  return shown;
}

export async function avatarShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await memberDecisionWithoutWriting(ctx, hoggieAvatarFlag, member)) && (await memberDecisionWithoutWriting(ctx, collectionFlag, member));
}

export async function avatarOpenFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  if (!(await hoggiesShownTo(ctx, member))) return false;
  const open = await memberDecision(ctx, hoggieAvatarFlag, member);
  await exposed(ctx, hoggieAvatarFlag, member, open);
  return open;
}
