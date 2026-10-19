import type { Album, AlbumEmoji, AlbumPerson, AlbumTeam } from "./answer";

export type OnThePhoto = { kind: "person"; person: AlbumPerson } | { kind: "unmatched"; name: string };

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

const howToUseIt = "react with it and put it in the kudos you give";

export function teamEmojiUseWords(emoji: AlbumEmoji) {
  return emoji.inSlack ? `Use it in Slack: ${howToUseIt}.` : `It isn't in Slack yet: add it, then ${howToUseIt}.`;
}

export function newTeamEmojiWords(emoji: AlbumEmoji | undefined) {
  if (emoji?.inSlack === true) return `Your new team emoji. Use it in Slack: ${howToUseIt}.`;
  return `Your new team emoji. Add it to Slack from this page, then ${howToUseIt}.`;
}

export function firstNameOf(name: string) {
  return name.split(/\s+/, 1)[0] ?? name;
}

const dayMonthAndYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function dateOf(at: number) {
  return dayMonthAndYear.format(at);
}
