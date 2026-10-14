import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakePostHog, postHogHost, projectToken, routedFetch } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { deleteMessage, deleteThreadParent, edit, everythingStored, kudosReceived, post, settle, testBackend, type Backend } from "../../testing/slackBackend";
import { broadcast, channel, codeBlock, emoji, link, list, mention, messageEvent, quote, section, text, unicodeEmoji, userGroup } from "../../testing/slackMessages";
import { ReportableError } from "../analytics/exceptions";
import { wordsOf } from "../engine/kudosText";
import type { WordSegment } from "../engine/messageEvent";

const forced = vi.hoisted(() => ({ failure: false, adapterFailure: false }));

vi.mock("./richText", async (importOriginal) => {
  const original = await importOriginal<typeof import("./richText")>();
  return {
    ...original,
    segmentsOf: (...args: Parameters<typeof original.segmentsOf>) => {
      const segments = original.segmentsOf(...args);
      if (forced.adapterFailure) throw new ReportableError(`could not read ${textOf(segments)}`);
      return segments;
    },
  };
});

vi.mock("../engine/kudosText", async (importOriginal) => {
  const original = await importOriginal<typeof import("../engine/kudosText")>();
  return {
    ...original,
    keepWords: async (...args: Parameters<typeof original.keepWords>) => {
      if (forced.failure) throw new ReportableError(`could not keep ${textOf(args[1].words?.segments ?? [])}`);
      return original.keepWords(...args);
    },
  };
});

const now = new Date("2026-10-13T10:00:00Z");
const postedTs = "1760349600.000100";
const message = { workspace: "T1", conversation: "C1", message: postedTs };
const reason = "for the calm rollback of the billing service";
const thanksBob = [section(text(`thanks ${reason} `), mention("U_BOB"), text(" "), emoji("taco"))];

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  vi.stubGlobal("fetch", slack.fetch);
});

afterEach(() => {
  forced.failure = false;
  forced.adapterFailure = false;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AT2 AT3: a kudos message's words", () => {
  test("are kept as segments in order, every element counted or not, with the channel's visibility, the author and the gate decision", async () => {
    const t = testBackend();

    await post(t, [
      section(
        text("Thanks "),
        mention("U_BOB"),
        text(" and "),
        userGroup("S1"),
        text(" for the "),
        text("rollback", { bold: true, italic: true }),
        text(" fix "),
        emoji("taco"),
        text(" "),
        unicodeEmoji("pray", "1f64f"),
      ),
      section(text("see "), link("https://example.com/runbook", "the runbook"), text(" in "), channel("C2"), text(" "), broadcast("here"), text("\nold: "), text("v1", { strike: true })),
      quote(text("quoted "), emoji("taco")),
      codeBlock(text("make deploy")),
      list(section(text("first")), section(text("second"))),
    ]);
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(await words(t)).toEqual({
      kind: "text",
      segments: [
        { kind: "text", text: "Thanks " },
        { kind: "person", user: "U_BOB" },
        { kind: "text", text: " and " },
        { kind: "group", group: "S1" },
        { kind: "text", text: " for the " },
        { kind: "text", text: "rollback", bold: true, italic: true },
        { kind: "text", text: " fix " },
        { kind: "emoji", name: "taco" },
        { kind: "text", text: " " },
        { kind: "emoji", name: "pray", unicode: "🙏" },
        { kind: "break" },
        { kind: "text", text: "see " },
        { kind: "link", url: "https://example.com/runbook", label: "the runbook" },
        { kind: "text", text: " in " },
        { kind: "channel" },
        { kind: "text", text: " " },
        { kind: "broadcast", range: "here" },
        { kind: "break" },
        { kind: "text", text: "old: " },
        { kind: "text", text: "v1", strike: true },
        { kind: "break" },
        { kind: "text", text: "quoted " },
        { kind: "emoji", name: "taco" },
        { kind: "break" },
        { kind: "text", text: "make deploy", code: true },
        { kind: "break" },
        { kind: "text", text: "first" },
        { kind: "break" },
        { kind: "text", text: "second" },
      ],
      edited: false,
      visibility: "public",
      author: "U_ALICE",
      gate: { version: 1, thoughtful: true },
    });
  });

  test("of a private channel are private, and a message that says why carries that gate decision", async () => {
    const t = testBackend();

    await post(t, thanksBob, { channelType: "group", channel: "G2" });
    await settle(t);

    expect(await words(t, { conversation: "G2" })).toMatchObject({ kind: "text", visibility: "private", gate: { version: 1, thoughtful: true } });
  });

  test("of a message that doesn't give are kept while it is a kudos message", async () => {
    const t = testBackend();

    await post(t, [section(text("thanks "), mention("U_BOB"), mention("U_CAROL"), emoji("taco"), emoji("taco"))]);
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(0);
    expect(await words(t)).toMatchObject({ kind: "text", segments: expect.arrayContaining([{ kind: "text", text: "thanks " }]) });
  });

  test("of a message nobody has seen are not captured", async () => {
    const t = testBackend();

    expect(await words(t)).toEqual({ kind: "unavailable", reason: "not-captured" });
  });
});

