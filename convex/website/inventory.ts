import type { QueryCtx } from "../_generated/server";
import { ladderOf } from "../achievements/ladders";
import type { CatalogueItem, Source } from "../store/catalogue";
import { visibleInventoryOf, type Inventory } from "../store/inventory";
import type { MemberId } from "../workspace/directory";

type TierSource = Extract<Source, { kind: "tier" }>;

export type ItemSource = Exclude<Source, TierSource> | (TierSource & { ladderName: string });

export type InventoryItem = Omit<CatalogueItem, "source"> & { source: ItemSource; onSale: boolean };

export type MemberInventory = Omit<Inventory, "catalogue"> & { catalogue: InventoryItem[] };

export async function inventoryShownTo(ctx: QueryCtx, member: MemberId): Promise<MemberInventory | null> {
  const inventory = await visibleInventoryOf(ctx, member);
  if (inventory === null) return null;
  return { ...inventory, catalogue: inventory.catalogue.map((entry) => ({ ...entry, source: withLadderName(entry.source) })) };
}

function withLadderName(source: Source): ItemSource {
  return source.kind === "tier" ? { ...source, ladderName: ladderOf(source.ladder).name } : source;
}
