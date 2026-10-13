import type { FunctionReference } from "convex/server";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { DomainEvent } from "./events";

type EventOf<T extends DomainEvent["type"]> = Extract<DomainEvent, { type: T }>;
type Subscriber<T extends DomainEvent["type"]> = FunctionReference<"mutation" | "action", "internal", { event: EventOf<T> }>;
type Registry = { [T in DomainEvent["type"]]: Array<Subscriber<T>> };

export const subscribers: Registry = {
  kudosGiven: [internal.welcome.welcome.welcomeNewMembers, internal.progression.progression.recordEffects],
  levelReached: [],
};

export async function publish<T extends DomainEvent["type"]>(ctx: MutationCtx, event: EventOf<T> & { type: T }) {
  const subscribersOfEvent: Array<Subscriber<T>> = subscribers[event.type];
  for (const subscriber of subscribersOfEvent) {
    await ctx.scheduler.runAfter(0, subscriber, { event });
  }
}