describe("AT4: the newest revision wins", () => {
  test("an edit replaces the words, marks them edited and takes its own gate decision", async () => {
    const t = testBackend();
    await post(t, thanksBob, { ts: postedTs });
    await settle(t);

    await edit(t, [section(text("cheers "), mention("U_BOB"), emoji("taco"))], { ts: postedTs, editedTs: "1760349660.000100" });
    await settle(t);

    expect(await words(t)).toMatchObject({
      kind: "text",
      segments: [{ kind: "text", text: "cheers " }, { kind: "person", user: "U_BOB" }, { kind: "emoji", name: "taco" }],
      edited: true,
      gate: { version: 1, thoughtful: false },
    });
    expect(await kudosReceived(t, "U_BOB")).toBe(1);
  });

  test("an older revision arriving late changes nothing", async () => {
    const t = testBackend();
    await post(t, thanksBob, { ts: postedTs });
    await edit(t, [section(text("newest "), mention("U_BOB"), emoji("taco"))], { ts: postedTs, editedTs: "1760349720.000100" });
    await settle(t);

    await edit(t, [section(text("older "), mention("U_BOB"), emoji("taco"))], { ts: postedTs, editedTs: "1760349660.000100" });
    await settle(t);

    expect(await words(t)).toMatchObject({ kind: "text", segments: [{ kind: "text", text: "newest " }, expect.anything(), expect.anything()] });
  });

  test("an edit that arrives before its post keeps the edit's words", async () => {
    const t = testBackend();

    await edit(t, [section(text("edited first "), mention("U_BOB"), emoji("taco"))], { ts: postedTs, editedTs: "1760349660.000100" });
    await post(t, thanksBob, { ts: postedTs });
    await settle(t);

    expect(await words(t)).toMatchObject({ kind: "text", segments: [{ kind: "text", text: "edited first " }, expect.anything(), expect.anything()], edited: true });
  });
});

describe("AT5: edited away", () => {
  test("removing the kudos emoji deletes the words and leaves them deleted, and the kudos stays", async () => {
    const t = testBackend();
    await post(t, thanksBob, { ts: postedTs });
    await settle(t);

    await edit(t, [section(text(`thanks ${reason} `), mention("U_BOB"))], { ts: postedTs, editedTs: "1760349660.000100" });
    await settle(t);

    expect(await words(t)).toEqual({ kind: "unavailable", reason: "deleted" });
    expect(await kudosReceived(t, "U_BOB")).toBe(1);
  });

  test("editing it back into a kudos message keeps the newest words again", async () => {
    const t = testBackend();
    await post(t, thanksBob, { ts: postedTs });
    await edit(t, [section(text("no emoji "), mention("U_BOB"))], { ts: postedTs, editedTs: "1760349660.000100" });
    await settle(t);

    await edit(t, [section(text("back again "), mention("U_BOB"), emoji("taco"))], { ts: postedTs, editedTs: "1760349720.000100" });
    await settle(t);

    expect(await words(t)).toMatchObject({ kind: "text", segments: [{ kind: "text", text: "back again " }, expect.anything(), expect.anything()] });
  });
});

