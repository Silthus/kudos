import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { aCutout, FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { xpToReach } from "../progression/levels";
import { mostRandomEmojis } from "./randomEmojis";
import schema from "../schema";
import type { AlbumAnswer, AlbumRead } from "../website/album";
import type { EmojiMappings, EmojiMappingsRead } from "../website/emojiMappings";
import type { MemberId } from "../workspace/directory";

const theRoll = vi.hoisted(() => ({ next: { chance: 0.99, pick: 0 } }));

vi.mock("./emojiRoll", () => ({ emojiRollOf: vi.fn(async () => theRoll.next) }));

const tuesday = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;
const why = "Thanks for untangling the flaky migration";
const albumOpen = ["album", "collection", "packs", "workspace-settings", "random-emojis"];
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
const ottersCrestPicture = expect.stringMatching(/\/v1\/otters-crest\.png$/) as string;

const slackPicture = (name: string) => `https://emoji.slack-edge.com/T1/${name}/a1b2c3.png`;

let postHog: FakePostHog;
let postHogCom: FakePostHogCom;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  vi.stubEnv("KUDOS_MAINTAINER", maintainer);
  theRoll.next = { chance: 0.99, pick: 0 };
  postHog = new FakePostHog();
  postHogCom = new FakePostHogCom();
  slack = new FakeSlack();
  for (const { user, name } of everyone) slack.withMember(user, { profile: { display_name: name, real_name: name } });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : slack.fetch(input, init))));
  t = testBackend({ transactionLimits: true });
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await switchWebsite(t, postHog, true, ...albumOpen);
  for (const someone of everyone) await memberChanged(t, "team_join", slackUser(someone));
  await settle(t);
  await theCompanyCopyHolds(...twoTeams());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the maintainer maps Slack emojis to earned emojis", { timeout: 90_000 }, () => {
  test("Settings list every Slack custom emoji with its picture, a name the registry holds already mapped to its earned emoji and the rest unmapped, beside every team, milestone, level and person to map to", async () => {
    await aliceCollects(otters[0]!);
    await slackHas("team-otters", "level-10", "full-of-friends", "otter-quillfeather1-hype", "party-parrot");

    const mappings = await mappingsOf(await signedIn(owner));

    expect(mappings.emoji).toEqual([
      { name: "full-of-friends", image: slackPicture("full-of-friends"), mapping: { kind: "milestone", milestone: "people:gold" } },
      { name: "level-10", image: slackPicture("level-10"), mapping: { kind: "level", level: 10 } },
      { name: "otter-quillfeather1-hype", image: slackPicture("otter-quillfeather1-hype"), mapping: { kind: "hype", person: keyOf(mappings, otters[0]!) } },
      { name: "party-parrot", image: slackPicture("party-parrot"), mapping: null },
      { name: "team-otters", image: slackPicture("team-otters"), mapping: { kind: "team", team: "otters" } },
    ]);
    expect(mappings.more).toBe(false);
    expect(mappings.randomDrops).toBe(true);
    expect(mappings.teams).toEqual([
      { team: "lanterns", name: "Lanterns" },
      { team: "otters", name: "Otters" },
    ]);
    expect(mappings.milestones.map(({ milestone }) => milestone)).toEqual(["people", "teams", "reach", "hoggies", "thoughtful"].flatMap((milestone) => ["bronze", "silver", "gold", "diamond"].map((tier) => `${milestone}:${tier}`)));
    expect(mappings.milestones.slice(0, 4)).toEqual([
      { milestone: "people:bronze", name: "First face" },
      { milestone: "people:silver", name: "Familiar faces" },
      { milestone: "people:gold", name: "Full of friends" },
      { milestone: "people:diamond", name: "Everyone's album" },
    ]);
    expect(mappings.levels).toEqual([5, 10, 15, 20, 25]);
    expect(mappings.people.map(({ name }) => name)).toEqual([alice, bruno, ...lanterns, owner, ...otters].map(({ name }) => name).toSorted((one, other) => one.localeCompare(other)));
  });

  test("a Slack emoji mapped to a team is that team's emoji at once: named and pictured as in Slack, in Slack, and kept by a member who unlocked it before", async () => {
    await aliceCollects(...otters);
    const asAlice = await signedIn(alice);
    await asAlice.mutation(api.website.album.unlockTeamSticker, { team: "otters" });
    await slackHas("hedgehog-otters");
    const asOwner = await signedIn(owner);

    expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "hedgehog-otters", to: { kind: "team", team: "otters" } })).toEqual({ kind: "mapped" });

    expect(await emojiWithId(asAlice, "team:otters")).toEqual({ id: "team:otters", kind: "team", name: "hedgehog-otters", from: "Otters", picture: slackPicture("hedgehog-otters"), earned: true, earnedAt: expect.any(Number), seen: false, inSlack: true, progress: null });
    expect((await mappingsOf(asOwner)).emoji).toEqual([{ name: "hedgehog-otters", image: slackPicture("hedgehog-otters"), mapping: { kind: "team", team: "otters" } }]);
  });

  test("a Slack emoji maps to a person's hype emoji, a milestone tier's and a level's, each earned emoji taking its name and picture", async () => {
    await aliceCollects(otters[0]!);
    await reachesXp(alice, xpToReach(10));
    await slackHas("otter-cheer", "gold-friends", "first-friend", "ten");
    const asOwner = await signedIn(owner);
    const otter = keyOf(await mappingsOf(asOwner), otters[0]!);

    for (const [name, to] of [
      ["otter-cheer", { kind: "hype", person: otter }],
      ["gold-friends", { kind: "milestone", milestone: "people:gold" }],
      ["first-friend", { kind: "milestone", milestone: "people:bronze" }],
      ["ten", { kind: "level", level: 10 }],
    ] as const) expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: name, to }), name).toEqual({ kind: "mapped" });

    const asAlice = await signedIn(alice);
    expect(await emojiWithId(asAlice, `hype:${await memberOf(otters[0]!)}`)).toMatchObject({ name: "otter-cheer", picture: slackPicture("otter-cheer"), earned: true, inSlack: true });
    expect(await emojiWithId(asAlice, "milestone:people:gold")).toMatchObject({ name: "gold-friends", picture: slackPicture("gold-friends"), earned: false, inSlack: true });
    expect(await emojiWithId(asAlice, "milestone:people:bronze")).toMatchObject({ name: "first-friend", picture: slackPicture("first-friend"), earned: true, inSlack: true });
    expect(await emojiWithId(asAlice, "level:10")).toMatchObject({ name: "ten", picture: slackPicture("ten"), earned: true, inSlack: true });
  });

  test("a person's hype emoji mapped before their first thoughtful pack keeps that name once the pack earns it", async () => {
    await aliceCollects(bruno);
    await slackHas("lantern-cheer");
    const asOwner = await signedIn(owner);

    await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "lantern-cheer", to: { kind: "hype", person: keyOf(await mappingsOf(asOwner), lanterns[0]!) } });
    await aliceCollects(lanterns[0]!);

    expect(await emojiWithId(await signedIn(alice), `hype:${await memberOf(lanterns[0]!)}`)).toMatchObject({ name: "lantern-cheer", earned: true, inSlack: true });
  });

  test("mapping a Slack emoji that names another earned emoji moves it: the other one takes the next free name Slack doesn't have, and reads not in Slack with its catalogue picture", async () => {
    await aliceCollects(otters[0]!);
    await slackHas("team-otters", "team-otters-2");
    const asOwner = await signedIn(owner);

    await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "team-otters", to: { kind: "team", team: "lanterns" } });

    const asAlice = await signedIn(alice);
    expect(await emojiWithId(asAlice, "team:lanterns")).toMatchObject({ name: "team-otters", picture: slackPicture("team-otters"), inSlack: true });
    expect(await emojiWithId(asAlice, "team:otters")).toMatchObject({ name: "team-otters-3", picture: ottersCrestPicture, inSlack: false });
    expect((await mappingsOf(asOwner)).emoji.map(({ name, mapping }) => [name, mapping])).toEqual([
      ["team-otters", { kind: "team", team: "lanterns" }],
      ["team-otters-2", null],
    ]);
  });

  test("an earned emoji mapped to a second Slack emoji leaves the first unmapped", async () => {
    await aliceCollects(otters[0]!);
    await slackHas("team-otters", "sea-otters");
    const asOwner = await signedIn(owner);

    await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "sea-otters", to: { kind: "team", team: "otters" } });

    expect((await mappingsOf(asOwner)).emoji.map(({ name, mapping }) => [name, mapping])).toEqual([
      ["sea-otters", { kind: "team", team: "otters" }],
      ["team-otters", null],
    ]);
  });

  test("clearing a mapping leaves the Slack emoji unmapped for good, and its earned emoji reads not in Slack under a free name", async () => {
    await aliceCollects(otters[0]!);
    await slackHas("team-otters");
    const asOwner = await signedIn(owner);

    expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "team-otters", to: { kind: "unmapped" } })).toEqual({ kind: "mapped" });

    expect((await mappingsOf(asOwner)).emoji).toEqual([{ name: "team-otters", image: slackPicture("team-otters"), mapping: null }]);
    expect(await emojiWithId(await signedIn(alice), "team:otters")).toMatchObject({ name: "team-otters-2", picture: ottersCrestPicture, inSlack: false });
    await theCompanyCopyHolds(...twoTeams());
    expect((await mappingsOf(asOwner)).emoji[0]!.mapping, "after the next company sync").toBeNull();
  });

  test("a Slack emoji the maintainer doesn't have, and a team, milestone, level or person nobody knows, are refused and change nothing; a Slack emoji already in that place only records the maintainer as who mapped it", async () => {
    await aliceCollects(otters[0]!);
    await slackHas("team-otters", "spare");
    const asOwner = await signedIn(owner);
    const before = await everyTable();

    for (const [name, to] of [
      ["not-in-slack", { kind: "team", team: "otters" }],
      ["spare", { kind: "team", team: "walruses" }],
      ["spare", { kind: "milestone", milestone: "speed" }],
      ["spare", { kind: "milestone", milestone: "people" }],
      ["spare", { kind: "milestone", milestone: "people:platinum" }],
      ["spare", { kind: "level", level: 7 }],
      ["spare", { kind: "hype", person: "not-a-key" }],
    ] as const) expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: name, to }), `${name} to ${JSON.stringify(to)}`).toEqual({ kind: "refused" });
    expect(await everyTable()).toEqual(before);

    expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "team-otters", to: { kind: "team", team: "otters" } })).toEqual({ kind: "mapped" });
    const { emojiNames, ...after } = await everyTable();
    const { emojiNames: _namesBefore, ...beforeWithoutNames } = before;
    expect(after, "mapping a Slack emoji to the place it already has changes nothing else").toEqual(beforeWithoutNames);
    expect(emojiNames!.find((row) => (row as { name: string }).name === "team-otters"), "and records the maintainer as who mapped it").toMatchObject({ name: "team-otters", mappedBy: { member: await memberOf(owner), as: "maintainer" } });
  });

  test("a Slack emoji classed random or left unmapped keeps that place when the registry opens, when a person's first pack names their hype emoji and when a later sync adds a team named like it", async () => {
    await slackHas("level-5", "lantern-wickfield1-hype", "team-beavers");
    const asOwner = await signedIn(owner);
    for (const [name, to] of [
      ["level-5", { kind: "random" }],
      ["lantern-wickfield1-hype", { kind: "unmapped" }],
      ["team-beavers", { kind: "random" }],
    ] as const) await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: name, to });

    await aliceCollects(lanterns[0]!);
    await theCompanyCopyHolds(...twoTeams(), { slug: "beavers", name: "Beavers", profiles: profilesOf(bruno) });

    expect((await mappingsOf(asOwner)).emoji.map(({ name, mapping }) => [name, mapping])).toEqual([
      ["lantern-wickfield1-hype", null],
      ["level-5", { kind: "random" }],
      ["team-beavers", { kind: "random" }],
    ]);
    const asAlice = await signedIn(alice);
    expect(await emojiWithId(asAlice, "level:5")).toMatchObject({ name: "level-5-2", inSlack: false });
    expect(await emojiWithId(asAlice, `hype:${await memberOf(lanterns[0]!)}`)).toMatchObject({ name: "lantern-wickfield1-2-hype", inSlack: false });
    expect(await emojiWithId(asAlice, "team:beavers")).toMatchObject({ name: "team-beavers-2", inSlack: false });
  });

  test(`at most ${mostRandomEmojis} Slack emojis are random drops; one more is refused`, async () => {
    const names = Array.from({ length: mostRandomEmojis + 1 }, (_, index) => `drop-${String(index).padStart(3, "0")}`);
    await slackHas(...names);
    const asOwner = await signedIn(owner);
    for (const name of names.slice(0, mostRandomEmojis)) await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: name, to: { kind: "random" } });

    expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: names.at(-1)!, to: { kind: "random" } })).toEqual({ kind: "refused" });
    theRoll.next = { chance: 0, pick: 0.5 };
    await aliceCollects(otters[0]!);
    expect((await albumOf(await signedIn(alice))).emojis.filter(({ kind }) => kind === "random"), "a pack opens within Convex's limits with every random emoji classed").toHaveLength(1);
  });
});

