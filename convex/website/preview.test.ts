import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { anIdInHalfOf, onForEmails, onForEveryone, onForHalf, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSession, allowedWorkspace } from "../../testing/website";
import { api, components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { analyticsIdOf } from "../analytics/person";
import type { SignedInProfile } from "../slack/signIn";
import { rememberSignedInMember } from "./signIn";

const now = new Date("2026-10-14T10:00:00Z");
const siteUrl = "https://kudos-site.test";
const alice = { user: "U_ALICE", email: "alice@example.com", name: "Alice Hart" };
const bob = { user: "U_BOB", email: "bob@example.com", name: "Bob Reyes" };

const websiteForAlice = onForEmails("website", alice.email);
const everythingForAlice = ["website", "xp-levels", "everyone-board", "unlocks", "quests"].map((key) => onForEmails(key, alice.email));
const websiteForEveryoneTheRestForAlice = [onForEveryone("website"), ...everythingForAlice.slice(1)];

let postHog: FakePostHog;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  vi.stubEnv("SITE_URL", siteUrl);
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, new FakeSlack().fetch));
  t = testBackend();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function flagsServed(...definitions: FlagDefinition[]) {
  postHog.withFlags(...definitions);
  await t.action(components.posthog.lib.refreshFlagDefinitions, {});
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
}

async function aMemberWithEmail({ user, email }: { user: string; email: string }) {
  const member = await aMember(t, user);
  await t.run((ctx) => ctx.db.patch(member, { email }));
  return member;
}

function profileOf({ user, name }: { user: string; name: string }): SignedInProfile {
  return { id: `${allowedWorkspace}/${user}`, chatWorkspace: allowedWorkspace, chatUser: user, name };
}

function signIn(person: { user: string; name: string }) {
  return t.run((ctx) => rememberSignedInMember(ctx, { existingUserId: null, profile: profileOf(person) }));
}

async function sessionOf(userId: Id<"users">) {
  const sessionId = await t.run((ctx) => ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 3_600_000 }));
  return t.withIdentity({ subject: `${userId}|${sessionId}` });
}

async function signedIn(person: { user: string; name: string }) {
  return sessionOf(await signIn(person));
}

function myProfile(caller: Pick<Backend, "query"> = t) {
  return caller.query(api.website.profile.getMyProfile, {});
}

function openFeature(caller: Pick<Backend, "mutation">) {
  return caller.mutation(api.website.commands.openFeature, { feature: "leaderboard" });
}

function rowsOf<Table extends "users" | "flagExposures" | "previewMoments" | "unlockLaunches" | "journeyLaunches" | "bookLaunches">(table: Table) {
  return t.run((ctx) => ctx.db.query(table).collect());
}

function everyRowOf(...tables: Array<"analyticsIds" | "flagExposures" | "analyticsOutbox">) {
  return t.run(async (ctx) => Promise.all(tables.map((table) => ctx.db.query(table).collect())));
}

async function websiteExposures() {
  return (await rowsOf("flagExposures")).filter(({ flag }) => flag === "website").map(({ member, value }) => ({ member, value }));
}

async function previewMoments() {
  return (await rowsOf("previewMoments")).map(({ member, moment }) => ({ member, moment }));
}

function anAnalyticsIdFor(member: Id<"members">) {
  return t.run((ctx) => analyticsIdOf(ctx, member));
}

