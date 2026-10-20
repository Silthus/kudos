import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { catalogue, hoggieNamed, type Rarity } from "../hoggies/catalogue";
import { drawOf } from "../hoggies/draw";
import type { LevelUpAnswer } from "../album/levelUp";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-20T10:00:00Z");
const hourMs = 60 * 60 * 1000;
const juno = { user: "U_JUNO", name: "Juno Park" };
const revealOn = ["album", "collection", "level-up-reveal"];

let postHog: FakePostHog;
let t: Backend;

beforeEach(() => {
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

async function reaches(member: MemberId, level: number) {
  vi.setSystemTime(Date.now() + hourMs);
  await reachesLevel(t, member, level);
  return Date.now();
}

const slots: ReadonlyArray<{ slot: number; floor?: Rarity }> = [{ slot: 1 }, { slot: 2 }, { slot: 3, floor: "rare" }];

async function drawnAt(secret: string, member: MemberId, level: number): Promise<string[]> {
  return Promise.all(slots.map(async ({ slot, floor }) => (await drawOf({ secret, member, crate: `level:${level}:${slot}`, version: catalogue.version, floor })).hoggie));
}

async function aSecretWhere(member: MemberId, drawsWanted: (draws: Map<number, string[]>) => boolean, levels: number[]) {
  for (let attempt = 0; ; attempt++) {
    const secret = `level-up-secret-${attempt}`;
    const draws = new Map(await Promise.all(levels.map(async (level) => [level, await drawnAt(secret, member, level)] as const)));
    if (drawsWanted(draws)) {
      vi.stubEnv("HOGGIE_DRAW_SECRET", secret);
      return draws;
    }
  }
}

function allDifferent(hoggies: string[]) {
  return new Set(hoggies).size === hoggies.length;
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
    const draws = await aSecretWhere(member, (drawn) => allDifferent(drawn.get(3)!), [3]);
    const at = await reaches(member, 3);

    expect(await levelUpOf(3)).toEqual({ kind: "levelUp", level: 3, at, hoggies: draws.get(3)!.map((hoggie) => found(hoggie)), emojis: [] });
  });

  test("a hoggie found before shows as a spare", async () => {
    const member = await junoWith(...revealOn);
    const draws = await aSecretWhere(member, (drawn) => drawn.get(3)![0] === drawn.get(2)![0] && allDifferent([...drawn.get(2)!, ...drawn.get(3)!.slice(1)]), [2, 3]);
    await reaches(member, 2);
    await reaches(member, 3);

    const [again, second, third] = draws.get(3)!;
    expect((await revealOf(3)).hoggies).toEqual([found(again!, 2), found(second!), found(third!)]);
  });

  test("a level up answers the level emojis above the member's previous level up and up to its own, in level order, and none it earned before", async () => {
    const member = await junoWith(...revealOn);
    await t.mutation(internal.album.emojiNames.reserveSharedEmojiNames, { workspace: "T1" });
    await reaches(member, 4);
    const atTen = await reaches(member, 10);
    await reaches(member, 11);

    expect((await revealOf(10)).emojis).toEqual([levelEmoji(5, atTen), levelEmoji(10, atTen)]);
    expect((await revealOf(11)).emojis).toEqual([]);
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
