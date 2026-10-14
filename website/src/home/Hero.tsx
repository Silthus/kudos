import { LeveledFace } from "../LeveledFace";
import { MaxLine } from "../Max";
import { PageTitle } from "../PageTitle";
import { SlackLink } from "../SlackLink";
import type { MemberProfile } from "../shell";
import { LevelLine } from "./LevelLine";

export function Hero({ member }: { member: MemberProfile }) {
  return (
    <section aria-labelledby="home-title" className="hud-panel relative flex flex-col gap-5 rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3">
        <LeveledFace member={member} className="size-12" />
        {member.name !== undefined && <span className="font-medium">{member.name}</span>}
      </div>
      <div className="flex flex-col gap-2">
        <PageTitle tab="Home" id="home-title">
          Thank someone for work you noticed
        </PageTitle>
        <p className="text-sm text-muted-foreground">Mention them in a Slack message with :{member.kudosEmoji}: and say what they did.</p>
      </div>
      <div className="flex flex-col items-start gap-2">
        <SlackLink chatUrl={member.chatUrl} variant="primary" size="lg">
          Thank someone in Slack
        </SlackLink>
        <AllowanceLine allowance={member.allowance} />
        {member.progression !== null && <LevelLine progression={member.progression} />}
      </div>
      <div className="border-t pt-4">
        <MaxLine>{weekInWords(member.thisWeek)}</MaxLine>
      </div>
    </section>
  );
}

function AllowanceLine({ allowance: { left, base, refillsAt } }: { allowance: MemberProfile["allowance"] }) {
  const refill = new Date(refillsAt);
  return (
    <p className="text-sm text-muted-foreground tabular-nums">
      {left} of {base} kudos left today · Refills at <time dateTime={refill.toISOString()}>{refill.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
    </p>
  );
}

function weekInWords({ given, received }: MemberProfile["thisWeek"]) {
  if (given === 0 && received === 0) return "No kudos yet this week, so thank someone in Slack for something they did.";
  return `This week you gave ${given} kudos and received ${received}.`;
}
