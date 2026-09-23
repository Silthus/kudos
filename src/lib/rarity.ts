export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export const RARITY_META: Record<Rarity, { label: string; color: string; glow: string; ring: string; text: string; bg: string }> = {
  common: { label: "Common", color: "var(--color-r-common)", glow: "", ring: "ring-r-common/30", text: "text-r-common", bg: "bg-r-common/12" },
  uncommon: { label: "Uncommon", color: "var(--color-r-uncommon)", glow: "shadow-[0_0_32px_-10px_var(--color-r-uncommon)]", ring: "ring-r-uncommon/35", text: "text-r-uncommon", bg: "bg-r-uncommon/12" },
  rare: { label: "Rare", color: "var(--color-r-rare)", glow: "shadow-[0_0_36px_-8px_var(--color-r-rare)]", ring: "ring-r-rare/40", text: "text-r-rare", bg: "bg-r-rare/12" },
  epic: { label: "Epic", color: "var(--color-r-epic)", glow: "shadow-[0_0_44px_-8px_var(--color-r-epic)]", ring: "ring-r-epic/45", text: "text-r-epic", bg: "bg-r-epic/14" },
  legendary: { label: "Legendary", color: "var(--color-r-legendary)", glow: "shadow-[0_0_56px_-6px_var(--color-r-legendary)]", ring: "ring-r-legendary/60", text: "text-r-legendary", bg: "bg-r-legendary/14" },
};

export const CATEGORY_LABEL: Record<string, string> = {
  giver_success: "Giver success",
  receiver_success: "Receiver success",
  limit_reached: "Limit reached",
  allowance_status: "Allowance check",
  self_kudos: "Self kudos",
};
