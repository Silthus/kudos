import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { offForEveryone, onForEmails, onForEveryone, onInTheSandboxOnly } from "../../testing/flags";
import type { FlagDefinition } from "../../testing/fakePostHog";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakePostHogCom, type TeamPage } from "../../testing/fakePostHogCom";
import { FakeSlack, slackError, type SlackCall } from "../../testing/fakeSlack";
import { signedRequest } from "../../testing/signedSlack";
import { deleteMessage, memberChanged, post, react, settle, settleUpTo, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonInHome, publishedHome } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession } from "../../testing/website";
import { api, components, internal } from "../_generated/api";
import crons from "../crons";
import { setMondayPost } from "../leaderboard/mondayPost";
import { setLeaderboardVisibility } from "../leaderboard/visibility";

const lastWeeksTuesday = Date.parse("2026-10-06T10:00:00Z");
const tuesday = Date.parse("2026-10-13T10:00:00Z");
const mondayNine = Date.parse("2026-10-19T09:00:00Z");
const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const weekMs = 7 * 24 * hourMs;
const site = "https://kudos-site.test";
const slackUrl = "https://t1.slack.com/";
const channel = "C_TEAM";
const announcementChannel = "C_KUDOS";
const why = "Thanks for untangling the flaky migration";
const albumOn = ["website", "album", "collection", "packs", "xp-levels", "message-settings", "hugs", "groups", "monday-post"];
const albumSlack = "album-slack";
const footer = "<slack://app?team=T1&id=A_KUDOS&tab=home|Change what I send you> in App Home's Settings tab.";
const nudge = "Hugs are a quick thanks. A kudos that names a teammate and says why earns much more XP.";

const theGate = vi.hoisted(() => ({ shut: false }));

vi.mock("./albumSlack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./albumSlack")>();
  return {
    ...actual,
    albumSlackAppliesTo: async (...args: Parameters<typeof actual.albumSlackAppliesTo>) => !theGate.shut && (await actual.albumSlackAppliesTo(...args)),
    albumSlackAppliesToWorkspace: async (...args: Parameters<typeof actual.albumSlackAppliesToWorkspace>) => !theGate.shut && (await actual.albumSlackAppliesToWorkspace(...args)),
  };
});

type Person = { user: string; name: string; email: string; profile: number };

const alice = person("Alice", "Marchetti", 1);
const bob = person("Bob", "Okonkwo", 2);
const carol = person("Carol", "Lindqvist", 3);
const dana = person("Dana", "Ferreira", 4);
const everyone = [alice, bob, carol, dana];
const lanterns: TeamPage = { slug: "lanterns", name: "Lanterns", profiles: [profileOf(alice), profileOf(bob), profileOf(carol)] };
const otters: TeamPage = { slug: "otters", name: "Otters", profiles: [profileOf(bob), profileOf(dana)] };

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let messages = 0;
let refusesPictures = false;

