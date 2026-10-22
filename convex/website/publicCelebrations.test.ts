import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { signedRequest } from "../../testing/signedSlack";
import { memberChanged, settle, settleUpTo, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonInHome, publishedHome } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api } from "../_generated/api";
import schema from "../schema";

const now = new Date("2026-10-22T10:00:00Z");
const maintainer = "U_MAINTAINER";
const form = { contentType: "application/x-www-form-urlencoded" };
const everyFlag = ["workspace-settings", "celebrations-switch", "message-settings", "xp-levels"];

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  vi.stubEnv("KUDOS_EMOJI", "");
  vi.stubEnv("KUDOS_MAINTAINER", maintainer);
  postHog = new FakePostHog();
  slack = new FakeSlack().withMember(maintainer).withMember("U_ADMIN", { is_admin: true }).withMember("U_ANN").withMember("U_BOB");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the maintainer switches public celebrations off and on from Settings", { timeout: 60_000 }, () => {
  test("the maintainer's Settings show public celebrations on until someone switches them", async () => {
    const owner = await aWorkspace();

    expect(await owner.publicCelebrations()).toBe(true);
  });

  test("switching off answers set, the read shows them off, and the next level up posts nothing in the announcement channel", async () => {
    const owner = await aWorkspace();

    expect(await owner.switchPublicCelebrations(false)).toEqual({ kind: "set" });

    expect(await owner.publicCelebrations()).toBe(false);
    await giveKudos("U_ANN", "U_BOB", 2);
    expect(slack.messagesIn("C_ANNOUNCE")).toEqual([]);
  });

  test("switching off what is already off answers set and writes nothing more", async () => {
    const owner = await aWorkspace();
    await owner.switchPublicCelebrations(false);
    const before = await everyTable();

    expect(await owner.switchPublicCelebrations(false)).toEqual({ kind: "set" });
    expect(await everyTable()).toEqual(before);
  });

  test("an admin's Switch on in App Home shows in the maintainer's Settings", async () => {
    const owner = await aWorkspace();
    await owner.switchPublicCelebrations(false);
    await adminTabOpen("U_ADMIN");

    await clickInHome("U_ADMIN", "Switch on");

    expect(await owner.publicCelebrations()).toBe(true);
  });

  test("the command exposes celebrations-switch for the maintainer, and the read decides it without", async () => {
    const owner = await aWorkspace();
    await owner.publicCelebrations();
    expect(await exposuresOf("celebrations-switch")).toEqual([]);

    await owner.switchPublicCelebrations(false);

    expect(await exposuresOf("celebrations-switch")).toEqual([{ flag: "celebrations-switch", member: owner.member, value: true }]);
  });
});

describe("only the maintainer switches public celebrations from Settings, and only while celebrations-switch is on", { timeout: 60_000 }, () => {
  test("a workspace admin who isn't the maintainer sees no switch in Settings, and their switch is refused and writes nothing", async () => {
    await aWorkspace();
    const admin = await signedIn("U_ADMIN");

    expect(await admin.publicCelebrations()).toBeUndefined();
    expect(await admin.switchPublicCelebrations(false)).toEqual({ kind: "refused" });
    expect(await storedSwitches()).toEqual([]);
  });

  test("while celebrations-switch is off, there is no switch in Settings, the switch is refused and writes nothing", async () => {
    const owner = await aWorkspace({ flags: ["workspace-settings", "message-settings", "xp-levels"] });

    expect(await owner.publicCelebrations()).toBeUndefined();
    expect(await owner.switchPublicCelebrations(false)).toEqual({ kind: "refused" });
    expect(await storedSwitches()).toEqual([]);
  });

  test("while workspace-settings is off for the maintainer, there is no switch in Settings, the switch is refused and writes nothing", async () => {
    const owner = await aWorkspace({ flags: ["celebrations-switch", "message-settings", "xp-levels"] });

    expect(await owner.publicCelebrations()).toBeUndefined();
    expect(await owner.switchPublicCelebrations(false)).toEqual({ kind: "refused" });
    expect(await storedSwitches()).toEqual([]);
  });

  test("WS61: on is setPublicCelebrations's only argument, so no call names a member", async () => {
    const owner = await aWorkspace();
    const before = await everyTable();

    await expect(owner.switchPublicCelebrations(false, { member: owner.member })).rejects.toThrow(/member/);
    expect(await everyTable()).toEqual(before);
  });
});

