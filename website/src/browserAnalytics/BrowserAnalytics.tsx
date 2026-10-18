import { useQueries, type RequestForQueries } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { browserAnalytics, type PostHogLoader } from "./capture";

const loadPostHog: PostHogLoader = () => import("posthog-js/dist/module.full.no-external").then((module) => module.default);

const request: RequestForQueries = { analytics: { query: api.website.browserAnalytics.getBrowserAnalytics, args: {} } };

export function BrowserAnalytics() {
  const [analytics] = useState(() => browserAnalytics(loadPostHog));
  const { analytics: answer } = useQueries(request);
  useEffect(() => analytics.follow(answer), [analytics, answer]);
  useEffect(() => analytics.stop, [analytics]);
  return null;
}
