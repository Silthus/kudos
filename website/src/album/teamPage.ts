import type { Album, AlbumEmoji, AlbumPerson, AlbumTeam } from "./answer";

export type OnThePhoto = { kind: "person"; person: AlbumPerson } | { kind: "unmatched"; name: string };

export type NextStep = { kind: "in-tray"; person: AlbumPerson } | { kind: "open-pack"; person: AlbumPerson } | { kind: "thank"; people: AlbumPerson[] };

export function onThePhotoOf(album: Album, team: AlbumTeam): OnThePhoto[] {
  const people = team.people.map((person): OnThePhoto => ({ kind: "person", person: personIn(album, person) }));
  return [...people, ...team.unmatched.map((name): OnThePhoto => ({ kind: "unmatched", name }))];
}

export function personIn(album: Album, person: string): AlbumPerson {
  return album.people.find((listed) => listed.person === person) ?? { person, name: "A teammate", face: { kind: "initials", initials: "?" }, teams: [], held: false, packedThisWeek: false };
}

export function nameOnThePhoto(shown: OnThePhoto) {
  return shown.kind === "person" ? shown.person.name : shown.name;
}

export function nextStepOf(album: Album, team: AlbumTeam): NextStep | null {
  const missing = team.people.map((person) => personIn(album, person)).filter(({ held }) => !held);
  if (missing.length === 0) return null;
  const trayed = missing.find((person) => isInTheTray(album, person.person));
  if (trayed !== undefined) return { kind: "in-tray", person: trayed };
  const waiting = missing.find((person) => hasAPackWaiting(album, person.person));
  if (waiting !== undefined) return { kind: "open-pack", person: waiting };
  return { kind: "thank", people: missing };
}

export function nextStepWords(step: NextStep, team: AlbumTeam) {
  const completes = team.total - team.held === 1;
  const toComplete = completes ? ` to complete ${team.name}` : "";
  switch (step.kind) {
    case "in-tray":
      return `${firstNameOf(step.person.name)} is in your tray: put the card in${toComplete}.`;
    case "open-pack":
      return completes ? `Open ${firstNameOf(step.person.name)}'s pack to complete ${team.name}.` : `${firstNameOf(step.person.name)}'s pack is waiting: open it to add them.`;
    case "thank":
      if (team.held === 0) return `Give anyone on ${team.name} a thoughtful kudos to start this page.`;
      return `Give ${namesOf(step.people)} a thoughtful kudos to complete ${team.name}.`;
  }
}

function namesOf(people: AlbumPerson[]) {
  const firsts = people.map(({ name }) => firstNameOf(name));
  if (firsts.length <= 3) return listOf(firsts);
  return `${firsts.slice(0, 2).join(", ")} and ${firsts.length - 2} more`;
}

function listOf(words: string[]) {
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

export function howToCollectWords(album: Album, person: string, name: string) {
  const first = firstNameOf(name);
  if (isInTheTray(album, person)) return `${first}'s card is in your tray. Put it in from the top bar.`;
  if (hasAPackWaiting(album, person)) return `${first}'s pack is waiting. Open it from your packs to add ${first} to your album.`;
  return `Give ${first} a thoughtful kudos in Slack: thank them and say why. Their sticker comes in the pack.`;
}

function isInTheTray(album: Album, person: string) {
  return album.tray.some((item) => item.kind === "sticker" && item.person === person);
}

function hasAPackWaiting(album: Album, person: string) {
  return album.packs.some((pack) => pack.person === person);
}

export function teamEmojiOf(album: Album, team: string): AlbumEmoji | undefined {
  return album.emojis.find(({ id }) => id === `team:${team}`);
}

export function inSlackWords(emoji: AlbumEmoji | undefined) {
  return emoji?.inSlack === true ? "use it in Slack: react with it or put it in a kudos" : null;
}

export function firstNameOf(name: string) {
  return name.split(/\s+/, 1)[0] ?? name;
}

const dayMonthAndYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function dateOf(at: number) {
  return dayMonthAndYear.format(at);
}
