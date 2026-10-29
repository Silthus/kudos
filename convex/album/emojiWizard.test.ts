import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { xpToReach } from "../progression/levels";
import schema from "../schema";
import type { AlbumAnswer, AlbumRead } from "../website/album";
import { mostAppEmojisListed } from "./emojiWizard";
import type { AppEmoji, AppEmojis, SlackEmojiMatches } from "../website/emojiWizard";
import type { MemberId } from "../workspace/directory";

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const why = "Thanks for untangling the flaky migration";
const wizardOpen = ["album", "collection", "packs", "workspace-settings", "emoji-wizard"];
const maintainer = "U_MAINTAINER";

type Person = { user: string; name: string };
type Reader = Pick<Backend, "query" | "mutation">;
type Emoji = AlbumAnswer["emojis"][number];

const owner = { user: maintainer, name: "Mona Keeper" };
const alice = person("Alice", "Marchetti");
const bruno = person("Bruno", "Castellane");
const otters = Array.from({ length: 3 }, (_, index) => person("Otter", `Quillfeather${index + 1}`));
const lanterns = Array.from({ length: 2 }, (_, index) => person("Lantern", `Wickfield${index + 1}`));
const everyone = [owner, alice, bruno, ...otters, ...lanterns];

const crowdRows = 3_000;
const crowdBatch = 500;

const slackPicture = (name: string) => `https://emoji.slack-edge.com/T1/${name}/a1b2c3.png`;
const standardPicture = (file: string) => `https://a.slack-edge.com/production-standard-emoji-assets/17.0/apple-large/${file}.png`;

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  vi.stubEnv("KUDOS_MAINTAINER", maintainer);
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom();
  slack = new FakeSlack();
  for (const { user, name } of everyone) slack.withMember(user, { profile: { display_name: name, real_name: name } });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await switchWebsite(t, postHog, true, ...wizardOpen);
  for (const someone of everyone) await memberChanged(t, "team_join", slackUser(someone));
  await settle(t);
  await theCompanyCopyHolds(...twoTeams());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the emoji wizard finds an earned emoji in Slack", { timeout: 90_000 }, () => {
  test("the Slack emojis closest to the earned emoji's name come first, the free ones before those another earned emoji or the maintainer holds, each with its picture", async () => {
    await slackHas("otter", "otters-wave", "otterly", "lanterns", "party-parrot", "level-5");
    await (await signedIn(owner)).mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "otterly", to: { kind: "unmapped" } });

    const found = await matchesOf(await signedIn(alice), { near: "otters", search: "" });

    expect(found.map(({ name }) => name)).toEqual(["otter", "otters-wave", "otterly"]);
    expect(found).toEqual([
      { name: "otter", image: slackPicture("otter"), free: true },
      { name: "otters-wave", image: slackPicture("otters-wave"), free: true },
      { name: "otterly", image: slackPicture("otterly"), free: false },
    ]);
  });

  test("a search finds the Slack emojis whose names start with any of its words, the closest to the search first", async () => {
    await slackHas("hedgehog-otters", "hedgehog", "hedge-fund", "otter");

    const found = await matchesOf(await signedIn(alice), { near: "otters", search: "Hedgehog" });

    expect(found.map(({ name }) => name)).toEqual(["hedgehog", "hedgehog-otters", "hedge-fund"]);
  });

  test("a search keeps the name as typed, underscores and colons included, so an exact Slack name is found even behind 40 names that share its start", async () => {
    await slackHas(...Array.from({ length: 45 }, (_, index) => `party_a${String(index).padStart(2, "0")}`), "party_parrot");

    const found = await matchesOf(await signedIn(alice), { near: "otters", search: ":party_parrot:" });

    expect(found[0]).toEqual({ name: "party_parrot", image: slackPicture("party_parrot"), free: true });
  });

  test("a Slack emoji held by another earned emoji reads taken, and an alias is found by the name it is an alias of", async () => {
    await aliceCollects(otters[0]!);
    await slackHas("team-lanterns", "lantern-glow");
    slack.withCustomEmoji("lantern-light", "alias:lantern-glow");
    await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
    await settle(t);

    expect(await matchesOf(await signedIn(alice), { near: "team-lanterns", search: "" })).toEqual([
      { name: "lantern-glow", image: slackPicture("lantern-glow"), free: true },
      { name: "team-lanterns", image: slackPicture("team-lanterns"), free: false },
    ]);
  });

  test("the wizard finds nothing while emoji-wizard is off for the member", async () => {
    await slackHas("otter");
    await switchWebsite(t, postHog, true, ...wizardOpen.filter((flag) => flag !== "emoji-wizard"));

    expect(await (await signedIn(alice)).query(api.website.emojiWizard.findSlackEmojis, { near: "otters", search: "" })).toEqual({ kind: "off" });
    expect((await albumOf(await signedIn(alice))).emojiWizard).toBe(false);
  });
});

