import { v, type Infer } from "convex/values";

export const mondayPostOutcomeValidator = v.union(v.literal("claimed"), v.literal("nobody-gave"), v.literal("posted"), v.literal("cant-post"), v.literal("failed"));

export type MondayPostOutcome = Infer<typeof mondayPostOutcomeValidator>;

export const channelRefusalValidator = v.union(v.literal("private"), v.literal("not-found"), v.literal("archived"), v.literal("failed"));

export type ChannelRefusal = Infer<typeof channelRefusalValidator>;

export const channelCheckValidator = v.union(v.literal("checking"), v.literal("picked"), channelRefusalValidator);

export type ChannelCheck = Infer<typeof channelCheckValidator>;
