import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack, landsButTimesOut, networkFailure, rateLimitedFor, type SlackArgs } from "../../testing/fakeSlack";
import { flagsFromPostHog, onForEmails, onForEveryone } from "../../testing/flags";
import { memberChanged, post, react, settleInTimeOrder, settleUpTo, testBackend, type Backend } from "../../testing/slackBackend";
import { signedRequest } from "../../testing/signedSlack";
import { blockActions, buttonIn, readBlocks, type Block } from "../../testing/slackInteractions";
import { emoji, mention, section, text } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, switchWebsite } from "../../testing/website";
import { internal } from "../_generated/api";
import crons from "../crons";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const mondayNine = Date.parse("2026-10-19T09:00:00Z");
const weekendBeforeMonday = Date.parse("2026-10-18T00:00:00Z");
const honoluluMondayNine = Date.parse("2026-10-19T19:00:00Z");
const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;
const siteUrl = "https://kudos.example";
const alice = { user: "U_ALICE", name: "Alice Marchetti" };
const bob = { user: "U_BOB", name: "Bob Okonkwo" };
const alicesEmail = "alice@example.com";
const carol = { user: "U_CAROL", name: "Carol Lindqvist" };
const saysWhy = "thanks for untangling the flaky migration today";
const todaysFlags = ["xp-levels", "album", "collection", "packs", "hidden-items", "onboarding", "hugs", "message-settings"];
const mondayPath = [...todaysFlags, "monday-quest"];
const footer = "<slack://app?team=T1&id=A_KUDOS&tab=home|Change what I send you> in App Home's Settings tab.";
const nudge = "Hugs are a quick thanks. A kudos that names a teammate and says why earns much more XP.";
const sendMondayDm = "slack/mondayDm:sendMondayDm";
const sendHugsRecap = "slack/hugsRecap:sendHugsRecap";

type Person = { user: string; name: string };

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let messages = 0;

