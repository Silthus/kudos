import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily("delete expired Slack receipts", { hourUTC: 3, minuteUTC: 0 }, internal.slack.receipts.deleteExpired);
crons.interval("restart a stale analytics drain", { minutes: 10 }, internal.analytics.drain.recover);
crons.daily("clean up the analytics outbox", { hourUTC: 3, minuteUTC: 15 }, internal.analytics.drain.cleanUp);
crons.interval("sweep failed scheduled functions", { minutes: 15 }, internal.analytics.sweep.sweep);
crons.interval("make features that shipped ready", { hours: 1 }, internal.unlocks.sweep.sweep, {});
crons.interval("draw each member's new week of quests", { hours: 1 }, internal.quests.newWeek.sweep, {});
crons.interval("tick the website clock", { minutes: 15 }, internal.website.clock.tick);
crons.daily("delete abandoned sign-in handshakes", { hourUTC: 3, minuteUTC: 30 }, internal.website.abandonedHandshakes.deleteAbandoned);
crons.daily("read the company profiles from posthog.com", { hourUTC: 4, minuteUTC: 0 }, internal.companyProfiles.sync.syncCompanyProfiles);
crons.daily("follow the workspace's Slack user groups", { hourUTC: 4, minuteUTC: 15 }, internal.slack.userGroups.syncUserGroups, {});
crons.daily("bring PostHog's people up to date", { hourUTC: 4, minuteUTC: 45 }, internal.analytics.person.catchUp, {});

export default crons;
