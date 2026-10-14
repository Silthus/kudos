import { v, type Infer } from "convex/values";
import { mentionValidator } from "../engine/messageEvent";

export const segmentValidator = v.union(v.object({ text: v.string() }), v.object({ mention: mentionValidator }));

export type Segment = Infer<typeof segmentValidator>;
export type Line = Segment[];
