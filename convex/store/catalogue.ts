import type { LadderId } from "../achievements/ladders";

export type ItemId = string;

export type Art = { kind: "unicode"; glyph: string } | { kind: "custom"; url: string };

export type Source = { kind: "starter" } | { kind: "store"; price: number } | { kind: "tier"; ladder: LadderId; tier: "silver" };

export type CatalogueItem = { item: ItemId; kind: "kudosEmoji"; name: string; emoji: string; art: Art; source: Source };

const storePrice = 100;

const starter = kudosEmoji("hedgehog", "hedgehog", "🦔", "Hedgehog", { kind: "starter" });

export const catalogue = {
  version: "1",
  items: [
    starter,
    kudosEmoji("sunflower", "sunflower", "🌻", "Sunflower", sold()),
    kudosEmoji("rocket", "rocket", "🚀", "Rocket", sold()),
    kudosEmoji("glowing-star", "star2", "🌟", "Glowing Star", sold()),
    kudosEmoji("gem", "gem", "💎", "Gem", sold()),
    kudosEmoji("rainbow", "rainbow", "🌈", "Rainbow", sold()),
    kudosEmoji("clover", "four_leaf_clover", "🍀", "Clover", sold()),
    kudosEmoji("doughnut", "doughnut", "🍩", "Doughnut", sold()),
    kudosEmoji("cookie", "cookie", "🍪", "Cookie", sold()),
    kudosEmoji("crown", "crown", "👑", "Crown", sold()),
    kudosEmoji("balloon", "balloon", "🎈", "Balloon", sold()),
    kudosEmoji("cactus", "cactus", "🌵", "Cactus", sold()),
    kudosEmoji("trophy", "trophy", "🏆", "Trophy", sold()),
    kudosEmoji("ribbon", "ribbon", "🎀", "Ribbon", silverIn("generosity")),
    kudosEmoji("sparkling-heart", "sparkling_heart", "💖", "Sparkling Heart", silverIn("recognition")),
    kudosEmoji("jigsaw", "jigsaw", "🧩", "Jigsaw", silverIn("connections")),
    kudosEmoji("anchor", "anchor", "⚓", "Anchor", silverIn("dependability")),
    kudosEmoji("confetti", "confetti_ball", "🎊", "Confetti", silverIn("applause")),
    kudosEmoji("maple-leaf", "maple_leaf", "🍁", "Maple Leaf", silverIn("seasons")),
    kudosEmoji("teddy-bear", "teddy_bear", "🧸", "Teddy Bear", silverIn("old-friends")),
  ],
} as const satisfies { version: string; items: readonly CatalogueItem[] };

export const starterItem: ItemId = starter.item;

export function itemOf(item: ItemId): CatalogueItem | undefined {
  return catalogue.items.find((entry) => entry.item === item);
}

function kudosEmoji(id: string, emoji: string, glyph: string, name: string, source: Source): CatalogueItem {
  return { item: `kudos-emoji-${id}`, kind: "kudosEmoji", name, emoji, art: { kind: "unicode", glyph }, source };
}

function sold(): Source {
  return { kind: "store", price: storePrice };
}

function silverIn(ladder: LadderId): Source {
  return { kind: "tier", ladder, tier: "silver" };
}
