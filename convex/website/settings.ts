import type { QueryCtx } from "../_generated/server";
import { workspaceMatchesOf } from "../companyProfiles/admin";
import { teamPagesShownTo } from "../companyProfiles/flag";
import { companyProfileSettingOf, type CompanyProfileSetting, type ProfileChoice } from "../companyProfiles/links";
import type { MatchedBy } from "../companyProfiles/matcher";
import { groupsShownTo } from "../groups/groups";
import { groupChoiceOf, type GroupChoice } from "../groups/pick";
import { isOnTheBoards } from "../leaderboard/visibility";
import { messageSettingsOnFor } from "../messageSettings/flag";
import { messageSettingsOf, type MessageSetting } from "../messageSettings/messageSettings";
import { personFactsOf } from "../workspace/directory";
import { memberQuery, type VerifiedMember } from "./memberQuery";
import { settingsSections, type SettingsSection } from "./routes";
import { teammateKeyOf } from "./teammateKeys";
import { leaderboardStateOf, unlockPathOf, type FeaturePage } from "./unlockPath";

export type { MessageSetting } from "../messageSettings/messageSettings";
export type { MessageKind, MessagePlace } from "../messageSettings/kinds";
export type { GroupChoice } from "../groups/pick";
export type { CompanyProfileSetting, ProfileChoice } from "../companyProfiles/links";

type SectionSettings = { board: { onTheBoards: boolean } | null; messages: MessageSetting[] | null; group: GroupChoice | null };

export type AdminProfiles = {
  members: Array<{ key: string; name: string; profile: number | null; by: MatchedBy | null }>;
  profiles: Array<ProfileChoice & { heldBy: string | null; by: MatchedBy | null }>;
};

export type MySettings = { kind: "settings"; companyProfile?: CompanyProfileSetting; admin?: AdminProfiles } & SectionSettings;

export type SettingsAnswer = MySettings | { kind: "not-found" };

export const getSettings = memberQuery(async (ctx, me): Promise<SettingsAnswer> => {
  const settings = await settingsOf(ctx, me);
  return hasAny(settings) ? settings : { kind: "not-found" };
});

export async function settingsShownTo(ctx: QueryCtx, me: VerifiedMember, leaderboard: FeaturePage): Promise<boolean> {
  if (leaderboard.kind === "open" || (await messageSettingsOnFor(ctx, me.member)) || (await teamPagesShownTo(ctx, me.member))) return true;
  return (await groupPickOf(ctx, me)) !== null;
}

async function settingsOf(ctx: QueryCtx, me: VerifiedMember): Promise<MySettings> {
  return { kind: "settings", ...(await sectionSettingsOf(ctx, me)), ...(await companyProfileSectionOf(ctx, me)), ...(await adminPartOf(ctx, me)) };
}

async function sectionSettingsOf(ctx: QueryCtx, me: VerifiedMember): Promise<SectionSettings> {
  return { board: await boardSettingOf(ctx, me), messages: await messagesOf(ctx, me), group: await groupPickOf(ctx, me) };
}

async function companyProfileSectionOf(ctx: QueryCtx, me: VerifiedMember): Promise<{ companyProfile?: CompanyProfileSetting }> {
  return (await teamPagesShownTo(ctx, me.member)) ? { companyProfile: await companyProfileSettingOf(ctx, me.member) } : {};
}

async function adminPartOf(ctx: QueryCtx, me: VerifiedMember): Promise<{ admin?: AdminProfiles }> {
  if (!(await adminPartShownTo(ctx, me))) return {};
  const { members, profiles } = await workspaceMatchesOf(ctx, me.workspace);
  return {
    admin: {
      members: await Promise.all(members.map(async ({ member, ...match }) => ({ key: await teammateKeyOf(me, member), ...match }))),
      profiles: await Promise.all(profiles.map(async ({ heldBy, ...profile }) => ({ ...profile, heldBy: heldBy === null ? null : await teammateKeyOf(me, heldBy) }))),
    },
  };
}

async function adminPartShownTo(ctx: QueryCtx, me: VerifiedMember): Promise<boolean> {
  return (await personFactsOf(ctx, me.member))?.admin === true && (await teamPagesShownTo(ctx, me.member));
}

export async function settingsSectionsShownTo(ctx: QueryCtx, me: VerifiedMember): Promise<SettingsSection[]> {
  const { board, messages, group } = await sectionSettingsOf(ctx, me);
  const shown: Record<SettingsSection, boolean> = { visibility: board !== null, messages: messages !== null, group: group !== null, "company-profile": await teamPagesShownTo(ctx, me.member), admin: await adminPartShownTo(ctx, me) };
  return settingsSections.filter((section) => shown[section]);
}

function hasAny({ board, messages, group, companyProfile }: MySettings) {
  return board !== null || messages !== null || group !== null || companyProfile !== undefined;
}

async function boardSettingOf(ctx: QueryCtx, me: VerifiedMember) {
  if ((await leaderboardStateOf(ctx, me, await unlockPathOf(ctx, me))).kind !== "open") return null;
  return { onTheBoards: await isOnTheBoards(ctx, me.member) };
}

async function messagesOf(ctx: QueryCtx, me: VerifiedMember) {
  if (!(await messageSettingsOnFor(ctx, me.member))) return null;
  return (await messageSettingsOf(ctx, me.member)).filter(({ applies }) => applies);
}

async function groupPickOf(ctx: QueryCtx, me: VerifiedMember) {
  if (!(await groupsShownTo(ctx, me.member))) return null;
  const choice = await groupChoiceOf(ctx, me.member);
  return choice !== null && choice.groups.length > 1 ? choice : null;
}
