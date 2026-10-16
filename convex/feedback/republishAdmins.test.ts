import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import { testBackend, type Backend } from "../../testing/slackBackend";

const admins = Array.from({ length: 1_500 }, (_, index) => `U_ADMIN_${String(index).padStart(4, "0")}`);

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-16T10:00:00Z") });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("republishing the admins' App Home stays within Convex's limit of 1,000 scheduled functions per call", () => {
  test("a workspace of 1,500 admins gets each admin's App Home published once, and nobody else's", { timeout: 120_000 }, async () => {
    const t = testBackend({ transactionLimits: true });
    await t.run(async (ctx) => {
      for (const user of admins) await ctx.db.insert("members", { workspace: "T1", user, kind: "member", admin: true, asOf: 0 });
      await ctx.db.insert("members", { workspace: "T1", user: "U_GONE_ADMIN", kind: "not-a-member", admin: true, asOf: 0 });
      await ctx.db.insert("members", { workspace: "T1", user: "U_MEMBER", kind: "member", admin: false, asOf: 0 });
      await ctx.db.insert("members", { workspace: "T2", user: "U_OTHER_ADMIN", kind: "member", admin: true, asOf: 0 });
    });

    await t.mutation(internal.feedback.homes.republishAdminsIn, { workspace: "T1" });
    await runEveryRepublishPage(t);

    expect(await publishedHomes(t)).toEqual(admins.map((user) => ({ workspace: "T1", user })));
  });
});

async function runEveryRepublishPage(t: Backend) {
  for (let pages = 0; pages < admins.length; pages += 1) {
    const [next] = await pendingJobsNamed(t, "feedback/homes:republishAdminsIn");
    if (next === undefined) return;
    await t.run((ctx) => ctx.scheduler.cancel(next._id));
    await t.mutation(internal.feedback.homes.republishAdminsIn, next.args[0] as { workspace: string });
  }
}

async function publishedHomes(t: Backend) {
  const jobs = await pendingJobsNamed(t, "slack/appHome:publishHome");
  return jobs.map(({ args: [home] }) => home as { workspace: string; user: string }).toSorted((first, second) => first.user.localeCompare(second.user));
}

function pendingJobsNamed(t: Backend, name: string) {
  return t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).filter((job) => job.name === name && job.state.kind === "pending"));
}