beforeEach(async () => {
  vi.useFakeTimers({ now: tuesday });
  aDeploymentForWorkspace();
  vi.stubEnv("SITE_URL", siteUrl);
  postHog = new FakePostHog();
  slack = new FakeSlack();
  for (const person of [alice, bob, carol]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 200 }));
  await t.mutation(internal.workspace.url.rememberWorkspaceUrl, { workspace: "T1", url: "https://t1.slack.com/" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("MQ23 MQ24 MQ25 MQ28: at Monday 9:00 local a Monday-path member gets one DM built from their hugs and their quests", { timeout: 60_000 }, () => {
  test("a member hugged last week, one quest into onboarding, gets the recap's lines, then the journey with three buttons, and today's footer", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    const hugged = await hug(bob, alice);

    await mondayArrives();

    expect(dmsTo(alice).map(seen)).toEqual([
      [
        `section: :taco: Your week in hugs\nTeammates reacted :taco: on your messages and gave you 1 hug (+1 XP).\n1 teammate reacted :taco: on your most-hugged message: <${permalinkOf(hugged)}|open it in Slack>`,
        "divider",
        `section: *Your onboarding journey* · 1 of 3 done\nTwo quests left. Each one pays +50 XP and an unidentified Hoggie for your collection.\n\nFive unidentified Hoggies for your collection are waiting for you.`,
        "✅ ~Thank someone and say why~",
        "👉 *Thank someone you haven't thanked before*",
        "⚪ Say why on 2 different days _1 of 2 days_",
        `actions: Identify them on the website (primary, dm-link:monday:book → ${siteUrl}/book) | See your quests (dm-link:monday:quests → ${siteUrl}/book#me/quests) | Stop Monday quests`,
        `context: ${footer}`,
      ],
    ]);
    expect(dmTimesTo(alice)).toEqual([mondayNine]);
  });

  test("a member whose onboarding is done and who had no hugs gets this week's three drawn quests, drawn at the DM's start", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await finishOnboarding(alice);

    await mondayArrives();

    const [dm, ...more] = dmsTo(alice).map(seen);
    expect(more).toEqual([]);
    expect(dm?.[0]).toBe(`section: Happy Monday :sun_with_face: Here are three quests for your week. Each one pays +20 XP and an unidentified Hoggie for your collection.\n\nTen unidentified Hoggies for your collection are waiting for you.`);
    expect(dm?.slice(1, 4)).toHaveLength(3);
    for (const quest of dm!.slice(1, 4)) expect(quest).toMatch(/^⚪ /);
    expect(dm?.slice(4)).toEqual([`actions: Identify them on the website (primary, dm-link:monday:book → ${siteUrl}/book) | See your quests (dm-link:monday:quests → ${siteUrl}/book#me/quests) | Stop Monday quests`]);
  });

  test("with the website closed to the member, the DM counts no waiting hoggies it can't link to", async () => {
    await switchWebsite(t, postHog, false, ...mondayPath);
    await finishOnboarding(alice);

    await mondayArrives();

    const [dm] = dmsTo(alice).map(seen);
    expect(dm?.[0]).toBe("section: Happy Monday :sun_with_face: Here are three quests for your week. Each one pays +20 XP and an unidentified Hoggie for your collection.");
    expect(dm?.at(-1)).toBe("actions: Stop Monday quests");
  });

  test("a member whose week was drawn on the unlock path gets no drawn quests from it", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await finishOnboarding(alice);
    const member = await memberOf(alice);
    await t.run((ctx) => ctx.db.insert("questDraws", { member, week: "2026-10-19", drawnAt: weekendBeforeMonday, slots: [{ slot: 0, quest: "say-why", reward: { xp: 20, coins: 10, item: null }, catalogueVersion: "2", feasibleBecause: { peopleLeft: 2, recognitionsLeft: 10 } }] }));

    await mondayArrives();

    expect(dmsTo(alice)).toEqual([]);
  });

  test("a member taken out of monday-quest before 9:00 gets the hugs recap alone, byte for byte as today's recap", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    const hugged = await hug(bob, alice);
    await sweepsAt(Date.now() + hourMs);

    await switchWebsite(t, postHog, true, ...todaysFlags);
    await mondayArrives();

    expect(dmsTo(alice)).toEqual([
      {
        text: [":taco: Your week in hugs", "Teammates reacted :taco: on your messages and gave you 1 hug (+1 XP).", `1 teammate reacted :taco: on your most-hugged message: <${permalinkOf(hugged)}|open it in Slack>`, nudge, footer].join("\n"),
        blocks: undefined,
      },
    ]);
  });

  test("a member with no quests section and no hugs gets nothing that Monday", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    await sweepsAt(Date.now() + hourMs);

    await switchWebsite(t, postHog, true, ...todaysFlags);
    await mondayArrives();

    expect(dmsTo(alice)).toEqual([]);
  });

  test("a member whose quests never started keeps today's recap and gets no Monday DM", async () => {
    await switchWebsite(t, postHog, true, ...todaysFlags);
    const carolsMessage = await thanks(carol, "thanks", alice);
    await hug(bob, carol, carolsMessage);
    await switchWebsite(t, postHog, true, ...mondayPath);

    await mondayArrives();

    expect(dmsTo(bob).map(({ text, blocks }) => ({ opening: String(text).split("\n").slice(0, 2), blocks }))).toEqual([{ opening: [":taco: Your week in hugs", "You reacted :taco: and gave 1 hug (+1 XP)."], blocks: undefined }]);
  });

  test("for a member previewing the website while it is closed for the workspace, the links go through the sign-in entry", async () => {
    slack.withMember(alice.user, { real_name: alice.name, profile: { real_name: alice.name, email: alicesEmail } });
    await flagsFromPostHog(t, postHog, onForEmails("website", alicesEmail), ...mondayPath.map(onForEveryone));
    await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
    await thanks(alice, saysWhy, bob);

    await mondayArrives();

    expect(seen(dmsTo(alice).at(-1)!).at(-1)).toBe(
      `actions: Identify them on the website (primary, dm-link:monday:book → ${siteUrl}/sign-in/book) | See your quests (dm-link:monday:quests → ${siteUrl}/sign-in/book#me/quests) | Stop Monday quests`,
    );
  });

  test("for a member previewing the website, the welcome's links keep their destinations through the sign-in entry too", async () => {
    slack.withMember(alice.user, { real_name: alice.name, profile: { real_name: alice.name, email: alicesEmail } });
    await flagsFromPostHog(t, postHog, onForEmails("website", alicesEmail), ...mondayPath.map(onForEveryone));
    await t.mutation(internal.website.flag.prepareWebsiteFlag, {});

    await thanks(alice, saysWhy, bob);

    const welcome = slack.messagesShownIn(alice.user).find(({ blocks }) => welcomeLinksIn((blocks ?? []) as Block[]).length > 0);
    expect(linkUrlsIn(welcome!.blocks as Block[])).toEqual({
      "dm-link:welcome:book": `${siteUrl}/sign-in/book`,
      "dm-link:welcome:quests": `${siteUrl}/sign-in/book#me/quests`,
    });
  });

  test("a member in a time zone ahead of UTC gets the DM at 9:00 there", async () => {
    slack.withMember(alice.user, { real_name: alice.name, tz: "Asia/Kolkata" });
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);

    await mondayArrives();

    expect(dmTimesTo(alice)).toEqual([Date.parse("2026-10-19T03:30:00Z")]);
  });
});

describe("MQ26: a member's week of hugs goes out once, in the Monday DM, whichever start runs first", { timeout: 60_000 }, () => {
  test("with today's recap starting first, the member still gets one DM with their hugs and their quests", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    const hugged = await hug(bob, alice);
    await sweepsAt(Date.now() + hourMs);
    await settleUpTo(t, mondayNine - 1);

    await startsFirst(sendHugsRecap);
    await settleUpTo(t, mondayNine + hourMs);

    expect(dmsTo(alice).map(seen).map((dm) => [dm[0]?.split("\n")[0], dm[2]?.split("\n")[0]])).toEqual([["section: :taco: Your week in hugs", "section: *Your onboarding journey* · 1 of 3 done"]]);
  });

  test("with the Monday DM starting first and its post held, today's recap stands down, and one DM goes out", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    const hugged = await hug(bob, alice);
    await sweepsAt(Date.now() + hourMs);
    await settleUpTo(t, mondayNine - 1);
    const recap = await cancelled(sendHugsRecap);
    const held = slack.holdNext("chat.postMessage");

    const sending = settleUpTo(t, mondayNine);
    await held.reached;
    await t.mutation(internal.hugs.recap.startRecap, recap);
    held.release();
    await sending;
    await settleUpTo(t, mondayNine + hourMs);

    expect(dmsTo(alice)).toHaveLength(1);
    expect(seen(dmsTo(alice)[0]!)[0]).toMatch(/^section: :taco: Your week in hugs/);
  });
});