beforeEach(() => {
  theGate.shut = false;
  refusesPictures = false;
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AL60: the Monday hug recap names the emojis earned last week", { timeout: 180_000 }, () => {
  test("a member who unlocked a team sticker and two hype emojis last week gets one more line in their recap, each emoji's picture with its name, Slack's own where Slack has it, and a member who earned none gets today's recap", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    slack.withCustomEmoji("carol-lindqvist-hype", "https://emoji.slack-edge.com/T1/carol-lindqvist-hype/1.png");
    await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
    await collects(alice, bob, carol);
    await unlocks(alice, "lanterns");
    const danaSays = await says(dana, "Lunch is in the kitchen");
    await hugs(alice, danaSays);

    await recapsSentOnMonday();

    expect(recapTo(alice)).toEqual({
      channel: alice.user,
      text: [...alicesWeekInHugs, "Emojis you earned last week: team-lanterns, bob-okonkwo-hype, :carol-lindqvist-hype:, first-face, first-full-page, first-thank-you", footer].join("\n"),
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: alicesWeekInHugs.join("\n") } },
        {
          type: "context",
          elements: [
            { type: "image", image_url: `${site}/emoji/team.png`, alt_text: "team-lanterns" },
            { type: "image", image_url: `${site}/emoji/hype.png`, alt_text: "bob-okonkwo-hype" },
            { type: "image", image_url: "https://emoji.slack-edge.com/T1/carol-lindqvist-hype/1.png", alt_text: "carol-lindqvist-hype" },
            { type: "image", image_url: `${site}/emoji/milestone-people-bronze.png`, alt_text: "first-face" },
            { type: "image", image_url: `${site}/emoji/milestone-teams-bronze.png`, alt_text: "first-full-page" },
            { type: "image", image_url: `${site}/emoji/milestone-thoughtful-bronze.png`, alt_text: "first-thank-you" },
            { type: "mrkdwn", text: "Emojis you earned last week: team-lanterns, bob-okonkwo-hype, :carol-lindqvist-hype:, first-face, first-full-page, first-thank-you" },
          ],
        },
        { type: "context", elements: [{ type: "mrkdwn", text: footer }] },
      ],
    });
    expect(recapTo(dana), "Dana earned no emoji last week").toEqual({
      channel: dana.user,
      text: [":taco: Your week in hugs", "Teammates reacted :taco: on your messages and gave you 1 hug (+1 XP).", `1 teammate reacted :taco: on your most-hugged message: <${permalinkOf(danaSays)}|open it in Slack>`, nudge, footer].join("\n"),
    });
  });

  test("emojis earned the week before are not on last week's recap, which is then today's recap", async () => {
    await fourMembers([onForEveryone(albumSlack)], { startingAt: lastWeeksTuesday });
    await collects(alice, bob, carol);
    await unlocks(alice, "lanterns");
    vi.setSystemTime(tuesday);
    await hugs(alice, await says(dana, "Lunch is in the kitchen"));

    await recapsSentOnMonday();

    expect(recapTo(alice)).toEqual({ channel: alice.user, text: [...alicesWeekInHugs, footer].join("\n") });
  });

  test("thirty-seven emojis show their first nine pictures and their first twenty-five names, the rest counted", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    const crowd = await joined(30);
    await thanks(alice, why, ...crowd);
    await levelsReached(alice, 26);
    await hugs(alice, await says(dana, "Lunch is in the kitchen"));

    await recapsSentOnMonday();

    const emojiLine = contextOf(recapTo(alice));
    expect(emojiLine.filter(({ type }) => type === "image")).toHaveLength(9);
    const names = crowd.slice(0, 25).map(({ name }) => `${name.toLowerCase().replaceAll(" ", "-")}-hype`);
    expect(emojiLine.at(-1)).toEqual({ type: "mrkdwn", text: `Emojis you earned last week: ${names.join(", ")} and 12 more` });
  });

  test("a member who jumps past level 5 in one award earns the level-5 emoji, recorded only at the level they reached", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    await t.mutation(internal.album.emojiNames.reserveSharedEmojiNames, { workspace: "T1" });
    await levelsReached(alice, 6);
    await hugs(alice, await says(dana, "Lunch is in the kitchen"));

    await recapsSentOnMonday();

    expect(contextOf(recapTo(alice)).at(-1)).toEqual({ type: "mrkdwn", text: "Emojis you earned last week: level-5" });
  });

  test("a recap whose pictures Slack refuses goes once more without them, its emoji line as words", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    await thanks(alice, why, bob);
    await hugs(alice, await says(dana, "Lunch is in the kitchen"));
    refusesPictures = true;

    await recapsSentOnMonday();

    expect(recapTo(alice)).toEqual({ channel: alice.user, text: [...alicesWeekInHugs, "Emojis you earned last week: bob-okonkwo-hype, first-thank-you", footer].join("\n") });
  });
});

