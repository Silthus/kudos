import { IconBox, IconUser } from "@posthog/icons";
import { ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { useRef, useState } from "react";
import type { MemberInventory, MemberProfile, ShellActions } from "../shell";
import { CharacterSide } from "./CharacterSide";
import { slotsRetiredIn, useLoadoutCommand, type LoadoutActions } from "./gear";
import { InventorySide, type Said } from "./InventorySide";
import { panelTargetAttributes } from "../linkTarget";
import { useItemPurchase, type PendingItemPurchase } from "./itemPurchase";
import { Panel } from "./Panel";

export type Side = "character" | "inventory";

type Turn = { side: Side; turns: number };

type GearPanelProps = { member: MemberProfile; opensOn: Side; loadout: LoadoutActions; buyItem: ShellActions["buyItem"]; pendingPurchase: PendingItemPurchase };

export function GearPanel({ member, opensOn, loadout, buyItem, pendingPurchase }: GearPanelProps) {
  const [{ side, turns }, setTurn] = useState<Turn>({ side: opensOn, turns: 0 });
  const [landing, setLanding] = useState(opensOn);
  if (opensOn !== landing) {
    setLanding(opensOn);
    if (opensOn === "inventory") setTurn({ side: opensOn, turns });
  }
  const send = useLoadoutCommand();
  const kudosEmojiHeading = useRef<HTMLHeadingElement>(null);
  const [said, setSaid] = useState<Said>();
  const purchasing = useItemPurchase(buyItem, pendingPurchase, () => kudosEmojiHeading.current?.focus(), (notice) => setSaid(notice && { text: notice.text, done: notice.kind === "bought" }));
  if (member.inventory === null) return null;
  if (slotsRetiredIn(member.inventory)) {
    return (
      <Panel id="gear" label="Inventory" target={panelTargetAttributes("inventory")} gameObject>
        <InventorySide member={member} inventory={member.inventory} loadout={loadout} send={send} purchasing={purchasing} heading={kudosEmojiHeading} said={said} onSaid={setSaid} />
      </Panel>
    );
  }
  const turnTo = (next: Side) => next !== side && setTurn({ side: next, turns: turns + 1 });
  return (
    <Panel id="gear" label={labelOf(side, member.inventory)} target={side === "inventory" ? panelTargetAttributes("inventory") : undefined} aside={<SideToggle side={side} onTurn={turnTo} />} gameObject>
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
