import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSlack } from "../../testing/fakeSlack";
import { signingSecret } from "../../testing/signedSlack";
import { convexStops, kudosReceived, kudosSpent, pendingJobs, post, settle, settleUntil, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { strandedPerSweep } from "./strandedJobs";

const recheck = vi.hoisted(() => ({ failuresLeft: 0, tries: 0 }));

vi.mock("../engine/engine", async (importOriginal) => {
  const original = await importOriginal<typeof import("../engine/engine")>();
  return {
    ...original,
    recheck: async (...args: Parameters<typeof original.recheck>) => {
      recheck.tries += 1;
      if (recheck.failuresLeft > 0) {
        recheck.failuresLeft -= 1;
        throw new Error('Documents read from or written to the "kudosTotals" table changed while this mutation was being run and on every subsequent retry.');
      }
      return original.recheck(...args);
    },
  };
});

const now = new Date("2026-10-14T10:00:00Z");
const postedTs = `${Math.floor(now.getTime() / 1000)}.000100`;

let slack: FakeSlack;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_EVE").withMember("U_BOB");
  vi.stubGlobal("fetch", slack.fetch);
  Object.assign(recheck, { failuresLeft: 0, tries: 0 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a failed directory check is tried again", () => {
  test("a kudos from a giver the directory didn't know still gives when its directory check fails", async () => {
    const t = testBackend();
    recheck.failuresLeft = 1;

    await post(t, [section(mention("U_BOB"), emoji("taco"))], { user: "U_EVE", ts: postedTs });
    await settle(t);

    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(slack.reactionsOn("C1", postedTs)).toEqual(["taco"]);
  }, 30_000);

  test("a directory check that keeps failing stops after four more tries, spending nothing", async () => {
    const t = testBackend();
    recheck.failuresLeft = Infinity;

    await post(t, [section(mention("U_BOB"), emoji("taco"))], { user: "U_EVE", ts: postedTs });
    await settle(t);

    expect(recheck.tries).toBe(5);
    expect(await kudosSpent(t)).toBe(0);
    expect(slack.reactionsOn("C1", postedTs)).toEqual([]);
  }, 30_000);
});

describe("a stranded directory check is checked again", () => {
  test("a kudos whose directory check Convex stopped gives once the sweep finds it stranded", async () => {
    const t = testBackend();

    await post(t, [section(mention("U_BOB"), emoji("taco"))], { user: "U_EVE", ts: postedTs });
    await convexStops(t, "slack/directory:checkDirectory");
    await settle(t);
    expect(await kudosReceived(t, "U_BOB")).toBe(0);

    await sweepAt(t, minutesAfterPosting(87));

    expect(await kudosReceived(t, "U_BOB")).toBe(1);
    expect(slack.reactionsOn("C1", postedTs)).toEqual(["taco"]);
  }, 30_000);

  test("a kudos whose directory check failed all five tries gives once the sweep finds it stranded", async () => {
    const t = testBackend();
    recheck.failuresLeft = 5;

    await post(t, [section(mention("U_BOB"), emoji("taco"))], { user: "U_EVE", ts: postedTs });
    await settle(t);
    expect(await kudosReceived(t, "U_BOB")).toBe(0);

    await sweepAt(t, minutesAfterPosting(87));

    expect(recheck.tries).toBe(6);
    expect(await kudosReceived(t, "U_BOB")).toBe(1);
  }, 30_000);

  test("a message whose fresh checks keep failing is given up once its directory checks run out", async () => {
    const t = testBackend();
    recheck.failuresLeft = Infinity;

    await post(t, [section(mention("U_BOB"), emoji("taco"))], { user: "U_EVE", ts: postedTs });
    await settle(t);
    const triesPerSweep: number[] = [];
    for (let sweep = 1; sweep <= 9; sweep += 1) {
      const before = recheck.tries;
      await sweepAt(t, minutesAfterPosting(87 * sweep));
      triesPerSweep.push(recheck.tries - before);
    }

    expect(triesPerSweep.at(-1)).toBe(0);
    expect(await kudosSpent(t)).toBe(0);
  }, 60_000);

  test("a check whose five tries could each still be running until Convex's action time limit is left alone", async () => {
    const t = testBackend();

    await post(t, [section(mention("U_BOB"), emoji("taco"))], { user: "U_EVE", ts: postedTs });
    await convexStops(t, "slack/directory:checkDirectory");
    await sweepAt(t, minutesAfterPosting(86));

    expect(await kudosReceived(t, "U_BOB")).toBe(0);
  }, 30_000);

  test("a message waiting for its next directory check is left alone", async () => {
    const t = testBackend();

    await post(t, [section(mention("U_GHOST"), emoji("taco"))], { user: "U_EVE", ts: postedTs });
    await settleUntil(t, minutesAfterPosting(130));
    expect(lookupsOf("U_GHOST")).toBe(4);

    await t.mutation(internal.slack.directory.recheckStranded, {});
    await settleUntil(t, minutesAfterPosting(131));

    expect(lookupsOf("U_GHOST")).toBe(4);
  }, 30_000);

  test("a message from before due times were recorded is left to its own check", async () => {
    const t = testBackend();

    await post(t, [section(mention("U_GHOST"), emoji("taco"))], { user: "U_EVE", ts: postedTs });
    await settleUntil(t, minutesAfterPosting(130));
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("kudosMessages").collect()) await ctx.db.patch(row._id, { nextCheckAt: undefined });
    });

    await t.mutation(internal.slack.directory.recheckStranded, {});
    await settleUntil(t, minutesAfterPosting(131));

    expect(lookupsOf("U_GHOST")).toBe(4);
  }, 30_000);

  test("sweeping twice before the stranded check runs schedules it once", async () => {
    const t = testBackend();

    await post(t, [section(mention("U_BOB"), emoji("taco"))], { user: "U_EVE", ts: postedTs });
    await convexStops(t, "slack/directory:checkDirectory");
    vi.setSystemTime(minutesAfterPosting(87));
    await t.mutation(internal.slack.directory.recheckStranded, {});
    await t.mutation(internal.slack.directory.recheckStranded, {});

    expect(await pendingJobs(t, "slack/directory:checkDirectory")).toBe(1);
  }, 30_000);

  test("more stranded messages than one page all give", async () => {
    const t = testBackend();
    const givers = Array.from({ length: strandedPerSweep + 1 }, (_, index) => `U_GIVER${index}`);
    for (const giver of givers) slack.withMember(giver);

    for (const [index, giver] of givers.entries()) {
      await post(t, [section(mention("U_BOB"), emoji("taco"))], { user: giver, ts: `${Math.floor(now.getTime() / 1000)}.${String(index).padStart(6, "0")}` });
    }
    await convexStops(t, "slack/directory:checkDirectory");
    await sweepAt(t, minutesAfterPosting(87));

    expect(await kudosReceived(t, "U_BOB")).toBe(givers.length);
  }, 30_000);
});

function minutesAfterPosting(minutes: number) {
  return new Date(now.getTime() + minutes * 60_000);
}

async function sweepAt(t: Backend, at: Date) {
  vi.setSystemTime(at);
  await t.mutation(internal.slack.directory.recheckStranded, {});
  await settle(t);
}

function lookupsOf(user: string) {
  return slack.callsTo("users.info").filter((args) => args.user === user).length;
}
