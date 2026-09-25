export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export const RARITY_META: Record<Rarity, { label: string; color: string; glow: string; ring: string; text: string; bg: string }> = {
  common: { label: "Common", color: "var(--color-r-common)", glow: "", ring: "ring-r-common", text: "text-r-common", bg: "bg-r-common/12" },
  uncommon: { label: "Uncommon", color: "var(--color-r-uncommon)", glow: "shadow-[2px_2px_0_0_var(--color-r-uncommon)]", ring: "ring-r-uncommon", text: "text-r-uncommon", bg: "bg-r-uncommon/12" },
  rare: { label: "Rare", color: "var(--color-r-rare)", glow: "shadow-[3px_3px_0_0_var(--color-r-rare)]", ring: "ring-r-rare", text: "text-r-rare", bg: "bg-r-rare/12" },
  epic: { label: "Epic", color: "var(--color-r-epic)", glow: "shadow-[3px_3px_0_0_var(--color-r-epic)]", ring: "ring-r-epic", text: "text-r-epic", bg: "bg-r-epic/14" },
  legendary: { label: "Legendary", color: "var(--color-r-legendary)", glow: "shadow-[3px_3px_0_0_var(--color-r-legendary),6px_6px_0_0_var(--color-ember)]", ring: "ring-r-legendary", text: "text-r-legendary", bg: "bg-r-legendary/14" },
};

export const CATEGORY_LABEL: Record<string, string> = {
  giver_success: "Giver success",
  receiver_success: "Receiver success",
  limit_reached: "Limit reached",
  allowance_status: "Allowance check",
  self_kudos: "Self kudos",
  quest_complete: "Quest complete",
};

/** How to find a category's messages, shown on the ones you haven't discovered yet. */
export const CATEGORY_HINT: Partial<Record<string, string>> = {
  quest_complete: "Complete weekly quests to find these",
};
