import { describe, expect, test } from "vitest";
import {
  QUEST_BY_KEY,
  QUESTS,
  type GivenFact,
  type QuestFacts,
  type QuestKey,
  boardSeed,
  completionTimes,
  eligibleQuestKeys,
  evaluateBoard,
  isCleanSweep,
  maxMatching,
  pickBoard,
  weekKeyFor,
} from "./quests";

const H = 3_600_000;
const D = 24 * H;
/** Monday 2026-09-21 00:00 in Berlin. */
const WEEK_START = Date.UTC(2026, 8, 20, 22);
const WED = WEEK_START + 2 * D + 12 * H;

describe("weekKeyFor", () => {
  test("is the Monday of the quest week in the workspace timezone", () => {
    expect(weekKeyFor(Date.UTC(2026, 8, 23, 10), "Europe/Berlin")).toBe("2026-09-21");
    // Sunday 23:30 UTC is already Monday in Berlin, still Sunday in UTC.
    expect(weekKeyFor(Date.UTC(2026, 8, 27, 22, 30), "Europe/Berlin")).toBe("2026-09-28");
    expect(weekKeyFor(Date.UTC(2026, 8, 27, 22, 30), "UTC")).toBe("2026-09-21");
  });

  test("the week with the DST switch still starts on Monday", () => {
    // Berlin leaves summer time on Sunday 2026-10-25.
    expect(weekKeyFor(Date.UTC(2026, 9, 25, 12), "Europe/Berlin")).toBe("2026-10-19");
    expect(weekKeyFor(Date.UTC(2026, 9, 25, 23, 30), "Europe/Berlin")).toBe("2026-10-26");
  });
});

describe("the catalog", () => {
  test("has the 7 built-in quests", () => {
    expect(QUESTS.map((q) => [q.key, q.group, q.goal])).toEqual([
      ["spread", "people", 3],
      ["fresh", "people", 1],
      ["rekindle", "people", 1],
      ["unsung", "people", 1],
      ["steady", "habit", 3],
      ["channels", "habit", 2],
      ["story", "craft", 2],
    ]);
  });
});

describe("pickBoard", () => {
  const all = QUESTS.map((q) => q.key);
  const boards = Array.from({ length: 200 }, (_, i) =>
    pickBoard({ seed: boardSeed("ws1", `2026-01-${i}`), previousKeys: [], eligibleKeys: all }),
  );

  test("is deterministic for the same seed", () => {
    const seed = boardSeed("ws1", "2026-09-21");
    expect(pickBoard({ seed, previousKeys: [], eligibleKeys: all })).toEqual(
      pickBoard({ seed, previousKeys: [], eligibleKeys: all }),
    );
    expect(boardSeed("ws1", "2026-09-21")).not.toBe(boardSeed("ws2", "2026-09-21"));
  });

  test("always 3 distinct quests, people first, with at least one habit or craft quest", () => {
    for (const board of boards) {
      expect(new Set(board).size).toBe(3);
      const groups = board.map((k) => QUEST_BY_KEY[k].group);
      expect(groups[0]).toBe("people");
      expect(groups.some((g) => g !== "people")).toBe(true);
      expect(groups).toEqual([...groups].sort((a, b) => Number(a !== "people") - Number(b !== "people")));
    }
    // Over many weeks every quest shows up.
    expect(new Set(boards.flat()).size).toBe(7);
  });

  test("avoids last week's quests when it can", () => {
    for (let i = 0; i < 100; i++) {
      const seed = boardSeed("ws1", `w${i}`);
      const previousKeys: QuestKey[] = ["spread", "steady", "story"];
      const board = pickBoard({ seed, previousKeys, eligibleKeys: all });
      expect(board.some((k) => previousKeys.includes(k))).toBe(false);
    }
  });

  test("falls back to last week's quests when too few are left", () => {
    const board = pickBoard({
      seed: 1,
      previousKeys: ["spread", "fresh", "channels"],
      eligibleKeys: ["spread", "fresh", "steady", "channels", "story"],
    });
    expect(board.filter((k) => QUEST_BY_KEY[k].group === "people")).toHaveLength(1);
    expect(board).toContain("steady");
    expect(board).toContain("story");
  });
});