describe("AL61: the Monday post becomes the week's top thoughtful kudos", { timeout: 180_000 }, () => {
  test("the three most hugged public thoughtful kudos are quoted, then by recipients, then newest, each with giver, recipients, its first 200 characters and a link, and the week's team stickers by count", async () => {
    await fourMembers([onForEveryone(albumSlack)], { startingAt: lastWeeksTuesday });
    await collects(alice, bob, carol);
    await collects(bob, dana);
    await collects(dana, bob);
    vi.setSystemTime(tuesday);
    await unlocks(alice, "lanterns");
    await unlocks(bob, "otters");
    await unlocks(dana, "otters");
    const long = `${"Thanks for staying late to pair on the release checklist, ".repeat(4)}it saved the launch`;
    const mostHugged = await thanks(alice, long, bob);
    const twoRecipients = await thanks(carol, "Thanks for the careful design review today", dana, alice);
    const newest = await thanks(dana, "Thanks for covering the support rotation", carol);
    const unhugged = await thanks(bob, "Thanks for the thorough incident write-up", alice);
    const short = await thanks(bob, "ty", carol);
    await hugs(carol, mostHugged);
    await hugs(dana, mostHugged);
    await hugs(bob, twoRecipients);
    await hugs(alice, newest);
    for (const hugger of [alice, dana]) await hugs(hugger, short);

    await mondayPostSent();

    const quote = `${long.slice(0, 200)}…`;
    expect(Array.from(quote.slice(0, -1))).toHaveLength(200);
    expect(mondayPost()).toEqual({
      channel: announcementChannel,
      text: [
        "🏆 Last week's top thoughtful kudos",
        `1. Alice Marchetti thanked Bob Okonkwo: ${quote} ${permalinkOf(mostHugged)}`,
        `2. Carol Lindqvist thanked Dana Ferreira and Alice Marchetti: Thanks for the careful design review today @Dana Ferreira @Alice Marchetti :taco: ${permalinkOf(twoRecipients)}`,
        `3. Dana Ferreira thanked Carol Lindqvist: Thanks for covering the support rotation @Carol Lindqvist :taco: ${permalinkOf(newest)}`,
        "Team stickers unlocked last week: Otters ×2, Lanterns ×1",
      ].join("\n"),
      unfurl_links: false,
      unfurl_media: false,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: "*🏆 Last week's top thoughtful kudos*" } },
        { type: "section", text: { type: "mrkdwn", text: `*1. Alice Marchetti* thanked *Bob Okonkwo*\n>${quote}\n<${permalinkOf(mostHugged)}|Open in Slack>` } },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*2. Carol Lindqvist* thanked *Dana Ferreira* and *Alice Marchetti*\n>Thanks for the careful design review today @Dana Ferreira @Alice Marchetti :taco:\n<${permalinkOf(twoRecipients)}|Open in Slack>` },
        },
        { type: "section", text: { type: "mrkdwn", text: `*3. Dana Ferreira* thanked *Carol Lindqvist*\n>Thanks for covering the support rotation @Carol Lindqvist :taco:\n<${permalinkOf(newest)}|Open in Slack>` } },
        { type: "section", text: { type: "mrkdwn", text: "*Team stickers unlocked last week*" } },
        { type: "context", elements: [{ type: "image", image_url: `${site}/emoji/team.png`, alt_text: "team-otters" }, { type: "mrkdwn", text: "*Otters* ×2" }] },
        { type: "context", elements: [{ type: "image", image_url: `${site}/emoji/team.png`, alt_text: "team-lanterns" }, { type: "mrkdwn", text: "*Lanterns* ×1" }] },
      ],
    });
    expect(quotedMessagesOf(mondayPost()), "the unhugged kudos is fourth").not.toContain(unhugged);
  });

  test("a week with no public thoughtful kudos and no team sticker posts nothing", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    await thanks(bob, "ty", carol);

    await mondayPostSent();

    expect(mondayPosts()).toEqual([]);
  });

  test("a post whose pictures Slack refuses goes once more without them", async () => {
    await fourMembers([onForEveryone(albumSlack)], { startingAt: lastWeeksTuesday });
    await collects(alice, bob, carol);
    vi.setSystemTime(tuesday);
    await unlocks(alice, "lanterns");
    await thanks(carol, "Thanks for the careful design review today", dana);
    refusesPictures = true;

    await mondayPostSent();

    expect(mondayPost()?.blocks?.at(-1)).toEqual({ type: "context", elements: [{ type: "mrkdwn", text: "*Lanterns* ×1" }] });
  });

  test("more than ten teams: the first ten with their pictures, then every other team with its count", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    await teamStickersUnlocked(alice, 12);

    await mondayPostSent();

    const blocks = mondayPost()?.blocks ?? [];
    expect(blocks.filter(({ type }) => type === "context")).toHaveLength(11);
    expect(blocks.at(-1)).toEqual({ type: "context", elements: [{ type: "mrkdwn", text: "*Team 10* ×1 · *Team 11* ×1" }] });
  });

  test("sixty teams with short names: the first ten with their pictures, then all fifty others with their counts in one line", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    await teamStickersUnlocked(alice, 60);

    await mondayPostSent();

    const listed = Array.from({ length: 50 }, (_, index) => `*Team ${index + 10}* ×1`).join(" · ");
    expect(mondayPost()?.blocks?.at(-1)).toEqual({ type: "context", elements: [{ type: "mrkdwn", text: listed }] });
  });

  test("sixty teams with long names: the line of other teams stays within Slack's 3,000 characters and counts the rest", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    await teamStickersUnlocked(alice, 60, " of the Very Long Department Name That Goes On and On Past Every Reasonable Length");

    await mondayPostSent();

    const otherTeams = mondayPost()?.blocks?.at(-1)?.elements?.[0]?.text ?? "";
    expect(otherTeams.length).toBeLessThanOrEqual(3_000);
    expect(otherTeams).toMatch(/^\*Team 10 of the Very Long Department Name That Goes On and On Past Every Reasonable Length\* ×1 · .+ and \d+ more teams$/);
  });

  test("a kudos that starts with many blank lines still quotes its words", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    messages += 1;
    vi.setSystemTime(Date.now() + minuteMs);
    const ts = `${Math.floor(Date.now() / 1000)}.${String(messages).padStart(6, "0")}`;
    const blankLines = Array.from({ length: 201 }, () => text("\n"));
    await post(t, [section(...blankLines, text("Thanks for the careful design review today "), mention(dana.user), text(" "), emoji("taco"))], { user: carol.user, ts, channel });
    await settle(t);

    await mondayPostSent();

    expect(mondayPost()?.text).toContain("1. Carol Lindqvist thanked Dana Ferreira: Thanks for the careful design review today @Dana Ferreira :taco:");
  });

  test("an admin's App Home switch says the Monday post is the week's top thoughtful kudos", async () => {
    await fourMembers([onForEveryone(albumSlack)]);

    await adminTabOpen(alice);

    expect(publishedHome(slack, alice.user)).toContain(`section: I can post last week's top thoughtful kudos in <#${announcementChannel}> every Monday at 9:00. [button: Switch on]`);
  });
});

