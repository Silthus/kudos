import { profileCardOf, type ProfileCard } from "../profileCard/profileCard";
import { profileCardOpenTo } from "../profileCard/flag";
import { memberQuery } from "./memberQuery";

export type ProfileCardAnswer = { kind: "not-found" } | ({ kind: "card" } & ProfileCard);

export const getProfileCard = memberQuery(async (ctx, me): Promise<ProfileCardAnswer> => {
  if (!(await profileCardOpenTo(ctx, me.member))) return { kind: "not-found" };
  return { kind: "card", ...(await profileCardOf(ctx, me.member, { own: true })) };
});
