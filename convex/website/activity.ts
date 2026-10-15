import { v } from "convex/values";
import { activityOf, recentKudosOf } from "../activity/activity";
import { activityShownTo } from "../activity/activityFlag";
import type { Activity, RecentKudos, Spotlight } from "../activity/entries";
import { spotlightOf } from "../activity/spotlight";
import { memberQuery, type Denial } from "./memberQuery";

export type { Activity, ActivityEntry, Channel, Found, KudosGiven, KudosReceived, LevelUp, Message, Person, QuestDone, RecentKudos, Segment, Spotlight } from "../activity/entries";

type NotFound = { kind: "not-found" };

export type ActivityAnswer = NotFound | Activity;

export type RecentKudosAnswer = NotFound | RecentKudos;

export type MyActivity = Denial | ActivityAnswer;

export type MyRecentKudos = Denial | RecentKudosAnswer;

export type SpotlightAnswer = NotFound | Spotlight;

export type MySpotlight = Denial | SpotlightAnswer;

const notFound: NotFound = { kind: "not-found" };

export const getActivity = memberQuery({
  args: { filter: v.union(v.literal("all"), v.literal("received"), v.literal("given")), cursor: v.union(v.string(), v.null()), limit: v.optional(v.number()) },
  handler: async (ctx, me, page): Promise<ActivityAnswer> => ((await activityShownTo(ctx, me.member)) ? activityOf(ctx, me.member, page) : notFound),
});

export const getRecentKudos = memberQuery({
  args: { direction: v.union(v.literal("received"), v.literal("given")), limit: v.optional(v.number()) },
  handler: async (ctx, me, recent): Promise<RecentKudosAnswer> => ((await activityShownTo(ctx, me.member)) ? recentKudosOf(ctx, me.member, recent) : notFound),
});

export const getSpotlight = memberQuery({
  args: { seed: v.optional(v.number()), after: v.optional(v.string()) },
  handler: async (ctx, me, { seed, after }): Promise<SpotlightAnswer> => {
    if (!(await activityShownTo(ctx, me.member))) return notFound;
    return spotlightOf(ctx, me.workspace, after === undefined ? { seed: seed ?? 0 } : { after });
  },
});
