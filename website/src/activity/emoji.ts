import charactersByName from "virtual:emoji-characters";

const characters = new Map(Object.entries(charactersByName));

const skinToneModifiers = new Map([
  ["2", "\u{1F3FB}"],
  ["3", "\u{1F3FC}"],
  ["4", "\u{1F3FD}"],
  ["5", "\u{1F3FE}"],
  ["6", "\u{1F3FF}"],
]);

const variationSelector = "\u{FE0F}";

export function emojiCharacterOf(name: string): string | undefined {
  const [shortName = name, skinTone] = name.split("::skin-tone-");
  const character = characters.get(shortName);
  const modifier = skinTone === undefined ? undefined : skinToneModifiers.get(skinTone);
  if (character === undefined || modifier === undefined) return character;
  return withSkinTone(character, modifier);
}

function withSkinTone(character: string, modifier: string) {
  const [first, ...rest] = Array.from(character);
  return [first, modifier, ...(rest[0] === variationSelector ? rest.slice(1) : rest)].join("");
}