describe("eligibleQuestKeys", () => {
  const old = WEEK_START - 40 * D;

  test("Unsung hero is only drawn when received counts are visible to everyone", () => {
    expect(eligibleQuestKeys({ receivedVisibility: "self", workspaceFirstKudosAt: old, weekStart: WEEK_START })).not.toContain("unsung");
    expect(eligibleQuestKeys({ receivedVisibility: "hidden", workspaceFirstKudosAt: old, weekStart: WEEK_START })).not.toContain("unsung");
    expect(eligibleQuestKeys({ receivedVisibility: "everyone", workspaceFirstKudosAt: old, weekStart: WEEK_START })).toContain("unsung");
  });

  test("Old friends needs a workspace with at least 35 days of history", () => {
    const keys = (first: number | null) =>
      eligibleQuestKeys({ receivedVisibility: "everyone", workspaceFirstKudosAt: first, weekStart: WEEK_START });
    expect(keys(null)).not.toContain("rekindle");
    expect(keys(WEEK_START - 34 * D)).not.toContain("rekindle");
    expect(keys(WEEK_START - 35 * D)).toContain("rekindle");
  });

  test("boards drawn from young, private workspaces never contain them", () => {
    const eligibleKeys = eligibleQuestKeys({ receivedVisibility: "self", workspaceFirstKudosAt: WEEK_START, weekStart: WEEK_START });
    for (let i = 0; i < 100; i++) {
      const board = pickBoard({ seed: boardSeed("ws", `w${i}`), previousKeys: [], eligibleKeys });
      expect(board).not.toContain("unsung");
      expect(board).not.toContain("rekindle");
    }
  });
});

describe("maxMatching", () => {
  test("each message counts for at most one person", () => {
    expect(maxMatching([["A", "B", "C"]])).toBe(1);
    expect(maxMatching([["A"], ["A"], ["B", "C"]])).toBe(2);
    expect(maxMatching([["A", "B"], ["A"], ["B", "C"]])).toBe(3);
    expect(maxMatching([])).toBe(0);
  });
});

