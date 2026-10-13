import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonInHome, publishedHome } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";

const now = new Date("2026-10-13T10:00:00Z");
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const questsReady = "section: *Quests* is ready. It opens your weekly quests. [button: Open]";
const goalsFeasibleWithOneTeammateAlreadyThanked = [
  "section: Thank someone and say why. *0/1* · *20 XP*",
  "section: Thank someone and say why, 2 times. *0/2* · *20 XP*",
  "section: Thank someone and say why, 3 times. *0/3* · *20 XP*",
  "section: Thank someone and say why on 2 different days. *0/2* · *20 XP*",
  "section: Thank someone and say why on 3 different days. *0/3* · *20 XP*",
];

let slack: FakeSlack;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "quests");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P80 P76: a member who opens Quests gets 3 quests for this week on App Home", () => {
  test("below level 2, App Home names Quests only as next, with no weekly quest anywhere", async () => {
    const t = await workspace();

    await openHome(t, "U_ALICE");

    const home = publishedHome(slack, "U_ALICE");
    expect(home).toContain("section: Next: Quests at level 2.");
    expect(questsIn(home)).toEqual([]);
  });

  test("at level 2, Quests is ready with Open and no weekly quest shows; opening it shows 3 different quests this week, each at 0 with its 20 XP", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await openHome(t, "U_ALICE");
    expect(publishedHome(slack, "U_ALICE")).toContain(questsReady);
    expect(questsIn(publishedHome(slack, "U_ALICE"))).toEqual([]);

    await send(t, blockActions("U_ALICE", buttonInHome(slack, "U_ALICE", "Open")));

    const [title, ...rest] = questsIn(publishedHome(slack, "U_ALICE"));
    const goals = rest.slice(0, -1);
    expect(title).toBe("section: *Quests this week*");
    expect(goals).toHaveLength(3);
    expect(new Set(goals).size).toBe(3);
    for (const goal of goals) expect(goalsFeasibleWithOneTeammateAlreadyThanked).toContain(goal);
    expect(rest.at(-1)).toBe("context: Saying why counts when your message has 5 or more words besides mentions and emoji.");
    expect(publishedHome(slack, "U_ALICE")).not.toContain(questsReady);
  });

  test("while quests is off, a level 2 member sees no Quests crate, next line or weekly quest", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks");
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE").filter((line) => /Quests|quests/.test(line))).toEqual([]);
  });
});

async function workspace() {
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return t;
}

async function giveKudos(t: Backend, giver: string, recipient: string, words: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${now.getTime() / 1000 + sentMessages}.000100` })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  await settle(t);
  return response;
}

function questsIn(home: string[]) {
  const start = home.findIndex((line) => line.includes("*Quests this week*"));
  return start === -1 ? [] : home.slice(start, home.indexOf("divider", start));
}
