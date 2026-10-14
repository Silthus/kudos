import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { Plugin } from "vite";

const moduleId = "virtual:emoji-characters";

const resolvedId = `\0${moduleId}`;

type SkinVariations = Record<string, { unified: string }>;

type DatasetEmoji = { unified: string; short_names: string[]; skin_variations?: SkinVariations };

const slackSkinTones = new Map([
  ["1F3FB", "2"],
  ["1F3FC", "3"],
  ["1F3FD", "4"],
  ["1F3FE", "5"],
  ["1F3FF", "6"],
]);

export function emojiCharacters(): Plugin {
  return {
    name: "emoji-characters",
    resolveId: (id) => (id === moduleId ? resolvedId : undefined),
    load: (id) => (id === resolvedId ? `export default ${JSON.stringify(charactersByName())};` : undefined),
  };
}

function charactersByName() {
  const datasetPath = createRequire(import.meta.url).resolve("emoji-datasource/emoji.json");
  const dataset: DatasetEmoji[] = JSON.parse(readFileSync(datasetPath, "utf8"));
  return Object.fromEntries(dataset.flatMap(({ unified, short_names, skin_variations = {} }) => short_names.flatMap((name) => [[name, characterOf(unified)], ...skinTonedOf(name, skin_variations)])));
}

function skinTonedOf(name: string, variations: SkinVariations) {
  return Object.entries(variations).flatMap(([modifiers, { unified }]) => slackSkinToneNamesOf(modifiers).map((tone) => [`${name}::skin-tone-${tone}`, characterOf(unified)]));
}

function slackSkinToneNamesOf(modifiers: string) {
  const tones = modifiers.split("-").map((modifier) => slackSkinTones.get(modifier));
  const paired = tones.join("-");
  return new Set(tones).size === 1 ? [tones[0], paired] : [paired];
}

function characterOf(unified: string) {
  return String.fromCodePoint(...unified.split("-").map((hex) => Number.parseInt(hex, 16)));
}
