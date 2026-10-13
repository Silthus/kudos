import type { KudosHome } from "../engine/home";
import type { ProgressionHome } from "../progression/progression";
import type { HomeFacts } from "./homes";
import { productName, slashCommand } from "./naming";

export type HomeTab = "profile" | "settings";

export type HomeView = { title: string; tabs: Array<{ tab: HomeTab; label: string; current: boolean }>; groups: HomeLine[][] };

export type HomeLine =
  | { kind: "text"; text: string }
  | { kind: "fields"; fields: string[] }
  | { kind: "hint"; text: string };

const tabLabels: Record<HomeTab, string> = { profile: "Profile", settings: "Settings" };

export function renderHome(facts: HomeFacts): HomeView {
  if (facts.kind === "not-a-member") {
    return { title: productName, tabs: [], groups: [[{ kind: "text", text: `${productName} is for active members of this workspace.` }]] };
  }
  return {
    title: "Your kudos",
    tabs: tabsOf("profile"),
    groups: [[allowanceOf(facts.kudos)], [progressOf(facts.progression)], [totalsOf(facts.kudos)], howToGive(facts.kudos.kudosEmoji)],
  };
}

function tabsOf(current: HomeTab) {
  return (Object.keys(tabLabels) as HomeTab[]).map((tab) => ({ tab, label: tabLabels[tab], current: tab === current }));
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