describe("F26 F27 F28 F29: a member previews the website by their own decision", () => {
  describe("F26: signing in admits on the workspace decision or the member's own", () => {
    test("while the website is closed for the workspace, the member it names by email signs in, sends their website exposure once, and reads their profile", async () => {
      const member = await aMemberWithEmail(alice);
      await flagsServed(websiteForAlice);

      const asAlice = await signedIn(alice);
      await signIn(alice);

      expect((await myProfile(asAlice)).kind).toBe("member");
      expect(await websiteExposures()).toEqual([{ member, value: true }]);
      expect(await myProfile()).toEqual({ kind: "closed" });
    });

    test("while the website is closed for the workspace, a member it doesn't name and a person the directory doesn't know are refused, and no account appears", async () => {
      await aMemberWithEmail(alice);
      await aMemberWithEmail(bob);
      await flagsServed(websiteForAlice);

      await expect(signIn(bob)).rejects.toThrow(/closed/);
      await expect(signIn({ user: "U_STRANGER", name: "Stranger" })).rejects.toThrow(/closed/);

      expect(await rowsOf("users")).toEqual([]);
      expect(await rowsOf("flagExposures")).toEqual([]);
    });

    test("signing in runs the previewing member's due preview moments, and never the unlocks launch or the Journey launch", async () => {
      const member = await aMemberWithEmail(alice);
      await flagsServed(...everythingForAlice);

      await signIn(alice);
      await settle(t);

      expect(await previewMoments()).toEqual([
        { member, moment: "unlocks" },
        { member, moment: "journey" },
      ]);
      expect(await rowsOf("unlockLaunches")).toEqual([]);
      expect(await rowsOf("journeyLaunches")).toEqual([]);
    });

    test("with the website on for the workspace, a member signs in with their website exposure and no preview moment runs", async () => {
      const member = await aMemberWithEmail(bob);
      await flagsServed(onForEveryone("website"), onForEveryone("xp-levels"), onForEveryone("unlocks"));

      await signIn(bob);

      expect(await websiteExposures()).toEqual([{ member, value: true }]);
      expect(await previewMoments()).toEqual([]);
      expect(await rowsOf("unlockLaunches")).toEqual([]);
    });
  });

  describe("F27: a signed-in member's reads follow their own decision", () => {
    test("while the website is closed for the workspace, a member it doesn't name reads closed with a live session, as a visitor without one does", async () => {
      const bobs = await aMemberWithEmail(bob);
      await aMemberWithEmail(alice);
      await flagsServed(websiteForAlice);
      await anAnalyticsIdFor(bobs);
      const { asSignedIn } = await aSession(t, { user: bob.user });

      expect(await myProfile(asSignedIn)).toEqual({ kind: "closed" });
      expect(await myProfile()).toEqual({ kind: "closed" });
    });

    test("a previewer's session that hasn't been verified yet reads closed, since the workspace decides for a person the directory doesn't know", async () => {
      await flagsServed(websiteForAlice);
      const { asSignedIn } = await aSession(t, { user: alice.user });

      expect(await myProfile(asSignedIn)).toEqual({ kind: "closed" });
    });

    test("with the website on for everyone, each member's pages follow their own XP, board, unlocks and quests decisions", async () => {
      const alices = await aMemberWithEmail(alice);
      const bobs = await aMemberWithEmail(bob);
      await flagsServed(...websiteForEveryoneTheRestForAlice);
      const asAlice = await signedIn(alice);
      const asBob = await signedIn(bob);
      await reachesLevel(t, alices, 3);
      await reachesLevel(t, bobs, 3);

      const alicesProfile = await myProfile(asAlice);
      const bobsProfile = await myProfile(asBob);

      expect(alicesProfile).toMatchObject({ kind: "member", progression: expect.objectContaining({ level: expect.any(Number) }), leaderboard: { kind: "open" } });
      expect(alicesProfile).toMatchObject({ features: expect.arrayContaining([expect.objectContaining({ feature: "leaderboard", state: "open" })]), journey: expect.any(Array) });
      expect(bobsProfile).toMatchObject({ kind: "member", progression: null, features: null, journey: null, leaderboard: { kind: "off" } });
      expect((await asAlice.query(api.website.leaderboard.getLeaderboard, { period: "week" })).kind).toBe("board");
      expect(await asBob.query(api.website.leaderboard.getLeaderboard, { period: "week" })).toEqual({ kind: "not-found" });
      expect((await asAlice.query(api.website.quests.getQuests, {})).kind).not.toBe("not-found");
      expect(await asBob.query(api.website.quests.getQuests, {})).toEqual({ kind: "not-found" });
    });
  });

  describe("F27: the website on for the workspace and off in one member's own decision", () => {
    const halfTheWebsite = onForHalf("website");

    function bucketed(inside: boolean) {
      return anIdInHalfOf("website", inside);
    }

    async function aWorkspaceInsideAndBobOutside() {
      const workspaceKey = await bucketed(true);
      const analyticsId = await bucketed(false);
      const member = await aMemberWithEmail(bob);
      await t.run(async (ctx) => {
        await ctx.db.insert("workspaceKeys", { workspace: allowedWorkspace, workspaceKey });
        await ctx.db.insert("analyticsIds", { member, analyticsId });
      });
      await flagsServed(halfTheWebsite);
      return member;
    }

    test("a member with no analytics ID yet, whose session the workspace decision admits, is refused by their own decision and the command writes nothing at all", async () => {
      const workspaceKey = await bucketed(true);
      const analyticsId = await bucketed(false);
      await aMemberWithEmail(bob);
      await t.run((ctx) => ctx.db.insert("workspaceKeys", { workspace: allowedWorkspace, workspaceKey }));
      await flagsServed(halfTheWebsite);
      const { asSignedIn } = await aSession(t, { user: bob.user });
      vi.spyOn(crypto, "randomUUID").mockReturnValue(analyticsId as ReturnType<typeof crypto.randomUUID>);
      const before = await everyRowOf("analyticsIds", "flagExposures", "analyticsOutbox");

      expect(await openFeature(asSignedIn)).toEqual({ kind: "closed" });
      expect(await everyRowOf("analyticsIds", "flagExposures", "analyticsOutbox")).toEqual(before);
    });

    test("the member signs in on the workspace decision with their own exposure off, then reads closed, while a visitor without a session is asked to sign in", async () => {
      const member = await aWorkspaceInsideAndBobOutside();

      const asBob = await signedIn(bob);

      expect(await websiteExposures()).toEqual([{ member, value: false }]);
      expect(await myProfile(asBob)).toEqual({ kind: "closed" });
      expect(await myProfile()).toEqual({ kind: "signed-out" });
    });
  });

  describe("F21: a previewer's command never records a workspace launch the flag's switch made due", () => {
    const everyFlagOn = ["website", "xp-levels", "everyone-board", "unlocks", "quests"].map(onForEveryone);

    test("unlocks switched on for the workspace after the preview: the previewer's open answers refused and records no unlocks launch", async () => {
      await aMemberWithEmail(alice);
      await flagsServed(...everythingForAlice);
      const asAlice = await signedIn(alice);
      await flagsServed(...everyFlagOn);

      expect(await openFeature(asAlice)).toEqual({ kind: "refused" });
      expect(await rowsOf("unlockLaunches")).toEqual([]);
      expect(await rowsOf("journeyLaunches")).toEqual([]);
    });

    test("unlocks and quests switched on for the workspace after an unlocks preview: the previewer's command starts no Journey preview, and nothing it schedules records a launch", async () => {
      const member = await aMemberWithEmail(alice);
      await flagsServed(...everythingForAlice.filter(({ key }) => key !== "quests"));
      const asAlice = await signedIn(alice);
      await flagsServed(onForEmails("website", alice.email), ...everyFlagOn.filter(({ key }) => key !== "website"));

      expect(await openFeature(asAlice)).toEqual({ kind: "refused" });
      await settle(t);

      expect(await previewMoments()).toEqual([{ member, moment: "unlocks" }]);
      expect(await rowsOf("unlockLaunches")).toEqual([]);
      expect(await rowsOf("journeyLaunches")).toEqual([]);
    });

    test("quests switched on for the workspace after the preview, with unlocks launched: the previewer's open answers refused and records no Journey launch", async () => {
      await aMemberWithEmail(alice);
      await flagsServed(...everythingForAlice);
      const asAlice = await signedIn(alice);
      await flagsServed(...everyFlagOn.filter(({ key }) => key !== "quests"));
      await unlocksShippedBeforeAnyoneJoined(t, allowedWorkspace);
      await flagsServed(...everyFlagOn);

      expect(await openFeature(asAlice)).toEqual({ kind: "refused" });
      expect(await rowsOf("journeyLaunches")).toEqual([]);
    });
    test("achievements switched on for the workspace after unlocks launched: the previewer's sign-in runs no Journey preview, and their open answers refused and records no Book launch", async () => {
      await aMemberWithEmail(alice);
      const workspaceFlags = everyFlagOn.filter(({ key }) => key !== "website" && key !== "quests");
      await flagsServed(websiteForAlice, onForEmails("quests", alice.email), ...workspaceFlags);
      await unlocksShippedBeforeAnyoneJoined(t, allowedWorkspace);
      await flagsServed(websiteForAlice, onForEmails("quests", alice.email), ...workspaceFlags, onForEveryone("achievements"));

      const asAlice = await signedIn(alice);

      expect(await previewMoments()).toEqual([]);
      expect(await openFeature(asAlice)).toEqual({ kind: "refused" });
      await settle(t);
      expect(await rowsOf("bookLaunches")).toEqual([]);
      expect(await rowsOf("journeyLaunches")).toEqual([]);
    });
  });

  describe("F29: a session from before the preview", () => {
    test("the previewer's first command sends the website exposure and runs the preview moment, so their Open works", async () => {
      const member = await aMemberWithEmail(alice);
      await flagsServed(...everythingForAlice);
      await anAnalyticsIdFor(member);
      const { asSignedIn } = await aSession(t, { user: alice.user });

      expect(await openFeature(asSignedIn)).toEqual({ kind: "opened" });
      expect(await websiteExposures()).toEqual([{ member, value: true }]);
      expect(await previewMoments()).toContainEqual({ member, moment: "unlocks" });
      expect(await rowsOf("unlockLaunches")).toEqual([]);
      expect(await rowsOf("journeyLaunches")).toEqual([]);
    });

    test("a member the preview doesn't name answers closed and writes nothing", async () => {
      const member = await aMemberWithEmail(bob);
      await aMemberWithEmail(alice);
      await flagsServed(...everythingForAlice);
      await anAnalyticsIdFor(member);
      const { asSignedIn } = await aSession(t, { user: bob.user });
      const before = await rowsOf("flagExposures");

      expect(await openFeature(asSignedIn)).toEqual({ kind: "closed" });
      expect(await rowsOf("flagExposures")).toEqual(before);
      expect(await previewMoments()).toEqual([]);
    });
  });

  describe("F28: App Home's way in for a previewer", () => {
    test("while the website is closed for the workspace, the previewer's App Home links to the direct sign-in entry of each page, and another member's has no link", async () => {
      const alices = await aMemberWithEmail(alice);
      const bobs = await aMemberWithEmail(bob);
      await flagsServed(...everythingForAlice);
      await signIn(alice);
      await anAnalyticsIdFor(bobs);
      await reachesLevel(t, alices, 3);

      const alicesLinks = await t.query(internal.website.link.frontDoorLinksOf, { workspace: allowedWorkspace, user: alice.user });
      const bobsLinks = await t.query(internal.website.link.frontDoorLinksOf, { workspace: allowedWorkspace, user: bob.user });

      expect(alicesLinks).toEqual({ origin: `${siteUrl}/sign-in`, pages: [
          { label: "Quests", url: `${siteUrl}/sign-in/quests` },
          { label: "Leaderboard", url: `${siteUrl}/sign-in/leaderboard` },
        ],
        sections: ["visibility"],
      });
      expect(bobsLinks).toBeNull();
    });

    test("with the website on for the workspace, App Home links to the pages themselves", async () => {
      await aMemberWithEmail(bob);
      await flagsServed(onForEveryone("website"));

      expect(await t.query(internal.website.link.frontDoorLinksOf, { workspace: allowedWorkspace, user: bob.user })).toEqual({ origin: siteUrl, pages: [], sections: [] });
    });
  });
});
