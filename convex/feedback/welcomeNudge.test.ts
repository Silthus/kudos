import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog, FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, type SlackCall } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsOnForEveryone, offForEveryone, onForEmails, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { react, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { blockActions, buttonInHome, publishedHome } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text, type MessageOptions } from "../../testing/slackMessages";
import { aSession, aSignedInSession } from "../../testing/website";
import { api, internal } from "../_generated/api";

const now = new Date("2026-10-13T10:00:00Z");
const siteUrl = "https://kudos-site.test";
const slackUrl = "https://t1.slack.com/";
const why = "Thanks for untangling the flaky migration";
const waits = "Your rare hoggie is waiting for you to collect it.";
const nudgeOn = ["website", "album", "hugs", "xp-levels", "hidden-items", "welcome-item"];
const form = { contentType: "application/x-www-form-urlencoded" } as const;
const nudgeJobs = vi.hoisted(() => ["feedback/welcomeNudge:nudgeTheThanked", "feedback/welcomeNudge:nudgeTheHugged"]);
const theBus = vi.hoisted(() => ({ withoutTheNudge: false }));

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  for (const type of ["kudosGiven", "hugGiven"] as const) {
    const subscriptions = actual.subscribers[type] as unknown[];
    actual.subscribers[type] = subscriptions.map((subscription) => {
      const subscriber = (typeof subscription === "object" && subscription !== null && "subscriber" in subscription ? subscription.subscriber : subscription) as Parameters<typeof getFunctionName>[0];
      return nudgeJobs.includes(getFunctionName(subscriber)) ? { subscriber, only: () => !theBus.withoutTheNudge } : subscription;
    }) as never;
  }
  return actual;
});

let slack: FakeSlack;
let postHog: FakePostHog;
let t: Backend;
let sent = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", siteUrl);
  vi.stubEnv("KUDOS_MAINTAINER", "U_ALICE");
  theBus.withoutTheNudge = false;
  sent = 0;
  slack = new FakeSlack();
  for (const [user, name, admin] of [["U_ALICE", "Alice Marchetti", true], ["U_BOB", "Bob Okonkwo", true], ["U_CAROL", "Carol Lindqvist", false], ["U_DANA", "Dana Ferreira", false], ["U_ERIN", "Erin Vasquez", false]] as const) {
    slack.withMember(user, { is_admin: admin, profile: { display_name: name, real_name: name, email: `${name.split(" ")[0]!.toLowerCase()}@example.com` } });
  }
  postHog = flagsOnForEveryone(slack.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("LP45 LP46 LP47 LP48: the welcome nudge is one DM ever to a member who has never opened the website", { timeout: 60_000 }, () => {
  test("a public kudos to a member who never signed in sends them one DM with the giver, the quoted thanks, their rare hoggie waiting and Open your HedgeHug album, and their first sign-in finds the welcome item waiting", async () => {
    await aWorkspace(nudgeOn.map(onForEveryone));

    await thanks("U_ALICE", "U_BOB");

    expect(nudgesTo("U_BOB")).toEqual([
      {
        channel: "U_BOB",
        text: `<@U_ALICE> thanked you :taco:\n${waits}`,
        unfurl_links: false,
        unfurl_media: false,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: `<@U_ALICE> thanked you :taco:\n>${why} @Bob Okonkwo:taco:` } },
          { type: "section", text: { type: "mrkdwn", text: waits } },
          { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open your HedgeHug album" }, url: `${siteUrl}/book`, action_id: "welcome-nudge-open-album" }] },
        ],
      },
    ]);
    const { asSignedIn } = await aSignedInSession(t, { user: "U_BOB", name: "Bob Okonkwo" });
    const album = await asSignedIn.query(api.website.album.getAlbum, {});
    expect(album.kind === "album" ? album.board?.items.map(({ reason }) => reason.kind) : album.kind, "the welcome item waits, earned once").toEqual(["welcome"]);
  });

  test("a hug on the member's own message reads that the giver hugged it, linking the message, and a kudos in a private channel names the giver without a quote", async () => {
    await aWorkspace(nudgeOn.map(onForEveryone));
    const hugged = await says("U_CAROL", "The release notes are up");

    await hugs("U_ALICE", "U_CAROL", hugged);
    await thanks("U_ALICE", "U_DANA", { channel: "G_PRIVATE", channelType: "group" });

    expect(nudgesTo("U_CAROL").map(({ blocks }) => blocks[0])).toEqual([{ type: "section", text: { type: "mrkdwn", text: `<@U_ALICE> <${slackUrl}archives/C1/p${hugged.replace(".", "")}|hugged your message> :taco:` } }]);
    expect(nudgesTo("U_DANA").map(({ blocks }) => blocks[0])).toEqual([{ type: "section", text: { type: "mrkdwn", text: "<@U_ALICE> thanked you :taco:" } }]);
  });

  test("a second kudos, a hug, the same kudos delivered again and two kudos at once send no second nudge, ever", async () => {
    await aWorkspace(nudgeOn.map(onForEveryone));
    const first = await thanks("U_ALICE", "U_BOB");

    await thanks("U_CAROL", "U_BOB");
    await thanks("U_ALICE", "U_BOB", { ts: first });
    await hugs("U_DANA", "U_BOB", await says("U_BOB", "Lunch is in the kitchen"));
    await postKudos("U_ALICE", "U_ERIN");
    await postKudos("U_CAROL", "U_ERIN");
    await settle(t);

    expect(nudgesTo("U_BOB"), "Bob").toHaveLength(1);
    expect(nudgesTo("U_ERIN"), "Erin, thanked twice at once").toHaveLength(1);
  });

  test("a member who has signed in before, and the giver, get no nudge", async () => {
    await aWorkspace(nudgeOn.map(onForEveryone));
    await aSession(t, { user: "U_DANA" });

    await thanks("U_ALICE", "U_DANA");

    expect(nudgesTo("U_DANA")).toEqual([]);
    expect(nudgesTo("U_ALICE")).toEqual([]);
  });

  test("the maintainer switches the nudge off and on again in App Home's Admin tab, another admin sees no switch, and no nudge goes out while it is off", async () => {
    await aWorkspace(nudgeOn.map(onForEveryone));
    await adminTabOpen("U_ALICE");
    await adminTabOpen("U_BOB");
    expect(publishedHome(slack, "U_ALICE")).toContain("section: I send a teammate one DM, the first time they are thanked or hugged while they have never opened the HedgeHug website, so they can collect their rare hoggie. [button: Switch off]");
    expect(publishedHome(slack, "U_BOB")).not.toContain("Welcome nudge");

    await clickInHome("U_ALICE", "Switch off");
    await thanks("U_CAROL", "U_ERIN");

    expect(publishedHome(slack, "U_ALICE")).toContain("section: I don't DM teammates who have never opened the HedgeHug website. [button: Switch on]");
    expect(nudgesTo("U_ERIN")).toEqual([]);
    await clickInHome("U_ALICE", "Switch on");
    await thanks("U_CAROL", "U_DANA");
    expect(nudgesTo("U_DANA")).toHaveLength(1);
  });

  test.each([
    { condition: "with welcome-item off", flags: [...nudgeOn.filter((key) => key !== "welcome-item").map(onForEveryone), offForEveryone("welcome-item")] },
    { condition: "with welcome-item on but hidden-items off", flags: [...nudgeOn.filter((key) => key !== "hidden-items").map(onForEveryone), offForEveryone("hidden-items")] },
    { condition: "with welcome-item on for someone else's email only", flags: [...nudgeOn.filter((key) => key !== "welcome-item").map(onForEveryone), onForEmails("welcome-item", "alice@example.com")] },
  ])("$condition, a walk of public, private and hugged kudos makes every Slack call the same walk makes without the nudge", async ({ flags }) => {
    theBus.withoutTheNudge = true;
    const withoutTheNudge = await walkWith(flags);
    theBus.withoutTheNudge = false;

    const walk = await walkWith(flags);

    expect(walk).toEqual(withoutTheNudge);
  });
});