describe("the emoji wizard offers Slack's standard emoji behind standard-emoji", { timeout: 90_000 }, () => {
  test("a search finds Slack's standard emoji by any of their names, each under its own name with Slack's picture, and a member maps their earned emoji to one", async () => {
    await unlocksOtters(alice);
    await switchWebsite(t, postHog, true, ...wizardOpen, "standard-emoji");
    const asAlice = await signedIn(alice);

    expect(await matchesOf(asAlice, { near: "otters", search: "thumbsup" })).toContainEqual({ name: "+1", image: standardPicture("1f44d"), free: true });
    expect(await matchesOf(asAlice, { near: "otters", search: "" })).toContainEqual({ name: "otter", image: standardPicture("1f9a6"), free: true });

    expect(await asAlice.mutation(api.website.emojiWizard.mapMyEmoji, { emoji: "team:otters", to: "otter" })).toEqual({ kind: "mapped" });
    expect(await emojiWithId(await signedIn(bruno), "team:otters")).toMatchObject({ name: "otter", picture: standardPicture("1f9a6"), inSlack: true });
  });

  test("a standard emoji a custom one names leaves its place to the next standard emoji, so the search stays full", async () => {
    await slackHas("b", ...Array.from({ length: 18 }, (_, index) => `b-${String(index + 1).padStart(2, "0")}`));
    await switchWebsite(t, postHog, true, ...wizardOpen, "standard-emoji");

    const found = await matchesOf(await signedIn(alice), { near: "otters", search: "b" });

    expect(found.filter(({ name }) => name === "b")).toEqual([{ name: "b", image: slackPicture("b"), free: true }]);
    expect(found.map(({ name }) => name)).toContain("baby");
  });

  test("with standard-emoji off, a search finds no standard emoji and mapping to one is refused and writes nothing", async () => {
    await unlocksOtters(alice);
    const asAlice = await signedIn(alice);
    const before = await everyTable();

    expect(await matchesOf(asAlice, { near: "otters", search: "otter" })).toEqual([]);
    expect(await asAlice.mutation(api.website.emojiWizard.mapMyEmoji, { emoji: "team:otters", to: "otter" })).toEqual({ kind: "refused" });
    expect(await everyTable()).toEqual(before);
  });
});

