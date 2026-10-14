import { afterEach, beforeEach, describe, expect, test, vi, type MockInstance } from "vitest";
import { internal } from "../_generated/api";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { memberChanged, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, mention, section } from "../../testing/slackMessages";

const now = new Date("2026-10-13T10:00:00Z");
const nowTs = `${now.getTime() / 1000}`;
const earlierTs = `${now.getTime() / 1000 - 60}`;

const annsProfile = { email: "ann@example.com", real_name: "Ann Example", display_name: "annie", title: "Gardener" };
const annStored = { email: "ann@example.com", realName: "Ann Example", displayName: "annie", title: "Gardener" };

let slack: FakeSlack;
let logged: MockInstance[];

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE");
  vi.stubGlobal("fetch", slack.fetch);
  logged = (["log", "info", "warn", "error", "debug"] as const).map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("F1 F2: team_join and user_change keep a member's Slack profile in the directory", () => {
  test("a member who joins is kept with their email, real name, display name and title", async () => {
    const t = testBackend();

    await memberChanged(t, "team_join", { id: "U_ANN", profile: annsProfile });

    expect(await profileOf(t, "U_ANN")).toEqual(annStored);
  });

  test("a newer user_change replaces a changed field and removes one Slack no longer gives", async () => {
    const t = testBackend();
    await memberChanged(t, "team_join", { id: "U_ANN", profile: annsProfile }, { eventTs: earlierTs });

    await memberChanged(t, "user_change", { id: "U_ANN", profile: { real_name: "Ann Example", email: "ann.example@example.com" } }, { eventTs: nowTs });

    expect(await profileOf(t, "U_ANN")).toEqual({ email: "ann.example@example.com", realName: "Ann Example" });
  });

  test("a user_change older than the one the directory holds changes nothing", async () => {
    const t = testBackend();
    await memberChanged(t, "user_change", { id: "U_ANN", profile: annsProfile }, { eventTs: nowTs });

    await memberChanged(t, "user_change", { id: "U_ANN", profile: { email: "old.ann@example.com" } }, { eventTs: earlierTs });

    expect(await profileOf(t, "U_ANN")).toEqual(annStored);
  });

  test("a display name Slack leaves empty is not kept", async () => {
    const t = testBackend();

    await memberChanged(t, "team_join", { id: "U_ANN", profile: { ...annsProfile, display_name: "", title: "" } });

    expect(await profileOf(t, "U_ANN")).toEqual({ email: "ann@example.com", realName: "Ann Example" });
  });
});

describe("F1 F2: users.info keeps a member's Slack profile in the directory", () => {
  test("a person the directory doesn't know is kept with the profile users.info gives", async () => {
    const t = testBackend();
    slack.withMember("U_ANN", { profile: annsProfile });

    await post(t, [section(mention("U_ANN"), emoji("taco"))]);
    await settle(t);

    expect(await profileOf(t, "U_ANN")).toEqual(annStored);
  });

  test("opening App Home refreshes the member's profile through users.info", async () => {
    flagsOnForEveryone(slack.fetch, "xp-levels");
    const t = await flagsLoaded(testBackend());
    await memberChanged(t, "team_join", { id: "U_ANN", profile: { email: "old.ann@example.com" } }, { eventTs: earlierTs });
    slack.withMember("U_ANN", { profile: annsProfile });

    await t.fetch("/slack/events", await signedRequest(appHomeOpened("U_ANN")));
    await settle(t);

    expect(await profileOf(t, "U_ANN")).toEqual(annStored);
  });
});

describe("F1 F5: only a member holds a profile", () => {
  test.each<[string, Record<string, unknown>]>([
    ["a bot", { id: "B_HELPER", is_bot: true, profile: annsProfile }],
    ["a person from another workspace", { id: "U_GUEST", team_id: "T_OTHER", profile: annsProfile }],
  ])("%s is kept without one", async (_, user) => {
    const t = testBackend();

    await memberChanged(t, "team_join", user);

    expect(await profileOf(t, String(user.id))).toEqual({});
  });

  test("a member who leaves keeps no profile, and one who rejoins gets it back from Slack", async () => {
    const t = testBackend();
    await memberChanged(t, "team_join", { id: "U_ANN", profile: annsProfile }, { eventTs: earlierTs });

    await memberChanged(t, "user_change", { id: "U_ANN", deleted: true, profile: annsProfile }, { eventTs: nowTs });
    const whileGone = await profileOf(t, "U_ANN");
    await memberChanged(t, "user_change", { id: "U_ANN", profile: annsProfile }, { eventTs: `${now.getTime() / 1000 + 60}` });

    expect(whileGone).toEqual({});
    expect(await profileOf(t, "U_ANN")).toEqual(annStored);
  });
});

