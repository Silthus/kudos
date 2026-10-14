import { v, type ObjectType } from "convex/values";

export const memberProfileFields = {
  email: v.optional(v.string()),
  realName: v.optional(v.string()),
  displayName: v.optional(v.string()),
  title: v.optional(v.string()),
};

export type MemberProfile = ObjectType<typeof memberProfileFields>;
