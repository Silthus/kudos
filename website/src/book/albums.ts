import type { AlbumPerson } from "../collectionRead";

export function albumWordsOf(people: AlbumPerson[]) {
  const names = (shown: AlbumPerson[]) => shown.map(({ name }) => name).join(", ");
  const held = people.filter((person) => person.held);
  const missing = people.filter((person) => !person.held);
  if (people.length === 0) return "No one else in this group yet.";
  if (missing.length === 0) return `Everyone here: ${names(held)}.`;
  return held.length === 0 ? `Still missing: ${names(missing)}.` : `Held: ${names(held)}. Still missing: ${names(missing)}.`;
}
