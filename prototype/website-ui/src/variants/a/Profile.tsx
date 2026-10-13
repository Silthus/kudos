// PROTOTYPE profile as a product-analytics overview: one hero XP trend, insight tiles around it, and the shared profile card.
import { useState } from "react";
import { IconCalendar, IconFlag, IconLock } from "@posthog/icons";
import { Button, Separator, Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@posthog/quill";
import { ladders, me } from "../../data/mock";
import type { Tier } from "../../data/types";
import { Initials, Rarity, TierMedal } from "../../ui";
import { Funnel, GroupedBars, Heatmap, TrendLine, series } from "./charts";
import { BigNumber, Insight, MaxLine, Private, StatTile, Tag } from "./insight";
import { levelReachedIndex, maxInsights, recentActivity, weeklyKudos, workdayHeatmap, xpLast30 } from "./series";

const tierOrder: Tier[] = ["bronze", "silver", "gold", "diamond"];

export function DashboardProfile(_props: { param?: string }) {
  const xpIntoLevel = me.xp - me.xpThisLevelStart;
  const xpLevelSpan = me.xpNextLevel - me.xpThisLevelStart;
  const xpToGo = me.xpNextLevel - me.xp;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">Overview</h1>
        <span className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-xs text-muted-foreground">
          <IconCalendar className="size-3.5" /> Last 30 days
        </span>
        <div className="ml-auto flex items-center gap-2">
          {me.skillPointsUnspent > 0 && (
            <Button variant="primary" size="sm" onClick={() => (location.hash = "/skills")}>
              Roll out {me.skillPointsUnspent} skill points
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Level" value={me.level} hint={`${xpToGo.toLocaleString()} XP to level ${me.level + 1}`}>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${(xpIntoLevel / xpLevelSpan) * 100}%`, background: series(1) }} />
          </div>
        </StatTile>
        <StatTile label="Skill points to spend" value={me.skillPointsUnspent} hint="Permanent once rolled out" accent={me.skillPointsUnspent > 0} />
        <StatTile label="Coins" value={me.coins} hint="From thoughtful kudos" />
        <StatTile label="Kudos left today" value={me.kudosLeftToday} unit={`of ${me.dailyAllowance}`} hint="Refills at your midnight">
          <div className="flex gap-1">
            {Array.from({ length: me.dailyAllowance }, (_, i) => (
              <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < me.kudosLeftToday ? series(1) : "var(--muted)" }} />
            ))}
          </div>
        </StatTile>
      </div>

      <Insight hero title="XP · cumulative" description="Every thank-you, chime-in and perk bonus, day by day" actions={<Tag variant="info">Trend</Tag>}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <BigNumber value={me.xp.toLocaleString()} unit="XP" />
            <span className="text-xs text-muted-foreground">
              ▲ {(me.xp - xpLast30[0].value).toLocaleString()} in 30 days · peak day {Math.max(...xpLast30.map((p, i) => (i ? p.value - xpLast30[i - 1].value : 0)))} XP
            </span>
          </div>
          <TrendLine points={xpLast30} unit=" XP" annotation={{ index: levelReachedIndex, label: `You reached level ${me.level}` }} goal={{ value: me.xpNextLevel, label: `Level ${me.level + 1} · ${me.xpNextLevel.toLocaleString()} XP` }} />
          <MaxLine>{maxInsights.profile}</MaxLine>
        </div>
      </Insight>

      <div className="grid gap-3 lg:grid-cols-3">
        <Insight title={`Level ${me.level} → ${me.level + 1}`} description="How far through this level you are" actions={<Tag variant="info">Funnel</Tag>}>
          <Funnel
            max={xpLevelSpan}
            steps={[
              { label: `Level ${me.level}`, value: xpLevelSpan, sub: `${me.xpThisLevelStart.toLocaleString()} XP`, state: "done" },
              { label: "You", value: xpIntoLevel, sub: `${Math.round((xpIntoLevel / xpLevelSpan) * 100)}% · ${xpIntoLevel} XP in`, state: "current" },
              { label: `Level ${me.level + 1}`, value: xpLevelSpan, sub: `${xpToGo} XP to go`, state: "ahead" },
            ]}
          />
        </Insight>

        <Insight title="Workday streak" description={me.streak.hidden ? "Hidden from your card" : `${me.streak.days} workdays, best ${me.streak.best}`} actions={<Tag variant="info">Retention</Tag>}>
          <div className="flex flex-col gap-3">
            <Heatmap weeks={workdayHeatmap} dayNames={["Mon", "Tue", "Wed", "Thu", "Fri"]} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>❄ = streak freeze used · {me.streak.freezesHeld} held</span>
              <Private />
            </div>
          </div>
        </Insight>

        <Insight title="Kudos · weekly" description="Given is public, received is yours alone" actions={<Tag variant="info">Breakdown</Tag>}>
          <GroupedBars
            groups={weeklyKudos.map((w) => ({ label: w.week, values: [w.given, w.received] }))}
            legend={[
              { name: `Given · ${me.kudosGiven} all time`, color: series(1) },
              { name: `Received · ${me.kudosReceived} all time`, color: series(2), locked: true },
            ]}
          />
        </Insight>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ProfileCardInsight />
        <Insight title="Boosters and loadout" description="What is switched on for you right now" actions={<Tag variant="info">Flags</Tag>}>
          <div className="flex flex-col">
            {me.boosters.map((b) => (
              <div key={b.name} className="flex items-center gap-3 py-2">
                <IconFlag className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{b.name}</div>
                  <div className="text-xs text-muted-foreground">{b.state === "running" ? `Running · ${b.endsIn} left` : "Waiting for you"}</div>
                </div>
                {b.state === "running" ? (
                  <Tag variant="success">
                    <span className="size-1.5 rounded-full bg-current" /> On
                  </Tag>
                ) : (
                  <Button variant="outline" size="xs" onClick={() => alert("Prototype: boosters switch on in Slack.")}>
                    Switch on
                  </Button>
                )}
              </div>
            ))}
            <Separator className="my-1" />
            <div className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{me.loadout.card}</div>
                <div className="text-xs text-muted-foreground">Equipped card · title “{me.loadout.title}”</div>
              </div>
              <Rarity rarity="uncommon" />
            </div>
          </div>
        </Insight>
      </div>

      <Insight title="Recent events" description="The last things HedgeHug counted for you" actions={<Private>Lock = only you</Private>}>
        <div className="-mx-4 -mb-4">
          <Table size="sm" fullWidth>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead expand>Details</TableHead>
                <TableHead className="hidden sm:table-cell">Effect</TableHead>
                <TableHead align="right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentActivity.map((e, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                      <span className="size-2 rounded-[2px]" style={{ background: series(e.event.startsWith("kudos") ? 1 : e.event === "drop" ? 14 : 3) }} />
                      {e.event}
                      {e.private && <IconLock className="size-3 text-muted-foreground" />}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.detail}</TableCell>
                  <TableCell className="hidden whitespace-nowrap sm:table-cell">{e.delta}</TableCell>
                  <TableCell align="right" className="whitespace-nowrap text-muted-foreground">
                    {e.when}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Insight>
    </div>
  );
}

