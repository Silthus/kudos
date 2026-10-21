// PROTOTYPE (Silthus/personal#98), throwaway: fixture moments for the XP moments prototype. Every name is made up.

export type Excerpt = {
  kind: "kudos-received" | "hugs" | "kudos-given" | "level";
  label: string;
  who: string;
  initials: string;
  tone: number;
  where: string;
  when: string;
  text: string;
  hugs?: number;
  xp: number;
  xpWhy?: string;
};

export type Scenario = { name: string; startXp: number; excerpts: Excerpt[]; folded: { count: number; xp: number; initials: string[] } | null; items: number; lastVisit: string };

const kudosForYou: Excerpt = { kind: "kudos-received", label: "Kudos for you", who: "Ines Okafor", initials: "IO", tone: 1, where: "#team-lanterns", when: "Yesterday 16:40", text: ":hedgehog: @you thank you for pairing on the flaky deploy, you saved my whole afternoon", xp: 10 };

const hugsOnYourMessage: Excerpt = { kind: "hugs", label: "3 hugs on your message", who: "You", initials: "", tone: 0, where: "#help-desk", when: "Yesterday 11:05", text: "Pushed a fix for the export timeout, it should be live in about ten minutes", hugs: 3, xp: 3 };

const kudosYouGave: Excerpt = { kind: "kudos-given", label: "Kudos you gave", who: "You", initials: "", tone: 0, where: "#general", when: "Today 09:18", text: ":hedgehog: @Wren Alder for the clearest onboarding doc I've read all year", xp: 15, xpWhy: "+10 · Spark +5" };

const kudosFromBram: Excerpt = { kind: "kudos-received", label: "Kudos for you", who: "Bram Teller", initials: "BT", tone: 2, where: "#team-kettle-works", when: "Today 10:02", text: ":hedgehog: @you for staying late to get the release notes out :tada:", xp: 10 };

const levelSeven: Excerpt = { kind: "level", label: "Level up", who: "HedgeHug", initials: "", tone: 0, where: "Direct message", when: "Today 10:02", text: ":tada: You reached level 7! Level 8 is 600 XP away.", xp: 0 };

export const scenarios: Record<string, Scenario> = {
  busy: { name: "Busy two days", startXp: 1462, excerpts: [kudosForYou, hugsOnYourMessage, kudosYouGave, kudosFromBram, levelSeven], folded: { count: 12, xp: 140, initials: ["FM", "KS", "OV"] }, items: 3, lastVisit: "Mon 09:12" },
  quiet: { name: "Quiet day", startXp: 1210, excerpts: [{ ...kudosForYou, who: "Fen Marlowe", initials: "FM", tone: 3, where: "#team-paper-moons", text: ":hedgehog: @you for the quick review on my migration" }, { ...hugsOnYourMessage, label: "2 hugs on your message", hugs: 2, xp: 2 }], folded: null, items: 1, lastVisit: "Yesterday 17:30" },
  nothing: { name: "Only items wait", startXp: 1210, excerpts: [], folded: null, items: 2, lastVisit: "Today 08:50" },
};

export const scenarioKeys = Object.keys(scenarios);

export type Pace = { name: string; settle: number; read: number; flight: number; gap: number; stagger: number; holdBase: number; holdPer: number; collectStagger: number };

export const paces: Record<string, Pace> = {
  snappy: { name: "Snappy", settle: 400, read: 650, flight: 480, gap: 120, stagger: 110, holdBase: 1400, holdPer: 450, collectStagger: 90 },
  brisk: { name: "Brisk", settle: 600, read: 1000, flight: 600, gap: 220, stagger: 170, holdBase: 2000, holdPer: 700, collectStagger: 140 },
  calm: { name: "Calm", settle: 800, read: 1600, flight: 750, gap: 350, stagger: 260, holdBase: 3000, holdPer: 1000, collectStagger: 220 },
};

export const paceKeys = Object.keys(paces);

export function xpToReach(level: number) {
  if (level <= 1) return 0;
  if (level === 2) return 20;
  return 50 * (level - 1) * (level - 2);
}

export function levelOf(xp: number) {
  let level = 1;
  while (xpToReach(level + 1) <= xp) level += 1;
  return level;
}

const emojiOf: Record<string, string> = { ":hedgehog:": "🦔", ":tada:": "🎉", ":raised_hands:": "🙌" };

export type Part = { kind: "text" | "mention" | "emoji"; value: string };

export function partsOf(text: string): Part[] {
  return text
    .split(/(@you|@[A-Z][a-z]+ [A-Z][a-z]+|:[a-z_]+:)/)
    .filter((part) => part !== "")
    .map((part) => (part.startsWith("@") ? { kind: "mention", value: part } : part.startsWith(":") && emojiOf[part] ? { kind: "emoji", value: emojiOf[part] } : { kind: "text", value: part }));
}
