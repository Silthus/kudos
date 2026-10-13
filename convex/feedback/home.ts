import { v, type Infer } from "convex/values";
import type { Intent } from "../bus/commands";
import type { KudosHome } from "../engine/home";
import type { ProgressionHome } from "../progression/progression";
import type { ProgressSettings } from "../progression/settings";
import type { AdminHome, HomeFacts } from "./homes";
import { productName, slashCommand } from "./naming";

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

function profileTab({ kudos, progression }: MemberHome): HomeLine[][] {
  return [[allowanceOf(kudos)], [progressOf(progression)], [totalsOf(kudos)], howToGive(kudos.kudosEmoji)];
}

function settingsTab({ hideLevel, hideAchievements, muteNotices, dms }: ProgressSettings): HomeLine[][] {
  return [
    [
      setting(hideLevel, { text: "Your level is hidden from other members.", label: "Show level" }, { text: "Other members can see your level.", label: "Hide level" }, (on) => ({ hideLevel: on })),
      setting(
        hideAchievements,
        { text: "Your achievements are hidden from other members.", label: "Show achievements" },
        { text: "Other members can see your achievements.", label: "Hide achievements" },
        (on) => ({ hideAchievements: on }),
      ),
    ],
    [
      setting(muteNotices, { text: "I don't post public notices about you.", label: "Unmute notices" }, { text: "I celebrate your level ups in public.", label: "Mute notices" }, (on) => ({ muteNotices: on })),
      setting(dms, { text: "I send you a DM when you reach a level.", label: "Turn off DMs" }, { text: "I don't send you DMs.", label: "Turn on DMs" }, (on) => ({ dms: on })),
    ],
    [{ kind: "hint", text: "Your App Home and your DMs always show you everything." }],
  ];
}

function adminTab({ announcementChannel }: AdminHome): HomeLine[][] {
  const picks = "setAnnouncementChannel";
  const channelLines: HomeLine[] =
    announcementChannel === null
      ? [{ kind: "pick-channel", text: "I celebrate level ups in a thread under each kudos message. Pick a channel to post them there instead.", picked: null, picks }]
      : [
          { kind: "pick-channel", text: `I celebrate level ups in <#${announcementChannel}>.`, picked: announcementChannel, picks },
          {
            kind: "action",
            text: "Or celebrate them in a thread under each kudos message again.",
            action: { label: "Use threads", intent: { type: picks, channel: null } },
          },
        ];
  return [channelLines, [{ kind: "hint", text: "Only workspace admins and owners see this tab." }]];
}

type SettingCopy = { text: string; label: string };
type SettingChange = Omit<Extract<Intent, { type: "setProgressSettings" }>, "type">;

function setting(on: boolean, whenOn: SettingCopy, whenOff: SettingCopy, change: (on: boolean) => SettingChange): HomeLine {
  const { text, label } = on ? whenOn : whenOff;
  return { kind: "action", text, action: { label, intent: { type: "setProgressSettings", ...change(!on) } } };
}

function allowanceOf({ left, base }: KudosHome): HomeLine {
  const refill = `You get ${bold(base)} more at midnight.`;
  const text = left > 0 ? `You have ${bold(left)} kudos left today. ${refill}` : `You've used all your kudos for today. ${refill}`;
  return { kind: "text", text };
}

function progressOf({ level, xpToNextLevel, skillPoints }: ProgressionHome): HomeLine {
  return {
    kind: "fields",
    fields: [figure("Level", level), figure(`XP to level ${level + 1}`, xpToNextLevel), figure("Skill points saved", skillPoints)],
  };
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
