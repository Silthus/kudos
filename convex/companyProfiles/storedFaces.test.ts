import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom, type TeamPageProfile } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { seenKeyOf } from "../website/seen";
import type { MemberId } from "../workspace/directory";
import { companyProfilesIn } from "./matcher";

const now = new Date("2026-10-18T10:00:00Z");
const minute = 60 * 1000;

const wrenProfile = { id: 1, firstName: "Wren", lastName: "Halloway", colour: "lilac", cutout: aCutout("wren") };
const orielProfile = { id: 2, firstName: "Oriel", lastName: "Pemberton", colour: "teal", cutout: aCutout("oriel") };
const cutoutOf = (file: string) => `https://res.cloudinary.com/posthog-test/image/upload/c_limit,w_160,f_auto,q_auto/v1/${file}.png`;

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let slack: FakeSlack;
let t: Backend;

beforeEach(async () => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom();
  slack = new FakeSlack();
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(urlOf(input)) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1" }));
  await switchWebsite(t, postHog, true, "team-pages");
  await onPostHogCom(wrenProfile, orielProfile);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function urlOf(input: string | URL | Request) {
  return new URL(input instanceof Request ? input.url : input);
}

async function onPostHogCom(...people: TeamPageProfile[]) {
  postHogCom.withTeams({ slug: "analytics", name: "Analytics", profiles: people });
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
  await settle(t);
}

function later() {
  vi.setSystemTime(Date.now() + minute);
}

async function slackSays(type: "team_join" | "user_change", user: string, fields: Record<string, unknown>) {
  later();
  await memberChanged(t, type, { id: user, ...fields });
  await settle(t);
}

function aMemberNamed(realName: string, { admin = false } = {}) {
  return { real_name: realName, profile: { real_name: realName }, ...(admin && { is_admin: true }) };
}

async function memberOf(user: string): Promise<MemberId> {
  const row = await t.run((ctx) => ctx.db.query("members").withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user)).unique());
  return row!._id;
}

async function storedAndMatchedFaces() {
  return t.run(async (ctx) => {
    const { matches } = await companyProfilesIn(ctx, "T1");
    const members = await ctx.db.query("members").withIndex("by_user", (q) => q.eq("workspace", "T1")).collect();
    const matched = Object.fromEntries(
      members.filter(({ kind }) => kind === "member").map(({ _id }) => {
        const profile = matches.get(_id)?.profile;
        return [_id, profile?.image === undefined ? null : { image: profile.image, colour: profile.colour }];
      }),
    );
    const stored = Object.fromEntries((await ctx.db.query("companyFaces").withIndex("by_member", (q) => q.eq("workspace", "T1")).collect()).map(({ member, face }) => [member, face]));
    return { stored, matched };
  });
}

async function expectStoredFacesToFollowTheMatcher() {
  const { stored, matched } = await storedAndMatchedFaces();
  expect(stored).toEqual(matched);
  return stored;
}

describe("CV22: each member's stored company face follows the matcher through every change", { timeout: 60_000 }, () => {
  test("joins, namesakes, renames, leaving, own and admin links, and a new copy of posthog.com each leave the stored faces equal to the matcher's", async () => {
    await slackSays("team_join", "U_WREN", aMemberNamed("Wren Halloway"));
    const wren = await memberOf("U_WREN");
    expect((await expectStoredFacesToFollowTheMatcher())[wren]).toEqual({ image: cutoutOf("wren"), colour: "#8567FF" });

    await slackSays("team_join", "U_TWIN", aMemberNamed("Wren Halloway"));
    expect((await expectStoredFacesToFollowTheMatcher())[wren]).toBeNull();

    await slackSays("user_change", "U_TWIN", aMemberNamed("Wren Other"));
    expect((await expectStoredFacesToFollowTheMatcher())[wren]).toEqual({ image: cutoutOf("wren"), colour: "#8567FF" });

    const twin = await memberOf("U_TWIN");
    const { asSignedIn: asTwin } = await aSignedInSession(t, { user: "U_TWIN", name: "Wren Other" });
    await asTwin.mutation(api.website.commands.linkMyCompanyProfile, { profile: 2 });
    await settle(t);
    expect((await expectStoredFacesToFollowTheMatcher())[twin]).toEqual({ image: cutoutOf("oriel"), colour: "#29DBBB" });

    await slackSays("team_join", "U_ADMIN", aMemberNamed("Ada Admin", { admin: true }));
    const { asSignedIn: asAdmin } = await aSignedInSession(t, { user: "U_ADMIN", name: "Ada Admin" });
    const admin = await memberOf("U_ADMIN");
    const wrensKey = await seenKeyOf(admin, `member:${wren}`);
    expect(await asAdmin.mutation(api.website.commands.linkCompanyProfile, { member: wrensKey, profile: "none" })).toEqual({ kind: "linked" });
    await settle(t);
    expect((await expectStoredFacesToFollowTheMatcher())[wren]).toBeNull();
    expect(await asAdmin.mutation(api.website.commands.linkCompanyProfile, { member: wrensKey, profile: null })).toEqual({ kind: "linked" });
    await settle(t);
    expect((await expectStoredFacesToFollowTheMatcher())[wren]).toEqual({ image: cutoutOf("wren"), colour: "#8567FF" });

    await slackSays("user_change", "U_TWIN", { ...aMemberNamed("Wren Other"), deleted: true });
    expect(Object.keys(await expectStoredFacesToFollowTheMatcher())).not.toContain(twin);

    await onPostHogCom({ ...wrenProfile, colour: "teal" }, orielProfile);
    expect((await expectStoredFacesToFollowTheMatcher())[wren]).toEqual({ image: cutoutOf("wren"), colour: "#29DBBB" });
  });

  test("a join records the member in its own transaction, and their face is kept in a job after it", async () => {
    later();
    await memberChanged(t, "team_join", { id: "U_WREN", ...aMemberNamed("Wren Halloway") });
    const wren = await memberOf("U_WREN");
    expect((await storedAndMatchedFaces()).stored).toEqual({});

    await settle(t);

    expect((await expectStoredFacesToFollowTheMatcher())[wren]).toEqual({ image: cutoutOf("wren"), colour: "#8567FF" });
  });

  test("the users.list backfill's real names reach the stored faces", async () => {
    await slackSays("team_join", "U_WREN", { profile: {} });
    const wren = await memberOf("U_WREN");
    expect((await expectStoredFacesToFollowTheMatcher())[wren]).toBeNull();

    slack.withMember("U_WREN", { real_name: "Wren Halloway", profile: { real_name: "Wren Halloway" } });
    await t.action(internal.slack.directory.fillMemberProfiles, {});
    await settle(t);

    expect((await expectStoredFacesToFollowTheMatcher())[wren]).toEqual({ image: cutoutOf("wren"), colour: "#8567FF" });
  });
});

