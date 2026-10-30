import { useEffect, useRef } from "react";
import type { ActivityState, ActivityWeek, NextStep } from "../../../convex/website/activity";
import { PageTitle } from "../PageTitle";
import { NextStepCard } from "./NextStepCard";

type YourWeekPageProps = { week: ActivityWeek; inSight: boolean; onViewed: (state: ActivityState) => void };

export function YourWeekPage({ week, inSight, onViewed }: YourWeekPageProps) {
  useViewedOnceInSight(week.next.kind, inSight, onViewed);
  return (
    <div className="al-page-body al-your-week">
      <p className="al-eyebrow">Activity</p>
      <PageTitle tab="Activity" size="hero">
        Your week
      </PageTitle>
      <NextStepCard step={week.next} kudos={week.kudos} slack={week.slack} />
    </div>
  );
}

function useViewedOnceInSight(state: NextStep["kind"], inSight: boolean, onViewed: (state: ActivityState) => void) {
  const viewed = useRef(false);
  const latest = useRef({ state, onViewed });
  latest.current = { state, onViewed };
  useEffect(() => {
    if (viewed.current || !inSight) return;
    viewed.current = true;
    latest.current.onViewed(latest.current.state);
  }, [inSight]);
}
