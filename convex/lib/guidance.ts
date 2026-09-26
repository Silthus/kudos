import type { Infer } from "convex/values";
import type { attemptOutcomeValidator, invalidReasonValidator } from "../schema";

export type AttemptOutcome = Infer<typeof attemptOutcomeValidator>;
export type InvalidReason = Infer<typeof invalidReasonValidator>;

/** What went wrong with a kudos attempt, with the numbers needed to explain it. */
export type Problem =
  | { kind: "limit"; people: number; amountEach: number; remaining: number; limit: number }
  | { kind: InvalidReason };

/** Slack reaction names the bot puts on a message for each outcome (`given` uses the kudos emoji). */
export const LIMIT_REACTION = "hourglass_flowing_sand";
export const INVALID_REACTION = "x";
/** Used when Slack rejects the kudos emoji as a reaction, e.g. a custom emoji the workspace lacks. */
export const FALLBACK_REACTION = "white_check_mark";

/**
 * Everyday emoji people type in chat without thanking anyone (#168): with one of them as the kudos
 * emoji, a message that mentions nobody is chat, not a kudos attempt. A kudos convention like
 * HeyTaco's taco, or a custom emoji, is typed on purpose, so it keeps the ❌ and the how-to.
 */
const EVERYDAY_EMOJI = new Set(["seedling", "herb", "sunflower", "heart", "sparkles", "star", "tada", "clap", "raised_hands", "pray", "fire", "100", "+1", "thumbsup"]);

export function everydayEmoji(emojiName: string): boolean {
  return EVERYDAY_EMOJI.has(emojiName);
}

export function reactionFor(outcome: AttemptOutcome, emojiName: string) {
  return outcome === "given" ? emojiName : outcome === "limit" ? LIMIT_REACTION : INVALID_REACTION;
}

/**
 * How to turn a failed attempt into a valid kudos, for the giver's eyes only. `e` is the kudos
 * emoji as the surface renders it (`:seedling:` in Slack, 🌱 on the web).
 */
export function guidance(problem: Problem, e: string): string {
  if (problem.kind === "limit") return limitGuidance(problem, e);
  return `${invalidGuidance(problem.kind, e)} Edit your message to fix it.`;
}

function invalidGuidance(reason: InvalidReason, e: string) {
  const example = `“@alex ${e} thanks for the review!”`;
  switch (reason) {
    case "no_mention":
      return `Nobody was mentioned, so no ${e} went out. Mention the people you're thanking in the same message, like ${example}`;
    case "group":
      return `Group mentions like @here or a user group don't give ${e}. Mention each person you're thanking, like ${example}`;
    case "self":
      return `You can't give ${e} to yourself. Mention a teammate instead, like ${example}`;
    case "bots":
      return `Bots and apps can't receive ${e}, so none went out. Mention a teammate instead, like ${example}`;
    case "inactive":
      return `Only active teammates in this workspace can receive ${e}, so none went out. Mention a current teammate, like ${example}`;
  }
}

/** An edit can't change kudos that were already sent; the author hears it privately. */
export function alreadySent(unitPlural: string): string {
  return `Your edit didn't change anything, because the ${unitPlural} in this message were already sent.`;
}

function limitGuidance({ people, amountEach, remaining, limit }: Extract<Problem, { kind: "limit" }>, e: string) {
  if (remaining === 0) return `You've given all ${limit} ${e} you have for today, so nothing was sent. Your allowance resets at midnight.`;
  const requested = people * amountEach;
  const math =
    people > 1
      ? `Every ${e} goes to every person you mention: ${people} people × ${amountEach} ${e} = ${requested} ${e}, but you have ${remaining} left today.`
      : `That's ${requested} ${e}, but you have ${remaining} left today.`;
  return `${math} Nothing was sent. ${limitFix(people, amountEach, remaining, e)}`;
}

function limitFix(people: number, amountEach: number, remaining: number, e: string) {
  if (people === 1) return `Edit your message down to ${remaining} ${e} to send it.`;
  const each = Math.floor(remaining / people);
  const fewer = Math.floor(remaining / amountEach);
  const options = [
    each > 0 ? `use ${each} ${e} so each of them gets ${each} (${each * people} in total)` : null,
    fewer > 0 ? `mention ${fewer === 1 ? "just 1 person" : `at most ${fewer} people`}` : null,
  ].filter(Boolean);
  if (options.length === 0) return `To fix it, edit your message: thank one person with up to ${remaining} ${e}.`;
  return `To fix it, edit your message: ${options.join(", or ")}.`;
}
