// PROTOTYPE (#625, round 6): what the team and person pages read from the album: members, the next step to a full team, the team sticker, the emojis and the hrefs. Never merge to main.
import type { Album, Emoji, Pack, Person, Team } from "../../../round-3/album";
import { firstNameOf, listOfNames } from "../../../round-3/variant-2-team-yearbook/parts";
import { hrefOf } from "../../address";

export { dateOf, firstNameOf, listOfNames, whenOf } from "../../../round-3/variant-2-team-yearbook/parts";

export function teamNamed(album: Album, team: string): Team {
  return album.teams.find((entry) => entry.team === team) ?? album.teams.find(({ mine }) => mine)!;
}

export function membersOf(album: Album, team: Team): Person[] {
  const members = team.people.flatMap((key) => album.people.filter((person) => person.key === key));
  return members.toSorted((first, second) => Number(second.lead) - Number(first.lead) || first.name.localeCompare(second.name));
}

export function isCollected(person: Person) {
  return person.collectedAt !== null;
}

export function teamHref(team: Team) {
  return hrefOf({ kind: "team", team: team.mine ? null : team.team });
}

export function personHref(person: Person) {
  return hrefOf({ kind: "person", key: person.key });
}

export function packFor(album: Album, person: Person): Pack | undefined {
  return album.packs.find((pack) => pack.person === person.key);
}

export function isInTray(album: Album, person: Person) {
  return album.tray.some((opening) => opening.person.key === person.key);
}

export function teamsOfPerson(album: Album, person: Person): Team[] {
  return person.teams.flatMap((key) => album.teams.filter(({ team }) => team === key));
}

export type NextStep = { kind: "complete" } | { kind: "in-tray"; person: Person; completes: boolean } | { kind: "open-pack"; person: Person; completes: boolean } | { kind: "thank"; people: Person[]; completes: boolean };

export function nextStepOf(album: Album, team: Team): NextStep {
  const missing = membersOf(album, team).filter((person) => !isCollected(person));
  if (missing.length === 0) return { kind: "complete" };
  const trayed = missing.find((person) => isInTray(album, person));
  if (trayed !== undefined) return { kind: "in-tray", person: trayed, completes: missing.length === 1 };
  const waiting = missing.find((person) => packFor(album, person) !== undefined);
  if (waiting !== undefined) return { kind: "open-pack", person: waiting, completes: missing.length === 1 };
  return { kind: "thank", people: missing, completes: missing.length === 1 };
}

export function nextStepWords(step: NextStep, team: Team) {
  if (step.kind === "complete") return team.claimedAt === null ? `Every ${team.name} card is in. Unlock your team sticker!` : `Every ${team.name} card is in your album.`;
  if (step.kind === "in-tray") return step.completes ? `${firstNameOf(step.person.name)} is in your tray: put the card in from the top bar to complete ${team.name}.` : `${firstNameOf(step.person.name)} is in your tray: put the card in from the top bar.`;
  if (step.kind === "open-pack") return step.completes ? `Open ${firstNameOf(step.person.name)}'s pack to complete ${team.name}.` : `${firstNameOf(step.person.name)}'s pack is waiting: open it to add them.`;
  if (step.completes) return `Thank ${firstNameOf(step.people[0]!.name)} to complete ${team.name}.`;
  if (team.held === 0) return `Thank anyone on ${team.name} in Slack to start this page.`;
  return `Thank ${namesToThank(step.people)} to complete ${team.name}.`;
}

function namesToThank(people: Person[]) {
  const firsts = people.map(({ name }) => firstNameOf(name));
  if (firsts.length <= 3) return listOfNames(firsts);
  return `${firsts.slice(0, 2).join(", ")} and ${firsts.length - 2} more`;
}

export function howToCollect(album: Album, person: Person) {
  const first = firstNameOf(person.name);
  if (isInTray(album, person)) return `${first}'s card is in your tray. Put it in from the top bar.`;
  if (packFor(album, person) !== undefined) return `${first}'s pack is waiting. Open it to add ${first} to your album.`;
  if (person.packedThisWeek) return `You thanked ${first} this week. Their next pack comes next week.`;
  return `Give ${first} a thoughtful kudos in Slack: thank them and say why. Their sticker comes in the pack.`;
}

export function leadsLine(team: Team) {
  return team.leads.length === 0 ? "" : `Led by ${listOfNames(team.leads)}`;
}

export function shareOf(team: Team) {
  return team.total === 0 ? 0 : team.held / team.total;
}

export type StickerState = "collecting" | "ready" | "unlocked";

export function stickerStateOf(team: Team): StickerState {
  if (!team.complete) return "collecting";
  return team.claimedAt === null ? "ready" : "unlocked";
}

export function teamEmojiOf(album: Album, team: Team): Emoji | undefined {
  return album.emojis.find(({ id }) => id === teamEmojiId(team));
}

export function teamEmojiId(team: Team) {
  return `team:${team.team}`;
}

export function hypeEmojiOf(album: Album, person: Person): Emoji | undefined {
  return album.emojis.find(({ id }) => id === `hype:${person.key}`);
}
