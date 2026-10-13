// PROTOTYPE achievements: every ladder in one table, its four tiers, the count and the next tier to earn.
import { Card, CardContent, Label, Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tooltip, TooltipContent, TooltipTrigger } from "@posthog/quill";
import { useState } from "react";
import { ladders, me } from "../data/mock";
import type { Ladder, LadderTier } from "../data/types";
import { HedgehogStar, PageHeader, TierMedal, tierLabel } from "../ui";

const allTiers = ladders.flatMap((l) => l.tiers);
const earnedTiers = allTiers.filter((t) => t.earned).length;

export function Achievements(_props: { param?: string }) {
  const [hidden, setHidden] = useState(me.privacy.hideAchievements);
  return (
    <>
      <PageHeader
        title="Achievements"
        hog={HedgehogStar}
        description={
          <>
            <span className="font-medium text-foreground">
              {earnedTiers} of {allTiers.length} tiers earned
            </span>{" "}
            across {ladders.length} ladders. Tiers unlock cosmetics, never XP, skill points or coins.
          </>
        }
        actions={
          <Label className="flex items-center gap-2 text-sm">
            <Switch size="sm" checked={hidden} onCheckedChange={setHidden} />
            Hide my achievements from teammates
          </Label>
        }
      />
      {hidden && <p className="-mt-2 mb-4 text-xs text-muted-foreground">Hidden. Teammates won't see these, now or later. You still do. Prototype: nothing was saved.</p>}
      <Card size="sm" flush>
        <CardContent>
          <Table fullWidth>
            <TableHeader>
              <TableRow>
                <TableHead expand>Ladder</TableHead>
                <TableHead className="hidden sm:table-cell">Tiers</TableHead>
                <TableHead align="right">Next tier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ladders.map((ladder) => (
                <LadderRow key={ladder.id} ladder={ladder} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function LadderRow({ ladder }: { ladder: Ladder }) {
  const next = ladder.tiers.find((t) => !t.earned);
  return (
    <TableRow>
      <TableCell expand>
        <div className="text-sm font-medium">{ladder.name}</div>
        <div className="text-xs text-muted-foreground">
          {sentenceCase(ladder.counts)}: <span className="tabular-nums">{ladder.count}</span>
        </div>
        <Medals ladder={ladder} className="mt-2 sm:hidden" />
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Medals ladder={ladder} />
      </TableCell>
      <TableCell align="right">
        {next ? (
          <>
            <div className="text-sm sm:whitespace-nowrap">{next.name}</div>
            <div className="text-xs tabular-nums text-muted-foreground">{next.threshold - ladder.count} to go</div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">All four earned</div>
        )}
      </TableCell>
    </TableRow>
  );
}

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function Medals({ ladder, className = "" }: { ladder: Ladder; className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {ladder.tiers.map((tier) => (
        <TierTip key={tier.tier} tier={tier} counts={ladder.counts} />
      ))}
    </div>
  );
}

function TierTip({ tier, counts }: { tier: LadderTier; counts: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<button type="button" className="rounded-full" />}>
        <TierMedal tier={tier.tier} earned={tier.earned} size={22} />
      </TooltipTrigger>
      <TooltipContent>
        <div className="font-medium">
          {tierLabel[tier.tier]}: {tier.name}
        </div>
        <div>
          {tier.threshold} {counts}. Unlocks {tier.reward}.{tier.earned ? " Earned." : ""}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