async function walkWith(flags: FlagDefinition[]) {
  await aWorkspace(flags);
  await thanks("U_ALICE", "U_BOB");
  await thanks("U_CAROL", "U_DANA", { channel: "G_PRIVATE", channelType: "group" });
  await hugs("U_DANA", "U_ERIN", await says("U_ERIN", "The release notes are up"));
  await thanks("U_BOB", "U_ERIN");
  return slack.calls.map((call: SlackCall) => JSON.stringify(call)).sort();
}

async function aWorkspace(flags: FlagDefinition[]) {
  vi.setSystemTime(now);
  sent = 0;
  t = await flagsFromPostHog(testBackend(), postHog, ...flags);
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  await unlocksShippedBeforeAnyoneJoined(t);
  await t.mutation(internal.workspace.url.rememberWorkspaceUrl, { workspace: "T1", url: slackUrl });
  slack.calls.length = 0;
}

async function postKudos(giver: string, recipient: string, options: MessageOptions = {}) {
  const ts = options.ts ?? aStep();
  await t.fetch("/slack/events", await signedRequest(messageEvent([section(text(`${why} `), mention(recipient), emoji("taco"))], { user: giver, ...options, ts })));
  return ts;
}

async function thanks(giver: string, recipient: string, options: MessageOptions = {}) {
  const ts = await postKudos(giver, recipient, options);
  await settle(t);
  return ts;
}

async function says(author: string, words: string) {
  const ts = aStep();
  await t.fetch("/slack/events", await signedRequest(messageEvent([section(text(words))], { user: author, ts })));
  await settle(t);
  return ts;
}

async function hugs(hugger: string, author: string, ts: string) {
  aStep();
  await react(t, { user: hugger, itemUser: author, channel: "C1", ts });
  await settle(t);
}

function aStep() {
  sent += 1;
  vi.setSystemTime(now.getTime() + sent * 600_000);
  return `${Math.floor(Date.now() / 1000)}.${String(sent).padStart(6, "0")}`;
}

async function adminTabOpen(user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
  await clickInHome(user, "Admin");
}

async function clickInHome(user: string, label: string) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, buttonInHome(slack, user, label)), form));
  await settle(t);
}

type Posted = { channel: string; text: string; blocks: Array<{ type: string; text?: { text: string } }> };

function nudgesTo(user: string): Posted[] {
  return (slack.callsTo("chat.postMessage") as unknown as Posted[]).filter(({ channel, blocks }) => channel === user && JSON.stringify(blocks ?? []).includes("welcome-nudge-open-album"));
}