describe("MQ26: once today's recap has begun its tries, the week stays its own", { timeout: 60_000 }, () => {
  test("a Monday DM row that appears before the recap's retry leaves the hugs to the recap", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await hug(bob, alice);
    slack.answeringIn("chat.postMessage", alice.user, rateLimitedFor(30 * 60));
    await mondayArrives(mondayNine + 10 * minuteMs);

    slack.withMember(alice.user, { real_name: alice.name, tz: "Pacific/Honolulu" });
    await memberChanged(t, "user_change", { id: alice.user, team_id: "T1", real_name: alice.name, tz: "Pacific/Honolulu" });
    await thanksWithinAMinute(alice, saysWhy, bob);
    await sweepsAt(mondayNine + 15 * minuteMs);
    await settleUpTo(t, honoluluMondayNine - minuteMs);
    await startsFirst(sendHugsRecap);
    await settleUpTo(t, honoluluMondayNine + minuteMs);

    expect(seen(dmsTo(alice).at(-1)!)[0]).toMatch(/^section: \*Your onboarding journey\*/);
  });
});

describe("MQ27: the Monday DM goes out at most once", { timeout: 60_000 }, () => {
  test("a delivered DM records dm sent with its sections, and hugs recap sent as today", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    const hugged = await hug(bob, alice);

    await mondayArrives();

    expect((await mondayDmsSentTo(alice)).map(({ properties }) => ({ kind: properties.kind, sections: properties.sections }))).toEqual([{ kind: "monday", sections: "hugs,quests" }]);
    expect(productEvents("hugs recap sent").map(({ properties }) => properties.hugs_received).toSorted(), "the hugs received in Bob's recap and in Alice's Monday DM").toEqual([0, 1]);
  });

  test("a rate limit is retried, at most three tries in all", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    slack.answeringIn("chat.postMessage", alice.user, rateLimitedFor(30), rateLimitedFor(30), rateLimitedFor(30), rateLimitedFor(30));

    await mondayArrives();

    expect(postsTo(alice)).toHaveLength(3);
    expect(dmsTo(alice)).toEqual([]);
    expect(await mondayDmsSentTo(alice)).toEqual([]);
  });

  test("a rate-limited DM goes out on a later try and is recorded once", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    slack.answeringIn("chat.postMessage", alice.user, rateLimitedFor(30));

    await mondayArrives();

    expect(dmsTo(alice)).toHaveLength(1);
    expect(await mondayDmsSentTo(alice)).toHaveLength(1);
  });

  test("an unknown answer is never sent again", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    slack.answeringIn("chat.postMessage", alice.user, networkFailure);

    await mondayArrives();
    await mondayArrives(mondayNine + 2 * dayMs);

    expect(postsTo(alice)).toHaveLength(1);
    expect(await mondayDmsSentTo(alice)).toEqual([]);
  });

  test("a start that Convex stranded is never sent again", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    await sweepsAt(Date.now() + hourMs);
    await settleUpTo(t, mondayNine - 1);

    await startsFirst(sendMondayDm);
    await startsFirst(sendMondayDm);
    await sweepsAt(mondayNine + hourMs);
    await sweepsAt(mondayNine + 2 * hourMs);

    expect([...postsTo(alice), ...postsTo(bob)], "Alice's DM and Bob's, whom her kudos welcomed").toEqual([]);
  });

  test("first tries that Convex lost before they started still go out, once each", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    await sweepsAt(Date.now() + hourMs);
    await settleUpTo(t, mondayNine - 1);

    await cancelled(sendMondayDm);
    await cancelled(sendMondayDm);
    await sweepsAt(mondayNine + hourMs);
    await sweepsAt(mondayNine + 2 * hourMs);

    expect(dmsTo(alice), "Alice's Monday DMs").toHaveLength(1);
    expect(dmsTo(bob), "the Monday DMs of Bob, whom her kudos welcomed").toHaveLength(1);
    expect([...(await mondayDmsSentTo(alice)), ...(await mondayDmsSentTo(bob))], "the dm sent records").toHaveLength(2);
  });
});