describe("AL23: a random emoji drops from a thoughtful pack", { timeout: 90_000 }, () => {
  test("a pack whose rare roll hits drops one random emoji the member doesn't hold, earned and unseen with its Slack name and picture; a roll that misses drops none", async () => {
    await slackHas("party-parrot", "dancing-hog");
    const asOwner = await signedIn(owner);
    for (const name of ["party-parrot", "dancing-hog"]) await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: name, to: { kind: "random" } });
    expect((await mappingsOf(asOwner)).emoji.map(({ mapping }) => mapping)).toEqual([{ kind: "random" }, { kind: "random" }]);

    await aliceCollects(otters[0]!);
    expect(await randomEmojisOf(await signedIn(alice)), "a roll that misses").toEqual([]);

    theRoll.next = { chance: 0, pick: 0.9 };
    await aliceCollects(otters[1]!);
    expect(await randomEmojisOf(await signedIn(alice))).toEqual([{ id: "random:party-parrot", kind: "random", name: "party-parrot", from: "Otter Quillfeather2", picture: slackPicture("party-parrot"), earned: true, earnedAt: expect.any(Number), seen: false, inSlack: true, progress: null }]);

    await aliceCollects(otters[2]!);
    expect((await randomEmojisOf(await signedIn(alice))).map(({ id }) => id), "the next hit drops the one left").toEqual(["random:dancing-hog", "random:party-parrot"]);
    await aliceCollects(lanterns[0]!);
    expect(await randomEmojisOf(await signedIn(alice)), "nothing left to drop").toHaveLength(2);
  });

  test("a random emoji the member holds stays theirs, seen once marked, after the maintainer maps it elsewhere, and no random emoji drops while none is classed random", async () => {
    theRoll.next = { chance: 0, pick: 0 };
    await aliceCollects(otters[0]!);
    expect(await randomEmojisOf(await signedIn(alice)), "nothing classed random").toEqual([]);
    await slackHas("party-parrot");
    const asOwner = await signedIn(owner);
    await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "party-parrot", to: { kind: "random" } });
    await aliceCollects(otters[1]!);
    const asAlice = await signedIn(alice);
    expect(await asAlice.mutation(api.website.album.markEmojisSeen, { ids: ["random:party-parrot"] })).toEqual({ kind: "seen", ids: ["random:party-parrot"] });

    await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "party-parrot", to: { kind: "team", team: "lanterns" } });

    expect(await randomEmojisOf(asAlice)).toEqual([{ id: "random:party-parrot", kind: "random", name: "party-parrot", from: "Otter Quillfeather2", picture: slackPicture("party-parrot"), earned: true, earnedAt: expect.any(Number), seen: true, inSlack: true, progress: null }]);
    expect((await albumOf(asAlice)).sharedEmojis).toBeNull();
  });

  test("a member who already holds more drops than the pool's limit, after the pool changed, keeps every drop and never gets one twice", async () => {
    const held = Array.from({ length: mostRandomEmojis + 1 }, (_, index) => `old-${String(index).padStart(3, "0")}`);
    await slackHas(...held, "fresh");
    const member = await memberOf(alice);
    await aliceCollects(otters[0]!);
    const pack = await t.run(async (ctx) => (await ctx.db.query("thoughtfulPacks").first())!._id);
    await t.run(async (ctx) => {
      for (const name of held) await ctx.db.insert("randomEmojiDrops", { member, name, pack, at: Date.now() });
      await ctx.db.insert("emojiClasses", { workspace: "T1", name: held.at(-1)!, class: "random" });
    });

    theRoll.next = { chance: 0, pick: 0 };
    await aliceCollects(otters[1]!);

    const drops = await t.run(async (ctx) => (await ctx.db.query("randomEmojiDrops").collect()).map(({ name }) => name));
    expect(drops.filter((name) => name === held.at(-1)), "the held drop beyond the limit is not dropped again").toHaveLength(1);
    expect(await randomEmojisOf(await signedIn(alice))).toHaveLength(held.length);
  });
});

