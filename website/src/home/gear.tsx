import { CustomEmoji } from "../CustomEmoji";
import type { InventoryItem, MemberInventory } from "../shell";

export function ownedIn({ owned, catalogue }: MemberInventory): InventoryItem[] {
  return owned.flatMap(({ item }) => catalogue.find((entry) => entry.item === item) ?? []);
}

export function ItemArt({ item: { art, name }, className }: { item: InventoryItem; className: string }) {
  if (art.kind === "custom") {
    return (
      <span aria-hidden="true" className="flex max-w-full min-w-0 items-center justify-center">
        <CustomEmoji key={art.url} label={name} image={art.url} className={`object-contain ${className}`} nameClassName="block max-w-full truncate text-xs" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={`flex items-center justify-center leading-none ${className}`}>
      {art.glyph}
    </span>
  );
}
