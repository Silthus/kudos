import type { QueryCtx } from "../_generated/server";
import type { Nudge } from "../album/hypeReactions";
import { firstNameOf } from "./recipientNames";

export async function hypeNudgeLineOf(ctx: QueryCtx, { person, emoji }: Nudge): Promise<string> {
  return `Give ${await firstNameOf(ctx, person)} a kudos to collect :${emoji}:.`;
}
