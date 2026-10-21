import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { hiddenItemsShownTo } from "./flag";
import { boardOf, type FaceDown } from "./ledger";

export type HypesHeld = { people: ReadonlySet<MemberId>; every: boolean };

export function hypesHeldFor({ items, more }: { items: FaceDown[]; more: boolean }): HypesHeld {
  return { people: new Set(items.flatMap(({ reason }) => (reason.kind === "thanks" ? [reason.person] : []))), every: more };
}

export function holdsTheHypeOf(held: HypesHeld, person: MemberId): boolean {
  return held.every || held.people.has(person);
}

export async function hypeWaitsForItsItem(ctx: QueryCtx, member: MemberId, person: MemberId): Promise<boolean> {
  return (await hiddenItemsShownTo(ctx, member)) && holdsTheHypeOf(hypesHeldFor(await boardOf(ctx, member)), person);
}
