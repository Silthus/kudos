import type { DocumentByName, SystemDataModel } from "convex/server";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { functionPathOf } from "./boundary";
import { carriesReportedMarker, exceptionOfJobError } from "./exceptions";
import { recordException } from "./outbox";

type Job = DocumentByName<SystemDataModel, "_scheduled_functions">;

const pageSize = 100;
const pagesPerSweep = 10;
const watchedPerSweep = 1000;
const settledAfterMs = 60 * 1000;
const reportsKeptMs = 7 * 24 * 60 * 60 * 1000;
const analyticsModule = "analytics/";

export const sweep = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    await recheckWatchedJobs(ctx);
    await discoverNewJobs(ctx);
    await forgetOldReports(ctx);
  },
});

async function recheckWatchedJobs(ctx: MutationCtx) {
  for (const watched of await ctx.db.query("watchedJobs").take(watchedPerSweep)) {
    const job = await ctx.db.system.get(watched.job);
    if (job !== null && !isFinished(job)) continue;
    if (job !== null) await reportIfFailed(ctx, job);
    await ctx.db.delete(watched._id);
  }
}

async function discoverNewJobs(ctx: MutationCtx) {
  const sweepState = await ctx.db.query("errorSweep").first();
  let cursor = sweepState?.cursor ?? 0;
  const settledBefore = Date.now() - settledAfterMs;
  for (let page = 0; page < pagesPerSweep; page += 1) {
    const jobs = await ctx.db.system
      .query("_scheduled_functions")
      .withIndex("by_creation_time", (q) => q.gt("_creationTime", cursor).lt("_creationTime", settledBefore))
      .take(pageSize);
    for (const job of jobs) {
      if (isFinished(job)) await reportIfFailed(ctx, job);
      else await ctx.db.insert("watchedJobs", { job: job._id });
    }
    cursor = jobs.at(-1)?._creationTime ?? cursor;
    if (jobs.length < pageSize) break;
  }
  if (sweepState === null) await ctx.db.insert("errorSweep", { cursor });
  else await ctx.db.patch(sweepState._id, { cursor });
}

async function reportIfFailed(ctx: MutationCtx, job: Job) {
  if (job.state.kind !== "failed") return;
  const error: string | undefined = job.state.error;
  if (job.name.startsWith(analyticsModule) || carriesReportedMarker(error) || (await wasReported(ctx, job))) return;
  await ctx.db.insert("reportedJobs", { job: job._id });
  await recordException(ctx, { path: functionPathOf(job.name), kind: "mutation" }, exceptionOfJobError(error), job.completedTime ?? Date.now());
}

async function wasReported(ctx: MutationCtx, job: Job) {
  const report = await ctx.db
    .query("reportedJobs")
    .withIndex("by_job", (q) => q.eq("job", job._id))
    .first();
  return report !== null;
}

async function forgetOldReports(ctx: MutationCtx) {
  const old = await ctx.db
    .query("reportedJobs")
    .withIndex("by_creation_time", (q) => q.lt("_creationTime", Date.now() - reportsKeptMs))
    .take(pageSize);
  for (const report of old) await ctx.db.delete(report._id);
}

function isFinished(job: Job) {
  return job.state.kind === "success" || job.state.kind === "failed" || job.state.kind === "canceled";
}