describe("LP55: the Monday post marks a turned epic or legendary find", { timeout: 180_000 }, () => {
  test("a quoted kudos whose giver turned a legendary or an epic hoggie from it says so beside its lead, the rarest of a kudos to two people, and one whose find was rare says nothing", async () => {
    await fourMembers([onForEveryone(albumSlack), ...itemsOn, onForEveryone(itemShare)]);
    const legendary = await thanks(alice, "Thanks for staying late on the release checklist", bob);
    const twoRecipients = await thanks(carol, "Thanks for the careful design review today", dana, alice);
    const rare = await thanks(dana, "Thanks for covering the support rotation", carol);
    for (const hugger of [carol, dana, bob]) await hugs(hugger, legendary);
    for (const hugger of [bob, alice]) await hugs(hugger, twoRecipients);
    await hugs(alice, rare);
    await turnsEverything(alice, "rocket");
    await turnsEverything(carol, "70s-dance", "angel");
    await turnsEverything(dana, "996");

    await mondayPostSent();

    expect(leadsOf(mondayPost())).toEqual([
      "*1. Alice Marchetti* thanked *Bob Okonkwo* and found a legendary Rocket",
      "*2. Carol Lindqvist* thanked *Dana Ferreira* and *Alice Marchetti* and found an epic Angel",
      "*3. Dana Ferreira* thanked *Carol Lindqvist*",
    ]);
    expect(String(mondayPost()?.text).split("\n").slice(1, 3)).toEqual([
      `1. Alice Marchetti thanked Bob Okonkwo and found a legendary Rocket: Thanks for staying late on the release checklist @Bob Okonkwo :taco: ${permalinkOf(legendary)}`,
      `2. Carol Lindqvist thanked Dana Ferreira and Alice Marchetti and found an epic Angel: Thanks for the careful design review today @Dana Ferreira @Alice Marchetti :taco: ${permalinkOf(twoRecipients)}`,
    ]);
  });

  test("a quoted kudos whose item still lies face down says nothing, beside one whose giver turned a legendary", async () => {
    await fourMembers([onForEveryone(albumSlack), ...itemsOn, onForEveryone(itemShare)]);
    await thanks(alice, "Thanks for staying late on the release checklist", bob);
    await thanks(carol, "Thanks for the careful design review today", dana);
    await turnsEverything(carol, "rocket");

    await mondayPostSent();

    expect(leadsOf(mondayPost())).toEqual(["*1. Carol Lindqvist* thanked *Dana Ferreira* and found a legendary Rocket", "*2. Alice Marchetti* thanked *Bob Okonkwo*"]);
  });

  test.each([
    { condition: "with item-share off", flags: [offForEveryone(itemShare)] },
    { condition: "while PostHog has no item-share flag", flags: [] },
    { condition: "with item-share on for someone else's email only", flags: [onForEmails(itemShare, dana.email)] },
  ])("$condition, a week whose quoted kudos brought a turned legendary posts the same Monday post as the week whose find still lies face down", async ({ flags }) => {
    const faceDown = await aWeekWithAFind(flags, { turned: false });

    const turned = await aWeekWithAFind(flags, { turned: true });

    expect(turned).toEqual(faceDown);
    expect(leadsOf(turned)).toEqual(["*1. Alice Marchetti* thanked *Bob Okonkwo*"]);
  });
});

