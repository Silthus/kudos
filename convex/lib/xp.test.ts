import { describe, expect, test } from "vitest";
import { earningsText, levelForXp, levelProgress, nextLockedAreas, scoreGive, scoreReceive, titleForLevel, xpForLevel, type GiveRecipient } from "./xp";

const AT = Date.UTC(2026, 8, 23, 10);
const DAY = 86_400_000;

function recipient(over: Partial<GiveRecipient> = {}): GiveRecipient {
  return {
    kudosId: "k1",
    receiverId: "ben",
    reciprocal: false,
    lastGivenAt: AT - 2 * DAY, // thanked 2 days ago: no bonus
    earlierToday: 0,
    earlierDaysThisWeek: 0,
    receiverLastReceivedAt: AT - DAY,
    ...over,
  };
}
const give = (over: Partial<Parameters<typeof scoreGive>[0]> = {}) =>
  scoreGive({ at: AT, noteWords: 5, unsungOn: false, earnedToday: 0, recipients: [recipient()], ...over });

describe("the level curve", () => {
  test("follows the spec's thresholds: 30, 75, 175, 350, then 50 × L per level up to 25", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(xpForLevel)).toEqual([0, 30, 75, 175, 350, 600, 900, 1250, 1650, 2100]);
    expect(xpForLevel(25)).toBe(14_850);
  });

  test("a level is reached exactly at its threshold and capped at 25", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(29)).toBe(1);
    expect(levelForXp(30)).toBe(2);
    expect(levelForXp(349)).toBe(4);
    expect(levelForXp(350)).toBe(5);
    expect(levelForXp(14_849)).toBe(24);
    expect(levelForXp(1_000_000)).toBe(25);
  });

  test("titles come in five garden bands", () => {
    expect([1, 2, 3, 4, 5, 9, 10, 19, 20, 25].map(titleForLevel)).toEqual([
      "Seedling",
      "Seedling",
      "Sprout",
      "Sprout",
      "Gardener",
      "Gardener",
      "Grove keeper",
      "Grove keeper",
      "Elder hog",
      "Elder hog",
    ]);
  });

  test("progress shows how far into the level you are and what the next one needs", () => {
    expect(levelProgress(40)).toEqual({ level: 2, title: "Seedling", xp: 40, floor: 30, next: 75, toNext: 35, fraction: 10 / 45 });
    expect(levelProgress(20_000).next).toBeNull();
    expect(levelProgress(20_000).fraction).toBe(1);
  });

  test("a level already reached stays when XP drops below it (a revoke)", () => {
    expect(levelProgress(20, 3)).toMatchObject({ level: 3, title: "Sprout", floor: 75, next: 175, toNext: 155, fraction: 0 });
  });
});

describe("XP for giving", () => {
  test("a qualifying kudos earns 10", () => {
    expect(give()).toEqual([{ kudosId: "k1", receiverId: "ben", qualifying: true, xp: 10, items: [{ kind: "base", xp: 10 }] }]);
  });

  test("the second to the same person on the same day earns 2, the third and later nothing", () => {
    expect(give({ recipients: [recipient({ earlierToday: 1 })] })[0].xp).toBe(2);
    expect(give({ recipients: [recipient({ earlierToday: 2 })] })[0].xp).toBe(0);
    expect(give({ recipients: [recipient({ earlierToday: 5 })] })[0].xp).toBe(0);
  });

  test("the same person on other days of the week earns 2 less each time, never below 2", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => give({ recipients: [recipient({ earlierDaysThisWeek: d })] })[0].xp)).toEqual([10, 8, 6, 4, 2, 2, 2]);
  });

  test("a thank-back or a kudos without a reason earns 2 and no bonus", () => {
    expect(give({ recipients: [recipient({ reciprocal: true, lastGivenAt: null })] })[0]).toMatchObject({
      qualifying: false,
      xp: 2,
      items: [{ kind: "thin", xp: 2 }],
    });
    expect(give({ noteWords: 2, recipients: [recipient({ lastGivenAt: null })] })[0]).toMatchObject({ qualifying: false, xp: 2 });
  });

  test("bonuses: new connection +10, rekindle after 30 days +5, unsung +5 only while received counts are public", () => {
    expect(give({ recipients: [recipient({ lastGivenAt: null })] })[0].items).toEqual([
      { kind: "base", xp: 10 },
      { kind: "new_connection", xp: 10 },
    ]);
    expect(give({ recipients: [recipient({ lastGivenAt: AT - 30 * DAY })] })[0].xp).toBe(15);
    expect(give({ recipients: [recipient({ lastGivenAt: AT - 29 * DAY })] })[0].xp).toBe(10);
    const quiet = recipient({ receiverLastReceivedAt: AT - 14 * DAY });
    expect(give({ unsungOn: true, recipients: [quiet] })[0].xp).toBe(15);
    expect(give({ unsungOn: false, recipients: [quiet] })[0].xp).toBe(10);
    expect(give({ unsungOn: true, recipients: [recipient({ receiverLastReceivedAt: null })] })[0].xp).toBe(15);
  });

  test("a real why (12+ words) adds 5 once per message, on the first line that earns", () => {
    const lines = give({
      noteWords: 12,
      recipients: [recipient({ kudosId: "k1", earlierToday: 2 }), recipient({ kudosId: "k2", receiverId: "cleo" }), recipient({ kudosId: "k3", receiverId: "dan" })],
    });
    expect(lines.map((l) => l.xp)).toEqual([0, 15, 10]);
    expect(lines[1].items).toContainEqual({ kind: "story", xp: 5 });
  });

  test("a real why doesn't pay on a message that earns nothing else", () => {
    expect(give({ noteWords: 20, recipients: [recipient({ earlierToday: 2 })] })[0].xp).toBe(0);
  });

  test("giving earns at most 50 a day: lines are cut in order once the cap is reached", () => {
    const three = [recipient({ kudosId: "a", lastGivenAt: null }), recipient({ kudosId: "b", receiverId: "c", lastGivenAt: null }), recipient({ kudosId: "c", receiverId: "d", lastGivenAt: null })];
    expect(give({ recipients: three }).map((l) => l.xp)).toEqual([20, 20, 10]);
    expect(give({ earnedToday: 45, recipients: three }).map((l) => l.xp)).toEqual([5, 0, 0]);
    expect(give({ earnedToday: 50 }).map((l) => l.xp)).toEqual([0]);
  });
});

