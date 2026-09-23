import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("prune slack event ids", { hours: 6 }, internal.slackData.pruneEvents, {});

// Keep the public demo tidy: fresh history every night.
crons.daily("reset demo workspace", { hourUTC: 2, minuteUTC: 17 }, internal.demo.startDemoReset, {});

export default crons;
