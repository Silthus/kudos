import type { AlbumHoggie, AlbumHoggies as HoggiesAnswered, AlbumRarity } from "../../../convex/album/hoggies";
import type { EmojiInPlace } from "../../../convex/album/emojiWizard";
import type { OwnHypePick } from "../../../convex/album/emojiMappings";
import type { KudosEmojiPick } from "../../../convex/album/kudosEmojis";
import type { Drop } from "../../../convex/hoggies/drops";
import type { Pet as AlbumPet } from "../../../convex/hoggies/pet";
import type { MilestoneId } from "../../../convex/album/milestoneCatalogue";
import type { ForgeAnswer, ItemBoard, LoopLesson, PetAnswer } from "../../../convex/website/album";
import type { GettingStarted, HowItWorksCard } from "../../../convex/website/onboarding";
import type { Denial } from "../../../convex/website/memberQuery";
import type { XpMomentAnswer } from "../../../convex/website/xpMoment";
import type { QuestsAnswer } from "../../../convex/website/quests";
import type { AppliedReward } from "../../../convex/progression/rewards";
import type { TeamArt } from "../crates/TeamCrest";
import type { Face, Message, Rarity } from "../shell";
import type { CardEmojisRead, CardWeek, PlayerCard, PlayerCardAnswer, PlayerCardRead as PlayerCardAnswered } from "../../../convex/website/playerCard";

export type AlbumMe = { name: string; face: Face; person: string; team: string | null };

export type AlbumLevel = { level: number; xp: number; startsAt: number; nextAt: number };

export type TeamState = "progress" | "ready" | "unlocked";

export type AlbumTeam = { team: string; name: string; art: TeamArt; mine: boolean; people: string[]; unmatched: string[]; held: number; total: number; state: TeamState; unlockedAt: number | null };

export type AlbumPerson = { person: string; name: string; face: Face; teams: string[]; held: boolean; packedThisWeek: boolean; at?: number };

export type Thanked = { name: string | null; face: Face | null };

export type WaitingPack = { pack: string; person: string; earnedAt: number; thanked: Thanked };

export type TrayItem = { item: string; kind: "sticker"; person: string; thanked: Thanked } | { item: string; kind: "hoggie"; hoggie: string; rarity: Rarity; isNew: boolean };

export type EarnedEmojiKind = "team" | "milestone" | "level" | "hype" | "random";

export type AlbumEmoji = { id: string; kind: EarnedEmojiKind; name: string; from: string; picture: string; earned: boolean; earnedAt: number | null; seen: boolean; inSlack: boolean; progress: { have: number; need: number } | null };

export type SharedEmoji = Pick<AlbumEmoji, "id" | "kind" | "name" | "from" | "picture" | "inSlack">;

export type MilestoneTierId = "bronze" | "silver" | "gold" | "diamond";

export type AlbumMilestone = { id: MilestoneId; count: number; tiers: { tier: MilestoneTierId; at: number; name: string; earnedAt: number | null; unlockedAt?: number }[] };

export type { AlbumPet };

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
  kudosEmojiPicks?: string[];
  sharedEmojis: SharedEmoji[] | null;
  emojiPage: string | null;
  emojiWizard: boolean;
  emojiInPlace: EmojiInPlace;
  milestones: AlbumMilestone[];
  gettingStarted: GettingStarted | null;
  board: ItemBoard | null;
  pets?: AlbumPet[];
  lastVisit?: number | null;
  emojiHowTo?: LoopLesson;
  howItWorks?: HowItWorksCard;
  shareableUrls?: true;
  linkPreviews?: true;
  personPageD?: true;
};

export type AlbumAnswer = { kind: "off" } | Album;

export type MyAlbum = AlbumAnswer | Denial;

export type AlbumShown = MyAlbum | { kind: "connecting" } | { kind: "broken" };

export type AlbumRead = (asking: boolean) => AlbumShown | undefined;

export type PackOpenAnswer = { kind: "opened"; items: TrayItem[]; applied: AppliedReward | null } | { kind: "refused" };

export type PackOpenReply = PackOpenAnswer | Denial;

export type SeenAnswer = { kind: "seen"; ids: string[] } | { kind: "refused" };

export type SeenReply = SeenAnswer | Denial;

export type KudosEmojiPickReply = KudosEmojiPick | Denial;

export type PickKudosEmoji = (emoji: string, picked: boolean) => Promise<KudosEmojiPickReply>;

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

export type AlbumWeek = { kind: "week"; week: string; thisWeek: string; weeks: WeekTab[]; issue: WeekIssue | null };

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
  hype: { earned: boolean; name: string | null; picture?: string | null; inSlack?: boolean };
  slackProfile: string | null;
  hypePick?: true;
};

export type PersonShown = PersonPage | { kind: "off" } | { kind: "no-person" } | Denial | { kind: "connecting" } | { kind: "broken" };

export type PersonRead = (asking: boolean, person: string | null) => PersonShown | undefined;

export type { AlbumHoggie, AlbumRarity };

export type AlbumHoggies = { kind: "hoggies" } & HoggiesAnswered & { pet?: string | null; forge?: true };

export type { PetAnswer };

export type PetReply = PetAnswer | Denial;

export type HypePickReply = OwnHypePick | Denial;
export type ForgeReply = ForgeAnswer | Denial;

export type KindNote = { giver: WeekPerson; message: Message; permalink: string | null; at: number };

export type NewestPerson = WeekPerson & { at: number };

export type AlbumProfile = { kind: "profile"; note: KindNote | null; newest: NewestPerson[] };

export type ProfileShown = AlbumProfile | { kind: "off" } | Denial | { kind: "connecting" } | { kind: "broken" };

export type ProfileRead = (asking: boolean) => ProfileShown | undefined;

export type FoundHoggie = Pick<AlbumHoggie, "hoggie" | "name" | "rarity" | "firstAt">;

export type HoggiesShown = AlbumHoggies | { kind: "off" } | Denial | { kind: "connecting" } | { kind: "broken" };

export type HoggiesRead = (asking: boolean) => HoggiesShown | undefined;

export type CardHoggie = Pick<Drop, "hoggie" | "name" | "rarity" | "isNew">;

export type AlbumLevelUp = { kind: "levelUp"; level: number; at: number; hoggies: CardHoggie[]; emojis: AlbumEmoji[] };

export type LevelUpShown = AlbumLevelUp | { kind: "off" } | { kind: "none" } | Denial | { kind: "connecting" } | { kind: "broken" };

export type LevelUpRead = (level: number | null) => LevelUpShown | undefined;

export type XpMomentShown = XpMomentAnswer | Denial | { kind: "connecting" } | { kind: "broken" };

export type XpMomentRead = (asking: boolean) => XpMomentShown | undefined;

export type QuestsShown = QuestsAnswer | Denial | { kind: "connecting" } | { kind: "broken" };

export type QuestsRead = (asking: boolean) => QuestsShown | undefined;

export type { CardWeek, PlayerCard, PlayerCardAnswer };

export type CardEmojis = Extract<CardEmojisRead, { kind: "emojis" }>;

export type PlayerCardShown = PlayerCardAnswered | Denial | { kind: "connecting" } | { kind: "broken" };

export type CardEmojisShown = CardEmojisRead | Denial | { kind: "connecting" } | { kind: "broken" };

export type PlayerCardReads = { card: PlayerCardShown | undefined; emojis: CardEmojisShown | undefined };

export type PlayerCardRead = (asking: boolean, person: string | null) => PlayerCardReads;
