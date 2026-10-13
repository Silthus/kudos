// PROTOTYPE mock facts. Every name here is fictional. Numbers are made up to exercise the screens.
import type { Album, Boards, Branch, Cosmetic, DeepLink, Group, Ladder, Me, Member, Perk, Period, Sticker, Tier } from "./types";

const m = (id: string, name: string, hue: number): Member => ({
  id,
  name,
  hue,
  initials: name.split(" ").map((p) => p[0]).join("").slice(0, 2),
});

export const members: Member[] = [
  m("u1", "Ada Lindqvist", 18),
  m("u2", "Bo Okafor", 200),
  m("u3", "Cleo Marchetti", 320),
  m("u4", "Dev Raman", 140),
  m("u5", "Edda Brandt", 40),
  m("u6", "Felix Ono", 260),
  m("u7", "Gia Duarte", 90),
  m("u8", "Hugo Lefèvre", 0),
  m("u9", "Iris Novak", 170),
  m("u10", "Jun Park", 290),
  m("u11", "Kai Mensah", 60),
  m("u12", "Lena Vogt", 230),
  m("u13", "Milo Sato", 110),
  m("u14", "Nora Quinn", 340),
  m("u15", "Omar Haddad", 25),
  m("u16", "Pia Holm", 190),
];

export const groups: Group[] = [
  { id: "g1", name: "Team Bramble", members: 7 },
  { id: "g2", name: "Team Burrow", members: 9 },
  { id: "g3", name: "Team Acorn", members: 5 },
  { id: "g4", name: "Team Thistle", members: 11 },
  { id: "g5", name: "Team Moss", members: 6 },
];

export const me: Me = {
  ...m("me", "Robin Hale", 28),
  level: 8,
  xp: 2470,
  xpThisLevelStart: 2100,
  xpNextLevel: 2800,
  skillPointsUnspent: 2,
  coins: 236,
  kudosLeftToday: 3,
  dailyAllowance: 5,
  bonusKudosLeft: 0,
  bonusKudosSize: 0,
  kudosGiven: 142,
  kudosReceived: 97,
  streak: { days: 8, best: 8, hidden: false, freezesHeld: 1 },
  primaryGroup: groups[0],
  groups: [groups[0], groups[3]],
  privacy: { hideLevel: false, hideAchievements: false, muteNotices: false, showOnLeaderboards: true },
  loadout: {
    title: "Thank-you Machine",
    card: "Paper High-Five",
    quips: ["You absolute legend.", "Hedgehog-approved work."],
    emoji: ["🦔", "🙌", "🌟"],
  },
  boosters: [
    { name: "XP booster", state: "running", endsIn: "4 days" },
    { name: "Discovery Lantern", state: "waiting" },
  ],
};

export const branches: Branch[] = [
  { id: "daily", name: "Daily", blurb: "Reward your first thank-you of the day.", icon: "☀️" },
  { id: "weekly", name: "Weekly", blurb: "Reward steady weeks.", icon: "📅" },
  { id: "active", name: "Active", blurb: "Switch on for a busy day.", icon: "⚡" },
  { id: "breadth", name: "Breadth", blurb: "Reward thanking new people.", icon: "🧭" },
  { id: "receiving", name: "Receiving", blurb: "Reward being thanked by many.", icon: "🎁" },
  { id: "capacity", name: "Capacity", blurb: "Bonus kudos for big weeks.", icon: "🫙" },
  { id: "discovery", name: "Discovery", blurb: "Find cosmetics more often.", icon: "🔍" },
  { id: "expression", name: "Expression", blurb: "Pick cosmetics you like.", icon: "🎨" },
  { id: "group", name: "Group", blurb: "Auras for your whole group.", icon: "🦔" },
];

