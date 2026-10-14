import { v } from "convex/values";

export const groupOrNoneValidator = v.union(v.id("userGroups"), v.null());

export const attributedAwardValidator = v.object({ award: v.id("awards"), recipient: v.id("members"), kudos: v.number(), saysWhy: v.boolean(), recipientGroup: groupOrNoneValidator });
