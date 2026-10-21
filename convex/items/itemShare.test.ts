import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FlagDefinition } from "../../testing/fakePostHog";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack, type SlackCall } from "../../testing/fakeSlack";
import { offForEveryone, onForEmails, onForEveryone } from "../../testing/flags";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { reachesLevel } from "../../testing/unlocks";
import { aDeploymentForWorkspace, aSignedInSession } from "../../testing/website";
import { api, components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { AlbumAnswer } from "../website/album";
import type { MemberId } from "../workspace/directory";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const site = "https://kudos-site.test";
const channel = "C_TEAM";
const weeklyPostChannel = "C_KUDOS";
const albumOn = ["website", "album", "collection", "packs", "xp-levels", "hugs", "groups", "hidden-items"];
const itemShare = "item-share";
const shareOn = [...albumOn, itemShare].map(onForEveryone);

type Person = { user: string; name: string; email: string; profile: number };
type Reader = Awaited<ReturnType<typeof aSignedInSession>>["asSignedIn"];
type Posted = SlackCall["args"] & { channel: string; text: string; blocks: unknown[] };

const alice = person("Alice", "Marchetti", 1);
const bob = person("Bob", "Okonkwo", 2);
const carol = person("Carol", "Lindqvist", 3);
const dana = person("Dana", "Ferreira", 4);
const everyone = [alice, bob, carol, dana];
const productAnalytics: TeamPage = { slug: "product-analytics", name: "Product Analytics", profiles: [profileOf(alice), profileOf(bob), profileOf(carol)] };

const theDraw = vi.hoisted(() => ({ planned: [] as string[] }));

vi.mock("../hoggies/draw", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hoggies/draw")>();
  const { hoggieNamed } = await import("../hoggies/catalogue");
  return {
    ...actual,
    drawOf: async (input: Parameters<typeof actual.drawOf>[0]) => {
      const planned = theDraw.planned.shift();
      return planned === undefined ? actual.drawOf(input) : { hoggie: planned, rarity: hoggieNamed(planned)!.rarity };
    },
  };
});

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(() => {
  theDraw.planned = [];
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LP51 LP53 LP54: Share posts a turned win into the weekly-post channel, the thanks first", { timeout: 120_000 }, () => {
  test("a public thanks whose hoggie turns legendary offers Share for that item, and the press posts one card into the weekly-post channel with the giver and the recipient in bold, the quoted thanks, the find, the hoggie's art and an Open HedgeHug link", async () => {
    await fourMembers(shareOn);
    await thanks(alice, "Thanks for staying late on the release checklist", bob);
    const asAlice = await signedIn(alice);
    const find = await hoggieItemOf(alice, bob);

    await turns(asAlice, find, "rocket");

    expect((await albumOf(asAlice)).shares, "the wins Share is offered for").toEqual([find]);
    expect(await asAlice.mutation(api.website.itemShare.shareItem, { item: find })).toEqual({ kind: "shared" });
    await settle(t);
    expect(sharesPosted()).toEqual([
      {
        channel: weeklyPostChannel,
        text: "Alice Marchetti thanked Bob Okonkwo: 'Thanks for staying late on the release checklist @Bob Okonkwo :taco:' and found a legendary Rocket",
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: "*Alice Marchetti* thanked *Bob Okonkwo*: 'Thanks for staying late on the release checklist @Bob Okonkwo :taco:' and found a legendary Rocket" },
            accessory: { type: "image", image_url: `${site}/share/rocket.png`, alt_text: "Rocket" },
          },
          { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open HedgeHug" }, url: `${site}/book`, action_id: "item-share-open" }] },
        ],
        unfurl_links: false,
        unfurl_media: false,
      },
    ]);
  });

  test("a win is shared once: after the press no device is offered it, and a second press, from another session too, refuses and posts nothing more", async () => {
    await fourMembers(shareOn);
    await thanks(alice, "Thanks for staying late on the release checklist", bob);
    const asAlice = await signedIn(alice);
    const asAliceElsewhere = await signedIn(alice);
    const find = await hoggieItemOf(alice, bob);
    await turns(asAlice, find, "rocket");

    await asAlice.mutation(api.website.itemShare.shareItem, { item: find });
    await settle(t);

    expect((await albumOf(asAliceElsewhere)).shares, "the other session's offer").toEqual([]);
    expect(await asAliceElsewhere.mutation(api.website.itemShare.shareItem, { item: find })).toEqual({ kind: "refused" });
    expect(await asAlice.mutation(api.website.itemShare.shareItem, { item: find })).toEqual({ kind: "refused" });
    await settle(t);
    expect(sharesPosted()).toHaveLength(1);
  });

  test("a thanks in a private channel names the giver and the recipient without a quote, and an epic find reads an epic", async () => {
    await fourMembers(shareOn);
    await thanks(alice, "Thanks for staying late on the release checklist", bob, { channel: "G_PRIVATE", channelType: "group" });
    const asAlice = await signedIn(alice);
    const find = await hoggieItemOf(alice, bob);
    await turns(asAlice, find, "angel");

    await sharesThe(asAlice, find);

    expect(leadsPosted()).toEqual(["*Alice Marchetti* thanked *Bob Okonkwo* and found an epic Angel"]);
  });

  test("the sticker that completes a team page offers Share, and its card reads that the giver completed the page, with the team's crest; the page's earlier sticker offers nothing", async () => {
    await fourMembers(shareOn);
    await thanks(alice, "Thanks for the careful design review today", bob, carol);
    const asAlice = await signedIn(alice);
    const first = await stickerItemOf(alice, bob);
    const completing = await stickerItemOf(alice, carol);
    await turns(asAlice, first);
    await turns(asAlice, completing);

    expect((await albumOf(asAlice)).shares, "the wins Share is offered for").toEqual([completing]);
    await sharesThe(asAlice, completing);

    expect(sharesPosted().map(({ blocks }) => blocks[0])).toEqual([
      {
        type: "section",
        text: { type: "mrkdwn", text: "*Alice Marchetti* thanked *Carol Lindqvist*: 'Thanks for the careful design review today @Bob Okonkwo @Carol Lindqvist :taco:' and completed the Product Analytics page" },
        accessory: { type: "image", image_url: `${site}/emoji/team-product-analytics.png`, alt_text: "Product Analytics crest" },
      },
    ]);
  });

  test("a level-up hoggie leads with the level, and the welcome item with the find alone", async () => {
    await fourMembers([...shareOn, onForEveryone("welcome-item")]);
    const asAlice = await signedIn(alice);
    await reachesLevel(t, await memberOf(alice), 2);
    await settle(t);
    const levelUp = await itemKeyed(alice, "level:2:3");
    const asBob = await signedIn(bob);
    const welcome = await itemKeyed(bob, "welcome:first");
    await turns(asAlice, levelUp, "rocket");
    await turns(asBob, welcome, "angel");

    await sharesThe(asAlice, levelUp);
    await sharesThe(asBob, welcome);

    expect(leadsPosted()).toEqual(["*Alice Marchetti* reached level 2 and found a legendary Rocket", "*Bob Okonkwo* found an epic Angel"]);
  });
});

