import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import crons from "../crons";
import schema from "../schema";
import { modules } from "../test.setup";

const day = 24 * 60 * 60 * 1000;
const start = new Date("2026-10-01T09:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ now: start });
});

afterEach(() => {
  vi.useRealTimers();
});

test("R49: the daily job deletes receipts older than 7 days and keeps the rest", async () => {
  const t = convexTest(schema, modules);
  await receiveAt(t, "Ev-8-days-old", new Date(start.getTime()));
  await receiveAt(t, "Ev-6-days-old", new Date(start.getTime() + 2 * day));
  vi.setSystemTime(start.getTime() + 8 * day);

  await t.mutation(dailyJob("delete expired Slack receipts"), {});

  expect(await eventIdsIn(t)).toEqual(["Ev-6-days-old"]);
});

test("R49: the daily job deletes every expired receipt, however many there are", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (let i = 0; i < 1201; i++) await ctx.db.insert("slackReceipts", { workspace: "T1", eventId: `Ev${i}` });
  });
  vi.setSystemTime(start.getTime() + 8 * day);

  await t.mutation(dailyJob("delete expired Slack receipts"), {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  expect(await eventIdsIn(t)).toEqual([]);
});

test("R49: the receipt cleanup runs every day", () => {
  expect(crons.crons["delete expired Slack receipts"]?.schedule).toMatchObject({ type: "daily" });
});

type Backend = ReturnType<typeof convexTest>;

function dailyJob(name: string) {
  const job = crons.crons[name];
  if (job === undefined) throw new Error(`no cron job named ${name}`);
  return makeFunctionReference<"mutation">(job.name);
}

async function receiveAt(t: Backend, eventId: string, at: Date) {
  vi.setSystemTime(at);
  await t.run((ctx) => ctx.db.insert("slackReceipts", { workspace: "T1", eventId }));
}

async function eventIdsIn(t: Backend) {
  const receipts = await t.run((ctx) => ctx.db.query("slackReceipts").collect());
  return receipts.map((receipt) => receipt.eventId);
}
