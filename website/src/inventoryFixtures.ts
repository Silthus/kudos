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

const threeOwned: MemberInventory = {
  owned: [
    { item: hedgehog.item, arrivedAt: arrived },
    { item: rocket.item, arrivedAt: arrived + hour },
    { item: sunflower.item, arrivedAt: arrived + 2 * hour },
  ],
  catalogue: [hedgehog, sunflower, rocket, glowingStar, gem, ribbon],
};

const starterOnly: MemberInventory = {
  owned: [{ item: hedgehog.item, arrivedAt: arrived }],
  catalogue: [hedgehog, { ...rocket, onSale: true }, { ...sunflower, onSale: true }],
};

function customEmoji(name: string, onSale: boolean): InventoryItem {
  return { item: `custom:${name}`, kind: "kudosEmoji", name: `:${name}:`, emoji: name, art: { kind: "custom", url: `https://emoji.slack-edge.com/T1/${name}/a1b2.png` }, source: sold, onSale };
}

const partyParrot = customEmoji("partyparrot", false);
const shipIt = customEmoji("shipit", true);

const withCustomEmoji: MemberInventory = {
  owned: [
    { item: hedgehog.item, arrivedAt: arrived },
    { item: partyParrot.item, arrivedAt: arrived + hour },
  ],
  catalogue: [hedgehog, partyParrot, shipIt],
};

const nothingForSale: MemberInventory = {
  owned: [
    { item: hedgehog.item, arrivedAt: arrived },
    { item: rocket.item, arrivedAt: arrived + hour },
  ],
  catalogue: [hedgehog, rocket, ribbon],
};

const oneForSale: MemberInventory = { ...nothingForSale, catalogue: [...nothingForSale.catalogue, shipIt] };

export const inventoryFixtures = { threeOwned, starterOnly, withCustomEmoji, nothingForSale, oneForSale } as const;
