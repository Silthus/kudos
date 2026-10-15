import type { QueryCtx } from "../_generated/server";
import { itemOf } from "../store/catalogue";
import { loadoutOf } from "../store/inventory";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import type { JourneyStep } from "./step";

export type JourneyStepCopy = { goal: string; hint: string | null };

const saysWhyCounts = "It counts when your message has 5 or more words besides mentions and emoji.";

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
  const slotted = await firstSlottedEmojiOf(ctx, member);
  if (slotted === null) return "Put one of your kudos emoji in a slot in the Inventory tab first.";
  const { workspace } = await chatUserOf(ctx, member);
  return `:${slotted}: is in your slots: use it in a kudos like :${(await settingsOf(ctx, workspace)).kudosEmoji}:. ${saysWhyCounts}`;
}

async function firstSlottedEmojiOf(ctx: QueryCtx, member: MemberId): Promise<string | null> {
  for (const { item } of await loadoutOf(ctx, member)) {
    const emoji = item === null ? undefined : itemOf(item)?.emoji;
    if (emoji !== undefined) return emoji;
  }
  return null;
}