describe("a member maps an earned emoji they hold to a Slack emoji", { timeout: 90_000 }, () => {
  test("a member maps their own earned emoji Slack doesn't have to a free Slack emoji: it is that Slack emoji at once, in Slack and pictured as Slack pictures it, for everyone who holds it", async () => {
    await unlocksOtters(alice);
    await slackHas("otter");

    expect(await (await signedIn(alice)).mutation(api.website.emojiWizard.mapMyEmoji, { emoji: "team:otters", to: "otter" })).toEqual({ kind: "mapped" });

    expect(await emojiWithId(await signedIn(alice), "team:otters")).toMatchObject({ name: "otter", picture: slackPicture("otter"), inSlack: true });
    expect(await emojiWithId(await signedIn(bruno), "team:otters")).toMatchObject({ name: "otter", inSlack: true });
  });

  test("a member maps their hype, milestone tier and level emojis too", async () => {
    await aliceCollects(otters[0]!);
    await reachesXp(alice, xpToReach(5));
    await slackHas("otter-cheer", "first-face-medal", "five");
    const asAlice = await signedIn(alice);
    const hype = `hype:${await memberOf(otters[0]!)}`;

    for (const [id, to] of [
      [hype, "otter-cheer"],
      ["milestone:people:bronze", "first-face-medal"],
      ["level:5", "five"],
    ] as const) expect(await asAlice.mutation(api.website.emojiWizard.mapMyEmoji, { emoji: id, to }), id).toEqual({ kind: "mapped" });

    expect(await emojiWithId(asAlice, hype)).toMatchObject({ name: "otter-cheer", inSlack: true });
    expect(await emojiWithId(asAlice, "milestone:people:bronze")).toMatchObject({ name: "first-face-medal", inSlack: true });
    expect(await emojiWithId(asAlice, "level:5")).toMatchObject({ name: "five", inSlack: true });
  });

  test("an emoji the member doesn't hold, one already in Slack, a Slack emoji another earned emoji holds or the maintainer left unmapped, a name Slack doesn't have and a random drop are refused and write nothing", async () => {
    await unlocksOtters(alice);
    await slackHas("team-lanterns", "spare", "held-back", "team-otters-2");
    await (await signedIn(owner)).mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "held-back", to: { kind: "unmapped" } });
    await (await signedIn(owner)).mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "team-otters-2", to: { kind: "team", team: "otters" } });
    await (await signedIn(owner)).mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "team-otters-2", to: { kind: "unmapped" } });
    const asAlice = await signedIn(alice);
    await slackHas("team-lanterns", "spare", "held-back", "team-otters-2", "fresh");
    const before = await everyTable();

    for (const [id, to] of [
      ["team:lanterns", "spare"],
      ["level:10", "spare"],
      ["team:otters", "team-lanterns"],
      ["team:otters", "held-back"],
      ["team:otters", "not-in-slack"],
      ["random:spare", "fresh"],
      ["team:walruses", "fresh"],
      ["nonsense", "fresh"],
    ] as const) expect(await asAlice.mutation(api.website.emojiWizard.mapMyEmoji, { emoji: id, to }), `${id} to ${to}`).toEqual({ kind: "refused" });

    expect(await everyTable()).toEqual(before);
  });

  test("an emoji already in Slack is refused: a member never remaps it", async () => {
    await unlocksOtters(alice);
    await slackHas("team-otters", "fresh");
    const asAlice = await signedIn(alice);
    const before = await everyTable();

    expect(await asAlice.mutation(api.website.emojiWizard.mapMyEmoji, { emoji: "team:otters", to: "fresh" })).toEqual({ kind: "refused" });
    expect(await everyTable()).toEqual(before);
  });

  test("the maintainer's mapping is locked for members: once its Slack emoji is gone from Slack, a member still can't map the earned emoji", async () => {
    await unlocksOtters(alice);
    await slackHas("sea-otters", "fresh");
    await (await signedIn(owner)).mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "sea-otters", to: { kind: "team", team: "otters" } });
    await slackLoses("sea-otters");
    const asAlice = await signedIn(alice);
    expect(await emojiWithId(asAlice, "team:otters")).toMatchObject({ name: "sea-otters", inSlack: false });
    const before = await everyTable();

    expect(await asAlice.mutation(api.website.emojiWizard.mapMyEmoji, { emoji: "team:otters", to: "fresh" })).toEqual({ kind: "refused" });
    expect(await everyTable()).toEqual(before);
  });

  test("the maintainer picking the Slack emoji a member mapped takes the mapping over and locks it for members", async () => {
    await unlocksOtters(alice);
    await slackHas("sea-otters", "fresh");
    await (await signedIn(alice)).mutation(api.website.emojiWizard.mapMyEmoji, { emoji: "team:otters", to: "sea-otters" });
    const asOwner = await signedIn(owner);

    expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "sea-otters", to: { kind: "team", team: "otters" } })).toEqual({ kind: "mapped" });

    expect(emojiNamed(await appEmojisOf(asOwner), "sea-otters").slack).toEqual({ image: slackPicture("sea-otters"), setBy: { by: "maintainer", name: owner.name } });
    await slackLoses("sea-otters");
    expect(await (await signedIn(alice)).mutation(api.website.emojiWizard.mapMyEmoji, { emoji: "team:otters", to: "fresh" })).toEqual({ kind: "refused" });
  });

  test("the maintainer picking an earned emoji's own name, already in Slack, records the maintainer and locks it for members", async () => {
    await unlocksOtters(alice);
    await slackHas("team-otters", "fresh");
    const asOwner = await signedIn(owner);

    expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "team-otters", to: { kind: "team", team: "otters" } })).toEqual({ kind: "mapped" });

    expect(emojiNamed(await appEmojisOf(asOwner), "team-otters").slack).toEqual({ image: slackPicture("team-otters"), setBy: { by: "maintainer", name: owner.name } });
    await slackLoses("team-otters");
    expect(await (await signedIn(alice)).mutation(api.website.emojiWizard.mapMyEmoji, { emoji: "team:otters", to: "fresh" })).toEqual({ kind: "refused" });
  });

  test("a person page answers the hype emoji's picture and whether Slack has it, so the wizard can open there", async () => {
    await aliceCollects(otters[0]!);
    await slackHas("otter-cheer");
    const asAlice = await signedIn(alice);
    const otter = await memberOf(otters[0]!);

    expect(await asAlice.query(api.website.album.getAlbumPerson, { person: otter })).toMatchObject({ hype: { earned: true, name: "otter-quillfeather1-hype", picture: expect.any(String), inSlack: false } });
    await asAlice.mutation(api.website.emojiWizard.mapMyEmoji, { emoji: `hype:${otter}`, to: "otter-cheer" });
    expect(await asAlice.query(api.website.album.getAlbumPerson, { person: otter })).toMatchObject({ hype: { earned: true, name: "otter-cheer", picture: slackPicture("otter-cheer"), inSlack: true } });
  });

  test("a member mapping is refused while emoji-wizard is off for the member, and writes nothing", async () => {
    await unlocksOtters(alice);
    await slackHas("otter");
    await switchWebsite(t, postHog, true, ...wizardOpen.filter((flag) => flag !== "emoji-wizard"));
    const asAlice = await signedIn(alice);
    const before = withoutFlagRows(await everyTable());

    expect(await asAlice.mutation(api.website.emojiWizard.mapMyEmoji, { emoji: "team:otters", to: "otter" })).toEqual({ kind: "refused" });
    expect(withoutFlagRows(await everyTable())).toEqual(before);
  });

  test("WS61: the earned emoji and the Slack emoji are mapMyEmoji's only arguments, so no call names a member", async () => {
    await unlocksOtters(alice);
    await slackHas("otter");
    const asAlice = await signedIn(alice);
    const before = await everyTable();

    await expect(asAlice.mutation(api.website.emojiWizard.mapMyEmoji, { emoji: "team:otters", to: "otter", member: await memberOf(alice) } as never)).rejects.toThrow(/member/);
    expect(await everyTable()).toEqual(before);
  });
});

