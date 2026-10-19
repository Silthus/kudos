import type { AppEmoji } from "../../convex/website/emojiWizard";
import type { EmojiMappingsShown } from "./emojiMappingsRead";
import type { AppEmojisRead, SlackEmojiMatchesRead } from "./emojiWizardReads";
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
  randomDrops: true,
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

const wizardSlackEmoji = [
  listed("ines-cheer"),
  listed("ines-wave"),
  listed("ines"),
  listed("level-5-star"),
  listed("lantern-glow", { kind: "team", team: "lanterns" }),
  listed("lanterns-party"),
  listed("quiet-harbour-boat"),
  listed("familiar-faces-medal"),
  ...workspace.emoji,
];

export const fixtureSlackEmojiMatches: SlackEmojiMatchesRead = (near, search) => {
  const words = (search.trim() === "" ? near : search).toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 2);
  const found = wizardSlackEmoji.filter(({ name }) => words.some((word) => name.startsWith(word.slice(0, 4))));
  return { kind: "matches", matches: found.slice(0, 24).map(({ name, image, mapping }) => ({ name, image, free: mapping === null })) };
};

const appEmojis: AppEmoji[] = [
  { key: "level:5", kind: "level", name: "level-5", from: "Level 5", picture: "/emoji/level-5.png", holders: 14, slack: { image: standardEmojiPicture(3), setBy: { by: "maintainer", name: "Sam Example" } }, place: { kind: "level", level: 5 } },
  { key: "team:quiet-harbour", kind: "team", name: "quiet-harbour", from: "Quiet Harbour", picture: "/emoji/team-workflows.png", holders: 9, slack: null, place: { kind: "team", team: "quiet-harbour" } },
  { key: "team:lanterns", kind: "team", name: "lantern-glow", from: "Lanterns", picture: "/emoji/team.png", holders: 6, slack: { image: standardEmojiPicture(5), setBy: { by: "member", name: "Bram Teller" } }, place: { kind: "team", team: "lanterns" } },
  { key: "hype:k-ines", kind: "hype", name: "ines-okafor-hype", from: "Ines Okafor", picture: "/emoji/hype.png", holders: 4, slack: null, place: { kind: "hype", person: "k-ines" } },
  { key: "milestone:people:silver", kind: "milestone", name: "familiar-faces", from: "Familiar faces", picture: "/emoji/milestone-people-silver.png", holders: 3, slack: null, place: { kind: "milestone", milestone: "people:silver" } },
  { key: "level:25", kind: "level", name: "level-25", from: "Level 25", picture: "/emoji/level-25.png", holders: 0, slack: null, place: { kind: "level", level: 25 } },
];

export const fixtureAppEmojis: AppEmojisRead = (asking) => (asking ? { kind: "app-emojis", emojis: appEmojis, more: false, emojiPage: "https://hedgehug.slack.com/customize/emoji" } : undefined);