describe("random emojis are dark where random-emojis is off", { timeout: 90_000 }, () => {
  test("with random-emojis off the maintainer reads no random drops place and can't class one, no pack drops one, and a drop already held stays out of the album", async () => {
    await slackHas("party-parrot", "dancing-hog");
    const asOwner = await signedIn(owner);
    await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "party-parrot", to: { kind: "random" } });
    theRoll.next = { chance: 0, pick: 0 };
    await aliceCollects(otters[0]!);
    expect(await randomEmojisOf(await signedIn(alice)), "on: the drop shows").toHaveLength(1);

    await switchWebsite(t, postHog, true, ...albumOpen.filter((flag) => flag !== "random-emojis"));

    expect((await mappingsOf(asOwner)).randomDrops).toBe(false);
    expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "dancing-hog", to: { kind: "random" } })).toEqual({ kind: "refused" });
    await aliceCollects(otters[1]!);
    expect(await randomEmojisOf(await signedIn(alice)), "off: no drop shows").toEqual([]);
    expect(await t.run(async (ctx) => (await ctx.db.query("randomEmojiDrops").collect()).length), "off: no pack drops one").toBe(1);
    expect(await (await signedIn(alice)).mutation(api.website.album.markEmojisSeen, { ids: ["random:party-parrot"] }), "off: a held drop can't be marked seen").toEqual({ kind: "seen", ids: [] });
  });
});