describe("the maintainer lists every app emoji, mapped or not", { timeout: 180_000 }, () => {
  test("every earned emoji Slack doesn't have is not mapped, with its picture, what earns it and how many members hold it, the most held first", async () => {
    await unlocksOtters(alice);
    await aliceCollects(lanterns[0]!);
    await thanks(bruno, why, otters[0]!);
    await reachesXp(bruno, xpToReach(10));
    await slackHas("team-lanterns");

    const { emojis } = await appEmojisOf(await signedIn(owner));
    const notMapped = emojis.filter(({ slack }) => slack === null);

    const heldByBoth = notMapped.filter(({ holders }) => holders === 2).map(({ name }) => name);
    expect(heldByBoth, "ties by name").toEqual(heldByBoth.toSorted());
    expect(heldByBoth).toEqual(expect.arrayContaining(["first-face", "otter-quillfeather1-hype", "team-otters"]));
    expect(notMapped[0]!.holders).toBe(2);
    expect(notMapped.find(({ name }) => name === "otter-quillfeather1-hype")).toEqual({ key: expect.any(String), kind: "hype", name: "otter-quillfeather1-hype", from: "Otter Quillfeather1", picture: expect.any(String), holders: 2, slack: null, place: { kind: "hype", person: expect.any(String) } });
    expect(notMapped.find(({ name }) => name === "level-10")).toMatchObject({ kind: "level", from: "Level 10", picture: "/emoji/level-10.png", holders: 1, place: { kind: "level", level: 10 } });
    expect(notMapped.find(({ name }) => name === "level-25")).toMatchObject({ holders: 0 });
    expect(notMapped.some(({ name }) => name === "team-lanterns"), "a name Slack holds is mapped").toBe(false);
    expect(emojis.find(({ name }) => name === "team-lanterns")).toMatchObject({ kind: "team", from: "Lanterns", slack: { image: slackPicture("team-lanterns"), setBy: null }, place: { kind: "team", team: "lanterns" } });
    expect(holdersOrder(notMapped)).toEqual(holdersOrder(notMapped).toSorted((one, other) => other - one));
  });

  test("a mapping shows who set it: a member's name, or the maintainer's; and undoing a member's mapping holds the Slack emoji back and returns the earned emoji to its own name, not in Slack", async () => {
    await unlocksOtters(alice);
    await slackHas("otter", "lantern-glow");
    await (await signedIn(alice)).mutation(api.website.emojiWizard.mapMyEmoji, { emoji: "team:otters", to: "otter" });
    const asOwner = await signedIn(owner);
    await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "lantern-glow", to: { kind: "team", team: "lanterns" } });

    expect(emojiNamed(await appEmojisOf(asOwner), "otter").slack).toEqual({ image: slackPicture("otter"), setBy: { by: "member", name: alice.name } });
    expect(emojiNamed(await appEmojisOf(asOwner), "lantern-glow").slack).toEqual({ image: slackPicture("lantern-glow"), setBy: { by: "maintainer", name: owner.name } });

    expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "otter", to: { kind: "unmapped" } })).toEqual({ kind: "mapped" });

    expect(emojiNamed(await appEmojisOf(asOwner), "team-otters")).toMatchObject({ slack: null, place: { kind: "team", team: "otters" } });
    expect(await emojiWithId(await signedIn(alice), "team:otters")).toMatchObject({ name: "team-otters", inSlack: false });
    expect(await (await signedIn(alice)).mutation(api.website.emojiWizard.mapMyEmoji, { emoji: "team:otters", to: "otter" }), "the Slack emoji is held back").toEqual({ kind: "refused" });
  });

  test("a former teammate's hype emoji stays off the list, since only a current member's hype can be mapped to", async () => {
    await aliceCollects(otters[0]!, lanterns[0]!);
    await memberChanged(t, "user_change", { id: lanterns[0]!.user, team_id: "T1", deleted: true });
    await settle(t);

    const names = (await appEmojisOf(await signedIn(owner))).emojis.map(({ name }) => name);

    expect(names).toContain("otter-quillfeather1-hype");
    expect(names).not.toContain("lantern-wickfield1-hype");
  });

  test(`the list answers at most ${mostAppEmojisListed} app emojis, the most held first, and says more wait, within Convex's limits`, async () => {
    await aliceCollects(otters[0]!);
    for (let batch = 0; batch < crowdRows / crowdBatch; batch++)
      await t.run(async (ctx) => {
        for (let index = batch * crowdBatch; index < (batch + 1) * crowdBatch; index++) {
          const person = await ctx.db.insert("members", { workspace: "T1", user: `U_CROWD_${index}`, kind: "member", name: `Crowd ${index}` });
          await ctx.db.insert("emojiNames", { workspace: "T1", emoji: "hype", person, name: `crowd-${index}-hype` });
        }
      });

    const { emojis, more } = await appEmojisOf(await signedIn(owner));

    expect(emojis).toHaveLength(mostAppEmojisListed);
    expect(more).toBe(true);
    expect(emojis.find(({ name }) => name === "first-face")).toMatchObject({ holders: 1 });
  });

  test("the maintainer's list is off for everyone else, and while emoji-wizard or workspace-settings is off for the maintainer", async () => {
    expect(await (await signedIn(alice)).query(api.website.emojiWizard.getAppEmojis, {})).toEqual({ kind: "off" });
    await switchWebsite(t, postHog, true, ...wizardOpen.filter((flag) => flag !== "emoji-wizard"));
    expect(await (await signedIn(owner)).query(api.website.emojiWizard.getAppEmojis, {})).toEqual({ kind: "off" });
    await switchWebsite(t, postHog, true, ...wizardOpen.filter((flag) => flag !== "workspace-settings"));
    expect(await (await signedIn(owner)).query(api.website.emojiWizard.getAppEmojis, {})).toEqual({ kind: "off" });
  });

  test("the maintainer's wizard searches like a member's and maps through mapSlackEmoji, so it may take a Slack emoji another earned emoji holds", async () => {
    await unlocksOtters(alice);
    await slackHas("team-lanterns");
    const asOwner = await signedIn(owner);

    expect(await matchesOf(asOwner, { near: "team-otters", search: "lan" })).toEqual([{ name: "team-lanterns", image: slackPicture("team-lanterns"), free: false }]);
    expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "team-lanterns", to: emojiNamed(await appEmojisOf(asOwner), "team-otters").place })).toEqual({ kind: "mapped" });
    expect(await emojiWithId(await signedIn(alice), "team:otters")).toMatchObject({ name: "team-lanterns", inSlack: true });
  });

  test("LP71: while onboarding is on for the maintainer, level 2's emoji is listed under raised_hands, in Slack, with every member at level 2 or above as a holder; while off it is not listed", async () => {
    await aliceCollects(lanterns[0]!);
    await reachesXp(alice, xpToReach(2));
    await reachesXp(bruno, xpToReach(10));
    await switchWebsite(t, postHog, true, ...wizardOpen, "hidden-items", "onboarding");
    const asOwner = await signedIn(owner);

    expect(emojiNamed(await appEmojisOf(asOwner), "raised_hands")).toEqual({ key: "level:2", kind: "level", name: "raised_hands", from: "Level 2", picture: standardPicture("1f64c"), holders: 2, slack: { image: standardPicture("1f64c"), setBy: null }, place: { kind: "level", level: 2 } });

    await switchWebsite(t, postHog, true, ...wizardOpen, "hidden-items");
    expect((await appEmojisOf(asOwner)).emojis.some(({ name }) => name === "raised_hands")).toBe(false);
  });
});

