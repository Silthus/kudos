import { v } from "convex/values";
import { activityOf, recentKudosOf } from "../activity/activity";
import { activityShownTo } from "../activity/activityFlag";
import type { Activity, RecentKudos, Spotlight } from "../activity/entries";
import { spotlightOf } from "../activity/spotlight";
import { albumShownTo } from "../album/flag";
import { reportActivityViewed } from "../analytics/isolatedUsage";
import { activityStateValidator } from "../analytics/projections";
import { activityNextOnAndExposedFor, activityNextShownTo } from "./activityNextFlag";
import { activityWeekOf, type ActivityWeek } from "./activityWeek";
import { followTheClock } from "./clock";
import { memberMutation } from "./memberMutation";
import { memberQuery, type Denial } from "./memberQuery";

export type { Activity, ActivityEntry, Channel, Found, KudosGiven, KudosReceived, LevelUp, Message, Person, QuestDone, RecentKudos, Segment, Spotlight, HugGiven, HugReceived } from "../activity/entries";

export type { ActivityWeek, NextStep } from "./activityWeek";

export type { LoopLesson } from "../album/items/welcome";

export type { ActivityState } from "../analytics/projections";

type NotFound = { kind: "not-found" };

export type ActivityWeekRead = { kind: "off" } | { kind: "edition" } | ActivityWeek;

export type MyActivityWeek = Denial | ActivityWeekRead;

export type ActivityViewAnswer = { kind: "viewed" } | { kind: "refused" };

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

export const getActivityWeek = memberQuery(async (ctx, me): Promise<ActivityWeekRead> => {
  if (!(await albumShownTo(ctx, me.member))) return { kind: "off" };
  if (!(await activityNextShownTo(ctx, me.member))) return { kind: "edition" };
  await followTheClock(ctx);
  return activityWeekOf(ctx, me, Date.now());
});

export const viewActivity = memberMutation({
  args: { state: activityStateValidator },
  handler: async (ctx, me, _person, { state }): Promise<ActivityViewAnswer> => {
    if (!(await albumShownTo(ctx, me.member)) || !(await activityNextOnAndExposedFor(ctx, me.member))) return { kind: "refused" };
    await reportActivityViewed(ctx, { workspace: me.workspace, member: me.member, state, at: Date.now() });
    return { kind: "viewed" };
  },
});