describe("MQ29 MQ30: one press on Stop Monday quests stops them, replacing the DM in place with a one-press undo", { timeout: 60_000 }, () => {
  test("in a DM with hugs the recap stays, the quests give way to the stopped note, and next Monday's DM is today's recap", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    const hugged = await hug(bob, alice);
    await mondayArrives();

    await press(alice, "Stop Monday quests");

    expect(dmsTo(alice).map(seen)).toEqual([
      [
        `section: :taco: Your week in hugs\nTeammates reacted :taco: on your messages and gave you 1 hug (+1 XP).\n1 teammate reacted :taco: on your most-hugged message: <${permalinkOf(hugged)}|open it in Slack>`,
        "divider",
        "section: 🔕 *Done, no more Monday quests from me.* Your hugs recap still comes on Mondays. Changed your mind? One press brings them back.",
        "actions: Turn Monday quests back on",
        `context: ${footer}`,
      ],
    ]);
    expect(settingChanges(), "the setting changes recorded").toEqual([{ kind: "quests", on: false, via: "dm-button" }]);

    vi.setSystemTime(mondayNine + 2 * dayMs);
    await hug(bob, alice);
    await mondayArrives(mondayNine + 7 * dayMs + hourMs);

    expect(dmsTo(alice).slice(1).map(({ text, blocks }) => ({ opening: String(text).split("\n")[0], blocks }))).toEqual([{ opening: ":taco: Your week in hugs", blocks: undefined }]);
  });

  test("in a quests-only DM the stopped note stands alone, and the undo brings back the DM as it was sent and next Monday's quests", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    await mondayArrives();
    const [asSent] = dmsTo(alice);

    await press(alice, "Stop Monday quests");
    expect(dmsTo(alice).map(seen)).toEqual([["section: 🔕 *Done, no more Monday quests from me.* Changed your mind? One press brings them back.", "actions: Turn Monday quests back on"]]);

    await press(alice, "Turn Monday quests back on");
    expect(dmsTo(alice)).toEqual([asSent]);
    expect(settingChanges(), "the setting changes recorded").toEqual([
      { kind: "quests", on: false, via: "dm-button" },
      { kind: "quests", on: true, via: "dm-button" },
    ]);

    await mondayArrives(mondayNine + 7 * dayMs + hourMs);
    expect(dmsTo(alice).map(seen).map((dm) => dm[0]?.split("\n")[0])).toEqual(["section: *Your onboarding journey* · 1 of 3 done", "section: *Your onboarding journey* · 1 of 3 done"]);
  });

  test("Stop works without message-settings, since only the Monday path gates it", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath.filter((flag) => flag !== "message-settings"));
    await thanks(alice, saysWhy, bob);
    await mondayArrives();

    await press(alice, "Stop Monday quests");

    expect(settingChanges(), "the setting changes recorded").toEqual([{ kind: "quests", on: false, via: "dm-button" }]);
    await mondayArrives(mondayNine + 7 * dayMs + hourMs);
    expect(dmsTo(alice), "the DMs after next Monday").toHaveLength(1);
  });

  test("a replayed press changes nothing more", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    await mondayArrives();
    const stop = pressBody(alice, "Stop Monday quests");

    await deliver(stop);
    await press(alice, "Turn Monday quests back on");
    await deliver(stop);

    expect(settingChanges(), "the setting changes recorded").toEqual([
      { kind: "quests", on: false, via: "dm-button" },
      { kind: "quests", on: true, via: "dm-button" },
    ]);
    expect(seen(dmsTo(alice)[0]!)[0]).toMatch(/^section: \*Your onboarding journey\*/);
  });

  test("off the Monday path a press on Stop does nothing", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    await mondayArrives();
    const [asSent] = dmsTo(alice);

    await switchWebsite(t, postHog, true, ...todaysFlags);
    await press(alice, "Stop Monday quests");

    expect(dmsTo(alice)).toEqual([asSent]);
    expect(settingChanges()).toEqual([]);
  });

  test("a DM whose post landed but whose answer was lost is still replaced in place", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    slack.answeringIn("chat.postMessage", alice.user, landsButTimesOut);
    await mondayArrives();

    await press(alice, "Stop Monday quests");

    expect(dmsTo(alice).map(seen)).toEqual([["section: 🔕 *Done, no more Monday quests from me.* Changed your mind? One press brings them back.", "actions: Turn Monday quests back on"]]);
  });

  test("a Stop button that carries another member's DM changes nothing for either of them", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    await thanks(bob, saysWhy, alice);
    await mondayArrives();
    const [alicesDm] = dmsTo(alice);

    await deliver(pressBody(bob, "Stop Monday quests", alice));

    expect(dmsTo(alice)).toEqual([alicesDm]);
    expect(settingChanges()).toEqual([]);
  });
});

describe("MQ35: a link button's dm-link action records dm link clicked, on the welcome's links and the Monday DM's alike", { timeout: 60_000 }, () => {
  test("each Monday DM link pressed records its destination", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    await mondayArrives();

    await press(alice, "Identify them on the website");
    await press(alice, "See your quests");

    expect(linkClicks()).toEqual([
      { kind: "monday", destination: "book" },
      { kind: "monday", destination: "quests" },
    ]);
  });

  test("each welcome link pressed records its destination", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    const welcome = slack.messagesShownIn(alice.user).find(({ blocks }) => welcomeLinksIn((blocks ?? []) as Block[]).length > 0);

    for (const label of welcomeLinksIn(welcome!.blocks as Block[])) await deliver(blockActions(alice.user, buttonIn(welcome!.blocks as Block[], label), { inMessage: welcome! }));

    expect(linkClicks()).toEqual(welcomeDestinations);
  });

  test("a replayed click is recorded once", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    await mondayArrives();
    const click = pressBody(alice, "See your quests");

    await deliver(click);
    await deliver(click);

    expect(linkClicks()).toEqual([{ kind: "monday", destination: "quests" }]);
  });

  test("off the Monday path, and for a link no DM carries, nothing is recorded", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    await mondayArrives();
    const [dm] = slack.messagesShownIn(alice.user).slice(-1);
    await deliver(blockActions(alice.user, { type: "button", action_id: "dm-link:monday:elsewhere" }, { inMessage: dm! }));

    await switchWebsite(t, postHog, true, ...todaysFlags);
    await press(alice, "See your quests");

    expect(linkClicks()).toEqual([]);
  });
});