describe("CV22: each member's stored company face follows the matcher through every change", { timeout: 60_000 }, () => {
  test("a new copy of posthog.com keeps the stored faces of a workspace the directory knows without a workspaces row", async () => {
    await t.run(async (ctx) => {
      const row = await ctx.db.query("workspaces").first();
      await ctx.db.delete(row!._id);
    });
    await slackSays("team_join", "U_WREN", aMemberNamed("Wren Halloway"));
    const wren = await memberOf("U_WREN");
    expect(await t.run((ctx) => ctx.db.query("workspaces").collect())).toEqual([]);

    await onPostHogCom({ ...wrenProfile, colour: "teal" }, orielProfile);

    expect((await expectStoredFacesToFollowTheMatcher())[wren]).toEqual({ image: cutoutOf("wren"), colour: "#29DBBB" });
  });
});

describe("a new copy of posthog.com stays within Convex's transaction limits", { timeout: 300_000 }, () => {
  test("six workspaces of 3,000 members each have their faces stored after a sync, each workspace in a transaction of its own", async () => {
    t = testBackend({ transactionLimits: true });
    const workspaces = ["T1", "T2", "T3", "T4", "T5", "T6"];
    for (const workspace of workspaces) {
      await t.run(async (ctx) => {
        await ctx.db.insert("workspaces", { workspace });
        for (let n = 0; n < 3000; n += 1) await ctx.db.insert("members", { workspace, user: `U${n}`, kind: "member", asOf: 0, name: `Person ${n}`, realName: n === 0 ? "Wren Halloway" : `Person ${n}` });
      });
    }

    await onPostHogCom(wrenProfile, orielProfile);

    const stored = await t.run(async (ctx) => Promise.all(workspaces.map(async (workspace) => (await ctx.db.query("companyFaces").withIndex("by_member", (q) => q.eq("workspace", workspace)).collect()).length)));
    expect(stored).toEqual(workspaces.map(() => 3000));
  });
});

describe("CV22: getMyFace reads the member's stored face", () => {
  test("a stored face is the face getMyFace answers, whatever the directory says", async () => {
    await slackSays("team_join", "U_WREN", aMemberNamed("Wren Halloway"));
    const wren = await memberOf("U_WREN");
    const stored = { image: cutoutOf("someone-else"), colour: "#000000" };
    await t.run(async (ctx) => {
      const row = await ctx.db.query("companyFaces").withIndex("by_member", (q) => q.eq("workspace", "T1").eq("member", wren)).unique();
      await ctx.db.patch(row!._id, { face: stored });
    });
    const { asSignedIn } = await aSignedInSession(t, { user: "U_WREN", name: "Wren Halloway" });

    expect(await asSignedIn.query(api.website.face.getMyFace, {})).toEqual({ kind: "company-profile", ...stored, initials: "WH" });
  });

  test("a member without a stored face yet reads the matcher's", async () => {
    const wren = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_WREN", kind: "member", asOf: 0, name: "Wren Halloway", realName: "Wren Halloway" }));
    const { asSignedIn } = await aSignedInSession(t, { user: "U_WREN", name: "Wren Halloway" });

    expect(await t.run((ctx) => ctx.db.query("companyFaces").withIndex("by_member", (q) => q.eq("workspace", "T1").eq("member", wren)).unique())).toBeNull();
    expect(await asSignedIn.query(api.website.face.getMyFace, {})).toEqual({ kind: "company-profile", image: cutoutOf("wren"), colour: "#8567FF", initials: "WH" });
  });
});
