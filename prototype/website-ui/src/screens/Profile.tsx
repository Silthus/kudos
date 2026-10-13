// PROTOTYPE profile: the member's private overview, and the profile card teammates see (G28, P65).
import { useState } from "react";
import { Badge as Tag, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle, Progress, Separator, Switch } from "@posthog/quill";
import { ladders, me } from "../data/mock";
import type { Tier } from "../data/types";
import { HedgehogSitting, Initials, PageHeader, Rarity, Stat, TierMedal } from "../ui";

const tierOrder: Tier[] = ["bronze", "silver", "gold", "diamond"];

export function Profile(_props: { param?: string }) {
  const [hideLevel, setHideLevel] = useState(me.privacy.hideLevel);
  const [hideAchievements, setHideAchievements] = useState(me.privacy.hideAchievements);
  const levelProgress = ((me.xp - me.xpThisLevelStart) / (me.xpNextLevel - me.xpThisLevelStart)) * 100;
  const bestTiers = ladders
    .map((l) => [...l.tiers].reverse().find((t) => t.earned)?.tier)
    .filter((t): t is Tier => t !== undefined)
    .sort((a, b) => tierOrder.indexOf(b) - tierOrder.indexOf(a))
    .slice(0, 4);

  return (
    <>
      <PageHeader
        hog={HedgehogSitting}
        title={me.name}
        description={`${me.loadout.title} · ${me.primaryGroup.name}`}
        actions={
          me.skillPointsUnspent > 0 && (
            <Button variant="primary" onClick={() => (location.hash = "/skills")}>
              Spend {me.skillPointsUnspent} skill points
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-muted-foreground">Level</span>
                <span className="text-3xl font-bold tabular-nums">{me.level}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground tabular-nums">{(me.xpNextLevel - me.xp).toLocaleString()} XP</span> to level {me.level + 1}
              </span>
            </div>
            <Progress value={levelProgress} aria-label="Progress to the next level" />
            <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>{me.xp.toLocaleString()} XP</span>
              <span>{me.xpNextLevel.toLocaleString()} XP</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Kudos left today" value={`${me.kudosLeftToday} of ${me.dailyAllowance}`} hint="Refills at your midnight" />
          <Stat label="Kudos given" value={me.kudosGiven} hint="All time" />
          <Stat label="Kudos received" value={me.kudosReceived} hint="Only you see this" />
          <Stat label="Coins" value={me.coins} hint="From thoughtful kudos" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Your profile card</CardTitle>
              <CardDescription>All that teammates see of you. Never your XP, coins, perks, streak, or kudos given and received.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
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
              <Separator />
              <label className="flex items-center justify-between gap-3 text-sm">
                Hide my level
                <Switch checked={hideLevel} onCheckedChange={setHideLevel} />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                Hide my achievements
                <Switch checked={hideAchievements} onCheckedChange={setHideAchievements} />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>This week</CardTitle>
            </CardHeader>
            <CardContent>
              <ItemGroup>
                {!me.streak.hidden && (
                  <Item size="sm">
                    <ItemContent>
                      <ItemTitle>{me.streak.days} workday streak</ItemTitle>
                      <ItemDescription>
                        Best {me.streak.best} · {me.streak.freezesHeld} streak freeze held
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                )}
                {me.boosters.map((b) => (
                  <Item key={b.name} size="sm">
                    <ItemContent>
                      <ItemTitle>{b.name}</ItemTitle>
                      <ItemDescription>{b.state === "running" ? `Running, ${b.endsIn} left` : "Ready when you are"}</ItemDescription>
                    </ItemContent>
                    <ItemActions>{b.state === "running" ? <Tag variant="success">Running</Tag> : <Button variant="outline" size="sm">Switch on</Button>}</ItemActions>
                  </Item>
                ))}
                <Item size="sm">
                  <ItemContent>
                    <ItemTitle>{me.loadout.card}</ItemTitle>
                    <ItemDescription>Equipped card</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Rarity rarity="uncommon" />
                  </ItemActions>
                </Item>
              </ItemGroup>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
