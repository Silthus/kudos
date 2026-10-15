import { IconBox, IconUser } from "@posthog/icons";
import { ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { useState } from "react";
import type { MemberInventory, MemberProfile } from "../shell";
import { CharacterSide } from "./CharacterSide";
import { useLoadoutCommand, type LoadoutActions } from "./gear";
import { InventorySide } from "./InventorySide";
import { Panel } from "./Panel";

type Side = "character" | "inventory";

type Turn = { side: Side; turns: number };

export function GearPanel({ member, loadout }: { member: MemberProfile; loadout: LoadoutActions }) {
  const [{ side, turns }, setTurn] = useState<Turn>({ side: "character", turns: 0 });
  const send = useLoadoutCommand();
  if (member.inventory === null) return null;
  const turnTo = (next: Side) => next !== side && setTurn({ side: next, turns: turns + 1 });
  return (
    <Panel id="gear" label={labelOf(side, member.inventory)} aside={<SideToggle side={side} onTurn={turnTo} />} gameObject>
      <div key={turns} className={turns > 0 ? "gear-turn" : undefined}>
        {side === "character" ? <CharacterSide member={member} inventory={member.inventory} loadout={loadout} send={send} /> : <InventorySide member={member} inventory={member.inventory} loadout={loadout} send={send} />}
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
