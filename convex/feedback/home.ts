import { v, type Infer } from "convex/values";
import type { Intent } from "../bus/commands";
import type { KudosHome } from "../engine/home";
import { skillTreeLevel } from "../progression/levels";
import type { ProgressionHome } from "../progression/progression";
import type { ProgressSettings } from "../progression/settings";
import type { ScheduledFeature } from "../unlocks/schedule";
import type { UnlocksHome } from "../unlocks/unlocks";
import type { AdminHome, HomeFacts } from "./homes";
import { productName, skillPointsOf, slashCommand } from "./naming";

export const homeTabValidator = v.union(v.literal("profile"), v.literal("settings"), v.literal("admin"));

export type HomeTab = Infer<typeof homeTabValidator>;

export type HomeAction = { label: string; intent: Intent };

export type HomeView = { title: string; tabs: Array<HomeAction & { current: boolean }>; groups: HomeLine[][] };

export type HomeLine =
  | { kind: "text"; text: string }
  | { kind: "fields"; fields: string[] }
  | { kind: "hint"; text: string }
  | { kind: "action"; text: string; action: HomeAction }
  | { kind: "pick-channel"; text: string; picked: string | null; picks: Extract<Intent, { channel: unknown }>["type"] };

type MemberHome = Extract<HomeFacts, { kind: "member" }>;

const tabLabels: Record<HomeTab, string> = { profile: "Profile", settings: "Settings", admin: "Admin" };

export function renderHome(facts: HomeFacts): HomeView {
  if (facts.kind === "not-a-member") {
    return { title: productName, tabs: [], groups: [[{ kind: "text", text: `${productName} is for active members of this workspace.` }]] };
  }
  if (facts.kind === "kudos-only") return { title: "Your kudos", tabs: [], groups: kudosOnlyTab(facts.kudos) };
  const tabs = tabsOf(facts);
  const current = tabs.includes(facts.tab) ? facts.tab : "profile";
  return { title: "Your kudos", tabs: tabs.map((tab) => tabButton(tab, current)), groups: tabContent(facts, current) };
}

function tabsOf({ admin }: MemberHome): HomeTab[] {
  return admin === null ? ["profile", "settings"] : ["profile", "settings", "admin"];
}

function tabButton(tab: HomeTab, current: HomeTab) {
  return { label: tabLabels[tab], intent: { type: "showHomeTab" as const, tab }, current: tab === current };
}

function tabContent(facts: MemberHome, tab: HomeTab): HomeLine[][] {
  if (tab === "settings") return settingsTab(facts.settings);
  if (tab === "admin" && facts.admin !== null) return adminTab(facts.admin);
  return profileTab(facts);
}

function profileTab({ kudos, progression, unlocks }: MemberHome): HomeLine[][] {
  return [[allowanceOf(kudos)], [...progressOf(progression), ...unlockLinesOf(unlocks)], [totalsOf(kudos)], howToGive(kudos.kudosEmoji)];
}

function kudosOnlyTab(kudos: KudosHome): HomeLine[][] {
  return [[allowanceOf(kudos)], [totalsOf(kudos)], howToGive(kudos.kudosEmoji)];
}

function settingsTab(settings: ProgressSettings): HomeLine[][] {
  return [
    [setting(settings, "muteNotices"), setting(settings, "dms")],
  ];
}

type SettingCopy = Record<"whenOn" | "whenOff", { text: string; label: string }>;

const settingCopy: Record<keyof ProgressSettings, SettingCopy> = {
  muteNotices: {
    whenOn: { text: "I don't post public notices about you.", label: "Unmute notices" },
    whenOff: { text: "I celebrate your level ups in public.", label: "Mute notices" },
  },
  dms: {
    whenOn: { text: "I send you a DM when you reach a level.", label: "Turn off DMs" },
    whenOff: { text: "I don't send you DMs.", label: "Turn on DMs" },
  },
};

function setting(settings: ProgressSettings, key: keyof ProgressSettings): HomeLine {
  const on = settings[key];
  const { text, label } = settingCopy[key][on ? "whenOn" : "whenOff"];
  return { kind: "action", text, action: { label, intent: { type: "setProgressSettings", ...changeOf(key, !on) } } };
}

function changeOf(key: keyof ProgressSettings, value: boolean): Partial<ProgressSettings> {
  return { [key]: value };
}

function adminTab({ announcementChannel }: AdminHome): HomeLine[][] {
  const channelLines = announcementChannel === null ? threadLines() : announcementChannelLines(announcementChannel);
  return [channelLines, [{ kind: "hint", text: "Only workspace admins and owners see this tab." }]];
}

function threadLines(): HomeLine[] {
  const text = "I celebrate level ups in a thread under each kudos message. Pick a channel to post them there instead.";
  return [{ kind: "pick-channel", text, picked: null, picks: "setAnnouncementChannel" }];
}

function announcementChannelLines(channel: string): HomeLine[] {
  return [
    { kind: "pick-channel", text: "I celebrate level ups in this channel.", picked: channel, picks: "setAnnouncementChannel" },
    {
      kind: "action",
      text: "Or celebrate them in a thread under each kudos message again.",
      action: { label: "Use threads", intent: { type: "setAnnouncementChannel", channel: null } },
    },
  ];
}

function allowanceOf({ left, base }: KudosHome): HomeLine {
  const refill = `You get ${bold(base)} more at midnight.`;
  const text = left > 0 ? `You have ${bold(left)} kudos left today. ${refill}` : `You've used all your kudos for today. ${refill}`;
  return { kind: "text", text };
}

function progressOf({ level, xpToNextLevel, skillPoints }: ProgressionHome): HomeLine[] {
  const levelFigures: HomeLine = { kind: "fields", fields: [figure("Level", level), figure(`XP to level ${level + 1}`, xpToNextLevel)] };
  if (level < skillTreeLevel) return [levelFigures];
  return [levelFigures, { kind: "text", text: `You have ${bold(skillPointsOf(skillPoints))} saved for the skill tree.` }];
}

function unlockLinesOf({ ready, next }: UnlocksHome): HomeLine[] {
  const readyLines = ready.map((feature): HomeLine => ({ kind: "action", ...readyCrateOf(feature) }));
  const nextLine: HomeLine[] = next === null ? [] : [{ kind: "text", text: `Next: ${next.name} at level ${next.level}.` }];
  return [...readyLines, ...nextLine];
}

export function readyCrateOf({ feature, name, opens }: ScheduledFeature): { text: string; action: HomeAction } {
  return { text: `${bold(name)} is ready. It opens ${opens}.`, action: { label: "Open", intent: { type: "openUnlock", feature } } };
}

function totalsOf(kudos: KudosHome): HomeLine {
  return {
    kind: "fields",
    fields: [
      figure("Given this week", kudos.givenWeek),
      figure("Received this week", kudos.receivedWeek),
      figure("Given in total", kudos.given),
      figure("Received in total", kudos.received),
    ],
  };
}

function howToGive(kudosEmoji: string): HomeLine[] {
  const emoji = `:${kudosEmoji}:`;
  return [
    { kind: "hint", text: `To give kudos, mention a teammate and add ${emoji} to your message. Each ${emoji} gives everyone you mention 1 kudos.` },
    { kind: "hint", text: `To add me to a channel, type \`${slashCommand}\` there.` },
  ];
}

function figure(label: string, count: number) {
  return `${bold(label)}\n${bold(count)}`;
}

function bold(text: string | number) {
  return `*${text}*`;
}
