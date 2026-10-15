import { v, type Infer } from "convex/values";

export const messageKindValidator = v.union(
  v.literal("kudos-reply"),
  v.literal("tips"),
  v.literal("level-ups"),
  v.literal("new-features"),
  v.literal("quests"),
  v.literal("achievements"),
  v.literal("celebrations"),
);

export type MessageKind = Infer<typeof messageKindValidator>;

export const messagePlaceValidator = v.union(v.literal("channel"), v.literal("dm"), v.literal("none"));

export type MessagePlace = Infer<typeof messagePlaceValidator>;

export type MessageKindEntry = { kind: MessageKind; label: string; description: string };

export const messageKinds: readonly MessageKindEntry[] = [
  { kind: "kudos-reply", label: "After-kudos reply", description: "What a kudos you gave earned you, right after you send it." },
  { kind: "tips", label: "Tips", description: "Short tips on earning more, like saying why you're thanking someone." },
  { kind: "level-ups", label: "Level ups", description: "When you reach a level, with what it opens for you." },
  { kind: "new-features", label: "New features", description: "When a new feature is ready for you to open." },
  { kind: "quests", label: "Quests and Journey", description: "When you finish a quest or a Journey step." },
  { kind: "achievements", label: "Book tiers", description: "When you earn an achievement tier." },
  { kind: "celebrations", label: "Public celebrations", description: "Your level ups and tiers in the announcement channel." },
];

export const directMessageKinds: readonly MessageKind[] = ["level-ups", "new-features", "quests", "achievements"];

export const placesChosenFrom: Record<Exclude<MessageKind, "tips">, readonly MessagePlace[]> = {
  "kudos-reply": ["channel", "dm", "none"],
  "level-ups": ["dm", "channel", "none"],
  "new-features": ["dm", "none"],
  quests: ["dm", "channel", "none"],
  achievements: ["dm", "channel", "none"],
  celebrations: ["channel", "none"],
};
