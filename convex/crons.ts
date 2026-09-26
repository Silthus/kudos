import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("prune slack event ids", { hours: 6 }, internal.slackData.pruneEvents, {});

// Backstop for missed user_change events: deactivated people lose access within a day.
crons.daily("resync slack directories", { hourUTC: 3, minuteUTC: 41 }, internal.slackData.scheduleDirectorySync, {});

// Keep the public demo tidy: fresh history every night.
crons.daily("reset demo workspace", { hourUTC: 2, minuteUTC: 17 }, internal.demo.startDemoReset, {});

// Visitors' simulators (#143) last 7 days; stalled wipes start again.
crons.interval("wipe expired simulators", { hours: 1 }, internal.simulator.wipeExpired, {});

export default crons;
