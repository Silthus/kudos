import type { Denial } from "../../../convex/website/memberQuery";
import type { TeamArt } from "../crates/TeamCrest";
import type { Face, Rarity } from "../shell";

export type AlbumMe = { name: string; face: Face; person: string; team: string | null };

export type AlbumLevel = { level: number; xp: number; startsAt: number; nextAt: number };

export type TeamState = "progress" | "ready" | "unlocked";

export type AlbumTeam = { team: string; name: string; art: TeamArt; mine: boolean; people: string[]; held: number; total: number; state: TeamState; unlockedAt: number | null };

export type AlbumPerson = { person: string; name: string; face: Face; teams: string[]; held: boolean; packedThisWeek: boolean };

export type WaitingPack = { pack: string; person: string; earnedAt: number };

export type TrayItem = { item: string; kind: "sticker"; person: string } | { item: string; kind: "hoggie"; hoggie: string; rarity: Rarity; isNew: boolean };

export type EarnedEmojiKind = "team" | "milestone" | "level" | "hype";

export type AlbumEmoji = { id: string; kind: EarnedEmojiKind; name: string; picture: string; earned: boolean; seen: boolean; inSlack: boolean; progress: { have: number; need: number } | null };

export type MilestoneTierId = "bronze" | "silver" | "gold" | "diamond";

export type AlbumMilestone = { id: string; count: number; tiers: { tier: MilestoneTierId; at: number; name: string; earnedAt: number | null }[] };

export type GettingStarted = { hugged: boolean; thoughtful: boolean; opened: boolean; completed: boolean };

export type Album = {
  kind: "album";
  me: AlbumMe;
  level: AlbumLevel;
  teams: AlbumTeam[];
  people: AlbumPerson[];
  packs: WaitingPack[];
  morePacks: boolean;
  tray: TrayItem[];
  emojis: AlbumEmoji[];
  milestones: AlbumMilestone[];
  gettingStarted: GettingStarted | null;
};

export type AlbumAnswer = { kind: "off" } | Album;

export type MyAlbum = AlbumAnswer | Denial;

export type AlbumShown = MyAlbum | { kind: "connecting" } | { kind: "broken" };

export type AlbumRead = (asking: boolean) => AlbumShown | undefined;
