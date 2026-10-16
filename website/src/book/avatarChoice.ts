import { lineAfter, useSentChoice, type Answer } from "../settings/useSentChoice";
import type { Avatar, AvatarReply, ShellActions } from "../shell";

export type AvatarChoice = { current: Avatar | null; pending: boolean; line: string; choose: (hoggie: string | null) => void };

export function useAvatarChoice(current: Avatar | null | undefined, setAvatar: ShellActions["setAvatar"]): AvatarChoice | null {
  const { pending, settled, choose } = useSentChoice<string | null>(current?.hoggie ?? null, async (hoggie) => answerOf(await setAvatar(hoggie)));
  if (current === undefined) return null;
  return { current, pending, line: lineAfter(settled, landedLineOf(current)), choose: (hoggie) => void choose(hoggie) };
}

function landedLineOf(current: Avatar | null) {
  return current === null ? "Your Slack picture is back." : `${current.name} is your avatar.`;
}

function answerOf(reply: AvatarReply): Answer {
  if (reply.kind === "set") return "landed";
  return reply.kind === "refused" ? "refused" : "denied";
}
