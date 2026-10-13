import type { Command } from "../commands/commands";
import type { HomeFacts, KudosHome } from "../engine/home";
import type { Period } from "../leaderboard/periods";
import { skillTreeLevel } from "../progression/levels";
import type { ProgressSettings } from "../progression/settings";
import type { ScheduledFeature } from "../unlocks/schedule";
import type { UnlocksHome } from "../unlocks/unlocks";
import type { HomeTab, ShownHome, ShownTab, ToldProgression } from "./homes";
import { renderEveryoneBoard } from "./leaderboard";
import { productName, skillPointsOf, slashCommand } from "./naming";
import type { Line } from "./replies";

export type HomeView = { tabBar?: Choice[]; title: string; groups: HomeLine[][] };

export type Choice = { label: string; command: Command; selected: boolean };

export type HomeAction = { label: string; command: Command };

export type HomeLine =
  | { kind: "text"; text: string }
  | { kind: "fields"; fields: string[] }
  | { kind: "hint"; text: string }
  | { kind: "choices"; choices: Choice[] }
  | { kind: "lines"; lines: Line[] }
  | { kind: "action"; text: string; action: HomeAction }
  | { kind: "pick-channel"; text: string; picked: string | null; picks: Extract<Command, { channel: unknown }>["type"] };

type MemberHome = Extract<HomeFacts, { kind: "member" }>;

const tabLabels: Record<HomeTab, string> = { profile: "Profile", leaderboard: "Leaderboard", settings: "Settings", admin: "Admin" };

const periods: Array<{ period: Period; label: string }> = [
  { period: "week", label: "This week" },
  { period: "month", label: "This month" },
  { period: "all", label: "All time" },
];

export function renderHome(facts: HomeFacts, home: ShownHome | null): HomeView {
  if (facts.kind === "not-a-member") {
    return { title: productName, groups: [[{ kind: "text", text: `${productName} is for active members of this workspace.` }]] };
  }
  if (home === null) return profileOf(facts, null, null);
  return { tabBar: tabBar(home.tabs, home.shown.tab), ...tabOf(facts, home.shown) };
}

function tabBar(tabs: HomeTab[], selected: HomeTab): Choice[] {
  return tabs.map((tab) => ({ label: tabLabels[tab], command: { type: "showHomeTab", tab }, selected: tab === selected }));
}

function tabOf(facts: MemberHome, shown: ShownTab): HomeView {
  switch (shown.tab) {
    case "profile":
      return profileOf(facts, shown.progression, shown.unlocks);
    case "leaderboard":
      return { title: "Leaderboard", groups: [[periodChoices(shown.period), { kind: "lines", lines: renderEveryoneBoard(shown.board, shown.period) }]] };
    case "settings":
      return { title: "Settings", groups: settingsGroups(shown) };
    case "admin":
      return { title: "Admin", groups: adminGroups(shown.announcementChannel) };
  }
}

function profileOf(kudos: KudosHome, progression: ToldProgression | null, unlocks: UnlocksHome | null): HomeView {
  const progress = progression === null ? [] : [[...progressOf(progression), ...(unlocks === null ? [] : unlockLinesOf(unlocks))]];
  return { title: "Your kudos", groups: [[allowanceOf(kudos)], ...progress, [totalsOf(kudos)], howToGive(kudos.kudosEmoji)] };
}

function periodChoices(selected: Period): HomeLine {
  return { kind: "choices", choices: periods.map(({ period, label }) => ({ label, command: { type: "showLeaderboard", period }, selected: period === selected })) };
}

function settingsGroups({ onTheBoards, progress }: Extract<ShownTab, { tab: "settings" }>): HomeLine[][] {
  const leaderboard = onTheBoards === null ? [] : [leaderboardSwitch(onTheBoards)];
  const progression = progress === null ? [] : [[setting(progress, "muteNotices"), setting(progress, "dms")]];
  return [...leaderboard, ...progression];
}

function leaderboardSwitch(onTheBoards: boolean): HomeLine[] {
  return [
    { kind: "text", text: bold("Show me on the leaderboards") },
    {
      kind: "choices",
      choices: [
        { label: "On", command: { type: "setLeaderboardVisibility", visible: true }, selected: onTheBoards },
        { label: "Off", command: { type: "setLeaderboardVisibility", visible: false }, selected: !onTheBoards },
      ],
    },
    { kind: "hint", text: "When it's off, nobody sees you on the leaderboards, you included." },
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
  return { kind: "action", text, action: { label, command: { type: "setProgressSettings", ...changeOf(key, !on) } } };
}

function changeOf(key: keyof ProgressSettings, value: boolean): Partial<ProgressSettings> {
  return { [key]: value };
}

function adminGroups(announcementChannel: string | null): HomeLine[][] {
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
      action: { label: "Use threads", command: { type: "setAnnouncementChannel", channel: null } },
    },
  ];
}

function allowanceOf({ left, base }: KudosHome): HomeLine {
  const refill = `You get ${bold(base)} more at midnight.`;
  const text = left > 0 ? `You have ${bold(left)} kudos left today. ${refill}` : `You've used all your kudos for today. ${refill}`;
  return { kind: "text", text };
}

function progressOf({ level, xpToNextLevel, skillPoints }: ToldProgression): HomeLine[] {
  const levelFigures: HomeLine = { kind: "fields", fields: [figure("Level", level), figure(`XP to level ${level + 1}`, xpToNextLevel)] };
  if (skillPoints === null || level < skillTreeLevel) return [levelFigures];
  return [levelFigures, { kind: "text", text: `You have ${bold(skillPointsOf(skillPoints))} saved for the skill tree.` }];
}

function unlockLinesOf({ ready, next }: UnlocksHome): HomeLine[] {
  const readyLines = ready.map((feature): HomeLine => ({ kind: "action", ...readyCrateOf(feature) }));
  const nextLine: HomeLine[] = next === null ? [] : [{ kind: "text", text: `Next: ${next.name} at level ${next.level}.` }];
  return [...readyLines, ...nextLine];
}

export function readyCrateOf({ feature, name, opens }: ScheduledFeature): { text: string; action: HomeAction } {
  return { text: `${bold(name)} is ready. It opens ${opens}.`, action: { label: "Open", command: { type: "openUnlock", feature } } };
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
