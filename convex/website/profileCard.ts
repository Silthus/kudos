import { avatarShownOn, type AvatarShown } from "../hoggies/avatar";
import { groupNameOnCard, profileCardOf, type ProfileCard } from "../profileCard/profileCard";
import { profileCardOpenTo } from "../profileCard/flag";
import { memberQuery } from "./memberQuery";

export type ProfileCardAnswer = { kind: "not-found" } | ({ kind: "card"; group: string | null } & ProfileCard & AvatarShown);

export const getProfileCard = memberQuery(async (ctx, me): Promise<ProfileCardAnswer> => {
  if (!(await profileCardOpenTo(ctx, me.member))) return { kind: "not-found" };
  const card = await profileCardOf(ctx, me.member, { own: true, viewer: me.member });
  return { kind: "card", ...card, group: await groupNameOnCard(ctx, me.member, me.member), ...(await avatarShownOn(ctx, me.member, me.member)) };
});