describe("AL80: behind admin-hype-emojis, the maintainer lists every current member's hype emoji, named or not", { timeout: 180_000 }, () => {
  test("a member nobody has thanked yet is listed not mapped, under the name their hype emoji takes, and the maintainer's mapping names it at once for whoever earns it later", async () => {
    await switchWebsite(t, postHog, true, ...wizardOpen, "admin-hype-emojis");
    await slackHas("alice-wave");
    const asOwner = await signedIn(owner);

    const unnamed = emojiNamed(await appEmojisOf(asOwner), "alice-marchetti-hype");
    expect(unnamed).toEqual({ key: expect.any(String), kind: "hype", name: "alice-marchetti-hype", from: alice.name, picture: expect.any(String), holders: 0, slack: null, place: { kind: "hype", person: expect.any(String) } });
    expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "alice-wave", to: unnamed.place })).toEqual({ kind: "mapped" });

    expect(emojiNamed(await appEmojisOf(asOwner), "alice-wave")).toMatchObject({ key: unnamed.key, slack: { image: slackPicture("alice-wave"), setBy: { by: "maintainer", name: owner.name } } });
    await collects(bruno, alice);
    expect(await emojiWithId(await signedIn(bruno), `hype:${await memberOf(alice)}`)).toMatchObject({ name: "alice-wave", inSlack: true });
  });

  test("a former member's hype emoji stays off the list, named or not", async () => {
    await switchWebsite(t, postHog, true, ...wizardOpen, "admin-hype-emojis");
    await aliceCollects(lanterns[0]!);
    for (const left of [lanterns[0]!, lanterns[1]!]) await memberChanged(t, "user_change", { id: left.user, team_id: "T1", deleted: true });
    await settle(t);

    const names = (await appEmojisOf(await signedIn(owner))).emojis.map(({ name }) => name);

    expect(names).toContain("bruno-castellane-hype");
    expect(names).not.toContain("lantern-wickfield1-hype");
    expect(names).not.toContain("lantern-wickfield2-hype");
  });

  test("with admin-hype-emojis off, only the hype emojis already named are listed", async () => {
    await aliceCollects(otters[0]!);

    const names = (await appEmojisOf(await signedIn(owner))).emojis.filter(({ kind }) => kind === "hype").map(({ name }) => name);

    expect(names).toEqual(["otter-quillfeather1-hype"]);
  });

  test(`thousands of unnamed members still answer at most ${mostAppEmojisListed} app emojis, the most held first, within Convex's limits`, async () => {
    await switchWebsite(t, postHog, true, ...wizardOpen, "admin-hype-emojis");
    await aliceCollects(otters[0]!);
    for (let batch = 0; batch < crowdRows / crowdBatch; batch++)
      await t.run(async (ctx) => {
        for (let index = batch * crowdBatch; index < (batch + 1) * crowdBatch; index++) await ctx.db.insert("members", { workspace: "T1", user: `U_CROWD_${index}`, kind: "member", name: `Crowd ${index}` });
      });

    const { emojis, more } = await appEmojisOf(await signedIn(owner));

    expect(emojis).toHaveLength(mostAppEmojisListed);
    expect(more).toBe(true);
    expect(emojiNamed({ kind: "app-emojis", emojis, more, emojiPage: null }, "otter-quillfeather1-hype")).toMatchObject({ holders: 1 });
  });
});

