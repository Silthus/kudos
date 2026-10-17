import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { signedRequest } from "../../testing/signedSlack";
import { kudosReceived, post, settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, staleButtonOf } from "../../testing/slackInteractions";
import { emoji, mention, section } from "../../testing/slackMessages";
import { aDeploymentForWorkspace, aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";

const now = new Date("2026-10-17T10:00:00Z");
const workspaceSettings = "workspace-settings";
const maintainer = "U_MAINTAINER";

const defaults = { baseAllowance: 3, kudosEmoji: "taco", kudosEmojiImage: null, hugBudget: 10 };

let postHog: FakePostHog;
let slack: FakeSlack;
let t: Backend;

beforeEach(() => {
  vi.useFakeTimers({ now });
  aDeploymentForWorkspace();
  vi.stubEnv("KUDOS_EMOJI", "");
  vi.stubEnv("KUDOS_MAINTAINER", maintainer);
  postHog = new FakePostHog();
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  t = testBackend();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function workspaceSettingsOn() {
  return switchWebsite(t, postHog, true, workspaceSettings);
}

function workspaceSettingsOff() {
  return switchWebsite(t, postHog, true);
}

async function aTeammate(user: string, { admin = false } = {}) {
  const member = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user, kind: "member", asOf: 0, name: user, admin }));
  const { asSignedIn } = await aSignedInSession(t, { user, name: user });
  return {
    member,
    user,
    settings: () => asSignedIn.query(api.website.settings.getSettings, {}),
    sections: async () => (await t.query(internal.website.link.frontDoorLinksOf, { workspace: "T1", user }))?.sections,
    save: (settings: { baseAllowance: number; kudosEmoji: string; hugBudget: number }) => asSignedIn.mutation(api.website.commands.setWorkspaceSettings, settings),
  };
}

async function workspacePartOf(teammate: Awaited<ReturnType<typeof aTeammate>>) {
  const settings = (await teammate.settings()) as { workspace?: unknown };
  return settings.workspace;
}

function workspaceRows() {
  return t.run((ctx) => ctx.db.query("workspaces").collect());
}

function workspaceSettingsExposures() {
  return t.run(async (ctx) => (await ctx.db.query("flagExposures").collect()).filter(({ flag }) => flag === workspaceSettings).map(({ member, value }) => ({ member, value })));
}

describe("the maintainer changes the workspace settings from Settings", { timeout: 60_000 }, () => {
  test("the maintainer's Settings carry the daily allowance, the kudos emoji and the hug budget, with their defaults", async () => {
    vi.stubEnv("SITE_URL", "https://kudos-site.test");
    await workspaceSettingsOn();
    const owner = await aTeammate(maintainer);

    expect(await workspacePartOf(owner)).toEqual(defaults);
    expect(await owner.sections()).toContain("workspace");
  });

  test("a save stores all three, the Settings read shows them, and Slack gives kudos by them", async () => {
    await workspaceSettingsOn();
    const owner = await aTeammate(maintainer);

    expect(await owner.save({ baseAllowance: 5, kudosEmoji: " :Pizza: ", hugBudget: 0 })).toEqual({ kind: "set" });

    expect(await workspacePartOf(owner)).toEqual({ baseAllowance: 5, kudosEmoji: "pizza", kudosEmojiImage: null, hugBudget: 0 });
    await post(t, [section(mention("U_BOB"), emoji("pizza"), emoji("pizza"), emoji("pizza"), emoji("pizza"), emoji("pizza"), emoji("taco"))], { user: "U_ALICE" });
    await settle(t);
    expect(await kudosReceived(t, "U_BOB")).toBe(5);
  });

  test("the kudos emoji's picture comes with it when it is one of the workspace's own emoji", async () => {
    await workspaceSettingsOn();
    const owner = await aTeammate(maintainer);
    await t.run((ctx) => ctx.db.insert("customEmoji", { workspace: "T1", name: "hoggo", image: "https://emoji.slack-edge.com/T1/hoggo/1.png", listing: 1 }));

    await owner.save({ baseAllowance: 3, kudosEmoji: "hoggo", hugBudget: 10 });

    expect(await workspacePartOf(owner)).toEqual({ ...defaults, kudosEmoji: "hoggo", kudosEmojiImage: "https://emoji.slack-edge.com/T1/hoggo/1.png" });
  });

  test("a save for a workspace with no row yet stores one", async () => {
    await workspaceSettingsOn();
    const owner = await aTeammate(maintainer);

    await owner.save({ baseAllowance: 4, kudosEmoji: "taco", hugBudget: 10 });

    expect(await workspaceRows()).toMatchObject([{ workspace: "T1", baseAllowance: 4, kudosEmoji: "taco", hugBudget: 10 }]);
  });

  test("the command decides workspace-settings with exposure, and the read without", async () => {
    await workspaceSettingsOn();
    const owner = await aTeammate(maintainer);
    await owner.settings();
    expect(await workspaceSettingsExposures()).toEqual([]);

    await owner.save({ baseAllowance: 4, kudosEmoji: "taco", hugBudget: 10 });

    expect(await workspaceSettingsExposures()).toEqual([{ member: owner.member, value: true }]);
  });
});

