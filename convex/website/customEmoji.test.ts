import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section, text, unicodeEmoji } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import type { ActivityEntry } from "./activity";

const now = new Date("2026-10-14T10:00:00Z");
const postedTs = "1760435000.000100";
const alice = { user: "U_ALICE", name: "Alice Archer" };
const bob = { user: "U_BOB", name: "Bob Brandt" };
const carol = { user: "U_CAROL", name: "Carol Chen" };
const reason = "for the calm rollback of the billing service";

const tacoPng = "https://emoji.slack-edge.com/T1/taco/7a8b9c.png";
const parrotGif = "https://emoji.slack-edge.com/T1/partyparrot/1a2b3c.gif";

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  postHog = new FakePostHog();
  slack = new FakeSlack().withWorkspaceUrl("https://kudos-test.slack.com/");
  for (const person of [alice, bob, carol]) slack.withMember(person.user, { real_name: person.name });
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a custom emoji in a kudos's words reads with its image", () => {
  test("the activity, the recent kudos and the spotlight give a listed custom emoji its image, a standard emoji its character, and an unlisted one its name alone", async () => {
    await websiteOn();
    slack.withCustomEmoji("taco", tacoPng).withCustomEmoji("parrot", "alias:partyparrot").withCustomEmoji("partyparrot", parrotGif);
    await syncCustomEmoji();

    await thank(bob, emoji("parrot"), text(" "), unicodeEmoji("tada", "1f389"), text(" "), emoji("shipit"), text(" "), emoji("taco"));

    const emojiRead = [
      { kind: "emoji", name: "parrot", image: parrotGif },
      { kind: "emoji", name: "tada", unicode: "🎉" },
      { kind: "emoji", name: "shipit" },
      { kind: "emoji", name: "taco", image: tacoPng },
    ];
    expect(emojiIn(await activitySegmentsOf(bob))).toEqual(emojiRead);
    expect(emojiIn(await recentSegmentsOf(bob))).toEqual(emojiRead);
    expect(emojiIn(await spotlightSegmentsOf(carol))).toEqual(emojiRead);
  });

  test("a kudos given before its emoji was listed reads the image once the list has it, and none once Slack removed it", async () => {
    await websiteOn();
    await thank(bob, emoji("taco"));

    expect(emojiIn(await activitySegmentsOf(bob))).toEqual([{ kind: "emoji", name: "taco" }]);

    slack.withCustomEmoji("taco", tacoPng);
    await syncCustomEmoji();
    expect(emojiIn(await activitySegmentsOf(bob))).toEqual([{ kind: "emoji", name: "taco", image: tacoPng }]);

    slack.withoutCustomEmoji("taco");
    await syncCustomEmoji();
    expect(emojiIn(await activitySegmentsOf(bob))).toEqual([{ kind: "emoji", name: "taco" }]);
  });
});

async function websiteOn() {
  await switchWebsite(t, postHog, true, "activity", "everyone-board");
  await memberChanged(t, "team_join", { id: carol.user, real_name: carol.name });
  await settle(t);
}

async function syncCustomEmoji() {
  await t.action(internal.slack.customEmoji.syncCustomEmoji, {});
  await settle(t);
}

async function thank(recipient: { user: string }, ...emojiElements: Parameters<typeof section>) {
  await post(t, [section(text(`thanks ${reason} `), mention(recipient.user), text(" "), ...emojiElements)], { user: alice.user, ts: postedTs });
  await settle(t);
}

async function signedIn(person: { user: string; name: string }) {
  return (await aSession(t, person)).asSignedIn;
}

async function activitySegmentsOf(person: { user: string; name: string }) {
  const answer = await (await signedIn(person)).query(api.website.activity.getActivity, { filter: "received", cursor: null });
  if (answer.kind !== "activity") throw new Error(`expected the activity, got ${answer.kind}`);
  return segmentsOf(answer.entries[0]);
}

async function recentSegmentsOf(person: { user: string; name: string }) {
  const answer = await (await signedIn(person)).query(api.website.activity.getRecentKudos, { direction: "received" });
  if (answer.kind !== "recent") throw new Error(`expected the recent kudos, got ${answer.kind}`);
  return segmentsOf(answer.entries[0]);
}

async function spotlightSegmentsOf(person: { user: string; name: string }) {
  const answer = await (await signedIn(person)).query(api.website.activity.getSpotlight, { seed: 0.5 });
  if (answer.kind !== "kudos") throw new Error(`expected a spotlight kudos, got ${answer.kind}`);
  return answer.message.segments;
}

function segmentsOf(entry: ActivityEntry | undefined) {
  if (entry === undefined || entry.kind === "levelUp" || entry.message.kind !== "text") throw new Error("expected a kudos with readable words");
  return entry.message.segments;
}

function emojiIn(segments: Array<{ kind: string }>) {
  return segments.filter((segment) => segment.kind === "emoji");
}
