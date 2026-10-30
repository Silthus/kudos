import type { LastWeek } from "../../../convex/website/activity";
import { AppLink } from "../AppLink";
import { plural } from "../album/facts";
import { hrefOf } from "../album/place";

export function LastWeekLine({ lastWeek: { week, hugsGiven, kudosGiven, hugsReceived } }: { lastWeek: LastWeek }) {
  return (
    <p className="al-last-week">
      Last week you gave {plural(hugsGiven, "hug", "hugs")} and {kudosGiven} kudos, and got {plural(hugsReceived, "hug", "hugs")}. <AppLink href={hrefOf({ kind: "activity", week })}>Read last week</AppLink>
    </p>
  );
}
