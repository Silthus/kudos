import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { convexStops, memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, switchWebsite } from "../../testing/website";
import { internal } from "../_generated/api";
import type { MemberId } from "../workspace/directory";
import { emojiNameOf, type EarnedEmojiId } from "./emojiNames";

const minuteMs = 60_000;
const why = "Thanks for the patient walkthrough of the ledger importer";
const giver = { user: "U_GIVER", name: "Ines Holloway" };

type Person = { user: string; name: string };

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date("2026-10-13T10:00:00Z") });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom();
  slack = new FakeSlack();
  slack.withMember(giver.user, { real_name: giver.name });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend();
  await switchWebsite(t, postHog, true, "album");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("an earned emoji's name never moves", () => {
  test("the first thoughtful kudos reserves the level, every milestone tier's and the company team names before it names the hype emoji of the person it thanked", async () => {
    await companyTeams(team("lanterns", "Lanterns"), team("kites", "Kites"));
    const wren = await aMember({ user: "U_WREN", name: "Wren Halloway" });

    await thanks(wren);

    expect(await namesOf("level:5", "level:10", "level:15", "level:20", "level:25")).toEqual(["level-5", "level-10", "level-15", "level-20", "level-25"]);
    expect(await namesOf("milestone:people:bronze", "milestone:people:silver", "milestone:people:gold", "milestone:people:diamond")).toEqual(["first-face", "familiar-faces", "full-of-friends", "everyone-s-album"]);
    expect(await namesOf("milestone:teams:gold", "milestone:reach:gold", "milestone:hoggies:gold", "milestone:thoughtful:gold")).toEqual(["most-of-the-company", "well-travelled", "hoarder", "heart-of-the-team"]);
    expect(await namesOf("milestone:hoggies:bronze", "milestone:thoughtful:diamond")).toEqual(["curious", "patron-of-praise"]);
    expect(await namesOf("team:lanterns", "team:kites")).toEqual(["team-lanterns", "team-kites"]);
    expect(await hypeNameOf(wren)).toBe("wren-halloway-hype");
  });

  test("before any thoughtful kudos nothing is named, and a short kudos names nothing", async () => {
    await companyTeams(team("lanterns", "Lanterns"));
    const wren = await aMember({ user: "U_WREN", name: "Wren Halloway" });

    await thanks(wren, "ty");

    expect(await namesOf("level:5", "team:lanterns")).toEqual([null, null]);
    expect(await hypeNameOf(wren)).toBeNull();
  });

  test("two namesakes get the name and its first free number, and a namesake who joins and leaves after the first was named moves nothing", async () => {
    const first = await aMember({ user: "U_SAM_1", name: "Sam Rivera" });
    const second = await aMember({ user: "U_SAM_2", name: "Sam Rivera" });
    await thanks(first);
    await thanks(second);
    const third = await aMember({ user: "U_SAM_3", name: "Sam Rivera" });
    await memberChanged(t, "user_change", { id: "U_SAM_3", deleted: true, real_name: "Sam Rivera" });
    await settle(t);
    await thanks(first, "Thanks again for the calm handover of the pager");

    expect([await hypeNameOf(first), await hypeNameOf(second), await hypeNameOf(third)]).toEqual(["sam-rivera-hype", "sam-rivera-2-hype", null]);
  });

  test("a hype name is the slug of the person's full name, not their Slack display name", async () => {
    const sam = await aMember({ user: "U_SAM", name: "Sam Rivera" }, "sam");

    await thanks(sam);

    expect(await hypeNameOf(sam)).toBe("sam-rivera-hype");
  });

  test("a rename keeps the name a person's hype emoji was given", async () => {
    const wren = await aMember({ user: "U_WREN", name: "Wren Halloway" });
    await thanks(wren);

    await memberChanged(t, "user_change", { id: "U_WREN", real_name: "Wren Okafor", profile: { real_name: "Wren Okafor", display_name: "Wren Okafor" } });
    await settle(t);
    const namesake = await aMember({ user: "U_WREN_2", name: "Wren Halloway" });
    await thanks(namesake);

    expect([await hypeNameOf(wren), await hypeNameOf(namesake)]).toEqual(["wren-halloway-hype", "wren-halloway-2-hype"]);
  });

  test("a name with accents keeps its letters, and a name with no Latin letter becomes person-n-hype in registry order", async () => {
    const zoe = await aMember({ user: "U_ZOE", name: "Zoë Ångström-Núñez" });
    const lei = await aMember({ user: "U_LEI", name: "李雷" });
    const mei = await aMember({ user: "U_MEI", name: "韩梅梅" });

    await thanks(zoe, why, lei, mei);

    expect([await hypeNameOf(zoe), await hypeNameOf(lei), await hypeNameOf(mei)]).toEqual(["zoe-angstrom-nunez-hype", "person-1-hype", "person-2-hype"]);
  });

  test("a team named team-<slug> of its name gets the first free number where another team took it, a team with no Latin letter becomes team-n, and a team that appears later is reserved by the next sync", async () => {
    await companyTeams(team("hoarders", "Hoarders"), team("hoarders-guild", "Hoarders!"), team("kanji", "数据"));
    await thanks(await aMember({ user: "U_WREN", name: "Wren Halloway" }));

    await companyTeams(team("hoarders", "Hoarders"), team("hoarders-guild", "Hoarders!"), team("kanji", "数据"), team("lanterns", "Lanterns"));
    await companyTeams(team("lanterns", "Lantern Bearers"));

    expect(await namesOf("team:hoarders", "team:hoarders-guild", "team:kanji", "team:lanterns")).toEqual(["team-hoarders", "team-hoarders-2", "team-1", "team-lanterns"]);
  });

  test("a team named like a hype emoji keeps its name when a first pack comes before the sync's reservation runs", async () => {
    await thanks(await aMember({ user: "U_WREN", name: "Wren Halloway" }));
    const sam = await aMember({ user: "U_SAM", name: "Team Sam Rivera" });
    postHogCom.withTeams(team("sam-rivera-hype", "Sam Rivera Hype"));
    await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
    await convexStops(t, "album/emojiNames:reserveTeamNamesAfterTheSync");

    await thanks(sam);

    expect([await hypeNameOf(sam), ...(await namesOf("team:sam-rivera-hype"))]).toEqual(["team-sam-rivera-2-hype", "team-sam-rivera-hype"]);
  });

  test("a registry opened before team emojis were named team-<slug> moves every team nobody mapped to team-<slug> at the next sync, once, keeping a mapped team's name and every row", async () => {
    const teams = [team("lanterns", "Lanterns"), team("kites", "Kites"), team("people-ops", "People & Ops")];
    await companyTeams(...teams);
    const maintainer = await aMember({ user: "U_MAINTAINER", name: "Maya Brandt" });
    await aRegistryOpenedBeforeTheTeamPrefix([
      { emoji: "team:lanterns", name: "lanterns" },
      { emoji: "team:kites", name: "kites", mappedBy: { member: maintainer, as: "maintainer" } },
      { emoji: "team:people-ops", name: "people-ops" },
    ]);
    const teamRowsBefore = await teamEmojisNamed();

    await companyTeams(...teams);
    const moved = await namesOf("team:lanterns", "team:kites", "team:people-ops");
    await companyTeams(team("lanterns", "Lantern Bearers"), team("kites", "Kites"), team("people-ops", "People & Ops"));

    expect([moved, await teamEmojisNamed()]).toEqual([["team-lanterns", "kites", "team-people-ops"], teamRowsBefore]);
    expect(await namesOf("team:lanterns", "team:kites", "team:people-ops")).toEqual(moved);
  });

  test("a registry opened with team-<slug> names keeps a renamed team's name at the next sync", async () => {
    await companyTeams(team("lanterns", "Lanterns"));
    await thanks(await aMember({ user: "U_WREN", name: "Wren Halloway" }));

    await companyTeams(team("lanterns", "Lantern Bearers"));

    expect(await namesOf("team:lanterns")).toEqual(["team-lanterns"]);
  });

  test("a hype name is lower-cased, accent-free, one hyphen per run of other characters, trimmed and cut to 80 characters before its suffix", async () => {
    const friends = await aMember({ user: "U_FRIENDS", name: "  Ünïcode -- & Friends!! " });
    const long = await aMember({ user: "U_LONG", name: `${"A".repeat(79)} B` });

    await thanks(friends, why, long);

    expect([await hypeNameOf(friends), await hypeNameOf(long)]).toEqual(["unicode-friends-hype", `${"a".repeat(79)}-hype`]);
  });
});