describe("F3: the backfill fills every known member's profile from users.list", () => {
  test("it fills a missing profile, replaces a changed one and never adds a person the directory doesn't know", async () => {
    const t = testBackend();
    await memberChanged(t, "team_join", { id: "U_ANN" }, { eventTs: earlierTs });
    await memberChanged(t, "team_join", { id: "U_BOB", profile: { email: "bob@example.com", title: "Intern" } }, { eventTs: earlierTs });
    slack
      .withMember("U_ANN", { profile: annsProfile })
      .withMember("U_BOB", { profile: { email: "bob.example@example.com", title: "Engineer" } })
      .withMember("U_CAROL", { profile: { email: "carol@example.com" } });

    await t.action(internal.slack.directory.fillMemberProfiles, {});

    expect(await profileOf(t, "U_ANN")).toEqual(annStored);
    expect(await profileOf(t, "U_BOB")).toEqual({ email: "bob.example@example.com", title: "Engineer" });
    expect(await directoryRowOf(t, "U_CAROL")).toBeNull();
  });

  test("a second run changes nothing", async () => {
    const t = testBackend();
    await memberChanged(t, "team_join", { id: "U_ANN" }, { eventTs: earlierTs });
    slack.withMember("U_ANN", { profile: annsProfile });
    await t.action(internal.slack.directory.fillMemberProfiles, {});
    const afterFirstRun = await directoryRowOf(t, "U_ANN");

    await t.action(internal.slack.directory.fillMemberProfiles, {});

    expect(await directoryRowOf(t, "U_ANN")).toEqual(afterFirstRun);
  });

  test("a member Slack now lists without a profile field keeps what the directory holds", async () => {
    const t = testBackend();
    await memberChanged(t, "team_join", { id: "U_ANN", profile: annsProfile }, { eventTs: earlierTs });
    slack.withMember("U_ANN", { profile: { real_name: "Ann Example" } });

    await t.action(internal.slack.directory.fillMemberProfiles, {});

    expect(await profileOf(t, "U_ANN")).toEqual(annStored);
  });
});

describe("F6: a Slack answer that can hold a profile is never logged", () => {
  test("a malformed users.info answer logs only a fixed code, without the profile or the user ID", async () => {
    const t = testBackend();
    slack.answering("users.info", formEncodedAnswer, formEncodedAnswer);

    await post(t, [section(mention("U_DAVE"), emoji("taco"))]);
    await settle(t);

    expect(everythingLogged()).not.toMatch(/dave|U_ALICE/i);
    expect(everythingLogged()).toContain("slack.users_info_failed");
  });

  test("a malformed users.list answer fails the backfill without quoting it", async () => {
    const t = testBackend();
    slack.answering("users.list", formEncodedAnswer);

    const failure = await t.action(internal.slack.directory.fillMemberProfiles, {}).then(() => null, (error: unknown) => String(error));

    expect(failure).toContain("users.list");
    expect(failure).not.toMatch(/dave/i);
    expect(everythingLogged()).not.toMatch(/dave/i);
  });
});

function formEncodedAnswer() {
  return new Response("email=dave%40example.com&real_name=Dave+Example&ok=true", { headers: { "content-type": "application/json" } });
}

function everythingLogged() {
  return logged.flatMap((spy) => spy.mock.calls).map((call) => call.map((argument) => (typeof argument === "string" ? argument : JSON.stringify(argument) ?? String(argument))).join(" ")).join("\n");
}

function directoryRowOf(t: Backend, user: string) {
  return t.run((ctx) => ctx.db.query("members").withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user)).unique());
}

async function profileOf(t: Backend, user: string) {
  const row = await directoryRowOf(t, user);
  const { email, realName, displayName, title } = (row ?? {}) as Partial<Record<"email" | "realName" | "displayName" | "title", string>>;
  return Object.fromEntries(Object.entries({ email, realName, displayName, title }).filter(([, value]) => value !== undefined));
}