describe("LP51 LP52: Share is offered only for a win, only to its owner and only with a weekly-post channel", { timeout: 120_000 }, () => {
  test("a rare find, a sticker that completes no page and a replayed turn offer nothing, another member's press of a win refuses, and nothing is posted", async () => {
    await fourMembers(shareOn);
    await thanks(alice, "Thanks for staying late on the release checklist", bob);
    const asAlice = await signedIn(alice);
    const asBob = await signedIn(bob);
    const rare = await hoggieItemOf(alice, bob);
    const sticker = await stickerItemOf(alice, bob);
    await turns(asAlice, rare, "996");
    await turns(asAlice, sticker);
    await turns(asAlice, rare);
    await thanks(bob, "Thanks for covering the support rotation", dana);
    const legendary = await hoggieItemOf(bob, dana);
    await turns(asBob, legendary, "rocket");

    expect((await albumOf(asAlice)).shares, "Alice's offer").toEqual([]);
    for (const item of [rare, sticker, legendary]) expect(await asAlice.mutation(api.website.itemShare.shareItem, { item })).toEqual({ kind: "refused" });
    await settle(t);
    expect(sharesPosted()).toEqual([]);
    expect((await albumOf(asBob)).shares, "Bob's own win stays offered").toEqual([legendary]);
  });

  test("without a weekly-post channel the album offers no Share and the press refuses, and once the workspace has one the same win is offered and shared", async () => {
    await fourMembers(shareOn, { announcementChannel: null });
    await thanks(alice, "Thanks for staying late on the release checklist", bob);
    const asAlice = await signedIn(alice);
    const find = await hoggieItemOf(alice, bob);
    await turns(asAlice, find, "rocket");

    expect((await albumOf(asAlice)).shares, "the offer without a channel").toBeUndefined();
    expect(await asAlice.mutation(api.website.itemShare.shareItem, { item: find })).toEqual({ kind: "refused" });
    await t.mutation(internal.workspace.settings.pickAnnouncementChannel, { workspace: "T1", channel: weeklyPostChannel });
    await settle(t);
    expect((await albumOf(asAlice)).shares, "the offer once the channel is picked").toEqual([find]);
    await sharesThe(asAlice, find);
    expect(sharesPosted().map(({ channel: to }) => to)).toEqual([weeklyPostChannel]);
  });
});