const itemShare = "item-share";
const itemsOn = ["hidden-items", "collection"].map(onForEveryone);
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

async function turnsEverything(giver: Person, ...draws: string[]) {
  const { asSignedIn } = await aSignedInSession(t, { user: giver.user, name: giver.name });
  const album = await asSignedIn.query(api.website.album.getAlbum, {});
  const board = album.kind === "album" ? (album.board?.items ?? []) : [];
  theDraw.planned = [...draws];
  for (const { item } of board) expect((await asSignedIn.mutation(api.website.album.turnItem, { item })).kind, `${giver.name} turns an item`).toBe("turned");
  expect(theDraw.planned, `${giver.name}'s hoggies drawn`).toEqual([]);
  await settle(t);
}

async function aWeekWithAFind(flags: FlagDefinition[], { turned }: { turned: boolean }) {
  await fourMembers([onForEveryone(albumSlack), ...itemsOn, ...flags]);
  await thanks(alice, "Thanks for staying late on the release checklist", bob);
  if (turned) await turnsEverything(alice, "rocket");
  await mondayPostSent();
  return mondayPost();
}

function leadsOf(posted: Posted | undefined) {
  return (posted?.blocks ?? []).flatMap(({ type, text }) => (type === "section" && text?.text.includes(" thanked ") ? [text.text.split("\n")[0]] : []));
}

describe("AL61 AL63: a weekly post quotes only public kudos", { timeout: 180_000 }, () => {
  test("a thoughtful kudos in a private channel, in a group DM or in a DM, or one deleted since, is never quoted however hugged, and a public one is", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    const inPrivate = await thanks(alice, "Thanks for walking me through the billing edge cases", bob, { channel: "G_PRIVATE", channelType: "group" });
    const inAGroupDm = await thanks(carol, "Thanks for the patient onboarding session yesterday", bob, { channel: "G_MPDM", channelType: "mpim" });
    const inADm = await thanks(dana, "Thanks for answering every question about the data model", bob, { channel: "D_DANA", channelType: "im" });
    const deleted = await thanks(bob, "Thanks for rescuing the deploy pipeline on Friday", carol);
    const shown = await thanks(carol, "Thanks for the clear notes after the planning meeting", dana);
    for (const hugger of [carol, dana]) await hugs(hugger, inPrivate);
    for (const hugger of [alice, dana]) await hugs(hugger, inAGroupDm);
    for (const hugger of [alice, carol]) await hugs(hugger, inADm);
    for (const hugger of [alice, dana]) await hugs(hugger, deleted);
    await deleteMessage(t, { ts: deleted.ts, channel: deleted.channel, user: bob.user });
    await settle(t);

    await mondayPostSent();

    expect(quotedMessagesOf(mondayPost())).toEqual([shown]);
    expect(JSON.stringify(mondayPost()), "no word of a private kudos").not.toMatch(/billing|onboarding|data model|deploy pipeline/);
  });

  test("a kudos whose giver or recipient left the leaderboards is not quoted", async () => {
    await fourMembers([onForEveryone(albumSlack)]);
    const toSomeoneOffTheBoards = await thanks(alice, "Thanks for the careful review of the pricing page", bob);
    const shown = await thanks(carol, "Thanks for the clear notes after the planning meeting", dana);
    await hugs(carol, toSomeoneOffTheBoards);
    await t.run(async (ctx) => {
      const member = (await ctx.db.query("members").collect()).find(({ user }) => user === bob.user)!._id;
      await setLeaderboardVisibility(ctx, member, false);
    });

    await mondayPostSent();

    expect(quotedMessagesOf(mondayPost())).toEqual([shown]);
  });
});

