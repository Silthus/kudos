// PROTOTYPE. Shapes follow the progression spec (P-rules) and the groups spec (G-rules).
// The website only reads facts like these; it never computes game rules.

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type Tier = "bronze" | "silver" | "gold" | "diamond";
export type CosmeticKind = "quip" | "card" | "title" | "emoji";
export type CosmeticSource = "store" | "achievement" | "drop" | "expression";

export type Member = { id: string; name: string; initials: string; hue: number };

export type Group = { id: string; name: string; members: number };

export type Me = Member & {
  level: number;
  xp: number;
  xpThisLevelStart: number;
  xpNextLevel: number;
  skillPointsUnspent: number;
  coins: number;
  kudosLeftToday: number;
  dailyAllowance: number;
  bonusKudosLeft: number;
  bonusKudosSize: number;
  kudosGiven: number;
  kudosReceived: number;
  streak: { days: number; best: number; hidden: boolean; freezesHeld: number };
  primaryGroup: Group;
  groups: Group[];
  privacy: { hideLevel: boolean; hideAchievements: boolean; muteNotices: boolean; showOnLeaderboards: boolean };
  loadout: { title: string; card: string; quips: string[]; emoji: string[] };
  boosters: Array<{ name: string; state: "waiting" | "running"; endsIn?: string }>;
};

export type PerkState =
  | { kind: "owned" }
  | { kind: "available" }
  | { kind: "needs-level"; level: number }
  | { kind: "needs-perk"; perk: string }
  | { kind: "cant-afford"; missing: string }
  | { kind: "needs-group" };

export type Perk = {
  id: string;
  name: string;
  branch: string;
  effect: string;
  minLevel: number;
  skillPoints?: number;
  coins?: number;
  requires?: string;
  group?: boolean;
  state: PerkState;
};

export type Branch = { id: string; name: string; blurb: string; icon: string };

export type LadderTier = { tier: Tier; threshold: number; name: string; reward: string; earned: boolean };

export type Ladder = { id: string; name: string; counts: string; count: number; tiers: LadderTier[] };

export type Cosmetic = {
  id: string;
  kind: CosmeticKind;
  name: string;
  rarity: Rarity;
  source: CosmeticSource;
  owned: boolean;
  preview: string;
};

export type Sticker = { member: Member; thanked: boolean; thankedMe: boolean; since: string };

export type Album = { group: Group; held: number; pages: number; complete: boolean; mine: boolean; missing: Member[] };

export type Period = "week" | "month" | "all";

export type BoardRow =
  | { kind: "row"; position: number; rank: number; name: string; kudos: number; me?: boolean; initials: string; hue: number }
  | { kind: "gap" };

export type GroupRow =
  | { kind: "row"; position: number; rank: number; group: string; score: number; participation: number; total: number; mine?: boolean }
  | { kind: "gap" };

export type Boards = {
  groups: { rows: GroupRow[]; myGroupLine?: string; mostImproved?: string };
  myGroup: { rows: BoardRow[] };
  everyone: { rows: BoardRow[]; improvementLine?: string; peerLine?: string };
};

export type DeepLink =
  | { from: "app-home"; target: string }
  | { from: "level-up"; level: number; points: number; nextXp: number }
  | { from: "kudos"; giver: Member; text: string; newSticker: boolean; coins: number; drop?: { rarity: Rarity; kind: CosmeticKind; name: string } }
  | { from: "achievement"; tierName: string; ladder: string; tier: Tier; reward: string };
