import charactersByName from "virtual:emoji-characters";

const characters = new Map(Object.entries(charactersByName));

const skinToneSuffix = "::skin-tone-";

export function emojiCharacterOf(name: string): string | undefined {
  return characters.get(name) ?? characters.get(name.split(skinToneSuffix)[0]!);
}

export function isSkinToned(name: string): boolean {
  return name.includes(skinToneSuffix);
}