describe("MQ31 MQ32 MQ33: a member who used HedgeHug and was never welcomed gets the catch-up welcome once, inside their first Monday DM", { timeout: 60_000 }, () => {
  test("with hugs, the DM is the recap's lines, then the catch-up welcome, then today's footer, and no recap goes on its own", async () => {
    await usedBeforeTheMondayPath();

    await mondayArrives();

    expect(dmsTo(bob).map(seen)).toEqual([
      [
        "section: :taco: Your week in hugs\nYou reacted :taco: and gave 1 hug (+1 XP).",
        "divider",
        `section: Hey <@U_BOB> :wave::skin-tone-2:\n\n${stuckInThePipe}\n\nHedgeHug is how we thank each other here. A :taco: reaction is a quick hug, and a kudos that says why is the big thanks.`,
        "divider",
        "section: *Your onboarding journey* · 0 of 3 done",
        "👉 *Thank someone and say why*",
        "⚪ Thank someone you haven't thanked before",
        "⚪ Say why on 2 different days _0 of 2 days_",
        "section: *Up next: thank someone and say why.*\nMention them, add :taco: and write a sentence about what they did. [button: Show me how]",
        "context: 🎁 +50 XP and an unidentified Hoggie for your collection",
        `actions: See your quests (primary, dm-link:monday:quests → ${siteUrl}/book#me/quests)`,
        `context: ${footer}`,
      ],
    ]);
    expect(dmTimesTo(bob)).toEqual([mondayNine]);
    expect((await mondayDmsSentTo(bob)).map(({ properties }) => properties.sections)).toEqual(["hugs,catch-up"]);
    expect(productEvents("dm sent").filter(({ properties }) => properties.kind === "welcome")).toEqual([]);
  });

  test("without hugs, the DM is the catch-up welcome alone", async () => {
    await usedBeforeTheMondayPath();

    await mondayArrives();

    const [dm, ...more] = dmsTo(carol).map(seen);
    expect(more).toEqual([]);
    expect(dm?.[0]).toBe(
      `section: Hey <@U_CAROL> :wave::skin-tone-2:\n\n${stuckInThePipe}\n\nHedgeHug is how we thank each other here. A :taco: reaction is a quick hug, and a kudos that says why is the big thanks.\n\nThree unidentified Hoggies for your collection are waiting for you.`,
    );
    expect(dm?.at(-1)).toBe(`actions: Identify them now (primary, dm-link:monday:book → ${siteUrl}/book) | See your quests (dm-link:monday:quests → ${siteUrl}/book#me/quests)`);
    expect((await mondayDmsSentTo(carol)).map(({ properties }) => properties.sections)).toEqual(["catch-up"]);
  });

  test("the next Monday each gets the regular Monday DM, and a member welcomed before never sees the pipe line", async () => {
    await usedBeforeTheMondayPath();
    await mondayArrives();

    await mondayArrives(nextMondayNine + hourMs);

    expect([bob, carol].map((person) => dmsTo(person).map(saysStuckInThePipe))).toEqual([
      [true, false],
      [true, false],
    ]);
    expect(seen(dmsTo(bob)[1]!)[0]).toMatch(/^section: \*Your onboarding journey\* · 0 of 3 done/);
    expect(dmsTo(alice).filter(saysStuckInThePipe)).toEqual([]);
  });

  test("a row first ensured on Monday after 9:00 goes at once, as the only DM that day", async () => {
    await usedBeforeTheMondayPath({ catchUpOn: false });
    await settleUpTo(t, mondayNine + hourMs);
    await switchWebsite(t, postHog, true, ...mondayPath, "catch-up-welcome");

    await sweepsAt(mondayNine + hourMs);

    expect(dmsTo(bob).map(saysStuckInThePipe)).toEqual([true]);
    expect(dmTimesTo(bob)).toEqual([mondayNine + hourMs]);
  });

  test("catch-up-welcome turned off before 9:00 sends no catch-up, and today's recap goes as today", async () => {
    await usedBeforeTheMondayPath();
    await sweepsAt(Date.now() + hourMs);

    await switchWebsite(t, postHog, true, ...mondayPath);
    await mondayArrives();

    expect(dmsTo(bob).map(({ text, blocks }) => ({ opening: String(text).split("\n").slice(0, 2), blocks }))).toEqual([{ opening: [":taco: Your week in hugs", "You reacted :taco: and gave 1 hug (+1 XP)."], blocks: undefined }]);
    expect(dmsTo(carol)).toEqual([]);
  });

  test("its link clicks record the Monday DM, and Show me how still answers in its thread", async () => {
    await usedBeforeTheMondayPath();
    await mondayArrives();

    await press(carol, "Identify them now");
    await press(carol, "See your quests");
    await press(carol, "Show me how");

    expect(linkClicks()).toEqual([
      { kind: "monday", destination: "book" },
      { kind: "monday", destination: "quests" },
      { kind: "welcome", destination: "quests-how" },
    ]);
    expect(slack.callsTo("chat.postMessage").filter(({ channel, thread_ts }) => channel === carol.user && thread_ts !== undefined)).toHaveLength(1);
  });

  test("a rate-limited catch-up goes out on its retry, once", async () => {
    await usedBeforeTheMondayPath();
    slack.answeringIn("chat.postMessage", carol.user, rateLimitedFor(30));

    await mondayArrives();

    expect(dmsTo(carol).map(saysStuckInThePipe)).toEqual([true]);
    expect((await mondayDmsSentTo(carol)).map(({ properties }) => properties.sections)).toEqual(["catch-up"]);
  });

  test("catch-up-welcome turned off while a rate-limited catch-up waits for its retry sends the regular Monday DM instead", async () => {
    await usedBeforeTheMondayPath();
    slack.answeringIn("chat.postMessage", carol.user, rateLimitedFor(30 * 60));
    await mondayArrives(mondayNine + 10 * minuteMs);

    await switchWebsite(t, postHog, true, ...mondayPath);
    await settleUpTo(t, mondayNine + hourMs);

    expect(dmsTo(carol).map(saysStuckInThePipe)).toEqual([false]);
    expect(seen(dmsTo(carol)[0]!)[0]).toMatch(/^section: \*Your onboarding journey\* · 0 of 3 done/);
  });

  test("with catch-up-welcome turned off between two rate-limited tries, the last try still sends the regular Monday DM", async () => {
    await usedBeforeTheMondayPath();
    slack.answeringIn("chat.postMessage", carol.user, rateLimitedFor(30 * 60), rateLimitedFor(30 * 60));
    await mondayArrives(mondayNine + 10 * minuteMs);

    await switchWebsite(t, postHog, true, ...mondayPath);
    await settleUpTo(t, mondayNine + 3 * hourMs);

    expect(dmsTo(carol).map(saysStuckInThePipe)).toEqual([false]);
    expect((await mondayDmsSentTo(carol)).map(({ properties }) => properties.sections)).toEqual(["quests"]);
  });

  test("a member who moves time zone while a rate-limited catch-up waits for its retry still gets the catch-up", async () => {
    await usedBeforeTheMondayPath();
    slack.answeringIn("chat.postMessage", carol.user, rateLimitedFor(30 * 60));
    await mondayArrives(mondayNine + 10 * minuteMs);

    slack.withMember(carol.user, { real_name: carol.name, tz: "Pacific/Honolulu" });
    await memberChanged(t, "user_change", { id: carol.user, team_id: "T1", real_name: carol.name, tz: "Pacific/Honolulu" });
    await settleUpTo(t, honoluluMondayNine + hourMs);

    expect(dmsTo(carol).map(saysStuckInThePipe)).toEqual([true]);
  });

  test("a member who moves a whole day east on that Monday gets the catch-up once, then next Monday's regular DM", async () => {
    slack.withMember(carol.user, { real_name: carol.name, tz: "Pacific/Honolulu" });
    await usedBeforeTheMondayPath();
    await sweepsAt(mondayNine - 2 * hourMs);
    await settleUpTo(t, mondayNine + hourMs);

    slack.withMember(carol.user, { real_name: carol.name, tz: "Pacific/Kiritimati" });
    await memberChanged(t, "user_change", { id: carol.user, team_id: "T1", real_name: carol.name, tz: "Pacific/Kiritimati" });
    await sweepsAt(mondayNine + 2 * hourMs);
    await mondayArrives(nextMondayNine + hourMs);

    expect(dmsTo(carol).map(saysStuckInThePipe)).toEqual([true, false]);
  });

  test("a row whose first start Convex lost and the sweep recovers days later sends no catch-up then, and the next Monday's does", async () => {
    await usedBeforeTheMondayPath();
    await sweepsAt(mondayNine - 2 * hourMs);
    await convexLosesTheFirstStarts();

    await sweepsAt(mondayNine + 2 * dayMs + hourMs);
    await mondayArrives(nextMondayNine + hourMs);

    expect(dmsTo(carol).map(saysStuckInThePipe)).toEqual([true]);
    expect(dmTimesTo(carol)).toEqual([nextMondayNine]);
  });

  test("a recovered catch-up whose rate-limited retry falls after its Monday's window still goes out, once", async () => {
    await usedBeforeTheMondayPath();
    await sweepsAt(mondayNine - 2 * hourMs);
    await convexLosesTheFirstStarts();
    slack.answeringIn("chat.postMessage", carol.user, rateLimitedFor(30 * 60));

    await sweepsAt(mondaysWindowEnds - 10 * minuteMs);
    await mondayArrives(nextMondayNine + hourMs);

    expect(dmsTo(carol).map(saysStuckInThePipe)).toEqual([true, false]);
  });

  test("a member welcomed on Monday before 9:00, whose row the catch-up already ensured, gets no Monday DM that day", async () => {
    await usedBeforeTheMondayPath();
    await sweepsAt(mondayNine - 2 * hourMs);

    await thanks(carol, saysWhy, alice);
    await mondayArrives();

    expect(dmsTo(carol).filter(saysStuckInThePipe)).toEqual([]);
    expect(await mondayDmsSentTo(carol)).toEqual([]);
  });

  test.each([
    ["monday-quest is off", [...todaysFlags, "catch-up-welcome"]],
    ["catch-up-welcome is not defined, so its read answers false", mondayPath],
  ])("while %s, everything is as before: today's recap and no welcome", async (_, flags) => {
    await usedBeforeTheMondayPath({ catchUpOn: false });
    await switchWebsite(t, postHog, true, ...flags);

    await mondayArrives();

    expect(dmsTo(bob).map(({ text, blocks }) => ({ opening: String(text).split("\n").slice(0, 2), blocks }))).toEqual([{ opening: [":taco: Your week in hugs", "You reacted :taco: and gave 1 hug (+1 XP)."], blocks: undefined }]);
    expect(dmsTo(carol)).toEqual([]);
    expect(productEvents("dm sent").filter(({ properties }) => properties.kind === "monday")).toEqual([]);
  });
});

