import { useQueries, type RequestForQueries } from "convex/react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { browserAnalytics, type PostHogLoader } from "./capture";
import { ReportCaughtError } from "./reportCaughtError";

const loadPostHog: PostHogLoader = () => import("./postHogScript").then((script) => script.postHogScript);

const request: RequestForQueries = { analytics: { query: api.website.browserAnalytics.getBrowserAnalytics, args: {} } };

export function BrowserAnalytics({ children }: { children: ReactNode }) {
  const [analytics] = useState(() => browserAnalytics(loadPostHog));
  const { analytics: answer } = useQueries(request);
  useEffect(() => analytics.follow(answer), [analytics, answer]);
  useEffect(() => analytics.stop, [analytics]);
  return <ReportCaughtError.Provider value={analytics.report}>{children}</ReportCaughtError.Provider>;
}
