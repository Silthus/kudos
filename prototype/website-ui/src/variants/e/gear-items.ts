// Variant E kudos emoji catalogue: the extra emoji a member thanks with, how each one is earned or its store price, and how many the character sheet holds.
export type ItemSource =
  | { kind: "starter" }
  | { kind: "level"; level: number }
  | { kind: "achievement"; name: string }
  | { kind: "quest"; name: string }
  | { kind: "store"; price: number };

export type Emoji = { id: string; name: string; glyph: string; source: ItemSource; owned: boolean };

export const emojiSlots = 3;

export const explainer = {
  hedgehog: "Your avatar on your profile card, the leaderboard and the top bar.",
  emoji: "Extra kudos emoji to thank with, beside the standard one.",
};

export const emoji: Emoji[] = [
  { id: "emoji-hog", name: "Hedgehog", glyph: "🦔", source: { kind: "starter" }, owned: true },
  { id: "emoji-raised-hands", name: "Raised hands", glyph: "🙌", source: { kind: "store", price: 80 }, owned: true },
  { id: "emoji-star", name: "Glowing star", glyph: "🌟", source: { kind: "level", level: 6 }, owned: true },
  { id: "emoji-butterfly", name: "Butterfly", glyph: "🦋", source: { kind: "achievement", name: "Social Butterfly" }, owned: true },
  { id: "emoji-fire", name: "Fire", glyph: "🔥", source: { kind: "quest", name: "Warm welcome" }, owned: true },
  { id: "emoji-party", name: "Party popper", glyph: "🎉", source: { kind: "store", price: 120 }, owned: false },
  { id: "emoji-crown", name: "Crown", glyph: "👑", source: { kind: "achievement", name: "Patron of Praise" }, owned: false },
  { id: "emoji-rocket", name: "Rocket", glyph: "🚀", source: { kind: "level", level: 10 }, owned: false },
  { id: "emoji-trophy", name: "Trophy", glyph: "🏆", source: { kind: "quest", name: "All hands" }, owned: false },
];

export const emojiById = (id: string) => emoji.find((e) => e.id === id);

export const emojiIdFor = (glyph: string) => emoji.find((e) => e.glyph === glyph)?.id;

export const priceOf = (source: ItemSource) => (source.kind === "store" ? source.price : undefined);

export function howToGet(source: ItemSource): string {
  switch (source.kind) {
    case "starter":
      return "Everyone has it";
    case "level":
      return `At level ${source.level}`;
    case "achievement":
      return `From ${source.name}`;
    case "quest":
      return `From the ${source.name} quest`;
    case "store":
      return "In the store";
  }
}