describe("LP56: the share is behind item-share, and needs hidden-items on for the member", { timeout: 120_000 }, () => {
  test.each([
    { condition: "with item-share off", flags: [offForEveryone(itemShare)] },
    { condition: "while PostHog has no item-share flag", flags: [] },
    { condition: "with item-share on for someone else's email only", flags: [onForEmails(itemShare, dana.email)] },
  ])("$condition, a legendary find writes no win, the album offers no Share, the press refuses and nothing is posted", async ({ flags }) => {
    await fourMembers([...albumOn.map(onForEveryone), ...flags]);
    await thanks(alice, "Thanks for staying late on the release checklist", bob);
    const asAlice = await signedIn(alice);
    const find = await hoggieItemOf(alice, bob);
    await turns(asAlice, find, "rocket");

    expect(await albumOf(asAlice)).not.toHaveProperty("shares");
    expect(await asAlice.mutation(api.website.itemShare.shareItem, { item: find })).toEqual({ kind: "refused" });
    await settle(t);
    expect(await t.run((ctx) => ctx.db.query("itemShares").collect())).toEqual([]);
    expect(sharesPosted()).toEqual([]);
  });

  test("a win turned while hidden-items was on is neither offered nor shared once hidden-items is off for the member", async () => {
    await fourMembers(shareOn);
    await thanks(alice, "Thanks for staying late on the release checklist", bob);
    const asAlice = await signedIn(alice);
    const find = await hoggieItemOf(alice, bob);
    await turns(asAlice, find, "rocket");

    await flagsAre(...albumOn.filter((flag) => flag !== "hidden-items").map(onForEveryone), offForEveryone("hidden-items"), onForEveryone(itemShare));

    expect(await albumOf(asAlice)).not.toHaveProperty("shares");
    expect(await asAlice.mutation(api.website.itemShare.shareItem, { item: find })).toEqual({ kind: "refused" });
    await settle(t);
    expect(sharesPosted()).toEqual([]);
  });
});

type Where = { channel?: string; channelType?: "channel" | "group" | "im" | "mpim" };

async function fourMembers(flags: FlagDefinition[], { announcementChannel = weeklyPostChannel as string | null } = {}) {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  vi.stubEnv("SITE_URL", site);
  messages = 0;
  postHog = new FakePostHog();
  const postHogCom = new FakePostHogCom().withTeams(productAnalytics);
  slack = new FakeSlack();
  for (const someone of everyone) slack.withMember(someone.user, { tz: "UTC", is_admin: someone === alice, profile: { display_name: someone.name, real_name: someone.name, email: someone.email, image_192: `https://avatars.slack-edge.com/${someone.user}.png` } });
  slack.withUserGroup("S_LANTERNS", { name: "Lanterns", users: [alice.user, bob.user, carol.user] });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200, ...(announcementChannel !== null && { announcementChannel }) }));
  await flagsAre(...flags);
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  for (const someone of everyone) {
    const profile = { real_name: someone.name, display_name: someone.name, email: someone.email };
    await memberChanged(t, "team_join", { id: someone.user, team_id: "T1", tz: "UTC", is_admin: someone === alice, name: someone.name, real_name: someone.name, profile });
  }
  await settle(t);
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
  await t.action(internal.slack.userGroups.syncUserGroups, {});
  await settle(t);
  slack.calls.length = 0;
}

