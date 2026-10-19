import type { EmojiMappingsShown } from "./emojiMappingsRead";
import type { EmojiMappings, ShownMappingTarget } from "./shell";

const standardEmojiArt = ["1f3c6", "1f994", "1f51f", "1f4e3", "1f9a6", "1f99c", "1f680", "2728", "1f525", "1f44d", "1f389", "1f31f"];

const standardEmojiPicture = (index: number) => `https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/${standardEmojiArt[index % standardEmojiArt.length]}.png`;

let listedSoFar = 0;

function listed(name: string, mapping: ShownMappingTarget | null = null): EmojiMappings["emoji"][number] {
  return { name, image: name === "shipit" ? shipitPicture : standardEmojiPicture(listedSoFar++), mapping };
}

export const shipitPicture = "https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/1f43f-fe0f.png";

const workspace: EmojiMappings = {
  kind: "mappings",
  emoji: [
    listed("full-of-friends", { kind: "milestone", milestone: "people" }),
    listed("hedgehog"),
    listed("level-10", { kind: "level", level: 10 }),
    listed("omar-haddad-hype", { kind: "hype", person: "k-omar" }),
    listed("otters", { kind: "team", team: "otters" }),
    listed("party-parrot", { kind: "random" }),
    listed("shipit"),
    ...Array.from({ length: 81 }, (_, index) => listed(`yak-${String(index + 1).padStart(3, "0")}`)),
  ],
  more: false,
  teams: [
    { team: "otters", name: "Otters" },
    { team: "workflows", name: "Workflows" },
  ],
  milestones: [
    { milestone: "people", name: "Full of friends" },
    { milestone: "teams", name: "Most of the company" },
    { milestone: "reach", name: "Well travelled" },
    { milestone: "hoggies", name: "Hoarder" },
    { milestone: "thoughtful", name: "Heart of the team" },
  ],
  levels: [5, 10, 15, 20, 25],
  people: [
    { key: "k-ada", name: "Ada Lindqvist" },
    { key: "k-omar", name: "Omar Haddad" },
  ],
};

export const emojiMappingsFixtures = { workspace } as const satisfies Record<string, EmojiMappingsShown>;

export function withMapping(mappings: EmojiMappings, name: string, mapping: ShownMappingTarget | null): EmojiMappings {
  return { ...mappings, emoji: mappings.emoji.map((each) => (each.name === name ? { ...each, mapping } : each)) };
}
