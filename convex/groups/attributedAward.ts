import { v } from "convex/values";
import { awardIdValidator } from "../engine/awards";

export const groupOrNoneValidator = v.union(v.id("userGroups"), v.null());

export const attributedAwardValidator = v.object({ award: awardIdValidator, recipient: v.id("members"), kudos: v.number(), saysWhy: v.boolean(), recipientGroup: groupOrNoneValidator });
