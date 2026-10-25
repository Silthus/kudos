import type { QueryCtx } from "../_generated/server";
import { starterEmoji } from "../store/catalogue";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import type { JourneyStep } from "./step";

export type JourneyStepCopy = { goal: string; hint: string | null };

export const saysWhyCounts = "It counts when your message has 5 or more words besides mentions and emoji.";

const journeyCopy: Record<JourneyStep, JourneyStepCopy> = {
  "first-thanks": { goal: "Give a kudos that says why.", hint: saysWhyCounts },
  "first-quest": { goal: "Finish a weekly quest.", hint: null },
  "someone-new": { goal: "Thank someone you haven't thanked before.", hint: null },
  "two-days": { goal: "Give kudos that say why on 2 different days.", hint: saysWhyCounts },
  "your-emoji": { goal: "Give a kudos that says why with one of your kudos emoji.", hint: null },
};

export async function journeyCopyFor(ctx: QueryCtx, member: MemberId, step: JourneyStep): Promise<JourneyStepCopy> {
  return step === "your-emoji" ? { ...journeyCopy[step], hint: await yourEmojiHintOf(ctx, member) } : journeyCopy[step];
}

export function journeyGoalOf(step: JourneyStep): string {
  return journeyCopy[step].goal;
}

async function yourEmojiHintOf(ctx: QueryCtx, member: MemberId): Promise<string> {
  const { workspace } = await chatUserOf(ctx, member);
  return `:${starterEmoji}: is one of your kudos emoji: use it in a kudos like :${(await settingsOf(ctx, workspace)).kudosEmoji}:. ${saysWhyCounts}`;
}