describe("only the maintainer maps Slack emojis", { timeout: 90_000 }, () => {
  test("a workspace admin who isn't the maintainer, every member while KUDOS_MAINTAINER is unset, and the maintainer while workspace-settings is off read no mappings and map nothing", async () => {
    await aliceCollects(otters[0]!);
    await slackHas("team-otters", "spare");
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("members").collect()).find(({ user }) => user === bruno.user)!;
      await ctx.db.patch(row._id, { admin: true });
    });
    const asOwner = await signedIn(owner);
    const otterKey = keyOf(await mappingsOf(asOwner), otters[0]!);
    const asBruno = await signedIn(bruno);
    await asBruno.query(api.website.emojiMappings.getEmojiMappings, {});
    const before = await everyTable();
    const attempts = async (reader: Reader, who: string) => {
      expect(await reader.query(api.website.emojiMappings.getEmojiMappings, {}), who).toEqual({ kind: "off" });
      for (const to of [{ kind: "team", team: "lanterns" }, { kind: "unmapped" }, { kind: "random" }, { kind: "hype", person: otterKey }] as const) {
        expect(await reader.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "team-otters", to }), `${who} mapping to ${to.kind}`).toEqual({ kind: "refused" });
      }
    };

    await attempts(asBruno, "a workspace admin");
    vi.stubEnv("KUDOS_MAINTAINER", "");
    await attempts(asOwner, "the maintainer while KUDOS_MAINTAINER is unset");
    vi.stubEnv("KUDOS_MAINTAINER", bruno.user.replace("BRUNO", "SOMEONE"));
    await attempts(asOwner, "the maintainer while KUDOS_MAINTAINER names someone else");
    vi.stubEnv("KUDOS_MAINTAINER", maintainer);
    await switchWebsite(t, postHog, true, ...albumOpen.filter((flag) => flag !== "workspace-settings"));
    const flagsOff = await everyTable();
    await attempts(asOwner, "the maintainer with workspace-settings off");

    expect(await everyTable()).toEqual(flagsOff);
    expect(withoutFlagRows(flagsOff)).toEqual(withoutFlagRows(before));
  });
});

