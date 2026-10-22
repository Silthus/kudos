import { v, type Infer } from "convex/values";
import { memberProfileFields } from "./memberProfile";

const memberEntryValidator = v.object({ kind: v.literal("member"), name: v.optional(v.string()), timeZone: v.optional(v.string()), admin: v.optional(v.boolean()), ...memberProfileFields });

export const directoryEntryValidator = v.union(memberEntryValidator, v.object({ kind: v.literal("bot") }), v.object({ kind: v.literal("not-a-member") }));

export type DirectoryEntry = Infer<typeof directoryEntryValidator>;
