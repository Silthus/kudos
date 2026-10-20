import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { hoggieNamed, hoggiesOfRarity } from "../hoggies/catalogue";
import type { LevelUpAnswer } from "../album/levelUp";
import type { MemberId } from "../workspace/directory";

const theDraw = vi.hoisted(() => ({ pinned: [] as string[] }));

vi.mock("../hoggies/draw", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hoggies/draw")>();
  const { hoggieNamed } = await import("../hoggies/catalogue");
  return {
    ...actual,
    drawOf: vi.fn(async (input: Parameters<typeof actual.drawOf>[0]) => {
      const pinned = input.crate.startsWith("level:") ? theDraw.pinned.shift() : undefined;
      return pinned === undefined ? actual.drawOf(input) : { hoggie: pinned, rarity: hoggieNamed(pinned)!.rarity };
    }),
  };
});

const now = new Date("2026-10-20T10:00:00Z");
const hourMs = 60 * 60 * 1000;
const juno = { user: "U_JUNO", name: "Juno Park" };
const revealOn = ["album", "collection", "level-up-reveal"];

const [common, otherCommon] = hoggiesOfRarity("common").map(({ hoggie }) => hoggie);
const [uncommon] = hoggiesOfRarity("uncommon").map(({ hoggie }) => hoggie);
const [rare] = hoggiesOfRarity("rare").map(({ hoggie }) => hoggie);
const [legendary] = hoggiesOfRarity("legendary").map(({ hoggie }) => hoggie);

let postHog: FakePostHog;
let t: Backend;

beforeEach(() => {
  theDraw.pinned = [];
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().withMember(juno.user, { profile: { display_name: juno.name, real_name: juno.name } }).fetch));
  t = testBackend({ transactionLimits: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function junoWith(...flags: string[]): Promise<MemberId> {
  await switchWebsite(t, postHog, true, ...flags);
  return aMember(t, juno.user);
}

async function levelUpOf(level: number) {
  const { asSignedIn } = await aSignedInSession(t, juno);
  return asSignedIn.query(api.website.album.getLevelUp, { level });
}

async function revealOf(level: number): Promise<LevelUpAnswer> {
  const answer = await levelUpOf(level);
  if (answer.kind !== "levelUp") throw new Error(`getLevelUp answered ${answer.kind} for level ${level}`);
  return answer;
}

async function reaches(member: MemberId, level: number, ...hoggies: string[]) {
  theDraw.pinned = hoggies;
  vi.setSystemTime(Date.now() + hourMs);
  await reachesLevel(t, member, level);
  return Date.now();
}

function found(hoggie: string, copy = 1) {
  const { name, rarity } = hoggieNamed(hoggie)!;
  return { hoggie, name, rarity, art: { kind: "hoggie", slug: hoggie }, copy, isNew: copy === 1 };
}

function levelEmoji(level: number, earnedAt: number) {
  return { id: `level:${level}`, kind: "level", name: `level-${level}`, from: `Level ${level}`, picture: `/emoji/level-${level}.png`, earned: true, earnedAt, seen: false, inSlack: false, progress: null };
}

describe("getLevelUp answers one level up's reveal", { timeout: 60_000 }, () => {
  test("a level up answers its level, when it was reached and its three hoggies in slot order, each shown like any drop", async () => {
    const member = await junoWith(...revealOn);
    const at = await reaches(member, 3, common!, uncommon!, legendary!);

    expect(await levelUpOf(3)).toEqual({ kind: "levelUp", level: 3, at, hoggies: [found(common!), found(uncommon!), found(legendary!)], emojis: [] });
  });

  test("a hoggie found before shows as a spare", async () => {
    const member = await junoWith(...revealOn);
    await reaches(member, 2, common!, uncommon!, rare!);
    await reaches(member, 3, common!, otherCommon!, legendary!);

    expect((await revealOf(3)).hoggies).toEqual([found(common!, 2), found(otherCommon!), found(legendary!)]);
  });

  test("a level up answers the level emojis above the member's previous level up and up to its own, in level order, and none it earned before", async () => {
    const member = await junoWith(...revealOn);
    await t.mutation(internal.album.emojiNames.reserveSharedEmojiNames, { workspace: "T1" });
    await reaches(member, 4);
    const atTen = await reaches(member, 10);
    const atEleven = await reaches(member, 11);

    expect((await revealOf(10)).emojis).toEqual([levelEmoji(5, atTen), levelEmoji(10, atTen)]);
    expect((await revealOf(11)).emojis).toEqual([]);
    expect(atEleven).toBeGreaterThan(atTen);
  });

  test("a level the member never reached, or reached before its hoggies dropped, answers none", async () => {
    const member = await junoWith("album", "collection");
    await reaches(member, 2);
    await switchWebsite(t, postHog, true, ...revealOn);
    await reaches(member, 3);

    expect(await levelUpOf(2)).toEqual({ kind: "none" });
    expect(await levelUpOf(7)).toEqual({ kind: "none" });
  });

  test.each([
    ["level-up-reveal is off", ["album", "collection"]],
    ["the album is off", ["collection", "level-up-reveal"]],
  ])("while %s, a level up that dropped its hoggies answers off", async (_, flags) => {
    const member = await junoWith(...revealOn);
    await reaches(member, 3);
    await switchWebsite(t, postHog, true, ...flags);

    expect(await levelUpOf(3)).toEqual({ kind: "off" });
  });
});