describe("AT6: deleted in Slack", () => {
  test("a message_deleted without a channel type deletes the words, and the kudos, the indicator and Slack stay untouched", async () => {
    const t = testBackend();
    await post(t, thanksBob, { ts: postedTs });
    await settle(t);
    const callsBefore = slack.calls.length;

    const response = await deleteMessage(t, { ts: postedTs, previous: thanksBob });
    await settle(t);

    expect(response.status).toBe(200);
    expect(await words(t)).toEqual({ kind: "unavailable", reason: "deleted" });
    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(slack.calls.slice(callsBefore)).toEqual([]);
  });

  test("a late or redelivered edit of a deleted message stores nothing", async () => {
    const t = testBackend();
    await post(t, thanksBob, { ts: postedTs });
    await settle(t);
    await deleteMessage(t, { ts: postedTs, previous: thanksBob });

    await edit(t, [section(text("too late "), mention("U_BOB"), emoji("taco"))], { ts: postedTs, editedTs: "1760349660.000100" });
    await settle(t);

    expect(await words(t)).toEqual({ kind: "unavailable", reason: "deleted" });
    expect(stringify(await everythingStored(t))).not.toContain("too late");
  });

  test("a deletion that arrives before its post wins, and the kudos still gives", async () => {
    const t = testBackend();

    await deleteMessage(t, { ts: postedTs, previous: thanksBob });
    await post(t, thanksBob, { ts: postedTs });
    await settle(t);

    expect(await words(t)).toEqual({ kind: "unavailable", reason: "deleted" });
    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(stringify(await everythingStored(t))).not.toContain(reason);
  });

  test("a deleted thread parent, a message_changed whose message is a tombstone, deletes the words", async () => {
    const t = testBackend();
    await post(t, thanksBob, { ts: postedTs });
    await settle(t);

    await deleteThreadParent(t, { ts: postedTs, previous: thanksBob });
    await settle(t);

    expect(await words(t)).toEqual({ kind: "unavailable", reason: "deleted" });
    expect(await kudosReceived(t, "U_BOB")).toBe(1);
  });

  test("an ordinary message's deletion stores nothing", async () => {
    const t = testBackend();
    await post(t, [section(text("lunch at noon?"))], { ts: postedTs });
    await settle(t);

    await deleteMessage(t, { ts: postedTs, previous: [section(text("lunch at noon?"))] });
    await settle(t);

    expect(await everythingStored(t)).toEqual([]);
  });
});

describe("AT11: a malformed event never reaches the events mutation, whose argument check would quote the words", () => {
  test.each<[string, Parameters<typeof messageEvent>[1], ReturnType<typeof section>[]]>([
    ["a channel that isn't a string", { extra: { channel: 404 } }, thanksBob],
    ["a ts that isn't a string", { extra: { ts: 1760349600.0001 } }, thanksBob],
    ["an author that isn't a string", { extra: { user: 404 } }, thanksBob],
    ["a thread that isn't a string", { extra: { thread_ts: 1760349000 } }, thanksBob],
    ["a team that isn't a string", { extra: { team: 404 }, team: 404 as unknown as string }, thanksBob],
    ["a mention whose user isn't a string", {}, [section(text(`thanks ${reason} `), { type: "user", user_id: 404 } as never, mention("U_BOB"), emoji("taco"))]],
    ["an emoji whose name isn't a string", {}, [section(text(`thanks ${reason} `), mention("U_BOB"), { type: "emoji", name: 404 } as never, emoji("taco"))]],
    ["a link whose url isn't a string", {}, [section(text(`thanks ${reason} `), mention("U_BOB"), { type: "link", url: 404, text: 7 } as never, emoji("taco"))]],
    ["text that isn't a string", {}, [section({ type: "text", text: 404 } as never, mention("U_BOB"), emoji("taco"))]],
  ])("%s is answered without failing", async (_, options, blocks) => {
    const t = testBackend();

    const response = await postEvent(t, messageEvent(blocks, options));
    await settle(t);

    expect(response.status).toBe(200);
  });
});