describe("only the maintainer changes the workspace settings", { timeout: 60_000 }, () => {
  test("a workspace admin who isn't the maintainer sees no workspace part, and their save is refused and writes nothing", async () => {
    vi.stubEnv("SITE_URL", "https://kudos-site.test");
    await workspaceSettingsOn();
    const admin = await aTeammate("U_ADMIN", { admin: true });

    expect(await workspacePartOf(admin)).toBeUndefined();
    expect(await admin.sections()).not.toContain("workspace");
    expect(await admin.save({ baseAllowance: 9, kudosEmoji: "pizza", hugBudget: 1 })).toEqual({ kind: "refused", reason: "not-maintainer" });
    expect(await workspaceRows()).toEqual([]);
    expect(await workspaceSettingsExposures()).toEqual([]);
  });

  test("with no maintainer configured, nobody sees the part or saves", async () => {
    vi.stubEnv("KUDOS_MAINTAINER", "");
    await workspaceSettingsOn();
    const owner = await aTeammate(maintainer);

    expect(await workspacePartOf(owner)).toBeUndefined();
    expect(await owner.save({ baseAllowance: 9, kudosEmoji: "pizza", hugBudget: 1 })).toEqual({ kind: "refused", reason: "not-maintainer" });
    expect(await workspaceRows()).toEqual([]);
  });

  test("a KUDOS_MAINTAINER naming another user leaves this member out", async () => {
    vi.stubEnv("KUDOS_MAINTAINER", "U_SOMEONE_ELSE");
    await workspaceSettingsOn();
    const owner = await aTeammate(maintainer);

    expect(await owner.save({ baseAllowance: 9, kudosEmoji: "pizza", hugBudget: 1 })).toEqual({ kind: "refused", reason: "not-maintainer" });
    expect(await workspaceRows()).toEqual([]);
  });

  test("while workspace-settings is off, the maintainer's Settings equal main's and the command refuses with no reason, writing nothing", async () => {
    vi.stubEnv("SITE_URL", "https://kudos-site.test");
    await workspaceSettingsOff();
    const owner = await aTeammate(maintainer);

    expect(await owner.settings()).toEqual({ kind: "not-found" });
    expect(await owner.sections()).toEqual([]);
    expect(await owner.save({ baseAllowance: 9, kudosEmoji: "pizza", hugBudget: 1 })).toEqual({ kind: "refused", reason: null });
    expect(await workspaceRows()).toEqual([]);
  });

  test("a Slack click carrying the command is no command at all: no receipt, no App Home and no write", async () => {
    await workspaceSettingsOn();
    await aTeammate(maintainer);
    const form = { contentType: "application/x-www-form-urlencoded" };

    await t.fetch("/slack/interactivity", await signedRequest(blockActions(maintainer, staleButtonOf({ type: "setWorkspaceSettings", baseAllowance: 9, kudosEmoji: "pizza", hugBudget: 1 })), form));
    await settleInTimeOrder(t);

    expect(await t.run((ctx) => ctx.db.query("slackReceipts").collect())).toEqual([]);
    expect(slack.calls.filter(({ method }) => method === "views.publish")).toEqual([]);
    expect(await workspaceRows()).toEqual([]);
  });
});

describe("a workspace settings save stays in bounds", { timeout: 60_000 }, () => {
  test.each([
    ["an allowance of 0", { baseAllowance: 0 }, "allowance"],
    ["an allowance above 20", { baseAllowance: 21 }, "allowance"],
    ["a fractional allowance", { baseAllowance: 2.5 }, "allowance"],
    ["a negative hug budget", { hugBudget: -1 }, "hug-budget"],
    ["a hug budget above 50", { hugBudget: 51 }, "hug-budget"],
    ["a fractional hug budget", { hugBudget: 1.5 }, "hug-budget"],
    ["an empty emoji", { kudosEmoji: " :: " }, "kudos-emoji"],
    ["an emoji with a space", { kudosEmoji: "two words" }, "kudos-emoji"],
    ["a skin-toned emoji", { kudosEmoji: "wave::skin-tone-2" }, "kudos-emoji"],
  ] as const)("%s is refused and writes nothing", async (_, change, reason) => {
    await workspaceSettingsOn();
    const owner = await aTeammate(maintainer);

    expect(await owner.save({ baseAllowance: 3, kudosEmoji: "taco", hugBudget: 10, ...change })).toEqual({ kind: "refused", reason });

    expect(await workspaceRows()).toEqual([]);
  });

  test("the edges of each range are saved", async () => {
    await workspaceSettingsOn();
    const owner = await aTeammate(maintainer);

    expect(await owner.save({ baseAllowance: 1, kudosEmoji: "+1", hugBudget: 0 })).toEqual({ kind: "set" });
    expect(await owner.save({ baseAllowance: 20, kudosEmoji: "man-woman-boy", hugBudget: 50 })).toEqual({ kind: "set" });

    expect(await workspacePartOf(owner)).toEqual({ baseAllowance: 20, kudosEmoji: "man-woman-boy", kudosEmojiImage: null, hugBudget: 50 });
  });
});