function team(slug: string, name: string): TeamPage {
  return { slug, name, profiles: [{ id: slug.length, firstName: "Pat", lastName: name, colour: "teal" }] };
}

async function companyTeams(...teams: TeamPage[]) {
  postHogCom.withTeams(...teams);
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
  await settle(t);
}

async function aMember(person: Person, displayName = person.name): Promise<MemberId> {
  const profile = { real_name: person.name, display_name: displayName };
  slack.withMember(person.user, { real_name: person.name, profile });
  await memberChanged(t, "team_join", { id: person.user, real_name: person.name, profile });
  await settle(t);
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique(),
  );
  return row!._id;
}

async function thanks(recipient: MemberId, words = why, ...others: MemberId[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const users = await t.run(async (ctx) => Promise.all([recipient, ...others].map(async (member) => (await ctx.db.get(member))!.user)));
  await post(t, [section(text(`${words} `), ...users.map((user) => mention(user)), emoji("taco"))], { user: giver.user, ts: `${Date.now() / 1000}.${String(messages).padStart(6, "0")}` });
  await settle(t);
}

type OldRegistryRow = { emoji: EarnedEmojiId; name: string; mappedBy?: { member: MemberId; as: "member" | "maintainer" } };

async function aRegistryOpenedBeforeTheTeamPrefix(teamRows: OldRegistryRow[]) {
  await t.run(async (ctx) => {
    for (const { emoji: key, name, mappedBy } of [{ emoji: "level:5" as const, name: "level-5" }, ...teamRows]) await ctx.db.insert("emojiNames", { workspace: "T1", emoji: key, name, mappedBy });
  });
}

function teamEmojisNamed() {
  return t.run(async (ctx) => (await ctx.db.query("emojiNames").collect()).flatMap(({ emoji: key }) => (key.startsWith("team:") ? [key] : [])).toSorted());
}

function namesOf(...emojis: EarnedEmojiId[]) {
  return t.run(async (ctx) => Promise.all(emojis.map((id) => emojiNameOf(ctx, "T1", id))));
}

function hypeNameOf(person: MemberId) {
  return t.run((ctx) => emojiNameOf(ctx, "T1", `hype:${person}`));
}