async function flagsAre(...flags: FlagDefinition[]) {
  postHog.withFlags(...flags);
  await t.action(components.posthog.lib.refreshFlagDefinitions, {});
}

async function thanks(giver: Person, words: string, ...recipientsAndWhere: Array<Person | Where>) {
  const recipients = recipientsAndWhere.filter((item): item is Person => "user" in item);
  const where = recipientsAndWhere.find((item): item is Where => !("user" in item)) ?? {};
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const ts = `${Math.floor(Date.now() / 1000)}.${String(messages).padStart(6, "0")}`;
  const thanked = recipients.flatMap(({ user }) => [mention(user), text(" ")]);
  await post(t, [section(text(`${words} `), ...thanked, emoji("taco"))], { user: giver.user, ts, channel: where.channel ?? channel, ...(where.channelType && { channelType: where.channelType }) });
  await settle(t);
}

async function signedIn(someone: Person): Promise<Reader> {
  return (await aSignedInSession(t, { user: someone.user, name: someone.name })).asSignedIn;
}

async function turns(reader: Reader, item: Id<"items">, draw?: string) {
  theDraw.planned = draw === undefined ? [] : [draw];
  expect((await reader.mutation(api.website.album.turnItem, { item })).kind, "the turn").toBe("turned");
  theDraw.planned = [];
  await settle(t);
}

async function sharesThe(reader: Reader, item: Id<"items">) {
  expect(await reader.mutation(api.website.itemShare.shareItem, { item }), "the press").toEqual({ kind: "shared" });
  await settle(t);
}

async function albumOf(reader: Reader): Promise<AlbumAnswer> {
  const album = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`the album answered ${album.kind}`);
  return album;
}

async function memberOf(someone: Person): Promise<MemberId> {
  return t.run(async (ctx) => (await ctx.db.query("members").collect()).find(({ user }) => user === someone.user)!._id);
}

async function itemsOf(someone: Person): Promise<Doc<"items">[]> {
  const member = await memberOf(someone);
  return t.run((ctx) => ctx.db.query("items").collect()).then((items) => items.filter((item) => item.member === member));
}

async function thanksItemOf(giver: Person, source: Doc<"items">["source"], thanked: Person) {
  const person = await memberOf(thanked);
  const item = (await itemsOf(giver)).find((earned) => earned.source === source && earned.reason.kind === "thanks" && earned.reason.person === person);
  if (item === undefined) throw new Error(`${giver.name} earned no ${source} item for thanking ${thanked.name}`);
  return item._id;
}

function hoggieItemOf(giver: Person, thanked: Person) {
  return thanksItemOf(giver, "hoggie", thanked);
}

function stickerItemOf(giver: Person, thanked: Person) {
  return thanksItemOf(giver, "sticker", thanked);
}

async function itemKeyed(owner: Person, key: string) {
  const item = (await itemsOf(owner)).find((earned) => earned.key === key);
  if (item === undefined) throw new Error(`${owner.name} earned no item keyed ${key}`);
  return item._id;
}

function sharesPosted(): Posted[] {
  return (slack.callsTo("chat.postMessage") as Posted[]).filter((posted) => posted.channel === weeklyPostChannel && JSON.stringify(posted.blocks ?? []).includes("item-share-open"));
}

function leadsPosted() {
  return sharesPosted().map(({ blocks }) => (blocks[0] as { text: { text: string } }).text.text);
}

function person(first: string, last: string, profile: number): Person {
  return { user: `U_${first}_${last}`.toUpperCase(), name: `${first} ${last}`, email: `${first}.${last}@example.com`.toLowerCase(), profile };
}

function profileOf({ name, profile }: Person): TeamPage["profiles"][number] {
  const [firstName, lastName] = name.split(" ") as [string, string];
  return { id: profile, firstName, lastName, colour: "teal" };
}
