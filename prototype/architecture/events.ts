// PROTOTYPE (throwaway, never merged): the event bus and the hook points.
// Publishers know only the bus. Subscribers and contributors are wired in one registry,
// so the kudos engine never imports progression, achievements or the leaderboard.

import type { DomainEvent, EventBus, GiverPerks, MemberId, Perks } from "./contracts.ts";

type EventType = DomainEvent["type"];
type EventOf<T extends EventType> = Extract<DomainEvent, { type: T }>;

export type Subscriber<T extends EventType> = { name: string; handle(event: EventOf<T>): void };
export type Subscriptions = { [T in EventType]: Array<Subscriber<T>> };

export type Job = { subscriber: string; run(): void };

export function createEventBus(subscriptions: Subscriptions, schedule: (job: Job) => void): EventBus {
  return {
    publish(event) {
      for (const subscriber of subscriptions[event.type]) {
        schedule({ subscriber: subscriber.name, run: () => subscriber.handle(event) });
      }
    },
  };
}

export type PerkContributor = { name: string; perksOf(giver: MemberId): Partial<GiverPerks> };

export function combinePerks(contributors: PerkContributor[]): Perks {
  return {
    of(giver) {
      const parts = contributors.map((contributor) => contributor.perksOf(giver));
      return { allowanceBonus: parts.reduce((sum, part) => sum + (part.allowanceBonus ?? 0), 0) };
    },
  };
}
