import { useRef, useState } from "react";
import type { MemberProfile, ShellActions } from "../shell";
import { InventorySide, type Said } from "./InventorySide";
import { panelTargetAttributes } from "../linkTarget";
import { useItemPurchase, type PendingItemPurchase } from "./itemPurchase";
import { Panel } from "./Panel";

type GearPanelProps = { member: MemberProfile; buyItem: ShellActions["buyItem"]; pendingPurchase: PendingItemPurchase };

export function GearPanel({ member, buyItem, pendingPurchase }: GearPanelProps) {
  const kudosEmojiHeading = useRef<HTMLHeadingElement>(null);
  const [said, setSaid] = useState<Said>();
  const purchasing = useItemPurchase(buyItem, pendingPurchase, () => kudosEmojiHeading.current?.focus(), (notice) => setSaid(notice && { text: notice.text, done: notice.kind === "bought" }));
  if (member.inventory === null) return null;
  return (
    <Panel id="gear" label="Inventory" target={panelTargetAttributes("inventory")} gameObject>
      <InventorySide member={member} inventory={member.inventory} purchasing={purchasing} heading={kudosEmojiHeading} said={said} />
    </Panel>
  );
}
