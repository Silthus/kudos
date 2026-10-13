import type { HomeFacts } from "../engine/home";

export function renderHome(facts: HomeFacts): string[] {
  if (facts.kind === "not-a-member") return ["Kudos is for active members of this workspace."];
  const emoji = `:${facts.kudosEmoji}:`;
  return [
    facts.left > 0
      ? `You have ${facts.left} kudos left today. You get ${facts.base} more at midnight.`
      : `You've used all your kudos for today. You get ${facts.base} more at midnight.`,
    `This week you've given ${facts.givenWeek} kudos and received ${facts.receivedWeek}. In total you've given ${facts.given} and received ${facts.received}.`,
    `To give kudos, mention a teammate and add ${emoji} to your message. Each ${emoji} gives everyone you mention 1 kudos.`,
    "To add me to a channel, type `/kudos` there.",
  ];
}
