import type { Album, AlbumTeam, TrayItem } from "./answer";

type TraySticker = Extract<TrayItem, { kind: "sticker" }>;

export type Destination = { kind: "team"; team: AlbumTeam; after: number; completes: boolean } | { kind: "album" } | { kind: "held" } | { kind: "hoggies" };

export type Slot = "hoggies" | "home" | `team:${string}`;

export function destinationOf(album: Album, item: TrayItem): Destination {
  if (item.kind === "hoggie") return { kind: "hoggies" };
  if (isHeld(album, item.person)) return { kind: "held" };
  const team = teamPageOf(album, item.person);
  if (team === undefined) return { kind: "album" };
  const after = Math.min(team.total, team.held + 1);
  return { kind: "team", team, after, completes: completes(team) };
}

export function slotOf(album: Album, item: TrayItem): Slot {
  const destination = destinationOf(album, item);
  if (destination.kind === "hoggies") return "hoggies";
  return destination.kind === "team" ? `team:${destination.team.team}` : "home";
}

export function albumWithLanded(album: Album, landed: readonly TrayItem[]): Album {
  if (landed.length === 0) return album;
  const gone = new Set(landed.map(({ item }) => item));
  const arriving = new Set(landed.filter(isSticker).map(({ person }) => person).filter((person) => !isHeld(album, person)));
  return {
    ...album,
    tray: album.tray.filter(({ item }) => !gone.has(item)),
    people: album.people.map((person) => (arriving.has(person.person) ? { ...person, held: true } : person)),
    teams: album.teams.map((team) => withArrivals(team, arriving)),
  };
}

function isSticker(item: TrayItem): item is TraySticker {
  return item.kind === "sticker";
}

function isHeld(album: Album, person: string) {
  return album.people.some((listed) => listed.person === person && listed.held);
}

function teamPageOf(album: Album, person: string): AlbumTeam | undefined {
  const pages = album.teams.filter(({ people }) => people.includes(person));
  return pages.find(completes) ?? pages.find(({ mine }) => mine) ?? pages[0];
}

function completes(team: AlbumTeam) {
  return team.state === "progress" && team.held + 1 === team.total;
}

export function withTrayItems(album: Album, items: readonly TrayItem[]): Album {
  const listed = new Set(album.tray.map(({ item }) => item));
  const arriving = items.filter(({ item }) => !listed.has(item));
  return arriving.length === 0 ? album : { ...album, tray: [...album.tray, ...arriving] };
}

function withArrivals(team: AlbumTeam, arriving: ReadonlySet<string>): AlbumTeam {
  const joining = team.people.filter((person) => arriving.has(person)).length;
  if (joining === 0) return team;
  const held = Math.min(team.total, team.held + joining);
  return { ...team, held, state: team.state === "progress" && held === team.total ? "ready" : team.state };
}
