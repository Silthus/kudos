import type { QueryCtx } from "../_generated/server";
import { hiddenItemsShownTo, teasersShownTo } from "../items/flag";
import { waitingCountOf, type WaitingCount } from "../items/ledger";
import type { MemberId } from "../workspace/directory";

export async function teaserOf(ctx: QueryCtx, member: MemberId): Promise<string | null> {
  if (!(await teasersShownTo(ctx, member)) || !(await hiddenItemsShownTo(ctx, member))) return null;
  const waiting = await waitingCountOf(ctx, member);
  return waiting === 0 ? null : itemsWaitOf(waiting);
}

function itemsWaitOf(waiting: WaitingCount) {
  return waiting === 1 ? "1 item waits" : `${waiting} items wait`;
}
