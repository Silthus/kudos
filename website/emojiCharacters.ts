import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { Plugin } from "vite";

const moduleId = "virtual:emoji-characters";

const resolvedId = `\0${moduleId}`;

type DatasetEmoji = { unified: string; short_names: string[] };

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
  return Object.fromEntries(dataset.flatMap(({ unified, short_names }) => short_names.map((name) => [name, characterOf(unified)])));
}

function characterOf(unified: string) {
  return String.fromCodePoint(...unified.split("-").map((hex) => Number.parseInt(hex, 16)));
}
