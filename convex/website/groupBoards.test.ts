import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aSession } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { GroupId } from "../groups/groups";
import type { Period } from "../leaderboard/periods";
import type { MemberId } from "../workspace/directory";

const tuesday = new Date("2026-10-13T10:00:00Z");
const juno = { user: "U_JUNO", name: "Juno Whitlock", image: "https://avatars.slack-edge.com/juno.png" };

let postHog: FakePostHog;
let t: Backend;
let messages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("WS344 GB17: getGroupBoards gives the leaderboard its Groups and My group boards", () => {
  test("a member of a listed group reads both boards: the groups ranked per person, and their group's members with faces and places climbed", async () => {
    await flagsOn("website", "everyone-board", "groups");
    const { groups, members } = await groupsOf({ Ants: [["U_JUNO", "Juno Whitlock"], ["U_ANN", "Ann Lee"], ["U_AL", "Al Day"]], Bees: [["U_BO", "Bo"], ["U_BEA", "Bea"], ["U_BEN", "Ben"], ["U_BIX", "Bix"]] });
    await attributed(members.U_BO, groups.Bees, 8, "2026-10-06");
    await attributed(members.U_BEA, groups.Bees, 5, "2026-10-08");
    await attributed(members.U_JUNO, groups.Ants, 4, "2026-10-12");
    await attributed(members.U_ANN, groups.Ants, 2, "2026-10-13");
    await attributed(members.U_BO, groups.Bees, 3, "2026-10-13");
    const { asSignedIn } = await aSession(t, juno);

    expect(await groupBoards("week", asSignedIn)).toEqual({
      kind: "boards",
      groups: {
        rows: [
          { position: 1, rank: 1, tied: false, group: groups.Ants, name: "Ants", perMember: 2, participation: 66, kudos: 6, members: 3, mine: true, climbed: 1 },
          { position: 2, rank: 2, tied: false, group: groups.Bees, name: "Bees", perMember: 0.8, participation: 25, kudos: 3, members: 4, mine: false, climbed: null },
        ],
        window: [1, 2],
        standing: { kind: "ranked", position: 1, rank: 1 },
        improvement: { gain: 2, places: 1 },
        mostImproved: { group: groups.Ants, name: "Ants", gain: 2 },
      },
      myGroup: {
        group: { group: groups.Ants, name: "Ants" },
        rows: [
          { position: 1, rank: 1, tied: false, name: "Juno Whitlock", face: { kind: "slack", image: juno.image, initials: "JW" }, kudos: 4, you: true, climbed: null },
          { position: 2, rank: 2, tied: false, name: "Ann Lee", face: { kind: "initials", initials: "AL" }, kudos: 2, you: false, climbed: null },
        ],
        window: [1, 2],
        standing: { kind: "ranked", position: 1, rank: 1 },
      },
    });
  });

  test("both boards are hidden while groups is off", async () => {
    await flagsOn("website", "everyone-board");
    await groupsOf({ Ants: [["U_JUNO", "Juno Whitlock"], ["U_ANN", "Ann Lee"], ["U_AL", "Al Day"]] });
    const { asSignedIn } = await aSession(t, juno);

    expect(await groupBoards("week", asSignedIn)).toEqual({ kind: "boards", groups: null, myGroup: null });
  });

  test("GB13: with no group of at least three members the Groups board is hidden, and the viewer still has My group", async () => {
    await flagsOn("website", "everyone-board", "groups");
    await groupsOf({ Pair: [["U_JUNO", "Juno Whitlock"], ["U_ANN", "Ann Lee"]] });
    const { asSignedIn } = await aSession(t, juno);

    const answer = await groupBoards("month", asSignedIn);

    expect(answer).toMatchObject({ kind: "boards", groups: null, myGroup: { group: { name: "Pair" }, rows: [], standing: { kind: "not-ranked" } } });
  });

  test("GB15: a viewer without a primary group gets the Groups board and no My group board", async () => {
    await flagsOn("website", "everyone-board", "groups");
    await groupsOf({ Ants: [["U_ANN", "Ann Lee"], ["U_AL", "Al Day"], ["U_AMY", "Amy"]] });
    await aMember("U_JUNO", "Juno Whitlock");
    const { asSignedIn } = await aSession(t, juno);

    expect(await groupBoards("all", asSignedIn)).toMatchObject({ kind: "boards", groups: { standing: { kind: "no-group" } }, myGroup: null });
  });

  test("GB17: the group boards follow the Everyone board's unlock and stay hidden until the member opens the Leaderboard", async () => {
    await flagsOn("website", "everyone-board", "groups", "xp-levels", "unlocks");
    await unlocksShippedBeforeAnyoneJoined(t);
    await groupsOf({ Ants: [["U_JUNO", "Juno Whitlock"], ["U_ANN", "Ann Lee"], ["U_AL", "Al Day"]] });
    const { asSignedIn } = await aSession(t, juno);

    expect(await groupBoards("week", asSignedIn)).toEqual({ kind: "boards", groups: null, myGroup: null });
  });

});

describe("website reads pass one guard", () => {
  test("getGroupBoards reads signed out without a session", async () => {
    await flagsOn("website", "everyone-board", "groups");

    expect(await groupBoards("week")).toEqual({ kind: "signed-out" });
  });

  test("getGroupBoards reads closed while the website flag is off, even with groups on", async () => {
    await flagsOn("everyone-board", "groups");
    await groupsOf({ Ants: [["U_JUNO", "Juno Whitlock"], ["U_ANN", "Ann Lee"], ["U_AL", "Al Day"]] });
    const { asSignedIn } = await aSession(t, juno);

    expect(await groupBoards("week", asSignedIn)).toEqual({ kind: "closed" });
  });
});

type Named = [user: string, name: string];

async function groupsOf<N extends string>(membersOf: Record<N, Named[]>) {
  return t.run(async (ctx) => {
    const groups = {} as Record<N, GroupId>;
    const members: Record<string, MemberId> = {};
    for (const [name, people] of Object.entries(membersOf) as Array<[N, Named[]]>) {
      groups[name] = await ctx.db.insert("userGroups", { workspace: "T1", group: `S_${name.toUpperCase()}`, handle: name.toLowerCase(), name, enabled: true, automatic: false, members: people.length, asOf: 0, membersAsOf: 0 });
      for (const [user, memberName] of people) {
        const member = await ctx.db.insert("members", { workspace: "T1", user, kind: "member", name: memberName, asOf: 0 });
        await ctx.db.insert("memberGroups", { workspace: "T1", member, groups: [groups[name]], primary: groups[name] });
        members[user] = member;
      }
    }
    return { groups, members };
  });
}

function aMember(user: string, name: string) {
  return t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user, kind: "member", name, asOf: 0 }));
}

async function attributed(giver: MemberId | undefined, group: GroupId, kudos: number, day: string) {
  const message = { workspace: "T1", conversation: "C1", message: String(messages++) };
  const event = { type: "awardsAttributed" as const, workspace: "T1", message, giver: giver!, group, kudos, day, at: Date.parse(`${day}T09:00:00Z`), awards: [] };
  await t.mutation(internal.leaderboard.groupTotals.countAwardsAttributed, { event });
}

async function flagsOn(...keys: string[]) {
  await flagsFromPostHog(t, postHog, ...keys.map(onForEveryone));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
}

function groupBoards(period: Period, asSignedIn: Pick<Backend, "query"> = t) {
  return asSignedIn.query(api.website.groupBoards.getGroupBoards, { period });
}
