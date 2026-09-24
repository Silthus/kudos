export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

/** The pip's shape grows with the tier, so rarity never rests on colour alone. */
export type RarityPipShape = "ring" | "dot" | "diamond" | "sparkle" | "star";

/**
 * `color` is for fills, borders and pips, never for text (epic is below 3:1 on dark surfaces):
 * rarity text always uses the text tokens, next to its word and pip.
 */
export const RARITY_META: Record<Rarity, { label: string; color: string; pip: RarityPipShape; ring: string; bg: string }> = {
  common: { label: "Common", color: "var(--k-r-common)", pip: "ring", ring: "ring-r-common/30", bg: "bg-r-common/12" },
  uncommon: { label: "Uncommon", color: "var(--k-r-uncommon)", pip: "dot", ring: "ring-r-uncommon/35", bg: "bg-r-uncommon/12" },
  rare: { label: "Rare", color: "var(--k-r-rare)", pip: "diamond", ring: "ring-r-rare/40", bg: "bg-r-rare/12" },
  epic: { label: "Epic", color: "var(--k-r-epic)", pip: "sparkle", ring: "ring-r-epic/45", bg: "bg-r-epic/14" },
  legendary: { label: "Legendary", color: "var(--k-r-legendary)", pip: "star", ring: "ring-r-legendary/60", bg: "bg-r-legendary/14" },
};

export const CATEGORY_LABEL: Record<string, string> = {
  giver_success: "Giver success",
  receiver_success: "Receiver success",
  limit_reached: "Limit reached",
  allowance_status: "Allowance check",
  self_kudos: "Self kudos",
};
