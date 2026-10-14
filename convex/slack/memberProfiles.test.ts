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

  test("a member event older than the backfill's page leaves the backfilled profile, and still applies its other fields", async () => {
    const t = testBackend();
    await memberChanged(t, "team_join", { id: "U_ANN", profile: { email: "old.ann@example.com" } }, { eventTs: `${now.getTime() / 1000 - 120}` });
    slack.withMember("U_ANN", { profile: annsProfile });
    await t.action(internal.slack.directory.fillMemberProfiles, {});

    await memberChanged(t, "user_change", { id: "U_ANN", tz: "Europe/Berlin", profile: { email: "old.ann@example.com" } }, { eventTs: earlierTs });

    expect(await profileOf(t, "U_ANN")).toEqual(annStored);
    expect((await directoryRowOf(t, "U_ANN"))?.timeZone).toBe("Europe/Berlin");
  });

  test("a member event newer than the backfill's page replaces the backfilled profile", async () => {
    const t = testBackend();
    await memberChanged(t, "team_join", { id: "U_ANN" }, { eventTs: earlierTs });
    slack.withMember("U_ANN", { profile: annsProfile });
    await t.action(internal.slack.directory.fillMemberProfiles, {});

    await memberChanged(t, "user_change", { id: "U_ANN", profile: { email: "ann.example@example.com" } }, { eventTs: `${now.getTime() / 1000 + 60}` });

    expect(await profileOf(t, "U_ANN")).toEqual({ email: "ann.example@example.com" });
  });

  test("a backfill whose page Slack answered before another backfill's changes nothing that one wrote", async () => {
    const t = testBackend();
    await memberChanged(t, "team_join", { id: "U_ANN" }, { eventTs: earlierTs });
    let answerTheFirstPage = () => {};
    const firstPageAnswered = new Promise<void>((resolve) => (answerTheFirstPage = resolve));
    let firstPageAsked = () => {};
    const firstPageReached = new Promise<void>((resolve) => (firstPageAsked = resolve));
    slack.answering("users.list", async () => {
      firstPageAsked();
      await firstPageAnswered;
      return Response.json({ ok: true, members: [{ id: "U_ANN", team_id: "T1", profile: { email: "old.ann@example.com" } }], response_metadata: { next_cursor: "" } });
    });
    const firstRun = t.action(internal.slack.directory.fillMemberProfiles, {});
    await firstPageReached;
    vi.setSystemTime(now.getTime() + 60_000);
    slack.withMember("U_ANN", { profile: annsProfile });

    await t.action(internal.slack.directory.fillMemberProfiles, {});
    answerTheFirstPage();
    await firstRun;

    expect(await profileOf(t, "U_ANN")).toEqual(annStored);
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

describe("the directory keeps each member's Slack picture for the website", () => {
  const largePicture = "https://avatars.example.com/ann-192.png";
  const smallPicture = "https://avatars.example.com/ann-72.png";

  test("a member who joins is kept with the 192-pixel picture Slack gives", async () => {
    const t = testBackend();

    await memberChanged(t, "team_join", { id: "U_ANN", profile: { image_72: smallPicture, image_192: largePicture } });

    expect(await pictureOf(t, "U_ANN")).toBe(largePicture);
  });

  test("the 72-pixel picture stands in when Slack gives no 192-pixel one", async () => {
    const t = testBackend();

    await memberChanged(t, "team_join", { id: "U_ANN", profile: { image_72: smallPicture, image_192: "" } });

    expect(await pictureOf(t, "U_ANN")).toBe(smallPicture);
  });

  test("a newer user_change replaces the picture, and one without a picture removes it", async () => {
    const t = testBackend();
    await memberChanged(t, "team_join", { id: "U_ANN", profile: { image_192: smallPicture } }, { eventTs: earlierTs });
    await memberChanged(t, "user_change", { id: "U_ANN", profile: { image_192: largePicture } }, { eventTs: nowTs });
    const changed = await pictureOf(t, "U_ANN");

    await memberChanged(t, "user_change", { id: "U_ANN", profile: {} }, { eventTs: `${now.getTime() / 1000 + 60}` });

    expect(changed).toBe(largePicture);
    expect(await pictureOf(t, "U_ANN")).toBeUndefined();
  });

  test("a picture that isn't an https address is not kept", async () => {
    const t = testBackend();

    await memberChanged(t, "team_join", { id: "U_ANN", profile: { image_192: "javascript:alert(1)", image_72: "http://avatars.example.com/ann-72.png" } });

    expect(await pictureOf(t, "U_ANN")).toBeUndefined();
  });

  test("an https address without a host gives way to the 72-pixel picture", async () => {
    const t = testBackend();

    await memberChanged(t, "team_join", { id: "U_ANN", profile: { image_192: "https://", image_72: smallPicture } });

    expect(await pictureOf(t, "U_ANN")).toBe(smallPicture);
  });

  test("users.info keeps the picture of a person the directory doesn't know", async () => {
    const t = testBackend();
    slack.withMember("U_ANN", { profile: { image_192: largePicture } });

    await post(t, [section(mention("U_ANN"), emoji("taco"))]);
    await settle(t);

    expect(await pictureOf(t, "U_ANN")).toBe(largePicture);
  });

  test("the backfill fills the picture of every known member from users.list", async () => {
    const t = testBackend();
    await memberChanged(t, "team_join", { id: "U_ANN", profile: annsProfile }, { eventTs: earlierTs });
    slack.withMember("U_ANN", { profile: { ...annsProfile, image_192: largePicture } });

    await t.action(internal.slack.directory.fillMemberProfiles, {});

    expect(await pictureOf(t, "U_ANN")).toBe(largePicture);
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

  test("a users.info answer with a field of the wrong type keeps the member and logs nothing of the answer", async () => {
    const t = testBackend();
    slack.withMember("U_DAVE", { tz: 123, profile: { email: "dave@example.com", real_name: "Dave Example", title: 7 } } as never);

    await post(t, [section(mention("U_DAVE"), emoji("taco"))]);
    await settle(t);

    expect(await profileOf(t, "U_DAVE")).toEqual({ email: "dave@example.com", realName: "Dave Example" });
    expect(everythingLogged()).not.toMatch(/dave/i);
  });

  test("a users.info answer naming a user ID of the wrong type keeps the person asked about", async () => {
    const t = testBackend();
    slack.answering("users.info", () => Response.json({ ok: true, user: { id: 42, team_id: "T1", profile: { email: "alice@example.com" } } }));
    slack.withMember("U_DAVE", { profile: { email: "dave@example.com" } });

    await post(t, [section(mention("U_DAVE"), emoji("taco"))]);
    await settle(t);

    expect(await profileOf(t, "U_ALICE")).toEqual({ email: "alice@example.com" });
    expect(everythingLogged()).not.toMatch(/alice@|dave@/i);
  });

  test("a signed member event naming a user ID of the wrong type is acknowledged and logs nothing of it", async () => {
    const t = testBackend();

    const response = await memberChanged(t, "user_change", { id: 42, profile: { email: "dave@example.com", title: "Baker" } });

    expect(response.status).toBe(200);
    expect(await t.run((ctx) => ctx.db.query("members").collect())).toEqual([]);
    expect(everythingLogged()).not.toMatch(/dave|baker/i);
  });

  test("a users.info refusal carrying a retry delay that isn't a number fails verification without quoting it", async () => {
    const t = testBackend();
    slack.answering("users.info", () => Response.json({ ok: false, error: "user_not_found", retryAfterMs: "dave@example.com" }));

    const failure = await t.action(internal.slack.verifyMember.verifyMember, { workspace: "T1", user: "U_DAVE" }).then(() => null, (error: unknown) => String(error));

    expect(failure ?? "").not.toMatch(/dave@/i);
    expect(everythingLogged()).not.toMatch(/dave@/i);
  });

  test("a signed member event whose event ID isn't a string is acknowledged and logs nothing of it", async () => {
    const t = testBackend();
    const body = JSON.stringify({ type: "event_callback", team_id: "T1", event_id: ["dave@example.com"], event: { type: "user_change", user: { id: "U_DAVE", team_id: "T1" }, event_ts: nowTs } });

    const response = await t.fetch("/slack/events", await signedRequest(body));

    expect(response.status).toBe(200);
    expect(everythingLogged()).not.toMatch(/dave@/i);
  });

  test("a signed member event that isn't JSON fails without quoting it", async () => {
    const t = testBackend();
    const body = "email=dave%40example.com&type=event_callback&team_id=T1";

    const failure = await t.fetch("/slack/events", await signedRequest(body)).then(() => null, (error: unknown) => String(error));

    expect(failure).toContain("SyntaxError");
    expect(failure).not.toMatch(/dave/i);
    expect(everythingLogged()).not.toMatch(/dave/i);
  });

  test("a users.list refusal whose error isn't a Slack error code fails the backfill without quoting it", async () => {
    const t = testBackend();
    slack.answering("users.list", () => Response.json({ ok: false, error: "dave.example" }));

    const failure = await t.action(internal.slack.directory.fillMemberProfiles, {}).then(() => null, (error: unknown) => String(error));

    expect(failure).toContain("users.list");
    expect(failure).not.toMatch(/dave/i);
    expect(everythingLogged()).not.toMatch(/dave/i);
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

async function pictureOf(t: Backend, user: string) {
  return (await directoryRowOf(t, user))?.picture;
}