describe("progressive disclosure", () => {
  test("a newcomer sees only the next areas ahead, visible but locked, each with its level", () => {
    expect(nextLockedAreas(1).map((a) => [a.key, a.level])).toEqual([
      ["wallet", 3],
      ["garden", 3],
    ]);
    expect(nextLockedAreas(3).map((a) => [a.key, a.level])).toEqual([
      ["store", 5],
      ["quests", 5],
    ]);
    expect(nextLockedAreas(5)).toEqual([]);
    expect(nextLockedAreas(1).every((a) => a.how.length > 0 && !/unlock/i.test(a.how))).toBe(true);
  });
});

describe("the earnings reply", () => {
  const none = { bonuses: [], capped: false, noReason: false, thankBack: false };
  test("itemises the XP and every bonus", () => {
    expect(earningsText({ ...none, xp: 10 })).toBe("+10 XP");
    expect(earningsText({ ...none, xp: 25, bonuses: [{ kind: "new_connection", xp: 10 }, { kind: "story", xp: 5 }] })).toBe(
      "+25 XP · new connection +10 · a real why +5",
    );
    expect(earningsText({ ...none, xp: 20, bonuses: [{ kind: "rekindle", xp: 5 }, { kind: "unsung", xp: 5 }] })).toBe(
      "+20 XP · rekindled +5 · unsung hero +5",
    );
  });

  test("says when the daily cap cut it, and how a kudos without a reason or a thank-back could earn more", () => {
    expect(earningsText({ ...none, xp: 4, capped: true })).toBe("+4 XP · daily XP cap reached");
    expect(earningsText({ ...none, xp: 2, noReason: true })).toBe("+2 XP · a kudos with a reason (3+ words) earns more");
    expect(earningsText({ ...none, xp: 2, thankBack: true })).toBe("+2 XP · thanking back within 72 h earns less");
  });

  test("a kudos the cap cut to nothing lists no bonuses, and a third thanks in a day says why it earned nothing", () => {
    expect(earningsText({ ...none, xp: 0, capped: true, bonuses: [{ kind: "new_connection", xp: 10 }] })).toBe("+0 XP · daily XP cap reached");
    expect(earningsText({ ...none, xp: 0 })).toBe("+0 XP · you've thanked them twice today already");
  });

  test("the hint for a kudos without a reason works for reactions too", () => {
    expect(earningsText({ ...none, xp: 2, noReason: true })).not.toMatch(/react/i);
  });
});

describe("XP for receiving", () => {
  const base = { qualifying: true, isPlayer: true, giverCountedToday: false, earnedToday: 0 };
  test("5 per distinct qualifying giver a day, at most 15", () => {
    expect(scoreReceive(base)).toBe(5);
    expect(scoreReceive({ ...base, giverCountedToday: true })).toBe(0);
    expect(scoreReceive({ ...base, earnedToday: 12 })).toBe(3);
    expect(scoreReceive({ ...base, earnedToday: 15 })).toBe(0);
  });

  test("nothing for a non-qualifying kudos, and nothing before you are a player", () => {
    expect(scoreReceive({ ...base, qualifying: false })).toBe(0);
    expect(scoreReceive({ ...base, isPlayer: false })).toBe(0);
  });
});