export const perks: Perk[] = [
  { id: "spark", name: "Spark", branch: "daily", effect: "+5 XP on the first qualifying recognition of each workday", minLevel: 2, skillPoints: 1, state: { kind: "owned" } },
  { id: "flame", name: "Flame", branch: "daily", effect: "Spark becomes +9 XP", minLevel: 6, skillPoints: 2, coins: 150, requires: "spark", state: { kind: "available" } },
  { id: "rhythm", name: "Rhythm", branch: "weekly", effect: "A recognition every workday of a week: +9 XP × those workdays", minLevel: 3, skillPoints: 2, state: { kind: "available" } },
  { id: "cadence", name: "Cadence", branch: "weekly", effect: "Rhythm becomes +16 XP × workdays", minLevel: 9, skillPoints: 3, coins: 300, requires: "rhythm", state: { kind: "needs-level", level: 9 } },
  { id: "focus", name: "Focus", branch: "active", effect: "Switch on one day a week: +12 XP on that day's next three qualifying recognitions", minLevel: 3, skillPoints: 2, state: { kind: "owned" } },
  { id: "spotlight", name: "Spotlight", branch: "active", effect: "Focus becomes +24 XP", minLevel: 7, skillPoints: 3, coins: 200, requires: "focus", state: { kind: "cant-afford", missing: "1 skill point" } },
  { id: "circle", name: "Circle", branch: "breadth", effect: "+5 XP on the first qualifying recognition to each person in your week", minLevel: 3, skillPoints: 2, state: { kind: "owned" } },
  { id: "bridge", name: "Bridge", branch: "breadth", effect: "+4 XP on the first qualifying recognition to each person in your month", minLevel: 7, skillPoints: 2, coins: 150, requires: "circle", state: { kind: "available" } },
  { id: "echo", name: "Echo", branch: "receiving", effect: "+2 XP on the first thoughtful kudos from each giver in your week", minLevel: 3, skillPoints: 2, state: { kind: "available" } },
  { id: "resonance", name: "Resonance", branch: "receiving", effect: "Echo becomes +6 XP", minLevel: 7, skillPoints: 3, coins: 200, requires: "echo", state: { kind: "needs-perk", perk: "Echo" } },
  { id: "reserve", name: "Reserve", branch: "capacity", effect: "Weekly reserve +2 bonus kudos", minLevel: 4, skillPoints: 2, state: { kind: "available" } },
  { id: "reservoir", name: "Reservoir", branch: "capacity", effect: "Your reserve becomes +4 bonus kudos", minLevel: 9, skillPoints: 3, coins: 350, requires: "reserve", state: { kind: "needs-level", level: 9 } },
  { id: "curiosity", name: "Curiosity", branch: "discovery", effect: "Drop rates +25% of base", minLevel: 2, skillPoints: 1, state: { kind: "available" } },
  { id: "fortune", name: "Fortune", branch: "discovery", effect: "Another +25% of base", minLevel: 6, skillPoints: 2, coins: 150, requires: "curiosity", state: { kind: "needs-perk", perk: "Curiosity" } },
  { id: "fieldnotes", name: "Field Notes", branch: "discovery", effect: "+25% of base on the first qualifying recognition to each person in your week", minLevel: 4, skillPoints: 2, state: { kind: "available" } },
  { id: "signature", name: "Signature", branch: "expression", effect: "Choose one named common cosmetic", minLevel: 2, coins: 120, state: { kind: "owned" } },
  { id: "gallery", name: "Gallery", branch: "expression", effect: "Choose three named cosmetics", minLevel: 6, coins: 450, requires: "signature", state: { kind: "cant-afford", missing: "214 coins" } },
  { id: "keepsake", name: "Keepsake", branch: "expression", effect: "Every 28 days, choose one of 12 named cosmetics", minLevel: 4, coins: 300, state: { kind: "cant-afford", missing: "64 coins" } },
  { id: "rally", name: "Rally", branch: "group", effect: "Group aura: +1 XP on every qualifying recognition by opted-in members", minLevel: 5, skillPoints: 3, group: true, state: { kind: "cant-afford", missing: "1 skill point" } },
  { id: "beacon", name: "Beacon", branch: "group", effect: "Group aura: drop rates +15% of base for opted-in members", minLevel: 5, skillPoints: 3, group: true, state: { kind: "cant-afford", missing: "1 skill point" } },
  { id: "provision", name: "Provision", branch: "group", effect: "Group aura: weekly reserve +1 for opted-in members", minLevel: 5, skillPoints: 3, group: true, state: { kind: "cant-afford", missing: "1 skill point" } },
];

const ladder = (id: string, name: string, counts: string, count: number, t: Array<[number, string, string]>): Ladder => {
  const tiers: Tier[] = ["bronze", "silver", "gold", "diamond"];
  return {
    id,
    name,
    counts,
    count,
    tiers: t.map(([threshold, tierName, reward], i) => ({ tier: tiers[i], threshold, name: tierName, reward, earned: count >= threshold })),
  };
};

