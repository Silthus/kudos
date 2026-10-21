import type { QueryCtx } from "../_generated/server";
import { kudosDecidedAfter } from "../engine/awards";
import { hiddenItemsShownTo, teasersShownTo } from "../items/flag";
import { waitingCountOf, type WaitingCount } from "../items/ledger";
import { lastVisitOf } from "../website/lastVisit";
import type { MemberId } from "../workspace/directory";

const mostKudosCounted = 50;

type KudosCount = number | `${typeof mostKudosCounted}+`;

export async function teaserOf(ctx: QueryCtx, member: MemberId): Promise<string | null> {
  if (!(await teasersShownTo(ctx, member)) || !(await hiddenItemsShownTo(ctx, member))) return null;
  const counts = [itemsWaitOf(await waitingCountOf(ctx, member)), kudosCameInOf(await kudosSinceLastVisitOf(ctx, member))].filter((count) => count !== null);
  return counts.length === 0 ? null : counts.join(" · ");
}

async function kudosSinceLastVisitOf(ctx: QueryCtx, member: MemberId): Promise<KudosCount | null> {
  const lastVisit = await lastVisitOf(ctx, member);
  if (lastVisit === null) return null;
  const received = await kudosDecidedAfter(ctx, member, lastVisit, mostKudosCounted + 1);
  return received > mostKudosCounted ? `${mostKudosCounted}+` : received;
}

function itemsWaitOf(waiting: WaitingCount) {
  if (waiting === 0) return null;
  return waiting === 1 ? "1 item waits" : `${waiting} items wait`;
}

function kudosCameInOf(kudos: KudosCount | null) {
  return kudos === null || kudos === 0 ? null : `${kudos} kudos came in since your last visit`;
}
