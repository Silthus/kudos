import { describe, expect, test } from "vitest";
import { earningsText, levelForXp, levelProgress, nextLockedAreas, QUEST_REWARDS, QUESTS_LEVEL, scoreGive, scoreReceive, titleForLevel, xpForLevel, type GiveRecipient } from "./xp";

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
    expect(earningsText({ ...none, xp: 2, noReason: true })).toBe("+2 XP · a seed with a few words on why (3 or more) earns more");
    expect(earningsText({ ...none, xp: 2, thankBack: true })).toBe("+2 XP · thanking back within 72 h earns less");
  });

  test("a kudos the cap cut to nothing lists no bonuses, and a third thanks in a day says why it earned nothing", () => {
    expect(earningsText({ ...none, xp: 0, capped: true, bonuses: [{ kind: "new_connection", xp: 10 }] })).toBe("+0 XP · daily XP cap reached");
    expect(earningsText({ ...none, xp: 0 })).toBe("+0 XP · you've thanked them twice today already");
  });

  test("shows Hog coins once the wallet is open, and a kudos without a reason is told that one with a reason earns coins", () => {
    expect(earningsText({ ...none, xp: 10, coins: 2, bonuses: [{ kind: "new_connection", xp: 10 }] })).toBe("+10 XP · +2 Hog coins · new connection +10");
    expect(earningsText({ ...none, xp: 10, coins: 1 })).toBe("+10 XP · +1 Hog coin");
    expect(earningsText({ ...none, xp: 2, coins: 0, noReason: true })).toBe("+2 XP · a seed with a few words on why (3 or more) earns coins");
    expect(earningsText({ ...none, xp: 2, coins: 0, thankBack: true })).toBe("+2 XP · thanking back within 72 h earns less");
    expect(earningsText({ ...none, xp: 0, coins: 1 })).toBe("+0 XP · +1 Hog coin · you've thanked them twice today already");
  });

  test("lists the quests the kudos completed, each with what it paid", () => {
    expect(
      earningsText({
        ...none,
        xp: 10,
        coins: 1,
        quests: [
          { scope: "daily", title: "A thoughtful thanks", xp: 10, coins: 2 },
          { scope: "weekly", title: "Spread the love", xp: 20, coins: 5 },
          { scope: "sweep", title: "Clean sweep", xp: 30, coins: 0 },
        ],
      }),
    ).toBe("+10 XP · +1 Hog coin · daily quest done +10 XP +2 Hog coins · Spread the love done +20 XP +5 Hog coins · clean sweep +30 XP");
  });

  test("quest rewards are what the spec pays: weekly 20 XP + 5 coins, daily 10 + 2, clean sweep +30 XP", () => {
    expect(QUEST_REWARDS).toEqual({ weekly: { xp: 20, coins: 5 }, daily: { xp: 10, coins: 2 }, sweep: { xp: 30, coins: 0 } });
    expect(QUESTS_LEVEL).toBe(5);
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

describe("bonus days and company-wide boosters (#55 §G9, G10)", () => {
  const show = (lines: ReturnType<typeof scoreGive>) => lines.map((l) => `${l.kudosId}:${l.xp}:${l.boosted ?? false}`);

  test("a bonus day doubles what a qualifying kudos earns, bonuses included, but never a thin one", () => {
    const [line] = give({ boost: "double", recipients: [recipient({ lastGivenAt: null })] }); // 10 + new connection 10
    expect(line).toMatchObject({ qualifying: true, xp: 40, boosted: true });
    expect(line.items).toEqual([
      { kind: "base", xp: 10 },
      { kind: "new_connection", xp: 10 },
      { kind: "boost", xp: 20 },
    ]);
    const [thin] = give({ boost: "double", noteWords: 1 });
    expect(thin).toMatchObject({ qualifying: false, xp: 2 });
    expect(thin.boosted).toBeUndefined();
  });

  test("the daily XP cap stays: doubled lines are cut like any other", () => {
    const two = [recipient({ kudosId: "a", lastGivenAt: null }), recipient({ kudosId: "b", receiverId: "c" })];
    expect(show(give({ boost: "double", earnedToday: 20, recipients: two }))).toEqual(["a:30:true", "b:0:true"]);
  });

  test("a third thanks today earns no XP but still counts as boosted, so its coins double", () => {
    expect(give({ boost: "double", recipients: [recipient({ earlierToday: 2 })] })[0]).toMatchObject({ xp: 0, boosted: true });
  });

  test("a conditional booster doubles only the kudos it is about", () => {
    const fresh = recipient({ kudosId: "a", lastGivenAt: null }); // 10 + new connection 10
    const old = recipient({ kudosId: "b", receiverId: "c", lastGivenAt: AT - 40 * DAY }); // 10 + rekindle 5
    const recent = recipient({ kudosId: "c", receiverId: "d" }); // 10
    const quiet = recipient({ kudosId: "d", receiverId: "e", receiverLastReceivedAt: null }); // 10 + unsung 5
    const recipients = [fresh, old, recent, quiet];
    expect(show(give({ boost: "new_connection", unsungOn: true, recipients }))).toEqual(["a:40:true", "b:10:false", "c:0:false", "d:0:false"]);
    expect(show(give({ boost: "rekindle", unsungOn: true, recipients }))).toEqual(["a:20:false", "b:30:true", "c:0:false", "d:0:false"]);
    expect(show(give({ boost: "unsung", unsungOn: true, recipients: [recent, quiet] }))).toEqual(["c:10:false", "d:30:true"]);
  });

  test("the earnings reply names the boost", () => {
    const e = { xp: 40, bonuses: [{ kind: "new_connection" as const, xp: 10 }, { kind: "boost" as const, xp: 20 }], capped: false, noReason: false, thankBack: false };
    expect(earningsText({ ...e, boost: "double" })).toBe("+40 XP · new connection +10 · bonus day ×2 +20");
    expect(earningsText({ ...e, boost: "new_connection" })).toBe("+40 XP · new connection +10 · new-connections booster ×2 +20");
  });

  test("a boost that doubled nothing (a third thanks today) isn't named (review #10)", () => {
    const e = { xp: 2, bonuses: [{ kind: "boost" as const, xp: 0 }], capped: false, noReason: false, thankBack: true, boost: "double" as const };
    expect(earningsText(e)).toBe("+2 XP · thanking back within 72 h earns less");
  });
});
