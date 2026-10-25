import { v, type Infer } from "convex/values";

export const mondayDmStateValidator = v.union(v.literal("scheduled"), v.literal("sent"), v.literal("skipped"), v.literal("failed"));

export const mondayDmSectionValidator = v.union(v.literal("hugs"), v.literal("quests"));

export const mondayDmValidator = v.object({
  member: v.id("members"),
  monday: v.string(),
  state: mondayDmStateValidator,
  dueAt: v.number(),
  tries: v.number(),
  sections: v.optional(v.array(mondayDmSectionValidator)),
});

export type MondayDmSection = Infer<typeof mondayDmSectionValidator>;