describe("website reads pass one guard", { timeout: 90_000 }, () => {
  test("getEmojiMappings answers closed with the website flag off, signed-out without a session and not-a-member for a member who left", async () => {
    const asOwner = await signedIn(owner);
    await switchWebsite(t, postHog, false, ...albumOpen);
    expect(await asOwner.query(api.website.emojiMappings.getEmojiMappings, {})).toEqual({ kind: "closed" });
    await switchWebsite(t, postHog, true, ...albumOpen);
    expect(await t.query(api.website.emojiMappings.getEmojiMappings, {})).toEqual({ kind: "signed-out" });
    await memberChanged(t, "user_change", { id: owner.user, team_id: "T1", deleted: true });
    await settle(t);
    expect(await asOwner.query(api.website.emojiMappings.getEmojiMappings, {})).toEqual({ kind: "not-a-member" });
  });
});

describe("website commands pass one guard", { timeout: 90_000 }, () => {
  test("WS61: with the website flag off mapSlackEmoji answers closed, without a session signed-out, and for a member who left not-a-member, writing nothing at all", async () => {
    await slackHas("spare");
    const asOwner = await signedIn(owner);
    const mapping = { emoji: "spare", to: { kind: "random" } } as const;
    await switchWebsite(t, postHog, false, ...albumOpen);
    const closed = await everyTable();
    expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, mapping)).toEqual({ kind: "closed" });
    expect(await everyTable()).toEqual(closed);
    await switchWebsite(t, postHog, true, ...albumOpen);
    const open = await everyTable();
    expect(await t.mutation(api.website.emojiMappings.mapSlackEmoji, mapping)).toEqual({ kind: "signed-out" });
    expect(await everyTable()).toEqual(open);
    await memberChanged(t, "user_change", { id: owner.user, team_id: "T1", deleted: true });
    await settle(t);
    const left = await everyTable();
    expect(await asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, mapping)).toEqual({ kind: "not-a-member" });
    expect(await everyTable()).toEqual(left);
  });

  test("WS61: the Slack emoji and its place are mapSlackEmoji's only arguments, so no call names a member", async () => {
    await slackHas("spare");
    const asOwner = await signedIn(owner);
    const before = await everyTable();

    await expect(asOwner.mutation(api.website.emojiMappings.mapSlackEmoji, { emoji: "spare", to: { kind: "random" }, member: await memberOf(owner) } as never)).rejects.toThrow(/member/);
    expect(await everyTable()).toEqual(before);
  });
});

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

