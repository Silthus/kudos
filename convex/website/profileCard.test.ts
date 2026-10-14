import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, offForEveryone, onForEmails, onForEveryone } from "../../testing/flags";
import { signedRequest } from "../../testing/signedSlack";
import { memberChanged, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { slashCommandResponseUrl } from "../../testing/slackMessages";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aMember, aSession, aSignedInSession } from "../../testing/website";
import { api } from "../_generated/api";
import type { LadderId, TierId } from "../achievements/ladders";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-14T10:00:00Z");
const cardFlag = "profile-card";
const shippedFlags = ["website", "xp-levels", "unlocks", "achievements"];
const levelSevenXp = 1500;
const ann = { user: "U_ANN", name: "Ann Quill", email: "ann@example.com" };
const bea = { user: "U_BEA", name: "Bea Marsh", email: "bea@example.com" };
const medalEmoji: Record<TierId, string> = { bronze: "🥉", silver: "🥈", gold: "🥇", diamond: "💎" };

type Card = { kind: "card"; name: string; level: number | null; medals: { ladder: LadderId; tier: TierId; name: string }[] };

let slack: FakeSlack;
let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  slack = new FakeSlack().withMember(ann.user, slackProfileOf(ann)).withMember(bea.user, slackProfileOf(bea));
  postHog = new FakePostHog();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("website reads pass one guard", () => {
  test("getProfileCard reads closed while the website flag is off, even with profile-card on", async () => {
    const t = await workspace({ flags: [offForEveryone("website"), ...["xp-levels", "unlocks", "achievements", cardFlag].map(onForEveryone)] });
    const { asSignedIn } = await aSession(t, { user: ann.user, name: ann.name });

    expect(await asSignedIn.query(api.website.profileCard.getProfileCard, {})).toEqual({ kind: "closed" });
  });

  test("getProfileCard reads signed out without a session", async () => {
    const t = await workspace();

    expect(await t.query(api.website.profileCard.getProfileCard, {})).toEqual({ kind: "signed-out" });
  });

  test("getProfileCard reads not-a-member for a former member with a live session", async () => {
    const t = await workspace();
    await aMember(t, "U_GONE", "not-a-member");
    const { asSignedIn } = await aSession(t, { user: "U_GONE" });

    expect(await asSignedIn.query(api.website.profileCard.getProfileCard, {})).toEqual({ kind: "not-a-member" });
  });

  test("getProfileCard rejects an argument that names another member", async () => {
    const t = await workspace();
    const asAnn = await signedIn(t, ann);
    const withAnotherMember = { user: bea.user } as unknown as Record<string, never>;

    await expect(asAnn.query(api.website.profileCard.getProfileCard, withAnotherMember)).rejects.toThrow(/user/);
  });
});

describe("PC15: the website reads the member's own profile card", () => {
  test("the card holds exactly the name, level and best four medals the member's own Slack card shows", async () => {
    const t = await workspace();
    const asAnn = await signedIn(t, ann);
    await withXp(t, ann, levelSevenXp);
    await earned(t, ann, "dependability", "bronze", "silver", "gold");
    await earned(t, ann, "applause", "bronze");
    await earned(t, ann, "connections", "bronze", "silver");
    await earned(t, ann, "generosity", "bronze", "silver", "gold");
    await earned(t, ann, "recognition", "bronze", "silver", "gold", "diamond");
    await bookOpenedBy(t, ann);

    const websiteCard = await asAnn.query(api.website.profileCard.getProfileCard, {});

    expect(websiteCard).toStrictEqual({
      kind: "card",
      name: "Ann Quill",
      level: 7,
      medals: [
        { ladder: "recognition", tier: "diamond", name: "Hall of Fame" },
        { ladder: "generosity", tier: "gold", name: "Heart of the Team" },
        { ladder: "dependability", tier: "gold", name: "Pillar" },
        { ladder: "connections", tier: "silver", name: "Connector" },
      ],
    });
    expect(await ownSlackCard(t, ann)).toBe(asSlackShows(ann, websiteCard as Card));
  });

  test("a member who hasn't opened the Book reads no medals, as their own Slack card shows none", async () => {
    const t = await workspace();
    const asAnn = await signedIn(t, ann);
    await earned(t, ann, "generosity", "bronze", "silver");

    const websiteCard = await asAnn.query(api.website.profileCard.getProfileCard, {});

    expect(websiteCard).toStrictEqual({ kind: "card", name: "Ann Quill", level: 1, medals: [] });
    expect(await ownSlackCard(t, ann)).toBe(asSlackShows(ann, websiteCard as Card));
  });

  test("with xp-levels off in the workspace, the card has no level", async () => {
    const t = await workspace({ flags: ["website", cardFlag].map(onForEveryone), book: false });
    const asAnn = await signedIn(t, ann);

    expect(await asAnn.query(api.website.profileCard.getProfileCard, {})).toStrictEqual({ kind: "card", name: "Ann Quill", level: null, medals: [] });
  });

  test("a member the directory has no display name for reads as a teammate", async () => {
    const t = await workspace();
    await aMember(t, "U_NAMELESS");
    const { asSignedIn } = await aSession(t, { user: "U_NAMELESS" });

    expect(await asSignedIn.query(api.website.profileCard.getProfileCard, {})).toStrictEqual({ kind: "card", name: "A teammate", level: 1, medals: [] });
  });
});