describe("MQ23 MQ24: the sweep ensures a Monday DM row only for a member the Monday DM is for", { timeout: 60_000 }, () => {
  test("a member welcomed on a Monday after 9:00 gets their first Monday DM the next Monday", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await settleUpTo(t, mondayNine + hourMs);
    await thanks(alice, saysWhy, bob);

    await sweepsAt(mondayNine + 2 * hourMs);
    expect(await mondayDmsSentTo(alice)).toEqual([]);

    await mondayArrives(nextMondayNine + hourMs);
    expect(dmTimesTo(alice).filter((at) => at >= nextMondayNine)).toEqual([nextMondayNine]);
  });

  test("a started member taken out of monday-quest before their row is ensured gets today's recap from the recap itself", async () => {
    await switchWebsite(t, postHog, true, ...mondayPath);
    await thanks(alice, saysWhy, bob);
    await hug(bob, alice);

    await switchWebsite(t, postHog, true, ...todaysFlags);
    await mondayArrives();

    expect(dmsTo(alice).map(({ text, blocks }) => ({ opening: String(text).split("\n")[0], blocks }))).toEqual([{ opening: ":taco: Your week in hugs", blocks: undefined }]);
    expect(await mondayDmsSentTo(alice)).toEqual([]);
  });
});

const stuckInThePipe = "A hoggie was stuck in the pipe, which kept this welcome from coming out. Here it is now :sweat_smile:";
const nextMondayNine = mondayNine + 7 * dayMs;
const mondaysWindowEnds = Date.parse("2026-10-21T00:00:00Z");