async function mappingsOf(reader: Reader): Promise<EmojiMappings> {
  const read: EmojiMappingsRead | { kind: string } = await reader.query(api.website.emojiMappings.getEmojiMappings, {});
  if (read.kind !== "mappings") throw new Error(`expected the mappings, got ${JSON.stringify(read)}`);
  return read as EmojiMappings;
}

function keyOf(mappings: EmojiMappings, someone: Person): string {
  const found = mappings.people.find(({ name }) => name === someone.name);
  if (found === undefined) throw new Error(`${someone.name} is not among the people to map`);
  return found.key;
}

async function randomEmojisOf(reader: Reader): Promise<Emoji[]> {
  return (await albumOf(reader)).emojis.filter(({ kind }) => kind === "random").toSorted((one, other) => one.id.localeCompare(other.id));
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
  await thanks(alice, why, ...people);
  const asAlice = await signedIn(alice);
  const album = await asAlice.query(api.website.album.getAlbum, {});
  for (const { pack } of album.kind === "album" ? album.packs : []) await asAlice.mutation(api.website.album.openThoughtfulPack, { pack });
  for (let placed = await asAlice.mutation(api.website.album.putAllIn, {}); placed.kind === "placed" && placed.more; ) placed = await asAlice.mutation(api.website.album.putAllIn, {});
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