function ProfileCardInsight() {
  const [hideLevel, setHideLevel] = useState(me.privacy.hideLevel);
  const [hideAchievements, setHideAchievements] = useState(me.privacy.hideAchievements);
  const bestTiers = ladders
    .map((l) => [...l.tiers].reverse().find((t) => t.earned)?.tier)
    .filter((t): t is Tier => t !== undefined)
    .sort((a, b) => tierOrder.indexOf(b) - tierOrder.indexOf(a))
    .slice(0, 4);
  return (
    <Insight title="Your profile card" description="Shared with teammates. Never XP, coins, perks, streak or kudos counts" actions={<Tag>Shared</Tag>}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-md border bg-background p-3">
          <Initials name={me.name} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {me.name} <span className="text-muted-foreground">· {me.loadout.title}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {me.primaryGroup.name}
              {!hideLevel && ` · Level ${me.level}`}
            </div>
          </div>
          {!hideAchievements && (
            <div className="flex gap-1">
              {bestTiers.map((t, i) => (
                <TierMedal key={i} tier={t} earned size={20} />
              ))}
            </div>
          )}
        </div>
        <div className="grid gap-2">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Hide my level <span className="text-xs text-muted-foreground">· card shows no level</span>
            </span>
            <Switch size="sm" checked={hideLevel} onCheckedChange={setHideLevel} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Hide my achievements <span className="text-xs text-muted-foreground">· no medals, ever</span>
            </span>
            <Switch size="sm" checked={hideAchievements} onCheckedChange={setHideAchievements} />
          </label>
        </div>
      </div>
    </Insight>
  );
}
