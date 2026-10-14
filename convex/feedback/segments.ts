import { v, type Infer } from "convex/values";
import { mentionValidator } from "../engine/messageEvent";

export const segmentValidator = v.union(v.object({ text: v.string() }), v.object({ mention: mentionValidator }), v.object({ link: v.object({ url: v.string(), label: v.string() }) }));

export type Segment = Infer<typeof segmentValidator>;
export type Line = Segment[];
