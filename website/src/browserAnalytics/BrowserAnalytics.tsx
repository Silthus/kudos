import { useQueries, type RequestForQueries } from "convex/react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { browserAnalytics, type Capturer, type PostHogLoader } from "./capture";
import { CapturingContext } from "./capturing";
import { ReportCaughtError } from "./reportCaughtError";

const loadPostHog: PostHogLoader = () => import("./postHogScript").then((script) => script.postHogScript);

const request: RequestForQueries = { analytics: { query: api.website.browserAnalytics.getBrowserAnalytics, args: {} } };

export function BrowserAnalytics({ children }: { children: ReactNode }) {
  const [capturer, setCapturer] = useState<Capturer | null>(null);
  const [analytics] = useState(() => browserAnalytics(loadPostHog, setCapturer));
  const { analytics: answer } = useQueries(request);
  useEffect(() => analytics.follow(answer), [analytics, answer]);
  useEffect(() => analytics.stop, [analytics]);
  return (
    <CapturingContext value={capturer}>
      <ReportCaughtError value={analytics.report}>{children}</ReportCaughtError>
    </CapturingContext>
  );
}
