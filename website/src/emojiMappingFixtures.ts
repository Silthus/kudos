import type { EmojiMappingsShown } from "./emojiMappingsRead";
import type { EmojiMappings, ShownMappingTarget } from "./shell";

const slackPicture = (name: string) => `https://emoji.slack-edge.com/T1/${name}/1.png`;

function listed(name: string, mapping: ShownMappingTarget | null = null): EmojiMappings["emoji"][number] {
  return { name, image: slackPicture(name), mapping };
}

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
