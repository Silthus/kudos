import { Card, CardContent } from "@posthog/quill";
import type { LadderCard, TierCard, TierId } from "../shell";
import { LadderEmblem } from "./LadderEmblem";
import { Medal } from "./Medal";

const tierWords: Record<TierId, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", diamond: "Diamond" };

export function Ladder({ ladder, timeZone }: { ladder: LadderCard; timeZone: string }) {
  const { name, counts, tiers, next } = ladder;
  const titleId = `ladder-${ladder.ladder}`;
  return (
    <article aria-labelledby={titleId}>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <LadderEmblem ladder={ladder.ladder} earned={tiers.some(isEarned)} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-col">
                <h2 id={titleId} className="text-lg font-semibold leading-tight">
                  {name}
                </h2>
                <p className="text-sm text-muted-foreground first-letter:uppercase">{counts}</p>
              </div>
              {next !== null && <WayToNext ladder={ladder} next={next} />}
            </div>
          </div>
          <ol aria-label={`${name} tiers`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tiers.map((tier) => (
              <Tier key={tier.tier} tier={tier} isNext={tier.tier === next?.tier} timeZone={timeZone} />
            ))}
          </ol>
        </CardContent>
      </Card>
    </article>
  );
}

function isEarned({ earnedAt }: TierCard) {
  return earnedAt !== null;
}

function WayToNext({ ladder, next }: { ladder: LadderCard; next: NonNullable<LadderCard["next"]> }) {
  const nextName = ladder.tiers.find(({ tier }) => tier === next.tier)?.name;
  const shown = `${ladder.count} of ${next.at}`;
  return (
    <div className="flex items-center gap-2.5">
      <div role="progressbar" aria-label={`${shown} for ${nextName}`} aria-valuenow={ladder.count} aria-valuemin={0} aria-valuemax={next.at} className="h-2 flex-1 overflow-hidden rounded-full border border-muted-foreground p-px">
        <div className="h-full rounded-full bg-muted-foreground" style={{ width: `${Math.min(100, (ladder.count / next.at) * 100)}%` }} />
      </div>
      <span aria-hidden="true" className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
        {shown}
      </span>
    </div>
  );
}

function Tier({ tier, isNext, timeZone }: { tier: TierCard; isNext: boolean; timeZone: string }) {
  const earned = isEarned(tier);
  return (
    <li className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${earned ? "bg-muted" : "border-dashed"}`}>
      <Medal tier={tier.tier} earned={earned} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground">{tierWords[tier.tier]}</span>
        <span className="text-sm font-medium leading-tight">{tier.name}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
          {tier.earnedAt !== null ? <EarnedOn at={tier.earnedAt} timeZone={timeZone} /> : `At ${tier.at}`}
          {isNext && <span className="rounded-full border px-1.5 py-px text-[11px] font-medium text-foreground">Next</span>}
        </span>
      </div>
    </li>
  );
}

function EarnedOn({ at, timeZone }: { at: number; timeZone: string }) {
  const date = new Date(at);
  return (
    <span>
      Earned <time dateTime={date.toISOString()}>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone }).format(date)}</time>
    </span>
  );
}
