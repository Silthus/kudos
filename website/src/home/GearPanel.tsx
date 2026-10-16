import { IconBox, IconUser } from "@posthog/icons";
import { ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { useRef, useState } from "react";
import type { MemberInventory, MemberProfile, ShellActions } from "../shell";
import { CharacterSide } from "./CharacterSide";
import { useLoadoutCommand, type LoadoutActions } from "./gear";
import { InventorySide, type Said } from "./InventorySide";
import { useItemPurchase, type PendingItemPurchase } from "./itemPurchase";
import { Panel } from "./Panel";

type Side = "character" | "inventory";

type Turn = { side: Side; turns: number };

type GearPanelProps = { member: MemberProfile; loadout: LoadoutActions; buyItem: ShellActions["buyItem"]; pendingPurchase: PendingItemPurchase };

export function GearPanel({ member, loadout, buyItem, pendingPurchase }: GearPanelProps) {
  const [{ side, turns }, setTurn] = useState<Turn>({ side: "character", turns: 0 });
  const send = useLoadoutCommand();
  const kudosEmojiHeading = useRef<HTMLHeadingElement>(null);
  const [said, setSaid] = useState<Said>();
  const purchasing = useItemPurchase(buyItem, pendingPurchase, () => kudosEmojiHeading.current?.focus(), (notice) => setSaid(notice && { text: notice.text, done: notice.kind === "bought" }));
  if (member.inventory === null) return null;
  const turnTo = (next: Side) => next !== side && setTurn({ side: next, turns: turns + 1 });
  return (
    <Panel id="gear" label={labelOf(side, member.inventory)} aside={<SideToggle side={side} onTurn={turnTo} />} gameObject>
      <div key={turns} className={turns > 0 ? "gear-turn" : undefined}>
        {side === "character" ? <CharacterSide member={member} inventory={member.inventory} loadout={loadout} send={send} /> : <InventorySide member={member} inventory={member.inventory} loadout={loadout} send={send} purchasing={purchasing} heading={kudosEmojiHeading} said={said} onSaid={setSaid} />}
      </div>
    </Panel>
  );
}

function labelOf(side: Side, inventory: MemberInventory) {
  return side === "character" ? `Character · ${inventory.slots.length} slots` : "Inventory";
}

function SideToggle({ side, onTurn }: { side: Side; onTurn: (side: Side) => void }) {
  const look = (each: Side) => `text-foreground ${each === side ? "bg-fill-selected" : ""}`;
  return (
    <ToggleGroup variant="outline" size="sm" aria-label="Gear side" value={[side]} onValueChange={(chosen) => chosen[0] && onTurn(chosen[0] as Side)}>
      <ToggleGroupItem value="character" className={look("character")}>
        <IconUser aria-hidden="true" />
        Character
      </ToggleGroupItem>
      <ToggleGroupItem value="inventory" className={look("inventory")}>
        <IconBox aria-hidden="true" />
        Inventory
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