describe("AT40: only kudos messages' text is stored", () => {
  test("an ordinary chat message's text is in no table and no job", async () => {
    const t = testBackend();
    const ordinary = "the deploy rescue on friday";

    await post(t, [section(text(ordinary), mention("U_BOB"))]);
    await edit(t, [section(text(`${ordinary}, edited`), mention("U_BOB"))], { editedTs: "1760349660.000100" });
    await settle(t);

    expect(await storedAndScheduled(t)).not.toContain(ordinary);
    expect(await storedAndScheduled(t)).not.toContain("thanks for the help");
  });

  test("a kudos message's words are only in the kudos text and in no job's arguments", async () => {
    const t = testBackend();

    await post(t, thanksBob);
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(await kudosText(t)).toContain(reason);
    expect(await storedAndScheduled(t, { besideKudosText: true })).not.toContain(reason);
    expect(await storedAndScheduled(t)).not.toContain("thanks for the help");
  });

  test.each<[string, (t: Backend) => Promise<unknown>]>([
    ["deleting it", (t) => deleteMessage(t, { ts: postedTs, previous: thanksBob })],
    ["editing it away", (t) => edit(t, [section(text(`${reason}, edited`), mention("U_BOB"))], { ts: postedTs, editedTs: "1760349660.000100" })],
  ])("%s leaves its words nowhere", async (_, forget) => {
    const t = testBackend();
    await post(t, thanksBob, { ts: postedTs });
    await settle(t);

    await forget(t);
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(await storedAndScheduled(t)).not.toContain(reason);
  });

  describe("AT11: with capture on, a failure that would quote the words", () => {
    let postHog: FakePostHog;
    let consoleLines: unknown[][];

    beforeEach(() => {
      vi.stubEnv("POSTHOG_PROJECT_TOKEN", projectToken);
      vi.stubEnv("KUDOS_ENVIRONMENT", "production");
      vi.stubEnv("POSTHOG_HOST", postHogHost);
      postHog = new FakePostHog();
      vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
      consoleLines = [];
      for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation((...line) => void consoleLines.push(line));
    });

    test.each<[string, () => Promise<unknown>]>([
      [
        "thrown in the events mutation, as a reportable error",
        async () => {
          forced.failure = true;
          return post(testBackendOnce(), thanksBob);
        },
      ],
      [
      "thrown in the Slack adapter, as a reportable error",
      async () => {
        forced.adapterFailure = true;
        return post(testBackendOnce(), thanksBob);
      },
    ],
    ])("%s leaves no words in the outbox, a captured exception, the console or the rethrown error", async (_, fail) => {
      const failure = await fail().then(
        () => null,
        (error: unknown) => error,
      );
      await settle(backend!);

      expect(failure).not.toBeNull();
      expect(String(failure)).not.toContain(reason);
      expect(await exceptionsRecorded()).toHaveLength(1);
      expect(stringify(await everythingStored(backend!))).not.toContain(reason);
      expect(postHog.requests.map((request) => request.body).join("\n")).not.toContain(reason);
      expect(stringify(consoleLines)).not.toContain(reason);
    });

    test.each<[string, () => Promise<unknown>]>([
      [
        "thrown in the events mutation, as a reportable error",
        async () => {
          forced.failure = true;
          return post(testBackendOnce(), thanksBob);
        },
      ],
      [
      "thrown in the Slack adapter, as a reportable error",
      async () => {
        forced.adapterFailure = true;
        return post(testBackendOnce(), thanksBob);
      },
    ],
    ])("%s, with native error reporting on, is rethrown without the words", async (_, fail) => {
      vi.stubEnv("POSTHOG_NATIVE_ERRORS", "on");

      const failure = await fail().then(
        () => null,
        (error: unknown) => error,
      );

      expect(failure).not.toBeNull();
      expect(String(failure)).not.toContain(reason);
      expect(stringify(consoleLines)).not.toContain(reason);
    });

    let backend: Backend | undefined;

    function testBackendOnce() {
      backend = testBackend();
      return backend;
    }

    async function exceptionsRecorded() {
      return postHog.events().filter((event) => event.event === "$exception");
    }
  });
});

async function postEvent(t: Backend, body: string) {
  return t.fetch("/slack/events", await signedRequest(body));
}

function textOf(segments: WordSegment[]) {
  return segments.map((segment) => (segment.kind === "text" ? segment.text : "")).join("");
}

async function words(t: Backend, ref: Partial<typeof message> = {}) {
  return t.run((ctx) => wordsOf(ctx, { ...message, ...ref }));
}

async function kudosText(t: Backend) {
  return stringify(await t.run((ctx) => ctx.db.query("kudosTexts").collect()));
}

async function storedAndScheduled(t: Backend, { besideKudosText = false } = {}) {
  const stored = besideKudosText ? await everythingStored(t, { except: ["kudosTexts"] }) : await everythingStored(t);
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return stringify([...stored, ...jobs]);
}

function stringify(value: unknown) {
  return JSON.stringify(value, (_, item) => (typeof item === "bigint" ? item.toString() : item));
}