describe("#736: with emoji-mapping-in-place on, the maintainer maps app emojis where they show and members map none", { timeout: 120_000 }, () => {
  beforeEach(async () => {
    await switchWebsite(t, postHog, true, ...wizardOpen, "emoji-mapping-in-place");
  });

  test("the maintainer maps a team, hype, milestone tier and level emoji they don't hold, Slack's or not, to any Slack emoji, as the maintainer, at once for everyone who holds it", async () => {
    await unlocksOtters(alice);
    await aliceCollects(lanterns[0]!);
    await reachesXp(alice, xpToReach(5));
    await slackHas("otter", "lantern-cheer", "first-face-medal", "level-5", "five");
    const asOwner = await signedIn(owner);
    const hype = `hype:${await memberOf(lanterns[0]!)}`;

    for (const [id, to] of [
      ["team:otters", "otter"],
      [hype, "lantern-cheer"],
      ["milestone:people:bronze", "first-face-medal"],
      ["level:5", "five"],
    ] as const) expect(await asOwner.mutation(api.website.emojiWizard.mapMyEmoji, { emoji: id, to }), id).toEqual({ kind: "mapped" });

    const asAlice = await signedIn(alice);
    expect(await emojiWithId(asAlice, "team:otters")).toMatchObject({ name: "otter", picture: slackPicture("otter"), inSlack: true });
    expect(await emojiWithId(asAlice, hype)).toMatchObject({ name: "lantern-cheer", inSlack: true });
    expect(await emojiWithId(asAlice, "milestone:people:bronze")).toMatchObject({ name: "first-face-medal", inSlack: true });
    expect(await emojiWithId(asAlice, "level:5")).toMatchObject({ name: "five", inSlack: true });
    const listed = await appEmojisOf(asOwner);
    for (const name of ["otter", "lantern-cheer", "first-face-medal", "five"]) expect(emojiNamed(listed, name).slack, name).toEqual({ image: slackPicture(name), setBy: { by: "maintainer", name: owner.name } });
  });

  test("the maintainer remaps a member's mapping and takes a Slack emoji another earned emoji holds, which moves that one to a free name", async () => {
    await unlocksOtters(alice);
    await slackHas("team-lanterns", "sea-otters");
    const asOwner = await signedIn(owner);

    expect(await asOwner.mutation(api.website.emojiWizard.mapMyEmoji, { emoji: "team:otters", to: "team-lanterns" })).toEqual({ kind: "mapped" });
    expect(await asOwner.mutation(api.website.emojiWizard.mapMyEmoji, { emoji: "team:otters", to: "sea-otters" })).toEqual({ kind: "mapped" });

    expect(emojiNamed(await appEmojisOf(asOwner), "sea-otters")).toMatchObject({ place: { kind: "team", team: "otters" }, slack: { image: slackPicture("sea-otters"), setBy: { by: "maintainer", name: owner.name } } });
    expect(emojiNamed(await appEmojisOf(asOwner), "team-lanterns-2")).toMatchObject({ place: { kind: "team", team: "lanterns" }, slack: null });
  });

  test("a member is refused, for an earned emoji they hold and for one they don't, and nothing is written", async () => {
    await unlocksOtters(alice);
    await reachesXp(alice, xpToReach(5));
    await slackHas("otter", "five", "lantern-glow");
    const asAlice = await signedIn(alice);
    const before = await everyTable();

    for (const [id, to] of [
      ["team:otters", "otter"],
      ["level:5", "five"],
      ["team:lanterns", "lantern-glow"],
    ] as const) expect(await asAlice.mutation(api.website.emojiWizard.mapMyEmoji, { emoji: id, to }), id).toEqual({ kind: "refused" });

    expect(await everyTable()).toEqual(before);
  });

  test("the maintainer is refused a name Slack doesn't have, a random drop, and a team, tier, level or person nobody knows, and nothing is written", async () => {
    await slackHas("fresh");
    const asOwner = await signedIn(owner);
    const before = await everyTable();

    for (const [id, to] of [
      ["team:otters", "not-in-slack"],
      ["random:fresh", "fresh"],
      ["team:walruses", "fresh"],
      ["milestone:people", "fresh"],
      ["level:7", "fresh"],
      ["hype:not-a-member", "fresh"],
      ["nonsense", "fresh"],
    ] as const) expect(await asOwner.mutation(api.website.emojiWizard.mapMyEmoji, { emoji: id, to }), `${id} to ${to}`).toEqual({ kind: "refused" });

    expect(await everyTable()).toEqual(before);
  });

  test("getAlbum answers emojiInPlace: admin for the maintainer, member for everyone else, and null while emoji-mapping-in-place, emoji-wizard or workspace-settings says otherwise", async () => {
    expect((await albumOf(await signedIn(owner))).emojiInPlace).toBe("admin");
    expect((await albumOf(await signedIn(alice))).emojiInPlace).toBe("member");

    await switchWebsite(t, postHog, true, ...wizardOpen.filter((flag) => flag !== "workspace-settings"), "emoji-mapping-in-place");
    expect((await albumOf(await signedIn(owner))).emojiInPlace, "the maintainer without workspace-settings").toBe("member");

    await switchWebsite(t, postHog, true, ...wizardOpen.filter((flag) => flag !== "emoji-wizard"), "emoji-mapping-in-place");
    expect((await albumOf(await signedIn(owner))).emojiInPlace, "without emoji-wizard").toBeNull();

    await switchWebsite(t, postHog, true, ...wizardOpen);
    expect((await albumOf(await signedIn(owner))).emojiInPlace, "without emoji-mapping-in-place").toBeNull();
    expect((await albumOf(await signedIn(alice))).emojiInPlace).toBeNull();
  });

  test("with emoji-mapping-in-place off a member maps their own emoji as before, and the maintainer can't map one they don't hold", async () => {
    await unlocksOtters(alice);
    await slackHas("otter", "lantern-glow");
    await switchWebsite(t, postHog, true, ...wizardOpen);

    expect(await (await signedIn(alice)).mutation(api.website.emojiWizard.mapMyEmoji, { emoji: "team:otters", to: "otter" })).toEqual({ kind: "mapped" });
    expect(await (await signedIn(owner)).mutation(api.website.emojiWizard.mapMyEmoji, { emoji: "team:lanterns", to: "lantern-glow" })).toEqual({ kind: "refused" });
  });
});

