import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily("delete expired Slack receipts", { hourUTC: 3, minuteUTC: 0 }, internal.slack.receipts.deleteExpired);

export default crons;
