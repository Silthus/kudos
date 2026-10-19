import type { AlbumHoggie, AlbumHoggies as HoggiesAnswered, AlbumRarity } from "../../../convex/album/hoggies";
import type { MilestoneId } from "../../../convex/album/milestoneCatalogue";
import type { Denial } from "../../../convex/website/memberQuery";
import type { AppliedReward } from "../../../convex/progression/rewards";
import type { TeamArt } from "../crates/TeamCrest";
import type { Face, Message, Rarity } from "../shell";

export type AlbumMe = { name: string; face: Face; person: string; team: string | null };

export type AlbumLevel = { level: number; xp: number; startsAt: number; nextAt: number };

export type TeamState = "progress" | "ready" | "unlocked";

export type AlbumTeam = { team: string; name: string; art: TeamArt; mine: boolean; people: string[]; unmatched: string[]; held: number; total: number; state: TeamState; unlockedAt: number | null };

export type AlbumPerson = { person: string; name: string; face: Face; teams: string[]; held: boolean; packedThisWeek: boolean };

export type Thanked = { name: string | null; face: Face | null };

export type WaitingPack = { pack: string; person: string; earnedAt: number; thanked: Thanked };

export type TrayItem = { item: string; kind: "sticker"; person: string } | { item: string; kind: "hoggie"; hoggie: string; rarity: Rarity; isNew: boolean };

export type EarnedEmojiKind = "team" | "milestone" | "level" | "hype" | "random";

export type AlbumEmoji = { id: string; kind: EarnedEmojiKind; name: string; from: string; picture: string; earned: boolean; earnedAt: number | null; seen: boolean; inSlack: boolean; progress: { have: number; need: number } | null };

export type SharedEmoji = Pick<AlbumEmoji, "id" | "kind" | "name" | "from" | "picture" | "inSlack">;

export type MilestoneTierId = "bronze" | "silver" | "gold" | "diamond";

export type AlbumMilestone = { id: MilestoneId; count: number; tiers: { tier: MilestoneTierId; at: number; name: string; earnedAt: number | null }[] };

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
  moreEmojis: boolean;
  sharedEmojis: SharedEmoji[] | null;
  emojiPage: string | null;
  milestones: AlbumMilestone[];
  gettingStarted: GettingStarted | null;
};

export type AlbumAnswer = { kind: "off" } | Album;

export type MyAlbum = AlbumAnswer | Denial;

export type AlbumShown = MyAlbum | { kind: "connecting" } | { kind: "broken" };

export type AlbumRead = (asking: boolean) => AlbumShown | undefined;

export type PackOpenAnswer = { kind: "opened"; items: TrayItem[]; applied: AppliedReward | null } | { kind: "refused" };

export type PackOpenReply = PackOpenAnswer | Denial;

export type SeenAnswer = { kind: "seen"; ids: string[] } | { kind: "refused" };

export type SeenReply = SeenAnswer | Denial;

export type PutInAnswer = { kind: "placed"; item: TrayItem } | { kind: "refused" };

export type PutInReply = PutInAnswer | Denial;

export type PutAllInAnswer = { kind: "placed"; items: TrayItem[]; more: boolean } | { kind: "refused" };

export type PutAllInReply = PutAllInAnswer | Denial;

export type Standing = { rank: number; tied: boolean } | { rank: null; tied: false };

export type BoardPerson = { person: string; name: string; face: Face; teams: string[]; thoughtful: number; you: boolean } & Standing;

export type BoardTeam = { team: string; name: string; art: TeamArt; thoughtful: number; mine: boolean } & Standing;

export type ThoughtfulBoards = { kind: "boards"; people: BoardPerson[]; teams: BoardTeam[]; pinned: { me: BoardPerson | null; teams: BoardTeam[] }; onTheBoards: boolean };

export type BoardsShown = ThoughtfulBoards | { kind: "off" } | Denial | { kind: "connecting" } | { kind: "broken" };

export type BoardPeriod = "week" | "last-week" | "month" | "all";

export type BoardsRead = (asking: boolean, period: BoardPeriod) => BoardsShown | undefined;

export type WeekPerson = { person: string; name: string; face: Face };

export type PeopleListed = { people: WeekPerson[]; more: number };

export type HoggiesFound = { hoggies: { hoggie: string; rarity: Rarity }[]; more: number };

export type KudosOfTheWeek = { giver: WeekPerson; message: Message; permalink: string | null; at: number; hugs: number };

export type WeekKudos = { people: WeekPerson[]; morePeople: number; message: Message; at: number };

export type WeekKudosList = { kudos: WeekKudos[]; more: boolean };

export type WeekIssue = {
  kudosGiven: number;
  kudosReceived: number;
  thoughtfulGiven: number;
  thoughtfulReceived: number;
  hugsGiven: number;
  hugsReceived: number;
  packsOpened: number;
  days: number[];
  kudosOfWeek: KudosOfTheWeek | null;
  thanked: PeopleListed;
  thankedBy: PeopleListed;
  hugged: PeopleListed;
  huggedBy: PeopleListed;
  newFaces: PeopleListed;
  hoggies: HoggiesFound;
  given: WeekKudosList;
  received: WeekKudosList;
};

export type WeekTab = { week: string; days: number[] };

export type AlbumWeek = { kind: "week"; week: string; weeks: WeekTab[]; issue: WeekIssue | null };

export type WeekShown = AlbumWeek | { kind: "off" } | Denial | { kind: "connecting" } | { kind: "broken" };

export type WeekRead = (asking: boolean, week: string | undefined) => WeekShown | undefined;

export type TeamSticker = { team: string; name: string; art: TeamArt; emoji: string; at: number };

export type UnlockAnswer = { kind: "unlocked"; sticker: TeamSticker } | { kind: "refused" };

export type UnlockReply = UnlockAnswer | Denial;

export type PersonTeam = { team: string; name: string; art: TeamArt };

export type AlbumKudos = { message: Message; permalink: string | null; at: number };

export type PersonPage = {
  kind: "person";
  person: string;
  name: string;
  face: Face;
  held: boolean;
  firstThankedAt: number | null;
  kudosGiven: number;
  kudosReceived: number;
  hugsGiven: number;
  hugsReceived: number;
  best: AlbumKudos | null;
  teams: PersonTeam[];
  hype: { earned: boolean; name: string | null };
};

export type PersonShown = PersonPage | { kind: "off" } | { kind: "no-person" } | Denial | { kind: "connecting" } | { kind: "broken" };

export type PersonRead = (asking: boolean, person: string | null) => PersonShown | undefined;

export type { AlbumHoggie, AlbumRarity };

export type AlbumHoggies = { kind: "hoggies" } & HoggiesAnswered;

export type KindNote = { giver: WeekPerson; message: Message; permalink: string | null; at: number };

export type NewestPerson = WeekPerson & { at: number };

export type AlbumProfile = { kind: "profile"; note: KindNote | null; newest: NewestPerson[] };

export type ProfileShown = AlbumProfile | { kind: "off" } | Denial | { kind: "connecting" } | { kind: "broken" };

export type ProfileRead = (asking: boolean) => ProfileShown | undefined;

export type FoundHoggie = Pick<AlbumHoggie, "hoggie" | "name" | "rarity" | "firstAt">;

export type HoggiesShown = AlbumHoggies | { kind: "off" } | Denial | { kind: "connecting" } | { kind: "broken" };

export type HoggiesRead = (asking: boolean) => HoggiesShown | undefined;
