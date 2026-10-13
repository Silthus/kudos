// PROTOTYPE profile as `hedgehug profile` output: the big level line, a key-value block and the card teammates see (P65).
import { useState } from "react";
import { Switch } from "@posthog/quill";
import { HedgehogSitting } from "@posthog/brand/hoggies";
import { ladders, me } from "../../data/mock";
import type { Tier } from "../../data/types";
import { Initials, Rarity, TierMedal } from "../../ui";
import { Bar, Box, Comment, Echo, Hoggie, KeyValue, LinkText, useTerminal } from "./term";

const tierOrder: Tier[] = ["bronze", "silver", "gold", "diamond"];

const bestTiers = ladders
  .map((l) => [...l.tiers].reverse().find((t) => t.earned)?.tier)
  .filter((t): t is Tier => t !== undefined)
  .sort((a, b) => tierOrder.indexOf(b) - tierOrder.indexOf(a))
  .slice(0, 4);

export function TerminalProfile(_props: { param?: string }) {
  useTerminal();
  const [hideLevel, setHideLevel] = useState(me.privacy.hideLevel);
  const [hideAchievements, setHideAchievements] = useState(me.privacy.hideAchievements);
  const [switchedOn, setSwitchedOn] = useState<string[]>([]);
  const xpIntoLevel = me.xp - me.xpThisLevelStart;
  const xpForLevel = me.xpNextLevel - me.xpThisLevelStart;
  const percent = Math.round((xpIntoLevel / xpForLevel) * 100);
  const handle = me.name.toLowerCase().replace(" ", ".");
  const otherGroups = me.groups.filter((g) => g.id !== me.primaryGroup.id);

  return (
    <div className="hh-in flex flex-col gap-8">
      <section>
        <Echo command="hedgehug profile">private view. teammates only see the card below</Echo>
        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
          <Hoggie Hog={HedgehogSitting} size={88} caption="robin.svg" />
          <div className="min-w-0 flex-1">
            <div className="text-muted-foreground">
              {handle} · {me.loadout.title} · {me.primaryGroup.name}
              {otherGroups.length > 0 && ` (+ ${otherGroups.map((g) => g.name).join(", ")})`}
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-muted-foreground">LEVEL</span>
              <span className="text-5xl font-bold leading-none tabular-nums text-primary sm:text-6xl">{me.level}</span>
              <span className="text-muted-foreground">→ {me.level + 1}</span>
            </div>
            <div className="mt-2 text-base sm:text-lg" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to the next level">
              <Bar value={xpIntoLevel} max={xpForLevel} width={24} /> <span className="tabular-nums">{percent}%</span>
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {me.xp.toLocaleString()} / {me.xpNextLevel.toLocaleString()} XP · {(me.xpNextLevel - me.xp).toLocaleString()} XP to level {me.level + 1}
            </div>
          </div>
        </div>

        <dl className="mt-6 flex flex-col gap-1.5 border-l-2 border-border pl-4">
          <KeyValue label="skill points">
            <span className={me.skillPointsUnspent > 0 ? "font-semibold text-primary" : ""}>{me.skillPointsUnspent} unspent</span>{" "}
            {me.skillPointsUnspent > 0 && (
              <Comment>
                spend them: <LinkText href="#/skills">perks --tree</LinkText>
              </Comment>
            )}
          </KeyValue>
          <KeyValue label="coins">
            {me.coins} <Comment>from thoughtful kudos</Comment>
          </KeyValue>
          <KeyValue label="kudos today">
            <span className="tabular-nums">
              {me.kudosLeftToday} of {me.dailyAllowance}
            </span>{" "}
            <Bar value={me.kudosLeftToday} max={me.dailyAllowance} width={me.dailyAllowance} /> <Comment>refills at your midnight</Comment>
          </KeyValue>
          <KeyValue label="given">
            {me.kudosGiven} <Comment>all time</Comment>
          </KeyValue>
          <KeyValue label="received">
            {me.kudosReceived} <Comment>only you see this</Comment>
          </KeyValue>
          {!me.streak.hidden && (
            <KeyValue label="streak">
              {me.streak.days} workdays{" "}
              <Comment>
                best {me.streak.best} · {me.streak.freezesHeld} freeze held
              </Comment>
            </KeyValue>
          )}
          <KeyValue label="boosters">
            <ul className="flex flex-col">
              {me.boosters.map((b) => {
                const running = b.state === "running" || switchedOn.includes(b.name);
                return (
                  <li key={b.name} className="flex flex-wrap items-baseline gap-x-3">
                    <span>{b.name}</span>
                    {running ? (
                      <span className="text-success-foreground">running{b.endsIn ? `, ${b.endsIn} left` : ""}</span>
                    ) : (
                      <>
                        <span className="text-muted-foreground">waiting</span>
                        <LinkText onClick={() => setSwitchedOn((s) => [...s, b.name])} className="text-primary">
                          [switch on]
                        </LinkText>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </KeyValue>
          <KeyValue label="equipped">
            <ul className="flex flex-col">
              <li className="flex flex-wrap items-baseline gap-x-3">
                <LinkText href="#/collection">{me.loadout.card}</LinkText>
                <Rarity rarity="uncommon" className="text-foreground" />
                <Comment>card</Comment>
              </li>
              <li className="flex flex-wrap items-baseline gap-x-3">
                <LinkText href="#/collection">{me.loadout.title}</LinkText>
                <Comment>title</Comment>
              </li>
            </ul>
          </KeyValue>
        </dl>
      </section>

      <section>
        <Echo command="hedgehug profile --card">what teammates see</Echo>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start">
          <Box legend="profile card" className="w-full max-w-md">
            <div className="flex items-center gap-3 py-1">
              <Initials name={me.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate">
                  <span className="font-semibold">{me.name}</span> <span className="text-muted-foreground">· {me.loadout.title}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {me.primaryGroup.name}
                  {!hideLevel && ` · Level ${me.level}`}
                </div>
              </div>
              {!hideAchievements && (
                <div className="flex gap-1" aria-label="Best achievement tiers">
                  {bestTiers.map((t, i) => (
                    <TierMedal key={i} tier={t} earned size={18} />
                  ))}
                </div>
              )}
            </div>
          </Box>
          <div className="flex flex-col gap-2">
            <PrivacyFlag flag="--hide-level" on={hideLevel} onChange={setHideLevel} />
            <PrivacyFlag flag="--hide-achievements" on={hideAchievements} onChange={setHideAchievements} />
            <Comment className="text-xs">never on the card: coins, perks, streak, XP, kudos given or received.</Comment>
          </div>
        </div>
      </section>
    </div>
  );
}

function PrivacyFlag({ flag, on, onChange }: { flag: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <Switch size="sm" checked={on} onCheckedChange={onChange} />
      <span className={on ? "font-semibold" : "text-muted-foreground"}>{flag}</span>
      <span className="text-xs text-muted-foreground">{on ? "on" : "off"}</span>
    </label>
  );
}