async function usedBeforeTheMondayPath({ catchUpOn = true } = {}) {
  await switchWebsite(t, postHog, true, ...todaysFlags);
  const carolsMessage = await thanks(carol, "thanks", alice);
  await hug(bob, carol, carolsMessage);
  await welcomeLost(carol);
  await switchWebsite(t, postHog, true, ...mondayPath, ...(catchUpOn ? ["catch-up-welcome"] : []));
}

async function welcomeLost(person: Person) {
  await t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique();
    const welcome = await ctx.db
      .query("welcomes")
      .withIndex("by_member", (q) => q.eq("member", member!._id))
      .unique();
    await ctx.db.delete(welcome!._id);
  });
}

function saysStuckInThePipe(dm: { blocks?: unknown }) {
  return JSON.stringify(dm.blocks ?? []).includes("stuck in the pipe");
}

async function finishOnboarding(person: Person) {
  await thanks(person, saysWhy, bob);
  await thanks(person, "thanks", carol);
  vi.setSystemTime(Date.now() + dayMs);
  await thanks(person, saysWhy, bob);
}

async function thanks(giver: Person, words: string, ...recipients: Person[]) {
  const ts = await postThanks(giver, words, recipients);
  await settleInTimeOrder(t);
  return ts;
}

async function thanksWithinAMinute(giver: Person, words: string, ...recipients: Person[]) {
  await postThanks(giver, words, recipients);
  await settleUpTo(t, Date.now() + minuteMs);
}

async function postThanks(giver: Person, words: string, recipients: Person[]) {
  messages += 1;
  vi.setSystemTime(Date.now() + minuteMs);
  const ts = `${Date.now() / 1000}.${String(messages).padStart(6, "0")}`;
  await post(t, [section(text(`${words} `), ...recipients.flatMap(({ user }) => [mention(user), text(" ")]), emoji("taco"))], { user: giver.user, ts });
  return ts;
}

async function hug(giver: Person, author: Person, message = `${Math.floor(Date.now() / 1000) - 600}.000100`) {
  await react(t, { user: giver.user, itemUser: author.user, ts: message });
  await settleUpTo(t, Date.now() + minuteMs);
  return message;
}

async function convexLosesTheFirstStarts() {
  await t.run(async (ctx) => {
    for (const job of await ctx.db.system.query("_scheduled_functions").collect()) if (job.name === sendMondayDm && job.state.kind === "pending") await ctx.scheduler.cancel(job._id);
  });
}

async function mondayArrives(until = mondayNine + hourMs) {
  await sweepsAt(Math.min(Date.now() + hourMs, until));
  await settleUpTo(t, until);
  await sweepsAt(until);
}

async function sweepsAt(at: number) {
  await settleUpTo(t, at);
  await t.mutation(cronNamed("schedule each member's weekly hugs recap"), {});
  await t.mutation(cronNamed("ensure each member's coming Monday DM"), {});
  await settleUpTo(t, at);
}

function cronNamed(name: string) {
  const job = crons.crons[name];
  if (job === undefined) throw new Error(`no cron job named ${name}`);
  expect(job.schedule).toEqual({ type: "interval", hours: 1 });
  return makeFunctionReference<"mutation">(job.name);
}