describe("PC15 PC17: getProfileCard follows the member's own profile-card decision", () => {
  test("with profile-card off for everyone, the card reads not-found", async () => {
    const t = await workspace({ flags: [...shippedFlags.map(onForEveryone), offForEveryone(cardFlag)] });
    const asAnn = await signedIn(t, ann);
    await earned(t, ann, "generosity", "bronze");
    await bookOpenedBy(t, ann);

    expect(await asAnn.query(api.website.profileCard.getProfileCard, {})).toEqual({ kind: "not-found" });
  });

  test("with profile-card on for one email, only that member reads their card", async () => {
    const t = await workspace({ flags: [...shippedFlags.map(onForEveryone), onForEmails(cardFlag, ann.email)] });
    const asAnn = await signedIn(t, ann);
    const asBea = await signedIn(t, bea);

    expect(await asAnn.query(api.website.profileCard.getProfileCard, {})).toMatchObject({ kind: "card", name: "Ann Quill" });
    expect(await asBea.query(api.website.profileCard.getProfileCard, {})).toEqual({ kind: "not-found" });
  });
});

type WorkspaceSetup = { flags?: FlagDefinition[]; book?: boolean };

async function workspace({ flags = [...shippedFlags, cardFlag].map(onForEveryone), book = true }: WorkspaceSetup = {}) {
  const t = await flagsFromPostHog(testBackend(), postHog, ...flags);
  if (book) await bookShippedBeforeAnyoneJoined(t);
  for (const person of [ann, bea]) await memberChanged(t, "team_join", { id: person.user, ...slackProfileOf(person) });
  await settle(t);
  return t;
}

function slackProfileOf({ name, email }: { name: string; email: string }) {
  return { profile: { display_name: name, email } };
}

async function signedIn(t: Backend, { user, name }: { user: string; name: string }) {
  const { asSignedIn } = await aSignedInSession(t, { user, name });
  return asSignedIn;
}

async function memberOf(t: Backend, { user }: { user: string }): Promise<MemberId> {
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return row!._id;
  });
}

async function withXp(t: Backend, person: { user: string }, xp: number) {
  const member = await memberOf(t, person);
  await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp, pointsSpent: 0 }));
}

async function earned(t: Backend, person: { user: string }, ladder: LadderId, ...tiers: TierId[]) {
  const member = await memberOf(t, person);
  await t.run(async (ctx) => {
    for (const tier of tiers) {
      const award = await ctx.db.insert("awards", { workspace: "T1", conversation: "C0", message: `${ladder}-${tier}`, giver: member, recipient: member, kudos: 1, day: "2026-10-13", at: Date.now() });
      await ctx.db.insert("earnedTiers", { member, ladder, tier, earnedAt: Date.now(), award, catalogueVersion: "1", rewards: [] });
    }
  });
}

async function bookOpenedBy(t: Backend, person: { user: string }) {
  const member = await memberOf(t, person);
  await reachesLevel(t, member, 4);
  await opens(t, member, "book");
}

async function ownSlackCard(t: Backend, { user }: { user: string }) {
  const body = new URLSearchParams({
    team_id: "T1",
    channel_id: "C1",
    channel_name: "general",
    user_id: user,
    command: "/hedgehug",
    text: `<@${user}>`,
    response_url: slashCommandResponseUrl,
    trigger_id: "1.2.3",
  }).toString();
  const response = await t.fetch("/slack/commands", await signedRequest(body, { contentType: "application/x-www-form-urlencoded" }));
  const reply = (await response.json()) as { text: string };
  await settle(t);
  return reply.text;
}

function asSlackShows({ user }: { user: string }, { level, medals }: Card) {
  const levelLine = level === null ? [] : [`Level ${level}`];
  const medalLine = medals.length === 0 ? [] : [medals.map(({ tier, name }) => `${medalEmoji[tier]} ${name}`).join(" · ")];
  return [`*<@${user}>*`, ...levelLine, ...medalLine].join("\n");
}
