import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  slackReceipts: defineTable({
    workspace: v.string(),
    eventId: v.string(),
  }).index("by_event", ["workspace", "eventId"]),
});