async function startsFirst(functionName: typeof sendMondayDm | typeof sendHugsRecap) {
  const args = await cancelled(functionName);
  await t.mutation(functionName === sendMondayDm ? internal.mondayDm.mondayDm.startMondayDm : internal.hugs.recap.startRecap, args);
}

async function cancelled(functionName: string) {
  const job = await t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).find(({ name, state }) => name === functionName && state.kind === "pending"));
  if (job === undefined) throw new Error(`no pending ${functionName}`);
  await t.run((ctx) => ctx.scheduler.cancel(job._id));
  vi.setSystemTime(Math.max(Date.now(), job.scheduledTime));
  return job.args[0];
}

function postsTo(person: Person) {
  const times = slack.timesOf("chat.postMessage");
  return slack.callsTo("chat.postMessage").filter(({ channel }, index) => channel === person.user && times[index]! >= weekendBeforeMonday);
}

function dmsTo(person: Person) {
  const postedBeforeTheWeekend = slack.timesOf("chat.postMessage", (args: SlackArgs) => args.channel === person.user).filter((at) => at < weekendBeforeMonday).length;
  return slack
    .messagesShownIn(person.user)
    .slice(postedBeforeTheWeekend)
    .map(({ text, blocks }) => ({ text, blocks }));
}

function dmTimesTo(person: Person) {
  return slack.timesOf("chat.postMessage", (args: SlackArgs) => args.channel === person.user).filter((at) => at >= weekendBeforeMonday);
}

function seen({ blocks }: { blocks?: unknown }): string[] {
  return ((blocks ?? []) as Block[]).flatMap((block) => (block.type === "rich_text" ? checklistOf(block) : block.type === "actions" ? [buttonsOf(block)] : readBlocks([block])));
}

type RichText = { type: string; name?: string; text?: string; style?: { bold?: boolean; strike?: boolean; italic?: boolean } };

function checklistOf(block: Block): string[] {
  const [list] = (block as unknown as { elements: Array<{ elements: Array<{ elements: RichText[] }> }> }).elements;
  return list!.elements.map(({ elements }) => elements.map(richTextOf).join("").trim());
}

const marks: Record<string, string> = { white_check_mark: "✅", point_right: "👉", white_circle: "⚪" };

function richTextOf({ type, name, text, style }: RichText) {
  if (type === "emoji") return marks[name!] ?? `:${name}:`;
  const styled = style?.strike ? `~${text!.trim()}~` : style?.bold ? `*${text!.trim()}*` : style?.italic ? `_${text!.trim()}_` : text!.trim();
  return ` ${styled}`;
}

function buttonsOf(block: Block) {
  const buttons = (block.elements ?? []) as Array<{ text: { text: string }; style?: string; action_id?: string; url?: string }>;
  return `actions: ${buttons.map(({ text, style, action_id, url }) => (url === undefined ? text.text : `${text.text} (${style === "primary" ? "primary, " : ""}${action_id} → ${url})`)).join(" | ")}`;
}


function pressBody(person: Person, label: string, inDmOf: Person = person) {
  const { channel, ts, blocks } = slack.messagesShownIn(inDmOf.user).at(-1)!;
  return blockActions(person.user, buttonIn(blocks as Block[], label), { inMessage: { channel, ts } });
}

async function press(person: Person, label: string) {
  await deliver(pressBody(person, label));
}

async function deliver(body: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(body, { contentType: "application/x-www-form-urlencoded" }));
  expect(response.status, "Slack's acknowledgement").toBe(200);
  await settleUpTo(t, Date.now() + minuteMs);
}

const welcomeDestinations = [
  { kind: "welcome", destination: "quests-how" },
  { kind: "welcome", destination: "book" },
  { kind: "welcome", destination: "quests" },
];

function welcomeLinksIn(blocks: Block[]) {
  const buttons = blocks.flatMap((block) => [block.accessory, ...(block.elements ?? [])]) as Array<{ action_id?: string; text?: { text: string } } | undefined>;
  return buttons.flatMap((button) => (button?.action_id?.startsWith("dm-link:welcome:") ? [button.text!.text] : []));
}

function linkUrlsIn(blocks: Block[]) {
  const buttons = blocks.flatMap((block) => [block.accessory, ...(block.elements ?? [])]) as Array<{ action_id?: string; url?: string } | undefined>;
  return Object.fromEntries(buttons.flatMap((button) => (button?.url === undefined ? [] : [[button.action_id, button.url]])));
}

function linkClicks() {
  return productEvents("dm link clicked").map(({ properties: { kind, destination } }) => ({ kind, destination }));
}

function settingChanges() {
  return productEvents("message setting changed").map(({ properties: { kind, on, via } }) => ({ kind, on, via }));
}

function productEvents(event: string) {
  return postHog.productEvents().filter((captured) => captured.event === event);
}

async function memberOf(person: Person) {
  const member = await t.run((ctx) =>
    ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", person.user))
      .unique(),
  );
  return member!._id;
}

async function mondayDmsSentTo(person: Person) {
  const member = await memberOf(person);
  const analyticsId = await t.run(async (ctx) => {
    const identity = await ctx.db
      .query("analyticsIds")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    return identity?.analyticsId;
  });
  return productEvents("dm sent").filter(({ distinct_id, properties }) => distinct_id === analyticsId && properties.kind === "monday");
}

function permalinkOf(message: string) {
  return `https://t1.slack.com/archives/C1/p${message.replace(".", "")}`;
}
