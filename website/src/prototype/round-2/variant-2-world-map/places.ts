// PROTOTYPE (#625): Hedgehog Land's geography: landmarks, team villages and the roads between them, in map units. Never merge to main.
import type { Quest, World } from "../../world";
import type { WindowId } from "./desk";

export type Point = [number, number];

export type LandmarkId = "square" | "market" | "library" | "post" | "hall";

export type PlaceId = LandmarkId | `village:${string}`;

export const mapSize = { width: 1600, height: 1000 };

export const hub: Point = [740, 560];

export const landmarks: Record<LandmarkId, { at: Point; name: string; does: string; road: Point[] }> = {
  square: { at: hub, name: "Town Square", does: "Leaderboard", road: [] },
  market: { at: [520, 470], name: "The Market", does: "Store and packs", road: [[680, 548], [600, 508], [520, 470]] },
  library: { at: [975, 455], name: "The Library", does: "Hoggie and Team books", road: [[800, 545], [880, 515], [975, 455]] },
  post: { at: [585, 735], name: "Post Office", does: "Activity", road: [[728, 640], [672, 700], [585, 735]] },
  hall: { at: [770, 285], name: "Hall of Fame", does: "Achievements", road: [[748, 480], [712, 420], [772, 360], [770, 285]] },
};

const villageSpots: { at: Point; road: Point[] }[] = [
  { at: [1010, 700], road: [[800, 600], [880, 650], [1010, 700]] },
  { at: [1135, 570], road: [[800, 545], [880, 515], [975, 455], [1060, 520], [1135, 570]] },
  { at: [1120, 320], road: [[800, 545], [880, 515], [975, 455], [1040, 385], [1120, 320]] },
  { at: [415, 300], road: [[680, 548], [600, 508], [520, 470], [460, 390], [415, 300]] },
  { at: [275, 545], road: [[680, 548], [600, 508], [520, 470], [395, 515], [275, 545]] },
  { at: [865, 845], road: [[728, 640], [770, 740], [865, 845]] },
  { at: [1130, 830], road: [[800, 600], [880, 650], [1010, 700], [1075, 775], [1130, 830]] },
];

export type Village = { id: `village:${string}`; team: string; at: Point; road: Point[] };

export function villagesOf(world: World): Village[] {
  return world.teams.slice(0, villageSpots.length).map((team, index) => ({ id: `village:${team.team}`, team: team.team, ...villageSpots[index]! }));
}

export function roadTo(place: PlaceId, villages: Village[]): Point[] {
  if (place.startsWith("village:")) return villages.find(({ id }) => id === place)?.road ?? [];
  return landmarks[place as LandmarkId].road;
}

export function pointOf(place: PlaceId, villages: Village[]): Point {
  if (place.startsWith("village:")) return villages.find(({ id }) => id === place)?.at ?? hub;
  return landmarks[place as LandmarkId].at;
}

export function journeyBetween(from: PlaceId, to: PlaceId, villages: Village[]): Point[] {
  const back = [...roadTo(from, villages)].reverse();
  return [pointOf(from, villages), ...back, hub, ...roadTo(to, villages)];
}

export function placeOfWindow(id: WindowId | null, teamHash: string): PlaceId | null {
  if (id === "market") return "market";
  if (id === "hall") return "hall";
  if (id === "leaderboard") return "square";
  if (id === "activity") return "post";
  if (id === "hoggies") return "library";
  if (id === "teams") {
    const team = /^#teams\/([^/]+)/.exec(teamHash)?.[1];
    return team === undefined ? "library" : `village:${team}`;
  }
  return null;
}

export function placeOfQuest(quest: Quest, world: World): PlaceId {
  if (quest.source === "group") return `village:${world.teams.find(({ mine }) => mine)?.team ?? world.teams[0]?.team ?? ""}`;
  if (quest.id === "journey:your-emoji") return "market";
  if (quest.id === "journey:someone-new") return "square";
  if (quest.goal.toLowerCase().includes("hug")) return "square";
  return "post";
}

export const bridges: { at: Point; angle: number }[] = [
  { at: [852, 530], angle: -18 },
  { at: [724, 652], angle: 70 },
  { at: [842, 624], angle: 30 },
];