const albumSlackOff: Array<{ condition: string; flags: FlagDefinition[]; turnOff?: () => void; momentsSent?: { recaps: number; mondayPosts: number } }> = [
  { condition: "with album-slack off", flags: [offForEveryone(albumSlack)] },
  { condition: "while PostHog has no album-slack flag", flags: [] },
  { condition: "without the flags key, even when PostHog turned album-slack on", flags: [onForEveryone(albumSlack)], turnOff: () => vi.stubEnv("POSTHOG_PERSONAL_API_KEY", ""), momentsSent: { recaps: 0, mondayPosts: 0 } },
  { condition: "in production, while album-slack is on in the sandbox only", flags: [onInTheSandboxOnly(albumSlack)], turnOff: () => vi.stubEnv("KUDOS_ENVIRONMENT", "production") },
  { condition: "with album-slack on but album off", flags: [onForEveryone(albumSlack)] },
  { condition: "with album-slack on for someone else's email only", flags: [onForEmails(albumSlack, dana.email)] },
];

describe("AL58: album moments are dark where album-slack is off", { timeout: 180_000 }, () => {
  test.each(albumSlackOff)("$condition, the Monday recaps and the Monday post make every Slack call they make with the album moments shut, and expose nothing", async ({ condition, flags, turnOff, momentsSent = { recaps: 2, mondayPosts: 1 } }) => {
    const albumFlags = condition.includes("album off") ? albumOn.filter((key) => key !== "album") : albumOn;
    theGate.shut = true;
    const shut = await mondayWalkWith(albumFlags, flags, turnOff);
    theGate.shut = false;

    const walk = await mondayWalkWith(albumFlags, flags, turnOff);

    expect(walk.calls).toEqual(shut.calls);
    expect({ recaps: walk.recaps.length, mondayPosts: walk.mondayPosts.length }, "the Monday moments went out where today's flags send them").toEqual(momentsSent);
    expect(walk.exposures).toEqual([]);
  });

  test("with album-slack on for one member's email, only that member's recap gains the line, and the Monday post stays the groups post", async () => {
    const walk = await mondayWalkWith(albumOn, [onForEmails(albumSlack, alice.email)]);

    expect(walk.recaps.map(({ channel, blocks }) => ({ channel, emojiLine: blocks !== undefined })).sort((one, other) => one.channel.localeCompare(other.channel))).toEqual([
      { channel: alice.user, emojiLine: true },
      { channel: dana.user, emojiLine: false },
    ]);
    expect(walk.mondayPosts.map(({ text }) => String(text).split("\n")[0])).toEqual(["🏆 Last week in kudos"]);
  });
});

async function mondayWalkWith(albumFlags: string[], flags: FlagDefinition[], turnOff?: () => void) {
  await fourMembers(flags, { albumFlags, startingAt: lastWeeksTuesday });
  await collects(alice, bob, carol);
  vi.setSystemTime(tuesday);
  await triesToUnlock(alice, "lanterns");
  turnOff?.();
  slack.calls.length = 0;
  await thanks(alice, why, dana);
  await hugs(alice, await says(dana, "Lunch is in the kitchen"));
  await mondayComes();
  const exposures = await t.run(async (ctx) => (await ctx.db.query("flagExposures").collect()).filter(({ flag }) => flag === albumSlack));
  return { calls: slack.calls.map((call) => JSON.stringify(call)).sort(), recaps: recaps(), mondayPosts: mondayPosts(), exposures };
}

type Options = { albumFlags?: string[]; startingAt?: number };

async function fourMembers(flags: FlagDefinition[], { albumFlags = albumOn, startingAt = tuesday }: Options = {}) {
  vi.unstubAllEnvs();
  vi.useFakeTimers({ now: startingAt });
  aDeploymentForWorkspace();
  vi.stubEnv("SITE_URL", site);
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  messages = 0;
  postHog = new FakePostHog();
  const postHogCom = new FakePostHogCom().withTeams(lanterns, otters);
  slack = new FakeSlack();
  for (const someone of everyone) slack.withMember(someone.user, { tz: "UTC", is_admin: someone === alice, profile: { display_name: someone.name, real_name: someone.name, email: someone.email } });
  slack.withUserGroup("S_LANTERNS", { name: "Lanterns", users: [alice.user, bob.user, carol.user] }).withUserGroup("S_OTTERS", { name: "Otters", users: [dana.user] });
  vi.stubGlobal("fetch", routedFetch(postHog, (input, init) => (postHogCom.owns(new URL(input instanceof Request ? input.url : String(input))) ? postHogCom.fetch(input) : slackAnswering(input, init))));
  t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200, announcementChannel }));
  await t.mutation(internal.workspace.url.rememberWorkspaceUrl, { workspace: "T1", url: slackUrl });
  postHog.withFlags(...albumFlags.map(onForEveryone), ...flags);
  await t.action(components.posthog.lib.refreshFlagDefinitions, {});
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

