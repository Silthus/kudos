import type { FunctionReference } from "convex/server";
import type { MutationCtx } from "../_generated/server";
import type { DayKey } from "../engine/allowance";
import type { Award } from "../engine/awards";
import type { Annotations, MessageRef } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";

export type KudosGivenEvent = {
  type: "kudosGiven";
  workspace: string;
  message: MessageRef;
  giver: MemberId;
  awards: Award[];
  kudosEmoji: string;
  annotations: Annotations;
  allowance: { dailyOpening: number; dailyLeft: number };
  day: DayKey;
  at: number;
};

export type DomainEvent = KudosGivenEvent;

type Subscriber<E extends DomainEvent> = FunctionReference<"mutation" | "action", "internal", { event: E }>;
type Registry = { [T in DomainEvent["type"]]: Array<Subscriber<Extract<DomainEvent, { type: T }>>> };

export const subscribers: Registry = { kudosGiven: [] };

export async function publish(ctx: MutationCtx, event: DomainEvent) {
  for (const subscriber of subscribers[event.type]) {
    await ctx.scheduler.runAfter(0, subscriber, { event });
  }
}