export const ladders: Ladder[] = [
  ladder("generosity", "Generosity", "kudos given", 142, [[1, "First Thanks", "Title: The Thankful"], [25, "Generous Soul", "Card: Open Hands"], [100, "Heart of the Team", "Quip: “Heart of gold.”"], [500, "Patron of Praise", "Card: Golden Laurel"]]),
  ladder("recognition", "Recognition", "kudos received", 97, [[1, "Noticed", "Emoji: 👀"], [25, "Appreciated", "Title: The Appreciated"], [100, "Highly Valued", "Card: Gilded Frame"], [500, "Hall of Fame", "Title: Hall of Famer"]]),
  ladder("connections", "Connections", "different people thanked", 14, [[3, "Friendly Face", "Quip: “Hi friend!”"], [6, "Connector", "Card: String Lights"], [12, "Social Butterfly", "Emoji: 🦋"], [24, "Constellation Maker", "Card: Star Map"]]),
  ladder("momentum", "Momentum", "best streak", 8, [[5, "Warming Up", "Emoji: 🔥"], [10, "On a Roll", "Title: On a Roll"], [25, "Unstoppable", "Card: Rolling Hog"], [60, "Perpetual Motion", "Card: Infinite Loop"]]),
  ladder("dependability", "Dependability", "days with a kudos given", 64, [[10, "Regular", "Title: The Regular"], [30, "Mainstay", "Card: Sturdy Oak"], [100, "Pillar", "Title: Pillar"], [250, "Cornerstone", "Card: Cornerstone"]]),
  ladder("applause", "Applause", "days thanking 3+ different people", 7, [[3, "Shout-out", "Emoji: 📣"], [10, "Hype Squad", "Quip: “Make some noise!”"], [30, "Thunderous Applause", "Card: Thunderclap"], [100, "Grand Chorus", "Title: The Chorus"]]),
  ladder("seasons", "Seasons", "calendar months with a kudos given", 7, [[1, "First Chapter", "Card: Blank Page"], [3, "Season of Thanks", "Emoji: 🍂"], [6, "Half-Year Hero", "Title: Half-Year Hero"], [12, "Year of Gratitude", "Card: Four Seasons"]]),
  ladder("old-friends", "Old Friends", "thanking someone again 30+ days later", 2, [[1, "Remembered", "Quip: “Long time no thank!”"], [3, "Old Friends", "Card: Polaroid"], [6, "Long Memory", "Title: Elephant Memory"], [12, "Evergreen", "Card: Evergreen"]]),
  ladder("team-spirit", "Team Spirit", "sticker albums completed", 1, [[1, "Team Spirit", "Card: Team Photo"], [2, "All Hands", "Emoji: 🤝"], [4, "Tight-Knit", "Title: Tight-Knit"], [8, "Unbreakable Crew", "Card: Crew Crest"]]),
  ladder("crowd-favourite", "Crowd Favourite", "chime-ins on kudos you gave", 12, [[5, "Crowd Pleaser", "Quip: “The crowd goes wild.”"], [10, "Rallying Cry", "Emoji: 📯"], [20, "Talk of the Town", "Card: Town Square"], [50, "Living Legend", "Title: Living Legend"]]),
  ladder("standing-ovation", "Standing Ovation", "most chime-ins on one kudos you got", 4, [[3, "Applauded", "Emoji: 👏"], [10, "Encore", "Quip: “Encore!”"], [20, "Crowd Roar", "Card: Stage Lights"], [50, "Stadium Legend", "Title: Stadium Legend"]]),
  ladder("amplifier", "Amplifier", "times you chimed in", 31, [[5, "Joined In", "Emoji: ➕"], [25, "Backup Vocals", "Title: Backup Vocals"], [100, "Amplifier", "Card: Big Speaker"], [500, "One-Person Crowd", "Title: One-Person Crowd"]]),
];

const c = (id: string, kind: Cosmetic["kind"], name: string, rarity: Cosmetic["rarity"], source: Cosmetic["source"], owned: boolean, preview: string): Cosmetic => ({ id, kind, name, rarity, source, owned, preview });

