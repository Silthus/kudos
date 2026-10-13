import type { HomeFacts } from "../engine/home";

export type HomeView = { title: string; groups: HomeLine[][] };

export type HomeLine =
  | { kind: "text"; text: string }
  | { kind: "fields"; fields: string[] }
  | { kind: "hint"; text: string };

export function renderHome(facts: HomeFacts): HomeView {
  if (facts.kind === "not-a-member") {
    return { title: "Kudos", groups: [[{ kind: "text", text: "Kudos is for active members of this workspace." }]] };
  }
  return {
    title: "Your kudos",
    groups: [[allowanceOf(facts)], [totalsOf(facts)], howToGive(facts.kudosEmoji)],
  };
}

type MemberFacts = Extract<HomeFacts, { kind: "member" }>;

function allowanceOf({ left, base }: MemberFacts): HomeLine {
  const refill = `You get ${bold(base)} more at midnight.`;
  const text = left > 0 ? `You have ${bold(left)} kudos left today. ${refill}` : `You've used all your kudos for today. ${refill}`;
  return { kind: "text", text };
}

function totalsOf(facts: MemberFacts): HomeLine {
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
    { kind: "hint", text: "To add me to a channel, type `/kudos` there." },
  ];
}

function figure(label: string, count: number) {
  return `${bold(label)}\n${bold(count)}`;
}

function bold(text: string | number) {
  return `*${text}*`;
}