describe("evaluateBoard", () => {
  let n = 0;
  /** A thoughtful, first-ever kudos from the member on Wednesday. */
  const give = (over: Partial<GivenFact> = {}): GivenFact => ({
    batchId: `b${n++}`,
    receiverId: "ben",
    dayKey: "2026-09-23",
    channelId: "C1",
    at: WED,
    noteWords: 5,
    lastBeforeAt: null,
    receiverLastReceivedAt: null,
    ...over,
  });
  const facts = (given: GivenFact[], over: Partial<QuestFacts> = {}): QuestFacts => ({
    given,
    receivedFrom: [],
    activeTeammates: 5,
    hasUnrecognizedTeammate: true,
    firstGivenAt: WEEK_START - 60 * D,
    weekStart: WEEK_START,
    receivedVisibility: "everyone",
    ...over,
  });
  const result = (key: QuestKey, f: QuestFacts) => evaluateBoard([key], f)[0];
  const progress = (key: QuestKey, given: GivenFact[], over?: Partial<QuestFacts>) => result(key, facts(given, over)).progress;

  test("a Note needs at least 3 words; reactions have none", () => {
    expect(progress("fresh", [give({ noteWords: 2 })])).toBe(0);
    expect(progress("fresh", [give({ noteWords: undefined })])).toBe(0);
    expect(progress("fresh", [give({ noteWords: 3 })])).toBe(1);
  });

  test("thanking someone back within 72 hours doesn't count", () => {
    const at = WED;
    const back = (ago: number) => progress("fresh", [give({ at })], { receivedFrom: [{ giverId: "ben", at: at - ago }] });
    expect(back(71 * H + 59 * 60_000)).toBe(0);
    expect(back(72 * H + 60_000)).toBe(1);
    // Kudos from someone else, or after this one, don't make it reciprocal.
    expect(progress("fresh", [give({ at })], { receivedFrom: [{ giverId: "cleo", at: at - H }] })).toBe(1);
    expect(progress("fresh", [give({ at })], { receivedFrom: [{ giverId: "ben", at: at + H }] })).toBe(1);
  });

  test("Spread the love: one message to three people is one step", () => {
    expect(progress("spread", [give({ batchId: "m1", receiverId: "a" }), give({ batchId: "m1", receiverId: "b" }), give({ batchId: "m1", receiverId: "c" })])).toBe(1);
    expect(
      progress("spread", [
        give({ batchId: "m1", receiverId: "a" }),
        give({ batchId: "m2", receiverId: "a" }),
        give({ batchId: "m3", receiverId: "b" }),
        give({ batchId: "m3", receiverId: "c" }),
      ]),
    ).toBe(2);
    const done = result("spread", facts(["a", "b", "c", "d"].map((r) => give({ receiverId: r }))));
    expect(done).toMatchObject({ progress: 3, goal: 3, done: true, waived: null });
  });

  test("Steady hand counts distinct days", () => {
    const days = ["2026-09-21", "2026-09-21", "2026-09-22"];
    expect(progress("steady", days.map((dayKey) => give({ dayKey })))).toBe(2);
    expect(progress("steady", [...days, "2026-09-24"].map((dayKey) => give({ dayKey })))).toBe(3);
  });

  test("Channel hopper counts distinct channels", () => {
    expect(progress("channels", [give({ channelId: "C1" }), give({ channelId: "C1" })])).toBe(1);
    expect(progress("channels", [give({ channelId: "C1" }), give({ channelId: "C2", noteWords: 1 })])).toBe(1);
    expect(progress("channels", [give({ channelId: "C1" }), give({ channelId: "C2" })])).toBe(2);
  });

  test("Say why needs 12+ words, counted once per message", () => {
    expect(progress("story", [give({ noteWords: 11 }), give({ noteWords: 12 })])).toBe(1);
    expect(progress("story", [give({ batchId: "m", receiverId: "a", noteWords: 20 }), give({ batchId: "m", receiverId: "b", noteWords: 20 })])).toBe(1);
    expect(progress("story", [give({ noteWords: 12 }), give({ noteWords: 30 })])).toBe(2);
  });

  test("New connection needs a teammate with no earlier kudos from you", () => {
    expect(progress("fresh", [give({ lastBeforeAt: WED - 400 * D })])).toBe(0);
    expect(progress("fresh", [give({ lastBeforeAt: null })])).toBe(1);
  });

  test("Old friends: the last kudos to them is at least 30 days old", () => {
    expect(progress("rekindle", [give({ lastBeforeAt: WED - 29 * D })])).toBe(0);
    expect(progress("rekindle", [give({ lastBeforeAt: WED - 31 * D })])).toBe(1);
    expect(progress("rekindle", [give({ lastBeforeAt: null })])).toBe(0);
  });

  test("Unsung hero: nobody recognized them in the 14 days before", () => {
    expect(progress("unsung", [give({ receiverLastReceivedAt: WED - 13 * D })])).toBe(0);
    expect(progress("unsung", [give({ receiverLastReceivedAt: WED - 15 * D })])).toBe(1);
    expect(progress("unsung", [give({ receiverLastReceivedAt: null })])).toBe(1);
    // Not looked up: never counts as quiet.
    expect(progress("unsung", [give({ receiverLastReceivedAt: undefined })])).toBe(0);
  });

  test("progress is capped at the goal", () => {
    expect(result("channels", facts(["C1", "C2", "C3"].map((channelId) => give({ channelId }))))).toMatchObject({ progress: 2, goal: 2, done: true });
  });

  test("waived quests say why", () => {
    expect(result("spread", facts([], { activeTeammates: 2 })).waived).toBe("no_candidates");
    expect(result("spread", facts([], { activeTeammates: 3 })).waived).toBeNull();
    expect(result("fresh", facts([], { hasUnrecognizedTeammate: false })).waived).toBe("no_candidates");
    expect(result("rekindle", facts([], { firstGivenAt: WEEK_START - 29 * D })).waived).toBe("too_new");
    expect(result("rekindle", facts([], { firstGivenAt: null })).waived).toBe("too_new");
    expect(result("rekindle", facts([], { firstGivenAt: WEEK_START - 30 * D })).waived).toBeNull();
    expect(result("steady", facts([], { activeTeammates: 0, hasUnrecognizedTeammate: false, firstGivenAt: null })).waived).toBeNull();
  });

  test("a completed quest is done, not waived, except when privacy hides it", () => {
    const f = facts([give()], { hasUnrecognizedTeammate: false });
    expect(result("fresh", f)).toMatchObject({ done: true, waived: null });
    expect(result("unsung", facts([give()], { receivedVisibility: "self" }))).toMatchObject({ progress: 0, done: false, waived: "privacy" });
  });

  test("a clean sweep completes every quest that isn't waived", () => {
    const f = facts([give({ channelId: "C1" }), give({ channelId: "C2" })], { hasUnrecognizedTeammate: true, receivedVisibility: "self" });
    expect(isCleanSweep(evaluateBoard(["fresh", "unsung", "channels"], f))).toBe(true);
    expect(isCleanSweep(evaluateBoard(["fresh", "spread", "channels"], f))).toBe(false);
    expect(isCleanSweep(evaluateBoard(["unsung"], f))).toBe(false);
  });

  test("each done quest was completed by the kudos that met its goal", () => {
    const f = facts([
      give({ at: WED, channelId: "C1", dayKey: "2026-09-23", receiverId: "ben" }),
      give({ at: WED + H, channelId: "C1", dayKey: "2026-09-23", noteWords: 2, receiverId: "cleo" }), // no Note: counts for nothing
      give({ at: WED + 2 * H, channelId: "C2", dayKey: "2026-09-23", receiverId: "cleo" }),
      give({ at: WED + D, channelId: "C2", dayKey: "2026-09-24", receiverId: "dev" }),
    ]);
    expect(completionTimes(["fresh", "spread", "channels", "steady"], f)).toEqual({
      fresh: WED,
      spread: WED + D,
      channels: WED + 2 * H,
    });
    expect(completionTimes(["story"], f)).toEqual({});
  });
});