export const cosmetics: Cosmetic[] = [
  c("card-paper-high-five", "card", "Paper High-Five", "uncommon", "drop", true, "🙌"),
  c("card-open-hands", "card", "Open Hands", "rare", "achievement", true, "🤲"),
  c("card-sturdy-oak", "card", "Sturdy Oak", "rare", "achievement", true, "🌳"),
  c("card-coffee-cheers", "card", "Coffee Cheers", "common", "store", true, "☕"),
  c("card-hog-on-a-bike", "card", "Hog on a Bike", "epic", "drop", true, "🚲"),
  c("card-rocket-launch", "card", "Rocket Launch", "legendary", "store", false, "🚀"),
  c("card-sunny-desk", "card", "Sunny Desk", "common", "expression", true, "🌤️"),
  c("card-string-lights", "card", "String Lights", "rare", "achievement", true, "✨"),
  c("title-thank-you-machine", "title", "Thank-you Machine", "rare", "store", true, "🏷️"),
  c("title-the-thankful", "title", "The Thankful", "common", "achievement", true, "🏷️"),
  c("title-the-regular", "title", "The Regular", "uncommon", "achievement", true, "🏷️"),
  c("title-chief-cheerleader", "title", "Chief Cheerleader", "epic", "store", false, "🏷️"),
  c("quip-legend", "quip", "You absolute legend.", "common", "store", true, "💬"),
  c("quip-hog-approved", "quip", "Hedgehog-approved work.", "uncommon", "drop", true, "💬"),
  c("quip-hi-friend", "quip", "Hi friend!", "common", "achievement", true, "💬"),
  c("quip-heart-of-gold", "quip", "Heart of gold.", "rare", "achievement", true, "💬"),
  c("quip-ship-it", "quip", "Ship it, superstar.", "uncommon", "store", false, "💬"),
  c("emoji-hog", "emoji", "Hedgehog", "uncommon", "drop", true, "🦔"),
  c("emoji-raised-hands", "emoji", "Raised hands", "common", "store", true, "🙌"),
  c("emoji-star", "emoji", "Glowing star", "rare", "drop", true, "🌟"),
  c("emoji-butterfly", "emoji", "Butterfly", "rare", "achievement", true, "🦋"),
  c("emoji-fire", "emoji", "Fire", "common", "achievement", true, "🔥"),
  c("emoji-crown", "emoji", "Crown", "legendary", "drop", false, "👑"),
];

export const dropOdds: Array<{ rarity: Cosmetic["rarity"]; chance: string }> = [
  { rarity: "common", chance: "6%" },
  { rarity: "uncommon", chance: "2.5%" },
  { rarity: "rare", chance: "0.8%" },
  { rarity: "epic", chance: "0.2%" },
  { rarity: "legendary", chance: "0.04%" },
];

export const stickers: Sticker[] = members.slice(0, 13).map((member, i) => ({
  member,
  thanked: i % 4 !== 3,
  thankedMe: i % 3 !== 1,
  since: ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"][i % 7],
}));

export const albums: Album[] = [
  { group: groups[0], held: 6, pages: 6, complete: true, mine: true, missing: [] },
  { group: groups[3], held: 7, pages: 10, complete: false, mine: true, missing: [members[13], members[14], members[15]] },
  { group: groups[1], held: 4, pages: 9, complete: false, mine: false, missing: members.slice(5, 10) },
  { group: groups[2], held: 1, pages: 5, complete: false, mine: false, missing: members.slice(10, 14) },
  { group: groups[4], held: 0, pages: 6, complete: false, mine: false, missing: members.slice(0, 6) },
];

const row = (position: number, rank: number, who: Member | "me", kudos: number) =>
  who === "me"
    ? ({ kind: "row", position, rank, name: me.name, kudos, me: true, initials: me.initials, hue: me.hue } as const)
    : ({ kind: "row", position, rank, name: who.name, kudos, initials: who.initials, hue: who.hue } as const);

