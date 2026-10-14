import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { bookAppliesIn } from "../achievements/flag";
import { analyticsIdOf } from "../analytics/person";
import { groupsShownTo, isGroupsShownTo, primaryGroupOf, type GroupId, type GroupRef } from "../groups/groups";
import { groupChoiceOf, type GroupChoice } from "../groups/pick";
import { reconcileMember } from "../groups/reconcile";
import { skillTreeAppliesIn } from "../progression/skillTree";
import { xpLevelsOnFor } from "../progression/xpLevels";
import { questsApplyTo } from "../quests/flag";
import { unlockPathShownTo } from "../unlocks/launch";
import { websiteOriginFor } from "../website/link";
import { welcomedAsValidator, type WelcomedAs } from "../welcome/welcomedAs";
import { chatUserOf, lookup, type MemberId } from "../workspace/directory";
import { countsFor, noLongerYours, pickQuestion } from "./groupCopy";
import { settingsOf } from "../workspace/settings";
import { deepLinkFrom, deepLinks, type DeepLink } from "./deepLinks";
import { productName } from "./naming";
import type { Line } from "./segments";

export type WelcomeMessage = { greeting: Line[]; allowance: string; website: { line: string; link: DeepLink } | null; openAppHome: string };

export type WelcomeGroups = { lines: string[]; picker: { groups: GroupRef[]; primary: GroupId } | null };

type Welcome = { workspace: string; user: string; welcomed?: WelcomedAs };

const namedAtMost = 3;

export async function requestWelcome(ctx: MutationCtx, member: MemberId, welcomed: WelcomedAs) {
  const { workspace, user } = await chatUserOf(ctx, member);
  await decidedAsMemberAtDelivery(ctx, member);
  const groups = await isGroupsShownTo(ctx, member);
  await ctx.scheduler.runAfter(0, internal.slack.welcome.deliverWelcome, { workspace, user, welcomed, ...(groups && { groups }), attempt: 1 });
}

async function decidedAsMemberAtDelivery(ctx: MutationCtx, member: MemberId) {
  await analyticsIdOf(ctx, member);
}

export const welcomeMessage = internalQuery({
  args: { workspace: v.string(), user: v.string(), welcomed: v.optional(welcomedAsValidator) },
  handler: async (ctx, asked): Promise<WelcomeMessage> => {
    const { baseAllowance, kudosEmoji } = await settingsOf(ctx, asked.workspace);
    const person = await lookup(ctx, asked.workspace, asked.user);
    const member = person?.kind === "member" ? person.member : undefined;
    const welcome = { ...asked, welcomed: asked.welcomed ?? (await storedWelcomedAs(ctx, member)) };
    return {
      greeting: [headerOf(welcome), [{ text: `Welcome to ${productName}, where we thank each other for the help that usually goes unnoticed.` }], ...(await progressLinesOf(ctx, welcome.workspace, member)), stepOf(welcome, kudosEmoji)],
      allowance: `You have ${baseAllowance} kudos a day, and they refill at midnight your time.`,
      website: await websiteOf(ctx, welcome.workspace, member),
      openAppHome: "Open App Home",
    };
  },
});

export const welcomePickValidator = v.object({ group: v.id("userGroups"), saved: v.boolean() });

type WelcomePick = Infer<typeof welcomePickValidator>;

export async function welcomePickOf(ctx: MutationCtx, member: MemberId, picked: string): Promise<WelcomePick | null> {
  const group = ctx.db.normalizeId("userGroups", picked);
  if (group === null || !(await isGroupsShownTo(ctx, member))) return null;
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

async function storedWelcomedAs(ctx: QueryCtx, member: MemberId | undefined): Promise<WelcomedAs | undefined> {
  if (member === undefined) return undefined;
  const welcome = await ctx.db
    .query("welcomes")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  return welcome?.welcomed;
}

function headerOf({ welcomed }: Welcome): Line {
  if (welcomed?.as === "recipient") return [{ text: "🎉 *" }, { mention: { kind: "person", user: welcomed.giver } }, { text: " just thanked you with a kudos!*" }];
  if (welcomed?.as === "giver" && welcomed.recipients.length > 0) return [{ text: "🎉 *Your first kudos just landed with " }, ...recipientsNamed(welcomed.recipients), { text: "!*" }];
  return [{ text: `👋 *Welcome to ${productName}!*` }];
}

function recipientsNamed(recipients: string[]): Line {
  const mentions: Line = recipients.map((user) => ({ mention: { kind: "person", user } }));
  if (recipients.length <= namedAtMost) return joined(mentions);
  return joined([...mentions.slice(0, namedAtMost - 1), { text: `${recipients.length - (namedAtMost - 1)} more` }]);
}

function joined(items: Line): Line {
  return items.flatMap((item, index) => (index === 0 ? [item] : [{ text: separatorBefore(index, items.length) }, item]));
}

function joinedWords(words: string[]) {
  return words.map((word, index) => (index === 0 ? word : `${separatorBefore(index, words.length)}${word}`)).join("");
}

function separatorBefore(index: number, count: number) {
  return index === count - 1 ? " and " : ", ";
}

async function progressLinesOf(ctx: QueryCtx, workspace: string, member: MemberId | undefined): Promise<Line[]> {
  if (member === undefined || !(await xpLevelsOnFor(ctx, member))) return [];
  const unlocks = await unlockedFeaturesOf(ctx, workspace, member);
  const unlocking = unlocks.length === 0 ? "" : ` As you level up you unlock ${joinedWords(unlocks)}.`;
  return [[{ text: `Every kudos you give or receive earns XP.${unlocking}` }]];
}

async function unlockedFeaturesOf(ctx: QueryCtx, workspace: string, member: MemberId): Promise<string[]> {
  if (!(await unlockPathShownTo(ctx, member))) return [];
  const features = [
    { name: "weekly quests", applies: await questsApplyTo(ctx, member) },
    { name: "a skill tree", applies: await skillTreeAppliesIn(ctx, workspace) },
    { name: "the Book of achievements", applies: await bookAppliesIn(ctx, workspace) },
  ];
  return features.filter(({ applies }) => applies).map(({ name }) => name);
}

function stepOf({ welcomed }: Welcome, kudosEmoji: string): Line {
  const sayWhy = "Say why you're thanking them: it means more.";
  if (welcomed?.as === "giver") return [{ text: `👉 *Next step:* thank two more teammates this week. ${sayWhy}` }];
  return [{ text: `👉 *Your first step:* thank someone who helped you lately. Mention them and add :${kudosEmoji}: to your message in any channel I'm in. ${sayWhy}` }];
}

async function websiteOf(ctx: QueryCtx, workspace: string, member: MemberId | undefined): Promise<WelcomeMessage["website"]> {
  const link = deepLinkFrom(await websiteOriginFor(ctx, workspace, member), deepLinks.welcome);
  return link === null ? null : { line: `The ${productName} website shows your kudos and progress in one place.`, link };
}
