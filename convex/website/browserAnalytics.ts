import { browserIdentityOf, websiteAnalyticsFlag, type BrowserIdentity } from "../analytics/browser";
import { memberDecisionWithoutWriting } from "../analytics/flags";
import { memberQuery } from "./memberQuery";

export type BrowserAnalytics = { kind: "off" } | ({ kind: "capture" } & BrowserIdentity);

const off: BrowserAnalytics = { kind: "off" };

export const getBrowserAnalytics = memberQuery(async (ctx, me): Promise<BrowserAnalytics> => {
  if (!(await memberDecisionWithoutWriting(ctx, websiteAnalyticsFlag, me.member))) return off;
  const identity = await browserIdentityOf(ctx, me.member);
  return identity === null ? off : { kind: "capture", ...identity };
});
