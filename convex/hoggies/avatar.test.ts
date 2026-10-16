import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined } from "../../testing/flags";
import { holds } from "../../testing/hoggies";
import { signedRequest } from "../../testing/signedSlack";
import { memberChanged, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, menuOptionInHome, menuOptionsInHome, publishedHome, staleMenuOptionOf } from "../../testing/slackInteractions";
import { appHomeOpened, slashCommandResponseUrl } from "../../testing/slackMessages";
import { opens, reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import { xpToReach } from "../progression/levels";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-14T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const ann = { user: "U_ANN", name: "Ann Quill", email: "ann@example.com" };
const bea = { user: "U_BEA", name: "Bea Marsh", email: "bea@example.com" };
const avatarFlags = ["xp-levels", "unlocks", "achievements", "collection", "profile-card", "hoggie-avatar"];
const siteUrl = "https://kudos-site.test";
const banana = { hoggie: "banana", name: "Banana", rarity: "common", art: { kind: "hoggie", slug: "banana" } };
const rocket = { hoggie: "rocket", name: "Rocket", rarity: "legendary", art: { kind: "hoggie", slug: "rocket" } };
const noAvatarLine = "Pick a hoggie you hold as your avatar.";

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  vi.stubEnv("SITE_URL", siteUrl);
  postHog = new FakePostHog();
  slack = new FakeSlack().withMember(ann.user, slackProfileOf(ann)).withMember(bea.user, slackProfileOf(bea));
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("HA1: a member picks a hoggie they hold as their avatar, changes it or goes back to none", { timeout: 60_000 }, () => {
  test("App Home's hoggies offer Use as avatar with every held hoggie; a pick sets it, another changes it and No avatar clears it", async () => {
    const member = await annWithTheBook();
    await holds(t, member, "banana", "rocket");
    await openHome(ann.user);

    expect(menuOptionsInHome(slack, ann.user, noAvatarLine)).toEqual(["Banana (⬜ Common)", "Rocket (🟧 Legendary)"]);

    await click(ann.user, menuOptionInHome(slack, ann.user, noAvatarLine, "Rocket (🟧 Legendary)"));
    expect(menuOptionsInHome(slack, ann.user, "Avatar: Rocket (🟧 Legendary)")).toEqual(["No avatar", "Banana (⬜ Common)", "Rocket (🟧 Legendary)"]);

    await click(ann.user, menuOptionInHome(slack, ann.user, "Avatar: Rocket (🟧 Legendary)", "Banana (⬜ Common)"));
    expect(publishedHome(slack, ann.user)).toContain("section: Avatar: Banana (⬜ Common) [select: Banana (⬜ Common)]");

    await click(ann.user, menuOptionInHome(slack, ann.user, "Avatar: Banana (⬜ Common)", "No avatar"));
    expect(menuOptionsInHome(slack, ann.user, noAvatarLine)).toEqual(["Banana (⬜ Common)", "Rocket (🟧 Legendary)"]);
  });

  test("the website's setAvatar sets, changes and clears the avatar, and a repeat answers the same and leaves one avatar", async () => {
    const member = await annWithTheBook();
    await holds(t, member, "banana", "rocket");
    const asAnn = await onTheWebsite(ann);

    expect(await asAnn.mutation(api.website.commands.setAvatar, { hoggie: "rocket" })).toEqual({ kind: "set", avatar: rocket });
    expect(await asAnn.mutation(api.website.commands.setAvatar, { hoggie: "rocket" })).toEqual({ kind: "set", avatar: rocket });
    expect(await avatarRows()).toEqual([{ member, hoggie: "rocket" }]);

    expect(await asAnn.mutation(api.website.commands.setAvatar, { hoggie: "banana" })).toEqual({ kind: "set", avatar: banana });
    expect(await asAnn.mutation(api.website.commands.setAvatar, { hoggie: null })).toEqual({ kind: "set", avatar: null });
    expect(await asAnn.mutation(api.website.commands.setAvatar, { hoggie: null })).toEqual({ kind: "set", avatar: null });
    expect(await avatarRows()).toEqual([]);
  });

  test("a hoggie the member doesn't hold is refused and changes nothing, on the website and from a stale App Home menu", async () => {
    const member = await annWithTheBook();
    await holds(t, member, "banana");
    const asAnn = await onTheWebsite(ann);
    await asAnn.mutation(api.website.commands.setAvatar, { hoggie: "banana" });

    expect(await asAnn.mutation(api.website.commands.setAvatar, { hoggie: "rocket" })).toEqual({ kind: "refused" });
    expect(await asAnn.mutation(api.website.commands.setAvatar, { hoggie: "no-such-hoggie" })).toEqual({ kind: "refused" });
    await click(ann.user, staleMenuOptionOf({ type: "setAvatar", hoggie: "rocket" }));

    expect(await avatarRows()).toEqual([{ member, hoggie: "banana" }]);
    expect(await asAnn.query(api.website.profile.getMyProfile, {})).toMatchObject({ avatar: banana });
  });
});

describe("HA2: the avatar shows where the member's face shows", { timeout: 60_000 }, () => {
  test("getMyProfile and getProfileCard answer the avatar, and null without one", async () => {
    const member = await annWithTheBook();
    await holds(t, member, "rocket");
    const asAnn = await onTheWebsite(ann);

    expect(await asAnn.query(api.website.profile.getMyProfile, {})).toMatchObject({ kind: "member", avatar: null });
    expect(await asAnn.query(api.website.profileCard.getProfileCard, {})).toMatchObject({ kind: "card", avatar: null });

    await asAnn.mutation(api.website.commands.setAvatar, { hoggie: "rocket" });

    expect(await asAnn.query(api.website.profile.getMyProfile, {})).toMatchObject({ kind: "member", avatar: rocket });
    expect(await asAnn.query(api.website.profileCard.getProfileCard, {})).toMatchObject({ kind: "card", avatar: rocket });
  });

  test("the /hedgehug card names the member's avatar under their name, for them and for a teammate", async () => {
    const member = await annWithTheBook();
    await aTeammate(bea);
    await holds(t, member, "rocket");
    await (await onTheWebsite(ann)).mutation(api.website.commands.setAvatar, { hoggie: "rocket" });

    expect(await card(ann.user, ann.user)).toEqual(`*<@${ann.user}>*\nAvatar: Rocket (🟧 Legendary)\nLevel 4`);
    expect(await card(bea.user, ann.user)).toEqual(`*<@${ann.user}>*\nAvatar: Rocket (🟧 Legendary)\nLevel 4`);
  });

  test("App Home names the avatar beside the hoggies when the website is the front door", async () => {
    const member = await annWithTheBook();
    await holds(t, member, "rocket");
    await (await onTheWebsite(ann)).mutation(api.website.commands.setAvatar, { hoggie: "rocket" });
    await openHome(ann.user);

    const home = publishedHome(slack, ann.user);
    expect(home).toContain("section: Avatar: Rocket (🟧 Legendary)");
    expect(home.join("\n")).not.toContain("static_select");
  });
});

async function annWithTheBook() {
  await switchWebsite(t, postHog, false, ...avatarFlags.filter((flag) => flag !== "collection"));
  await bookShippedBeforeAnyoneJoined(t);
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  const member = await aTeammate(ann);
  await t.run((ctx) => ctx.db.insert("memberProgress", { member, xp: xpToReach(4), pointsSpent: 0 }));
  await reachesLevel(t, member, 4);
  await opens(t, member, "book");
  await switchWebsite(t, postHog, false, ...avatarFlags);
  await openHome(ann.user);
  return member;
}

async function aTeammate(person: { user: string; name: string; email: string }): Promise<MemberId> {
  await memberChanged(t, "team_join", { id: person.user, ...slackProfileOf(person) });
  await settleInTimeOrder(t);
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique();
    return row!._id;
  });
}

async function onTheWebsite(person: { user: string; name: string }) {
  await switchWebsite(t, postHog, true, ...avatarFlags);
  const { asSignedIn } = await aSignedInSession(t, person);
  return asSignedIn;
}

function slackProfileOf({ name, email }: { name: string; email: string }) {
  return { profile: { display_name: name, email } };
}

async function openHome(user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settleInTimeOrder(t);
}

async function click(user: string, action: Parameters<typeof blockActions>[1]) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), form));
  await settleInTimeOrder(t);
}

async function card(viewer: string, user: string) {
  const body = new URLSearchParams({ team_id: "T1", channel_id: "C1", channel_name: "general", user_id: viewer, command: "/hedgehug", text: `<@${user}>`, response_url: slashCommandResponseUrl, trigger_id: "1.2.3" }).toString();
  const response = await t.fetch("/slack/commands", await signedRequest(body, form));
  const reply = (await response.json()) as { text: string };
  await settleInTimeOrder(t);
  return reply.text;
}

function avatarRows() {
  return t.run(async (ctx) => (await ctx.db.query("hoggieAvatars").collect()).map(({ member, hoggie }) => ({ member, hoggie })));
}