export const boards: Record<Period, Boards> = {
  week: {
    groups: {
      rows: [
        { kind: "row", position: 1, rank: 1, group: "Team Acorn", score: 4.2, participation: 100, total: 21 },
        { kind: "row", position: 2, rank: 2, group: "Team Bramble", score: 3.6, participation: 86, total: 25, mine: true },
        { kind: "row", position: 3, rank: 3, group: "Team Moss", score: 2.8, participation: 67, total: 17 },
        { kind: "row", position: 4, rank: 4, group: "Team Burrow", score: 2.1, participation: 78, total: 19 },
        { kind: "row", position: 5, rank: 5, group: "Team Thistle", score: 1.9, participation: 55, total: 21 },
      ],
      myGroupLine: "▲ 0.8 more per person than this time last week · ▲ 1 places",
      mostImproved: "Team Moss",
    },
    myGroup: {
      rows: [row(1, 1, members[0], 7), row(2, 2, "me", 6), row(3, 3, members[2], 5), row(4, 4, members[4], 3), row(5, 4, members[6], 3), row(6, 6, members[8], 1)],
    },
    everyone: {
      rows: [
        row(1, 1, members[0], 7),
        row(2, 2, members[1], 6),
        row(3, 2, "me", 6),
        row(4, 4, members[2], 5),
        row(5, 5, members[3], 4),
        row(6, 5, members[9], 4),
        row(7, 7, members[4], 3),
        row(8, 7, members[6], 3),
        row(9, 7, members[11], 3),
        row(10, 10, members[12], 2),
      ],
      improvementLine: "▲ 2 more kudos than this time last week · ▲ 4 places",
      peerLine: "You improved more than 60% of Team Bramble.",
    },
  },
  month: {
    groups: {
      rows: [
        { kind: "row", position: 1, rank: 1, group: "Team Acorn", score: 14.4, participation: 100, total: 72 },
        { kind: "row", position: 2, rank: 2, group: "Team Moss", score: 11.0, participation: 83, total: 66 },
        { kind: "row", position: 3, rank: 3, group: "Team Burrow", score: 9.3, participation: 89, total: 84 },
        { kind: "row", position: 4, rank: 4, group: "Team Bramble", score: 8.9, participation: 86, total: 62, mine: true },
        { kind: "row", position: 5, rank: 5, group: "Team Thistle", score: 7.2, participation: 64, total: 79 },
      ],
      myGroupLine: "Team Bramble's best month so far: 12.1 per person.",
      mostImproved: "Team Acorn",
    },
    myGroup: {
      rows: [row(1, 1, members[0], 21), row(2, 2, members[2], 17), row(3, 3, members[4], 12), row(4, 4, "me", 11), row(5, 5, members[6], 9), row(6, 6, members[8], 4)],
    },
    everyone: {
      rows: [
        row(1, 1, members[0], 21),
        row(2, 2, members[1], 19),
        row(3, 3, members[2], 17),
        { kind: "gap" },
        row(11, 11, members[9], 13),
        row(12, 12, members[10], 12),
        row(13, 12, members[4], 12),
        row(14, 14, "me", 11),
        row(15, 15, members[11], 10),
        row(16, 15, members[12], 10),
        row(17, 17, members[13], 9),
      ],
      improvementLine: "Your best month so far: 19 kudos.",
    },
  },
  all: {
    groups: {
      rows: [
        { kind: "row", position: 1, rank: 1, group: "Team Acorn", score: 61.8, participation: 100, total: 309 },
        { kind: "row", position: 2, rank: 2, group: "Team Bramble", score: 58.4, participation: 100, total: 409, mine: true },
        { kind: "row", position: 3, rank: 3, group: "Team Burrow", score: 44.0, participation: 100, total: 396 },
        { kind: "row", position: 4, rank: 4, group: "Team Moss", score: 40.5, participation: 100, total: 243 },
        { kind: "row", position: 5, rank: 5, group: "Team Thistle", score: 31.1, participation: 91, total: 342 },
      ],
    },
    myGroup: {
      rows: [row(1, 1, "me", 142), row(2, 2, members[0], 128), row(3, 3, members[2], 77), row(4, 4, members[4], 40), row(5, 5, members[6], 13), row(6, 6, members[8], 9)],
    },
    everyone: {
      rows: [
        row(1, 1, members[1], 171),
        row(2, 2, members[3], 150),
        row(3, 3, "me", 142),
        row(4, 4, members[0], 128),
        row(5, 5, members[9], 110),
        row(6, 6, members[2], 77),
        row(7, 7, members[10], 61),
        row(8, 8, members[11], 54),
        row(9, 9, members[12], 41),
        row(10, 10, members[4], 40),
      ],
    },
  },
};

export const deepLinks: Record<string, DeepLink> = {
  "app-home": { from: "app-home", target: "profile" },
  "level-up": { from: "level-up", level: 8, points: 2, nextXp: 330 },
  kudos: {
    from: "kudos",
    giver: members[0],
    text: "thanks for pairing on the flaky test all afternoon, you found the race in ten minutes",
    newSticker: true,
    coins: 2,
    drop: { rarity: "uncommon", kind: "card", name: "Paper High-Five" },
  },
  achievement: { from: "achievement", tierName: "Social Butterfly", ladder: "Connections", tier: "gold", reward: "Emoji: 🦋" },
};