describe("members can't pick public celebrations in Settings while the workspace switches them off", { timeout: 60_000 }, () => {
  test("a member's Settings read carries no celebrations kind while off, and their own choice again once on", async () => {
    const owner = await aWorkspace();
    const ann = await signedIn("U_ANN");
    await ann.setMessageSetting("celebrations", "none");

    await owner.switchPublicCelebrations(false);
    const kindsWhileOff = await ann.messageKinds();
    expect(await ann.setMessageSetting("celebrations", "channel")).toEqual({ kind: "refused" });
    await owner.switchPublicCelebrations(true);

    expect(kindsWhileOff).toEqual(["kudos-reply", "level-ups"]);
    expect(await ann.messages()).toContainEqual(expect.objectContaining({ kind: "celebrations", place: "none" }));
  });
});

type Setup = { flags?: string[] };

async function aWorkspace({ flags = everyFlag }: Setup = {}) {
  await switchWebsite(t, postHog, true, ...flags);
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10, announcementChannel: "C_ANNOUNCE", url: "https://hedgehug.slack.com/" }));
  await memberChanged(t, "team_join", { id: maintainer, real_name: "Mae Maintainer" });
  await memberChanged(t, "team_join", { id: "U_ADMIN", is_admin: true, real_name: "Ada Admin" });
  for (const user of ["U_ANN", "U_BOB"]) await memberChanged(t, "team_join", { id: user, real_name: `${user} Example` });
  await settle(t);
  return signedIn(maintainer);
}

type Messages = Array<{ kind: string; place: string }>;

async function signedIn(user: string) {
  const { asSignedIn } = await aSignedInSession(t, { user, name: user });
  const member = await t.run(async (ctx) => (await ctx.db.query("members").collect()).find((row) => row.user === user)!._id);
  const settings = async () => (await asSignedIn.query(api.website.settings.getSettings, {})) as { publicCelebrations?: boolean; messages?: Messages | null };
  const messages = async () => (await settings()).messages ?? [];
  return {
    member,
    publicCelebrations: async () => (await settings()).publicCelebrations,
    messages,
    messageKinds: async () => (await messages()).map(({ kind }) => kind),
    switchPublicCelebrations: (on: boolean, extra = {}) => asSignedIn.mutation(api.website.commands.setPublicCelebrations, { on, ...extra } as { on: boolean }),
    setMessageSetting: (kind: "celebrations", place: "channel" | "none") => asSignedIn.mutation(api.website.commands.setMessageSetting, { kind, place }),
  };
}

async function giveKudos(giver: string, recipient: string, kudos: number) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
  await settleUpTo(t, Date.now() + 60_000);
}

async function adminTabOpen(user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settleUpTo(t, Date.now() + 60_000);
  await clickInHome(user, "Admin");
  expect(publishedHome(slack, user)).toContain("section: *Public celebrations*");
}

async function clickInHome(user: string, label: string) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, buttonInHome(slack, user, label)), form));
  await settleUpTo(t, Date.now() + 60_000);
}

function storedSwitches() {
  return t.run((ctx) => ctx.db.query("celebrationsSwitches").collect());
}

function everyTable() {
  return t.run(async (ctx) => {
    const rows: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) rows[table] = await ctx.db.query(table).collect();
    return rows;
  });
}

function exposuresOf(...flags: string[]) {
  return t.run(async (ctx) => (await ctx.db.query("flagExposures").collect()).filter(({ flag }) => flags.includes(flag)).map(({ flag, member, value }) => ({ flag, member, value })));
}