function holdersOrder(emojis: AppEmoji[]): number[] {
  return emojis.map(({ holders }) => holders);
}

function emojiNamed({ emojis }: AppEmojis, name: string): AppEmoji {
  const found = emojis.find((each) => each.name === name);
  if (found === undefined) throw new Error(`no app emoji is named ${name}: ${emojis.map((each) => each.name).join(", ")}`);
  return found;
}

async function matchesOf(reader: Reader, args: { near: string; search: string }): Promise<SlackEmojiMatches["matches"]> {
  const read = await reader.query(api.website.emojiWizard.findSlackEmojis, args);
  if (read.kind !== "matches") throw new Error(`expected matches, got ${JSON.stringify(read)}`);
  return read.matches;
}

async function appEmojisOf(reader: Reader): Promise<AppEmojis> {
  const read = await reader.query(api.website.emojiWizard.getAppEmojis, {});
  if (read.kind !== "app-emojis") throw new Error(`expected the app emojis, got ${JSON.stringify(read)}`);
  return read;
}

async function unlocksOtters(someone: Person) {
  await collects(someone, ...otters);
  expect(await (await signedIn(someone)).mutation(api.website.album.unlockTeamSticker, { team: "otters" })).toMatchObject({ kind: "unlocked" });
  await collects(bruno, ...otters);
  expect(await (await signedIn(bruno)).mutation(api.website.album.unlockTeamSticker, { team: "otters" })).toMatchObject({ kind: "unlocked" });
}

