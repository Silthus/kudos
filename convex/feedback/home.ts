import type { Command } from "../commands/commands";
import type { HomeFacts } from "../engine/home";
import type { Period } from "../leaderboard/periods";
import type { HomeTab, ShownTab } from "./homeTabs";
import { renderEveryoneBoard } from "./leaderboard";
import { productName, slashCommand } from "./naming";
import type { Line } from "./replies";

export type HomeView = { tabBar?: Choice[]; title: string; groups: HomeLine[][] };

export type HomeLine =
  | { kind: "text"; text: string }
  | { kind: "fields"; fields: string[] }
  | { kind: "hint"; text: string }
  | { kind: "choices"; choices: Choice[] }
  | { kind: "lines"; lines: Line[] };

export type Choice = { label: string; command: Command; selected: boolean };

export function renderHome(facts: HomeFacts, shown: ShownTab): HomeView {
  if (facts.kind === "not-a-member") {
    return { title: productName, groups: [[{ kind: "text", text: `${productName} is for active members of this workspace.` }]] };
  }
  return { tabBar: tabBar(shown.tab), ...tabOf(facts, shown) };
}

type MemberHome = Extract<HomeFacts, { kind: "member" }>;

const tabs: Array<{ tab: HomeTab; label: string }> = [
  { tab: "profile", label: "Profile" },
  { tab: "leaderboard", label: "Leaderboard" },
  { tab: "settings", label: "Settings" },
];

const periods: Array<{ period: Period; label: string }> = [
  { period: "week", label: "This week" },
  { period: "month", label: "This month" },
  { period: "all", label: "All time" },
];

function tabBar(selected: HomeTab): Choice[] {
  return tabs.map(({ tab, label }) => ({ label, command: { type: "showHomeTab", tab }, selected: tab === selected }));
}

function tabOf(facts: MemberHome, shown: ShownTab): Omit<HomeView, "tabBar"> {
  switch (shown.tab) {
    case "profile":
      return { title: "Your kudos", groups: [[allowanceOf(facts)], [totalsOf(facts)], howToGive(facts.kudosEmoji)] };
    case "leaderboard":
      return { title: "Leaderboard", groups: [[periodChoices(shown.period), { kind: "lines", lines: renderEveryoneBoard(shown.board, shown.period) }]] };
    case "settings":
      return { title: "Settings", groups: [leaderboardSwitch(shown.onTheBoards)] };
  }
}

function periodChoices(selected: Period): HomeLine {
  return { kind: "choices", choices: periods.map(({ period, label }) => ({ label, command: { type: "showLeaderboard", period }, selected: period === selected })) };
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

function allowanceOf({ left, base }: MemberHome): HomeLine {
  const refill = `You get ${bold(base)} more at midnight.`;
  const text = left > 0 ? `You have ${bold(left)} kudos left today. ${refill}` : `You've used all your kudos for today. ${refill}`;
  return { kind: "text", text };
}

function totalsOf(facts: MemberHome): HomeLine {
  return {
    kind: "fields",
    fields: [
      figure("Given this week", facts.givenWeek),
      figure("Received this week", facts.receivedWeek),
      figure("Given in total", facts.given),
      figure("Received in total", facts.received),
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
