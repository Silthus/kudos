import charactersByName from "virtual:emoji-characters";

const characters = new Map(Object.entries(charactersByName));

const skinToneSuffix = "::skin-tone-";

export function emojiCharacterOf(name: string): string | undefined {
  return characters.get(name) ?? characters.get(withoutSkinTone(name));
}

export function withoutSkinTone(name: string): string {
  return name.split(skinToneSuffix)[0]!;
}

export function skinTonedCharacterOf(name: string): string | undefined {
  return name.includes(skinToneSuffix) ? characters.get(name) : undefined;
}
