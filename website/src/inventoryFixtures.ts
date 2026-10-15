import type { InventoryItem, MemberInventory } from "./shell";

const arrived = Date.parse("2026-10-13T09:00:00Z");
const hour = 60 * 60 * 1000;

function kudosEmoji(id: string, name: string, glyph: string, source: InventoryItem["source"], onSale = false): InventoryItem {
  return { item: `kudos-emoji-${id}`, kind: "kudosEmoji", name, emoji: id.replace("-", "_"), art: { kind: "unicode", glyph }, source, onSale };
}

const sold = { kind: "store", price: 100 } as const;

const hedgehog = kudosEmoji("hedgehog", "Hedgehog", "🦔", { kind: "starter" });
const rocket = kudosEmoji("rocket", "Rocket", "🚀", sold);
const sunflower = kudosEmoji("sunflower", "Sunflower", "🌻", sold);
const glowingStar = kudosEmoji("glowing-star", "Glowing Star", "🌟", sold, true);
const gem = kudosEmoji("gem", "Gem", "💎", sold, true);
const ribbon = kudosEmoji("ribbon", "Ribbon", "🎀", { kind: "tier", ladder: "generosity", tier: "silver", ladderName: "Generosity" });

const twoEquippedOfThree: MemberInventory = {
  slots: [
    { slot: "emoji-1", item: hedgehog.item },
    { slot: "emoji-2", item: rocket.item },
    { slot: "emoji-3", item: null },
  ],
  owned: [
    { item: hedgehog.item, arrivedAt: arrived },
    { item: rocket.item, arrivedAt: arrived + hour },
    { item: sunflower.item, arrivedAt: arrived + 2 * hour },
  ],
  catalogue: [hedgehog, sunflower, rocket, glowingStar, gem, ribbon],
};

const starterOnly: MemberInventory = {
  slots: [
    { slot: "emoji-1", item: hedgehog.item },
    { slot: "emoji-2", item: null },
    { slot: "emoji-3", item: null },
  ],
  owned: [{ item: hedgehog.item, arrivedAt: arrived }],
  catalogue: [hedgehog, { ...rocket, onSale: true }, { ...sunflower, onSale: true }],
};

export const inventoryFixtures = { twoEquippedOfThree, starterOnly } as const;