function twoTeams(): TeamPage[] {
  return [
    { slug: "otters", name: "Otters", crest: aCutout("otters-crest"), profiles: profilesOf(...otters) },
    { slug: "lanterns", name: "Lanterns", profiles: profilesOf(...lanterns) },
  ];
}

async function slackHas(...names: string[]) {
  for (const name of names) slack.withCustomEmoji(name, slackPicture(name));
  await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
  await settle(t);
}

async function slackLoses(name: string) {
  slack.withoutCustomEmoji(name);
  await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
  await settle(t);
}

async function emojiWithId(reader: Reader, id: string): Promise<Emoji | undefined> {
  return (await albumOf(reader)).emojis.find((entry) => entry.id === id);
}

async function albumOf(reader: Reader): Promise<AlbumAnswer> {
  const album: AlbumRead | { kind: string } = await reader.query(api.website.album.getAlbum, {});
  if (album.kind !== "album") throw new Error(`expected an album, got ${JSON.stringify(album)}`);
  return album as AlbumAnswer;
}

async function theCompanyCopyHolds(...teams: TeamPage[]) {
  postHogCom.withTeams(...teams);
  await t.action(internal.companyProfiles.sync.syncCompanyProfiles, {});
  await settle(t);
}

async function aliceCollects(...people: Person[]) {
  await collects(alice, ...people);
}

async function collects(giver: Person, ...people: Person[]) {
  await thanks(giver, why, ...people);
  const asGiver = await signedIn(giver);
  const album = await asGiver.query(api.website.album.getAlbum, {});
  for (const { pack } of album.kind === "album" ? album.packs : []) await asGiver.mutation(api.website.album.openThoughtfulPack, { pack });
  for (let placed = await asGiver.mutation(api.website.album.putAllIn, {}); placed.kind === "placed" && placed.more; ) placed = await asGiver.mutation(api.website.album.putAllIn, {});
  await settle(t);
}

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  await post(t, [section(text(`${words} `), ...recipients.map(({ user }) => mention(user)), emoji("taco"))], { user: giver.user, ts: `${Date.now() / 1000}.${String(messages).padStart(6, "0")}` });
  await settle(t);
}

async function reachesXp(someone: Person, xp: number) {
  const member = await memberOf(someone);
  await t.run(async (ctx) => {
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    if (progress === null) await ctx.db.insert("memberProgress", { member, xp, pointsSpent: 0 });
    else await ctx.db.patch(progress._id, { xp });
  });
}

async function signedIn(someone: Person) {
  const { asSignedIn } = await aSignedInSession(t, { user: someone.user, name: someone.name });
  return asSignedIn;
}

async function memberOf(someone: Person): Promise<MemberId> {
  const row = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", someone.user))
      .unique(),
  );
  if (row === null) throw new Error(`${someone.name} is no member`);
  return row._id;
}

function person(first: string, last: string): Person {
  return { user: `U_${first}_${last}`.toUpperCase(), name: `${first} ${last}` };
}

function slackUser({ user, name }: Person) {
  return { id: user, team_id: "T1", name, real_name: name, profile: { real_name: name, display_name: name } };
}

function profilesOf(...people: Person[]): TeamPage["profiles"] {
  return people.map(({ name }) => {
    const [firstName, lastName] = name.split(" ") as [string, string];
    return { id: everyone.findIndex((someone) => someone.name === name) + 1, firstName, lastName, colour: "teal" };
  });
}

function everyTable() {
  return t.run(async (ctx) => {
    const rows: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
}

function withoutFlagRows(tables: Record<string, unknown[]>) {
  const { flagExposures: _exposures, flagDefinitions: _definitions, ...rest } = tables;
  return rest;
}