async function slackAnswering(input: string | URL | Request, init?: RequestInit) {
  const refused = refusesPictures && String(input instanceof Request ? input.url : input).endsWith("/chat.postMessage") && String(init?.body ?? "").includes('"type":"image"');
  return refused ? slackError("invalid_blocks")(() => new Response()) : slack.fetch(input, init);
}

type Sent = { channel: string; ts: string };

type Where = { channel?: string; channelType?: "channel" | "group" | "im" | "mpim" };

async function thanks(giver: Person, words: string, ...recipientsAndWhere: Array<Person | Where>): Promise<Sent> {
  const recipients = recipientsAndWhere.filter((item): item is Person => "user" in item);
  const where = recipientsAndWhere.find((item): item is Where => !("user" in item)) ?? {};
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const ts = `${Math.floor(Date.now() / 1000)}.${String(messages).padStart(6, "0")}`;
  const sentIn = where.channel ?? channel;
  const thanked = recipients.flatMap(({ user }) => [mention(user), text(" ")]);
  await post(t, [section(text(`${words} `), ...thanked, emoji("taco"))], { user: giver.user, ts, channel: sentIn, ...(where.channelType && { channelType: where.channelType }) });
  authors.set(`${sentIn}/${ts}`, giver.user);
  await settle(t);
  return { channel: sentIn, ts };
}

const authors = new Map<string, string>();

async function hugs(hugger: Person, { channel: hugged, ts }: Sent) {
  vi.setSystemTime(Date.now() + minuteMs);
  await react(t, { user: hugger.user, itemUser: authors.get(`${hugged}/${ts}`)!, channel: hugged, ts });
  await settle(t);
}

async function joined(people: number): Promise<Person[]> {
  const crowd = Array.from({ length: people }, (_, index) => person(`Guest${String(index).padStart(2, "0")}`, "Visitor", 100 + index));
  for (const someone of crowd) {
    slack.withMember(someone.user, { tz: "UTC", profile: { display_name: someone.name, real_name: someone.name, email: someone.email } });
    const profile = { real_name: someone.name, display_name: someone.name, email: someone.email };
    await memberChanged(t, "team_join", { id: someone.user, team_id: "T1", tz: "UTC", name: someone.name, real_name: someone.name, profile });
  }
  await settle(t);
  return crowd;
}

async function levelsReached(someone: Person, level: number) {
  await t.run(async (ctx) => {
    const member = (await ctx.db.query("members").collect()).find(({ user }) => user === someone.user)!._id;
    await ctx.db.insert("levelUps", { member, level, ready: [], at: Date.now() });
  });
}

async function teamStickersUnlocked(someone: Person, teams: number, nameEnding = "") {
  await t.run(async (ctx) => {
    const member = (await ctx.db.query("members").collect()).find(({ user }) => user === someone.user)!._id;
    for (let index = 0; index < teams; index += 1) {
      const name = `Team ${String(index).padStart(2, "0")}${nameEnding}`;
      await ctx.db.insert("teamStickers", { member, workspace: "T1", team: `team-${index}`, at: Date.now(), name, art: null, emoji: `team-${index}` });
    }
  });
}

async function adminTabOpen(admin: Person) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(admin.user)));
  await settle(t);
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(admin.user, buttonInHome(slack, admin.user, "Admin")), { contentType: "application/x-www-form-urlencoded" }));
  await settle(t);
}

