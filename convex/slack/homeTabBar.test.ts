import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEveryone, postHogDeciding } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonInHome, publishedHome } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";

const now = new Date("2026-10-13T10:00:00Z");
const board = "everyone-board";
const xpLevels = "xp-levels";

const coreHome = [
  "header: Your kudos",
  "section: You have *8* kudos left today. You get *10* more at midnight.",
  "divider",
  "section fields: *Given this week*\n*2* | *Received this week*\n*0* | *Given in total*\n*2* | *Received in total*\n*0*",
  "divider",
  "context: To give kudos, mention a teammate and add :taco: to your message. Each :taco: gives everyone you mention 1 kudos.",
  "context: To add me to a channel, type `/hedgehug` there.",
];

const levelLine = "section fields: *Level*\n*2* | *XP to level 3*\n*80*";
const leaderboardSwitch = "section: *Show me on the leaderboards*";
const muteNotices = "section: I'll celebrate your level ups in public once your workspace picks a channel. [button: Mute notices]";
const dms = "section: I send you a DM when you reach a level. [button: Turn off DMs]";

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  postHog = postHogDeciding();
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

type Flags = { board: boolean; xp: boolean };

const flagsOf = ({ board: boardOn, xp }: Flags) => [boardOn ? onForEveryone(board) : offForEveryone(board), xp ? onForEveryone(xpLevels) : offForEveryone(xpLevels)];

describe("the App Home tab bar shows each tab only while its own flag is on", () => {
  test("with both flags off there is no tab bar, and App Home is the core loop's", async () => {
    const t = await workspaceWith({ board: false, xp: false });

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toEqual(coreHome);
  });

  test.each<[string, Flags, boolean, string]>([
    ["everyone-board alone", { board: true, xp: false }, false, "actions: [Profile] | Leaderboard | Settings"],
    ["everyone-board alone, for an admin", { board: true, xp: false }, true, "actions: [Profile] | Leaderboard | Settings"],
    ["xp-levels alone", { board: false, xp: true }, false, "actions: [Profile] | Settings"],
    ["xp-levels alone, for an admin", { board: false, xp: true }, true, "actions: [Profile] | Settings | Admin"],
    ["both flags", { board: true, xp: true }, false, "actions: [Profile] | Leaderboard | Settings"],
    ["both flags, for an admin", { board: true, xp: true }, true, "actions: [Profile] | Leaderboard | Settings | Admin"],
  ])("with %s, the tab bar sits above the Profile tab", async (_, flags, admin, tabBar) => {
    const t = await workspaceWith(flags, { admin });

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE").slice(0, 2)).toEqual([tabBar, "header: Your kudos"]);
  });

  test.each<[string, Flags, boolean]>([
    ["everyone-board alone", { board: true, xp: false }, false],
    ["xp-levels alone", { board: false, xp: true }, true],
    ["both flags", { board: true, xp: true }, true],
  ])("with %s, the Profile tab shows the level only while xp-levels is on", async (_, flags, levelShown) => {
    const t = await workspaceWith(flags);

    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE").includes(levelLine)).toBe(levelShown);
  });

  test.each<[string, Flags, string[]]>([
    ["everyone-board alone", { board: true, xp: false }, [leaderboardSwitch]],
    ["xp-levels alone", { board: false, xp: true }, [muteNotices, dms]],
    ["both flags", { board: true, xp: true }, [leaderboardSwitch, muteNotices, dms]],
  ])("with %s, the Settings tab shows the switches of the flags that are on", async (_, flags, switches) => {
    const t = await workspaceWith(flags);
    await openHome(t, "U_ALICE");

    await click(t, "U_ALICE", "Settings");

    expect(publishedHome(slack, "U_ALICE").filter((line) => [leaderboardSwitch, muteNotices, dms].includes(line))).toEqual(switches);
  });

  test.each<[string, string, FlagDefinition[], string]>([
    ["Leaderboard", "everyone-board", [offForEveryone(board), onForEveryone(xpLevels)], "actions: [Profile] | Settings | Admin"],
    ["Admin", "xp-levels", [onForEveryone(board), offForEveryone(xpLevels)], "actions: [Profile] | Leaderboard | Settings"],
  ])("a member left on the %s tab opens App Home on Profile once %s is off", async (tab, _, turnedOff, tabBar) => {
    const t = await workspaceWith({ board: true, xp: true }, { admin: true });
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", tab);

    await flagsFromPostHog(t, postHog, ...turnedOff);
    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE").slice(0, 3)).toEqual([tabBar, "header: Your kudos", "section: You have *8* kudos left today. You get *10* more at midnight."]);
  });
});

async function workspaceWith(flags: Flags, { admin = false } = {}) {
  if (admin) slack.withMember("U_ALICE", { is_admin: true });
  const t = await flagsFromPostHog(testBackend(), postHog, ...flagsOf(flags));
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await giveKudos(t, "U_ALICE", "U_BOB", 2);
  return t;
}

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${now.getTime() / 1000 + sentMessages}.000100` })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function click(t: Backend, user: string, label: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, buttonInHome(slack, user, label)), { contentType: "application/x-www-form-urlencoded" }));
  expect(response.status).toBe(200);
  await settle(t);
}
