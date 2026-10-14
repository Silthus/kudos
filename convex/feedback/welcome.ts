import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { groupsShownTo, primaryGroupOf, type GroupId, type GroupRef } from "../groups/groups";
import { groupChoiceOf, type GroupChoice } from "../groups/pick";
import { reconcileMember } from "../groups/reconcile";
import { chatUserOf, lookup, type MemberId } from "../workspace/directory";
import { countsFor, noLongerYours, pickQuestion } from "./groupCopy";
import { deepLinkOf, deepLinks, type DeepLink } from "./deepLinks";
import { settingsOf } from "../workspace/settings";
import { productName, slashCommand } from "./naming";

export type WelcomeMessage = { lines: string[]; openAppHome: string; website: DeepLink | null };

export type WelcomeGroups = { lines: string[]; picker: { groups: GroupRef[]; primary: GroupId } | null };

export async function requestWelcome(ctx: MutationCtx, member: MemberId) {
  const { workspace, user } = await chatUserOf(ctx, member);
  await ctx.scheduler.runAfter(0, internal.slack.welcome.deliverWelcome, { workspace, user, attempt: 1 });
}

export const welcomeMessage = internalQuery({
  args: { workspace: v.string() },
  handler: async (ctx, { workspace }): Promise<WelcomeMessage> => {
    const { baseAllowance, kudosEmoji } = await settingsOf(ctx, workspace);
    const emoji = `:${kudosEmoji}:`;
    return {
      lines: [
        `👋 Welcome to ${productName}! Thank a teammate by mentioning them and adding ${emoji} to your message in any channel I'm in. Each ${emoji} gives everyone you mention 1 kudos.`,
        `You can give ${baseAllowance} kudos a day, and they refill at midnight in your time zone.`,
        `To add me to a channel, type \`${slashCommand}\` there.`,
      ],
      openAppHome: "Open App Home",
      website: await deepLinkOf(ctx, workspace, deepLinks.welcome),
    };
  },
});

export const welcomePickValidator = v.object({ group: v.id("userGroups"), saved: v.boolean() });

type WelcomePick = Infer<typeof welcomePickValidator>;

export async function welcomePickOf(ctx: MutationCtx, member: MemberId, picked: string): Promise<WelcomePick | null> {
  const group = ctx.db.normalizeId("userGroups", picked);
  if (group === null || !(await groupsShownTo(ctx, member))) return null;
  return { group, saved: (await primaryGroupOf(ctx, member))?.group === group };
}

export const welcomeGroupsOf = internalMutation({
  args: { workspace: v.string(), user: v.string(), pick: v.optional(welcomePickValidator) },
  handler: async (ctx, { workspace, user, pick }): Promise<WelcomeGroups | null> => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind !== "member" || !(await groupsShownTo(ctx, person.member))) return null;
    await reconcileMember(ctx, person.member);
    const choice = await groupChoiceOf(ctx, person.member);
    if (pick === undefined) return choice === null ? null : { lines: [isPicked(choice) ? pickQuestion : countsFor(choice.primary)], picker: pickerOf(choice) };
    const picked = await ctx.db.get(pick.group);
    if (pick.saved && picked !== null) return { lines: [`Saved. ${countsFor(picked)} You can change it in App Home.`], picker: null };
    const refusal = picked === null ? [] : [noLongerYours(picked)];
    const stays = choice !== null && !isPicked(choice) ? [countsFor(choice.primary)] : [];
    return { lines: [...refusal, ...stays], picker: pickerOf(choice) };
  },
});

function isPicked({ groups }: GroupChoice) {
  return groups.length > 1;
}

function pickerOf(choice: GroupChoice | null) {
  return choice !== null && isPicked(choice) ? { groups: choice.groups, primary: choice.primary.group } : null;
}