async function says(author: Person, words: string): Promise<Sent> {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const ts = `${Math.floor(Date.now() / 1000)}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(words))], { user: author.user, ts, channel });
  authors.set(`${channel}/${ts}`, author.user);
  await settle(t);
  return { channel, ts };
}

async function collects(collector: Person, ...people: Person[]): Promise<Sent> {
  const kudos = await thanks(collector, why, ...people);
  const { asSignedIn } = await aSignedInSession(t, { user: collector.user, name: collector.name });
  const album = await asSignedIn.query(api.website.album.getAlbum, {});
  for (const { pack } of album.kind === "album" ? album.packs : []) await asSignedIn.mutation(api.website.album.openThoughtfulPack, { pack });
  for (let placed = await asSignedIn.mutation(api.website.album.putAllIn, {}); placed.kind === "placed" && placed.more; ) placed = await asSignedIn.mutation(api.website.album.putAllIn, {});
  await settle(t);
  return kudos;
}

async function unlocks(member: Person, team: string) {
  expect(await triesToUnlock(member, team), `${member.name} unlocks ${team}`).toBe("unlocked");
}

async function triesToUnlock(member: Person, team: string) {
  const { asSignedIn } = await aSignedInSession(t, { user: member.user, name: member.name });
  const unlocked = await asSignedIn.mutation(api.website.album.unlockTeamSticker, { team });
  await settle(t);
  return unlocked.kind;
}

function recapSweep() {
  const job = crons.crons["schedule each member's weekly hugs recap"];
  if (job === undefined) throw new Error("no cron job schedules each member's weekly hugs recap");
  return makeFunctionReference<"mutation">(job.name);
}

async function recapsSentOnMonday() {
  await t.mutation(recapSweep(), {});
  await settleUpTo(t, mondayNine + hourMs);
}

async function mondayPostSent() {
  await mondayPostSwitchedOn();
  await settleUpTo(t, mondayNine + hourMs);
}

async function mondayComes() {
  await t.mutation(recapSweep(), {});
  await mondayPostSwitchedOn();
  await settleUpTo(t, mondayNine + hourMs);
}

async function mondayPostSwitchedOn() {
  await t.run(async (ctx) => {
    const member = (await ctx.db.query("members").collect()).find(({ user }) => user === alice.user)!._id;
    await setMondayPost(ctx, "T1", { member, admin: true, timeZone: "UTC" }, { on: true, timeZone: "UTC" });
  });
}

type Posted = SlackCall["args"] & { channel: string; text: string; blocks?: Array<{ type: string; text?: { text: string }; elements?: Array<{ type: string; text?: string }> }> };

function recaps(): Posted[] {
  return (slack.callsTo("chat.postMessage") as Posted[]).filter(({ text }) => String(text).startsWith(":taco: Your week in hugs"));
}

function recapTo(someone: Person): Posted | undefined {
  const sent = recaps().filter(({ channel: to }) => to === someone.user);
  expect(sent, `one recap to ${someone.name}`).toHaveLength(1);
  return sent[0];
}

function contextOf(recap: Posted | undefined) {
  return recap?.blocks?.find(({ type }) => type === "context")?.elements ?? [];
}

function mondayPosts(): Posted[] {
  return (slack.callsTo("chat.postMessage") as Posted[]).filter(({ channel: to, text }) => to === announcementChannel && String(text).startsWith("🏆"));
}

function mondayPost(): Posted | undefined {
  const sent = mondayPosts();
  expect(sent, "one Monday post").toHaveLength(1);
  return sent[0];
}

function quotedMessagesOf(posted: Posted | undefined): Sent[] {
  const links = [...String(posted?.text ?? "").matchAll(/https:\/\/t1\.slack\.com\/archives\/(\w+)\/p(\d+)/g)];
  return links.map(([, linked, ts]) => ({ channel: linked!, ts: `${ts!.slice(0, -6)}.${ts!.slice(-6)}` }));
}

const alicesWeekInHugs = [":taco: Your week in hugs", "You reacted :taco: and gave 1 hug (+1 XP).", nudge];

function permalinkOf({ channel: conversation, ts }: Sent) {
  return `${slackUrl}archives/${conversation}/p${ts.replace(".", "")}`;
}

function person(first: string, last: string, profile: number): Person {
  return { user: `U_${first}_${last}`.toUpperCase(), name: `${first} ${last}`, email: `${first}.${last}@example.com`.toLowerCase(), profile };
}

function profileOf({ name, profile }: Person): TeamPage["profiles"][number] {
  const [firstName, lastName] = name.split(" ") as [string, string];
  return { id: profile, firstName, lastName, colour: "teal" };
}
