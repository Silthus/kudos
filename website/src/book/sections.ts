import type { Collection } from "../collectionRead";

export type SectionId = "hoggies" | "team-crests" | "stickers" | "group-albums";

export type CollectionSection = { id: SectionId; name: string };

export function sectionsOf({ crests, stickers, albums }: Collection): CollectionSection[] {
  return [
    { id: "hoggies", name: "Hoggies" },
    ...(crests === undefined ? [] : [{ id: "team-crests" as const, name: "Team crests" }]),
    ...(stickers === undefined ? [] : [{ id: "stickers" as const, name: "Stickers" }]),
    ...(albums === undefined ? [] : [{ id: "group-albums" as const, name: "Group albums" }]),
  ];
}

export function headingIdOf(id: SectionId) {
  return `${id}-heading`;
}
