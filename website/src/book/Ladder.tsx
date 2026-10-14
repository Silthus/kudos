import { IconCheck } from "@posthog/icons";
import { Card, CardContent } from "@posthog/quill";
import type { LadderCard, TierCard } from "../shell";
import { Bar } from "./Bar";
import { DateOf, tierWords } from "./dates";
import { LadderEmblem } from "./LadderEmblem";
import { Medal } from "./Medal";
import { bestOf, isEarned, type EarnedTier } from "./progress";
import { Tag } from "./Tag";

export function Ladder({ ladder, timeZone }: { ladder: LadderCard; timeZone: string }) {
  const { name, counts, tiers, next } = ladder;
  const titleId = `ladder-${ladder.ladder}`;
  const best = bestOf(ladder);
  return (
    <article aria-labelledby={titleId}>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <LadderEmblem ladder={ladder.ladder} best={best?.tier ?? null} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-col">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <h2 id={titleId} className="text-lg font-semibold leading-tight">
                    {name}
                  </h2>
                  <span className="text-xs tabular-nums text-muted-foreground">{best === null ? "Not started" : <LatestEarned tier={best} timeZone={timeZone} />}</span>
                </div>
                <p className="text-sm text-muted-foreground first-letter:uppercase">{counts}</p>
              </div>
              {next === null ? <Complete count={ladder.count} counts={counts} /> : <WayToNext ladder={ladder} next={next} />}
            </div>
          </div>
          <ol aria-label={`${name} tiers`} className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-4">
            {tiers.map((tier) => (
              <Tier key={tier.tier} tier={tier} isNext={tier.tier === next?.tier} timeZone={timeZone} />
            ))}
          </ol>
        </CardContent>
      </Card>
    </article>
  );
}

function LatestEarned({ tier, timeZone }: { tier: EarnedTier; timeZone: string }) {
  return (
    <>
      {tierWords[tier.tier]} earned <DateOf at={tier.earnedAt} timeZone={timeZone} />
    </>
  );
}

function WayToNext({ ladder, next }: { ladder: LadderCard; next: NonNullable<LadderCard["next"]> }) {
  const nextName = ladder.tiers.find(({ tier }) => tier === next.tier)?.name;
  const shown = `${ladder.count} of ${next.at}`;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2.5">
        <Bar label={`${shown} for ${nextName}`} value={ladder.count} max={next.at} />
        <span aria-hidden="true" className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {shown}
        </span>
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        {next.at - ladder.count} to go for {nextName}
      </p>
    </div>
  );
}

function Complete({ count, counts }: { count: number; counts: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2.5">
        <Bar label={`Complete, ${count} ${counts}`} value={1} max={1} />
        <span aria-hidden="true" className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      <p aria-hidden="true" className="flex items-center gap-1 text-xs font-medium">
        <IconCheck className="size-3.5" />
        Complete
      </p>
    </div>
  );
}

function Tier({ tier, isNext, timeZone }: { tier: TierCard; isNext: boolean; timeZone: string }) {
  const earned = isEarned(tier);
  return (
    <li className={`relative flex items-start gap-2.5 rounded-lg p-2.5 ${lookOf(earned, isNext)}`}>
      <Medal tier={tier.tier} earned={earned} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground">{tierWords[tier.tier]}</span>
        <span className={`text-sm font-medium leading-tight ${earned || isNext ? "" : "text-muted-foreground"}`}>{tier.name}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{isEarned(tier) ? <EarnedOn at={tier.earnedAt} timeZone={timeZone} /> : `At ${tier.at}`}</span>
      </div>
      {isNext && <Tag className="absolute -top-2 right-2">Next</Tag>}
    </li>
  );
}

function lookOf(earned: boolean, isNext: boolean) {
  if (earned) return "border bg-muted";
  if (isNext) return "border border-transparent bg-card ring-2 ring-foreground";
  return "border border-dashed";
}

function EarnedOn({ at, timeZone }: { at: number; timeZone: string }) {
  return (
    <span>
      Earned <DateOf at={at} timeZone={timeZone} />
    </span>
  );
}
