import type { QueryCtx } from "../_generated/server";
import { groupsShownTo, primaryGroupOf } from "../groups/groups";
import { profileCardOf, type ProfileCard } from "../profileCard/profileCard";
import { profileCardOpenTo } from "../profileCard/flag";
import type { MemberId } from "../workspace/directory";
import { memberQuery } from "./memberQuery";

export type ProfileCardAnswer = { kind: "not-found" } | ({ kind: "card"; group: string | null } & ProfileCard);

export const getProfileCard = memberQuery(async (ctx, me): Promise<ProfileCardAnswer> => {
  if (!(await profileCardOpenTo(ctx, me.member))) return { kind: "not-found" };
  return { kind: "card", ...(await profileCardOf(ctx, me.member, { own: true })), group: await groupNameShownOn(ctx, me.member) };
});

async function groupNameShownOn(ctx: QueryCtx, member: MemberId): Promise<string | null> {
  if (!(await groupsShownTo(ctx, member))) return null;
  return (await primaryGroupOf(ctx, member))?.name ?? null;
}
